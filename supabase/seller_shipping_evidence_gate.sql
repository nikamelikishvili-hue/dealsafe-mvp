begin;

-- Keep storage-level evidence validation outside the public API surface.
create schema if not exists dealsafe_private;
revoke all on schema dealsafe_private from public, anon, authenticated;

-- This helper is the single validation authority used by both readiness and
-- the immutable dispatch snapshot. A storage object and its client integrity
-- digest can count for exactly one evidence category. The server-owned object
-- id and timestamps are also captured in the dispatch audit record.
create or replace function dealsafe_private.valid_seller_shipping_evidence(
  p_deal_id uuid,
  p_seller_id uuid
)
returns table (
  evidence_id uuid,
  evidence_type text,
  storage_path text,
  sha256 text,
  evidence_created_at timestamptz,
  storage_object_id uuid,
  storage_created_at timestamptz,
  storage_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidate_evidence as (
    select
      evidence.id as evidence_id,
      evidence.evidence_type,
      evidence.storage_path,
      pg_catalog.lower(pg_catalog.btrim(evidence.sha256)) as sha256,
      evidence.created_at as evidence_created_at,
      stored_object.id as storage_object_id,
      stored_object.created_at as storage_created_at,
      stored_object.updated_at as storage_updated_at,
      pg_catalog.lower(
        coalesce(
          nullif(pg_catalog.btrim(stored_object.metadata ->> 'mimetype'), ''),
          nullif(pg_catalog.btrim(stored_object.metadata ->> 'contentType'), ''),
          nullif(pg_catalog.btrim(stored_object.metadata ->> 'content-type'), ''),
          nullif(pg_catalog.btrim(stored_object.metadata ->> 'content_type'), ''),
          nullif(pg_catalog.btrim(evidence.mime_type), ''),
          ''
        )
      ) as effective_mime_type
    from public.deal_evidence as evidence
    inner join storage.objects as stored_object
      on stored_object.bucket_id = 'deal-evidence'
     and stored_object.name = evidence.storage_path
    where evidence.deal_id = p_deal_id
      and evidence.uploaded_by = p_seller_id
      and evidence.uploader_role = 'seller'
      and evidence.dispute_id is null
      and evidence.evidence_type in (
        'seller_item_photo',
        'seller_packing_video',
        'seller_package_weight',
        'seller_serial_number'
      )
      and (storage.foldername(stored_object.name))[1] = p_seller_id::text
      and (storage.foldername(stored_object.name))[2] = p_deal_id::text
      and pg_catalog.lower(pg_catalog.btrim(coalesce(evidence.sha256, '')))
        ~ '^[0-9a-f]{64}$'
  ),
  valid_format as (
    select *
    from candidate_evidence
    where (
      evidence_type = 'seller_packing_video'
      and effective_mime_type like 'video/%'
    ) or (
      evidence_type in (
        'seller_item_photo',
        'seller_package_weight',
        'seller_serial_number'
      )
      and effective_mime_type like 'image/%'
    )
  ),
  single_purpose_paths as (
    select storage_path
    from valid_format
    group by storage_path
    having pg_catalog.count(distinct evidence_type) = 1
  ),
  single_purpose_digests as (
    select sha256
    from valid_format
    group by sha256
    having pg_catalog.count(distinct evidence_type) = 1
  ),
  ranked_evidence as (
    select
      valid_format.*,
      pg_catalog.row_number() over (
        partition by valid_format.evidence_type
        order by
          valid_format.evidence_created_at,
          valid_format.evidence_id
      ) as category_rank
    from valid_format
    inner join single_purpose_paths
      on single_purpose_paths.storage_path = valid_format.storage_path
    inner join single_purpose_digests
      on single_purpose_digests.sha256 = valid_format.sha256
  )
  select
    ranked_evidence.evidence_id,
    ranked_evidence.evidence_type,
    ranked_evidence.storage_path,
    ranked_evidence.sha256,
    ranked_evidence.evidence_created_at,
    ranked_evidence.storage_object_id,
    ranked_evidence.storage_created_at,
    ranked_evidence.storage_updated_at
  from ranked_evidence
  where ranked_evidence.category_rank = 1;
$$;

revoke all on function dealsafe_private.valid_seller_shipping_evidence(
  uuid,
  uuid
) from public, anon, authenticated;

create or replace function dealsafe_private.seller_shipping_evidence_readiness(
  p_deal_id uuid,
  p_seller_id uuid,
  p_serial_required boolean
)
returns table (
  item_photo_ready boolean,
  packing_video_ready boolean,
  package_weight_ready boolean,
  serial_required boolean,
  serial_photo_ready boolean,
  distinct_files_ready boolean,
  ready boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with evidence_flags as (
    select
      coalesce(
        pg_catalog.bool_or(evidence.evidence_type = 'seller_item_photo'),
        false
      ) as item_photo_ready,
      coalesce(
        pg_catalog.bool_or(evidence.evidence_type = 'seller_packing_video'),
        false
      ) as packing_video_ready,
      coalesce(
        pg_catalog.bool_or(evidence.evidence_type = 'seller_package_weight'),
        false
      ) as package_weight_ready,
      coalesce(
        pg_catalog.bool_or(evidence.evidence_type = 'seller_serial_number'),
        false
      ) as serial_photo_ready,
      (
        pg_catalog.count(distinct evidence.storage_object_id) >=
          (3 + case when p_serial_required then 1 else 0 end)
        and pg_catalog.count(distinct evidence.sha256) >=
          (3 + case when p_serial_required then 1 else 0 end)
      )
        as distinct_files_ready
    from dealsafe_private.valid_seller_shipping_evidence(
      p_deal_id,
      p_seller_id
    ) as evidence
  )
  select
    evidence_flags.item_photo_ready,
    evidence_flags.packing_video_ready,
    evidence_flags.package_weight_ready,
    p_serial_required as serial_required,
    evidence_flags.serial_photo_ready,
    evidence_flags.distinct_files_ready,
    (
      evidence_flags.item_photo_ready
      and evidence_flags.packing_video_ready
      and evidence_flags.package_weight_ready
      and (not p_serial_required or evidence_flags.serial_photo_ready)
      and evidence_flags.distinct_files_ready
    ) as ready
  from evidence_flags;
$$;

revoke all on function dealsafe_private.seller_shipping_evidence_readiness(
  uuid,
  uuid,
  boolean
) from public, anon, authenticated;

-- Participants can see readiness flags, but never private object paths or file
-- metadata through this RPC.
drop function if exists public.get_seller_shipping_evidence_readiness(uuid);
create function public.get_seller_shipping_evidence_readiness(p_deal_id uuid)
returns table (
  item_photo_ready boolean,
  packing_video_ready boolean,
  package_weight_ready boolean,
  serial_required boolean,
  serial_photo_ready boolean,
  distinct_files_ready boolean,
  ready boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    readiness.item_photo_ready,
    readiness.packing_video_ready,
    readiness.package_weight_ready,
    readiness.serial_required,
    readiness.serial_photo_ready,
    readiness.distinct_files_ready,
    readiness.ready
  from public.deals as deal
  cross join lateral dealsafe_private.seller_shipping_evidence_readiness(
    deal.id,
    deal.seller_id,
    nullif(
      pg_catalog.btrim(coalesce(deal.serial_last_four, '')),
      ''
    ) is not null
  ) as readiness
  where auth.uid() is not null
    and deal.id = p_deal_id
    and auth.uid() in (deal.seller_id, deal.buyer_id)
    and deal.delivery_method = 'Ship to buyer'
    and deal.status in ('accepted', 'completed', 'disputed');
$$;

revoke all on function public.get_seller_shipping_evidence_readiness(uuid)
  from public, anon, authenticated;
grant execute on function public.get_seller_shipping_evidence_readiness(uuid)
  to authenticated;

-- This is the final create_deal_shipment override. Shipping is blocked until
-- the buyer address, protected card payment, and seller evidence are ready.
create or replace function public.create_deal_shipment(
  p_deal_id uuid,
  p_carrier text,
  p_tracking_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deals%rowtype;
  v_serial_required boolean;
  v_evidence_ready boolean;
  v_evidence_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select deal.*
  into v_deal
  from public.deals as deal
  where deal.id = p_deal_id
  for update;

  if not found
    or v_deal.seller_id <> auth.uid()
    or v_deal.status <> 'accepted'
    or v_deal.delivery_method <> 'Ship to buyer'
  then
    raise exception 'Shipment is unavailable for this deal';
  end if;

  if not exists (
    select 1
    from public.deal_delivery_details as delivery
    where delivery.deal_id = p_deal_id
      and delivery.buyer_id = v_deal.buyer_id
  ) then
    raise exception 'Buyer delivery address is required before shipping';
  end if;

  perform payment.id
    from public.protected_payments as payment
    where payment.deal_id = p_deal_id
      and payment.seller_id = v_deal.seller_id
      and payment.buyer_id = v_deal.buyer_id
      and payment.item_amount_cents = v_deal.price_cents
      and payment.currency =
        pg_catalog.upper(pg_catalog.btrim(v_deal.currency::text))
      and payment.status = 'funds_secured'
    for update;

  if not found then
    raise exception 'Protected card payment must be secured before shipping';
  end if;

  v_serial_required := nullif(
    pg_catalog.btrim(coalesce(v_deal.serial_last_four, '')),
    ''
  ) is not null;

  -- Read readiness and the immutable dispatch snapshot from one materialized
  -- evidence set. This prevents a concurrent evidence change from making the
  -- readiness result disagree with the audit record.
  with valid_evidence as materialized (
    select *
    from dealsafe_private.valid_seller_shipping_evidence(
      p_deal_id,
      v_deal.seller_id
    )
  ),
  evidence_summary as (
    select
      coalesce(
        pg_catalog.bool_or(
          evidence.evidence_type = 'seller_item_photo'
        ),
        false
      ) as item_photo_ready,
      coalesce(
        pg_catalog.bool_or(
          evidence.evidence_type = 'seller_packing_video'
        ),
        false
      ) as packing_video_ready,
      coalesce(
        pg_catalog.bool_or(
          evidence.evidence_type = 'seller_package_weight'
        ),
        false
      ) as package_weight_ready,
      coalesce(
        pg_catalog.bool_or(
          evidence.evidence_type = 'seller_serial_number'
        ),
        false
      ) as serial_photo_ready,
      (
        pg_catalog.count(distinct evidence.storage_object_id) >=
          (3 + case when v_serial_required then 1 else 0 end)
        and pg_catalog.count(distinct evidence.sha256) >=
          (3 + case when v_serial_required then 1 else 0 end)
      ) as distinct_files_ready,
      coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'evidence_id',
            evidence.evidence_id,
            'evidence_type',
            evidence.evidence_type,
            'sha256',
            evidence.sha256,
            'created_at',
            evidence.evidence_created_at,
            'storage_object_id',
            evidence.storage_object_id,
            'storage_created_at',
            evidence.storage_created_at,
            'storage_updated_at',
            evidence.storage_updated_at
          )
          order by evidence.evidence_created_at
        ),
        '[]'::jsonb
      ) as evidence_snapshot
    from valid_evidence as evidence
  )
  select
    (
      summary.item_photo_ready
      and summary.packing_video_ready
      and summary.package_weight_ready
      and (not v_serial_required or summary.serial_photo_ready)
      and summary.distinct_files_ready
    ),
    summary.evidence_snapshot
  into
    v_evidence_ready,
    v_evidence_snapshot
  from evidence_summary as summary;

  if not coalesce(v_evidence_ready, false) then
    raise exception 'Required seller shipping evidence is incomplete';
  end if;

  if pg_catalog.char_length(
    coalesce(pg_catalog.btrim(p_carrier), '')
  ) < 2
    or pg_catalog.char_length(
      coalesce(pg_catalog.btrim(p_tracking_number), '')
    ) < 4
  then
    raise exception 'Carrier and tracking number are required';
  end if;

  insert into public.deal_shipments (
    deal_id,
    carrier,
    tracking_number
  )
  values (
    p_deal_id,
    pg_catalog.btrim(p_carrier),
    pg_catalog.btrim(p_tracking_number)
  )
  on conflict (deal_id) do update
  set carrier = excluded.carrier,
      tracking_number = excluded.tracking_number,
      status = 'shipped',
      shipped_at = pg_catalog.now(),
      delivered_at = null,
      updated_at = pg_catalog.now();

  insert into public.audit_events (
    deal_id,
    actor_id,
    event_type,
    metadata
  )
  values (
    p_deal_id,
    auth.uid(),
    'item_shipped',
    pg_catalog.jsonb_build_object(
      'seller_evidence_snapshot',
      v_evidence_snapshot
    )
  );
end;
$$;

revoke all on function public.create_deal_shipment(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_deal_shipment(uuid, text, text)
  to authenticated;

commit;
