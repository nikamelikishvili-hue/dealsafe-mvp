-- EVD-001/002/003: governed evidence intake, quarantine, clean-only records,
-- and case/participant metadata access. Apply after DAT-005 and the existing
-- evidence/shipping migrations.

begin;

create schema if not exists dealsafe_private;
revoke all on schema dealsafe_private from public, anon, authenticated;

create table if not exists public.evidence_upload_intakes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  uploader_role text not null check (uploader_role in ('seller', 'buyer')),
  evidence_type text not null check (
    evidence_type in (
      'seller_packing_video',
      'seller_item_photo',
      'seller_serial_number',
      'seller_package_weight',
      'buyer_unboxing_video',
      'buyer_received_photo',
      'buyer_damage_photo',
      'other'
    )
  ),
  storage_path text not null unique check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|mp4|webm|mov)$'
  ),
  original_file_name text not null check (
    char_length(original_file_name) between 1 and 160
  ),
  declared_mime_type text not null check (
    declared_mime_type in (
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    )
  ),
  declared_size_bytes bigint not null check (
    declared_size_bytes between 1 and 52428800
  ),
  status text not null default 'requested' check (
    status in (
      'requested',
      'processing',
      'finalized',
      'rejected',
      'scan_failed',
      'expired'
    )
  ),
  rejection_code text check (
    rejection_code is null
    or rejection_code ~ '^[a-z0-9_]{1,80}$'
  ),
  evidence_id uuid references public.deal_evidence(id),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (
      uploader_role = 'seller'
      and evidence_type in (
        'seller_packing_video',
        'seller_item_photo',
        'seller_serial_number',
        'seller_package_weight'
      )
    )
    or (
      uploader_role = 'buyer'
      and evidence_type in (
        'buyer_unboxing_video',
        'buyer_received_photo',
        'buyer_damage_photo',
        'other'
      )
    )
  ),
  check (expires_at > created_at and expires_at <= created_at + interval '20 minutes')
);

create index if not exists evidence_upload_intakes_user_created_idx
  on public.evidence_upload_intakes(user_id, created_at desc);
create index if not exists evidence_upload_intakes_expiry_idx
  on public.evidence_upload_intakes(expires_at)
  where status = 'requested';

alter table public.evidence_upload_intakes enable row level security;
revoke all on table public.evidence_upload_intakes
  from public, anon, authenticated;
revoke update, delete, truncate, trigger
  on table public.evidence_upload_intakes
  from service_role;
grant select, insert, update
  on table public.evidence_upload_intakes
  to service_role;

alter table public.deal_evidence
  add column if not exists detected_mime_type text,
  add column if not exists scan_status text not null default 'legacy_unscanned',
  add column if not exists scan_provider text,
  add column if not exists scan_reference text,
  add column if not exists scanned_at timestamptz;

alter table public.deal_evidence
  drop constraint if exists deal_evidence_scan_status_check;
alter table public.deal_evidence
  add constraint deal_evidence_scan_status_check
  check (scan_status in ('clean', 'legacy_unscanned'));

alter table public.deal_evidence
  drop constraint if exists deal_evidence_clean_scan_contract;
alter table public.deal_evidence
  add constraint deal_evidence_clean_scan_contract
  check (
    scan_status <> 'clean'
    or (
      detected_mime_type in (
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime'
      )
      and sha256 ~ '^[0-9a-f]{64}$'
      and scan_provider is not null
      and scan_reference is not null
      and scanned_at is not null
    )
  );

create table if not exists public.evidence_file_access_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.deal_evidence(id),
  deal_id uuid not null references public.deals(id),
  accessed_by uuid not null references public.profiles(id),
  access_reason text not null check (
    access_reason in ('participant', 'dispute_case')
  ),
  signed_url_expires_at timestamptz not null,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (
    signed_url_expires_at > created_at
    and signed_url_expires_at <= created_at + interval '90 seconds'
  )
);

create index if not exists evidence_file_access_events_deal_created_idx
  on public.evidence_file_access_events(deal_id, created_at desc);
create index if not exists evidence_file_access_events_actor_created_idx
  on public.evidence_file_access_events(accessed_by, created_at desc);

alter table public.evidence_file_access_events enable row level security;
revoke all on table public.evidence_file_access_events
  from public, anon, authenticated;
revoke update, delete, truncate, trigger
  on table public.evidence_file_access_events
  from service_role;
grant select, insert
  on table public.evidence_file_access_events
  to service_role;

drop trigger if exists evidence_file_access_events_reject_update_delete
  on public.evidence_file_access_events;
create trigger evidence_file_access_events_reject_update_delete
before update or delete on public.evidence_file_access_events
for each row
execute function public.reject_audit_event_mutation();

drop trigger if exists evidence_file_access_events_reject_truncate
  on public.evidence_file_access_events;
create trigger evidence_file_access_events_reject_truncate
before truncate on public.evidence_file_access_events
for each statement
execute function public.reject_audit_event_mutation();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'deal-evidence-quarantine',
  'deal-evidence-quarantine',
  false,
  52428800,
  array[
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]
where id = 'deal-evidence';

create or replace function dealsafe_private.can_upload_evidence_quarantine(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evidence_upload_intakes as intake
    where intake.storage_path = p_storage_path
      and intake.user_id = (select auth.uid())
      and intake.status = 'requested'
      and intake.expires_at > pg_catalog.now()
      and (storage.foldername(p_storage_path))[1] =
        (select auth.uid())::text
      and (storage.foldername(p_storage_path))[2] =
        intake.deal_id::text
  );
$$;

revoke all on function dealsafe_private.can_upload_evidence_quarantine(text)
  from public, anon, authenticated, service_role;
grant execute on function dealsafe_private.can_upload_evidence_quarantine(text)
  to authenticated;

drop policy if exists "participants upload deal evidence files"
  on storage.objects;
drop policy if exists "participants read deal evidence files"
  on storage.objects;
drop policy if exists "participants and admins read deal evidence files"
  on storage.objects;
drop policy if exists "approved evidence quarantine upload"
  on storage.objects;

create policy "approved evidence quarantine upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'deal-evidence-quarantine'
  and (
    select dealsafe_private.can_upload_evidence_quarantine(name)
  )
);

drop policy if exists "participants read deal evidence"
  on public.deal_evidence;
drop policy if exists "participants and admins read deal evidence"
  on public.deal_evidence;
drop policy if exists "participants upload deal evidence"
  on public.deal_evidence;
drop policy if exists "participants and case admins read safe evidence"
  on public.deal_evidence;

create policy "participants and case admins read safe evidence"
on public.deal_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.deals as deal
    where deal.id = deal_evidence.deal_id
      and (
        deal.seller_id = (select auth.uid())
        or deal.buyer_id = (select auth.uid())
      )
  )
  or (
    (select public.is_dealsafe_admin())
    and exists (
      select 1
      from public.deal_disputes as dispute
      where dispute.deal_id = deal_evidence.deal_id
    )
  )
);

revoke all on table public.deal_evidence
  from public, anon, authenticated;
grant select (
  id,
  deal_id,
  dispute_id,
  uploader_role,
  evidence_type,
  file_name,
  mime_type,
  detected_mime_type,
  file_size_bytes,
  sha256,
  scan_status,
  scanned_at,
  created_at
) on table public.deal_evidence
to authenticated;
grant select, insert on table public.deal_evidence to service_role;

drop view if exists public.deal_evidence_safe;
create view public.deal_evidence_safe
with (security_invoker = true, security_barrier = true)
as
select
  evidence.id,
  evidence.deal_id,
  evidence.dispute_id,
  evidence.uploader_role,
  evidence.evidence_type,
  evidence.file_name,
  evidence.mime_type,
  evidence.detected_mime_type,
  evidence.file_size_bytes,
  evidence.sha256,
  evidence.scan_status,
  evidence.scanned_at,
  evidence.created_at
from public.deal_evidence as evidence;

revoke all on table public.deal_evidence_safe
  from public, anon, authenticated;
grant select on table public.deal_evidence_safe
  to authenticated;

-- Shipping readiness and dispatch snapshots may only use clean evidence.
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
          nullif(pg_catalog.btrim(evidence.detected_mime_type), ''),
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
      and evidence.scan_status = 'clean'
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
      and effective_mime_type in (
        'video/mp4',
        'video/webm',
        'video/quicktime'
      )
    ) or (
      evidence_type in (
        'seller_item_photo',
        'seller_package_weight',
        'seller_serial_number'
      )
      and effective_mime_type = 'image/webp'
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

comment on table public.evidence_upload_intakes is
  'Short-lived server-approved paths for untrusted evidence quarantine uploads.';
comment on table public.evidence_file_access_events is
  'Append-only log of participant or dispute-case signed evidence access.';
comment on view public.deal_evidence_safe is
  'Participant/case-scoped evidence metadata with storage paths and scanner internals removed.';

notify pgrst, 'reload schema';

commit;
