-- Rollback-only EVD-001/002/003 database and authorization proof.
-- Safe for production: the only case fixture is transaction-local.

begin;

do $evd_schema_inventory$
declare
  final_bucket record;
  quarantine_bucket record;
  view_options text[];
begin
  select * into final_bucket
  from storage.buckets
  where id = 'deal-evidence';
  select * into quarantine_bucket
  from storage.buckets
  where id = 'deal-evidence-quarantine';

  if final_bucket.public
     or quarantine_bucket.public
     or final_bucket.file_size_limit <> 52428800
     or quarantine_bucket.file_size_limit <> 52428800
     or final_bucket.allowed_mime_types is distinct from array[
       'image/webp',
       'video/mp4',
       'video/webm',
       'video/quicktime'
     ]::text[]
     or quarantine_bucket.allowed_mime_types
       is distinct from final_bucket.allowed_mime_types then
    raise exception 'EVD-001 bucket allowlist or privacy contract changed';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname in (
        'participants upload deal evidence files',
        'participants read deal evidence files',
        'participants and admins read deal evidence files'
      )
  ) then
    raise exception 'EVD-003 final evidence bucket regained direct browser access';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname = 'approved evidence quarantine upload'
      and policy.cmd = 'INSERT'
      and policy.roles = array['authenticated']::name[]
      and position(
        'deal-evidence-quarantine'
        in coalesce(policy.with_check, '')
      ) > 0
      and position(
        'can_upload_evidence_quarantine'
        in coalesce(policy.with_check, '')
      ) > 0
  ) then
    raise exception 'EVD-001 quarantine upload policy changed';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.deal_evidence',
    'INSERT'
  )
    or has_column_privilege(
      'authenticated',
      'public.deal_evidence',
      'storage_path',
      'SELECT'
    )
    or not has_column_privilege(
      'authenticated',
      'public.deal_evidence',
      'scan_status',
      'SELECT'
    ) then
    raise exception 'EVD-003 evidence column or write grants changed';
  end if;

  select relation.reloptions
  into view_options
  from pg_class relation
  join pg_namespace namespace_record
    on namespace_record.oid = relation.relnamespace
  where namespace_record.nspname = 'public'
    and relation.relname = 'deal_evidence_safe';
  if view_options is null
     or not ('security_invoker=true' = any(view_options))
     or not ('security_barrier=true' = any(view_options)) then
    raise exception 'EVD-003 safe evidence view is not invoker-secured';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deal_evidence_safe'
      and column_name in (
        'storage_path',
        'uploaded_by',
        'metadata',
        'scan_provider',
        'scan_reference'
      )
  ) then
    raise exception 'EVD-003 safe evidence view exposes restricted fields';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.evidence_upload_intakes',
    'SELECT'
  )
    or has_table_privilege(
      'authenticated',
      'public.evidence_file_access_events',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'public.evidence_file_access_events',
      'INSERT'
    )
    or has_table_privilege(
      'service_role',
      'public.evidence_file_access_events',
      'UPDATE'
    ) then
    raise exception 'EVD-003 intake or access-log grants changed';
  end if;

  if (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.evidence_file_access_events'::regclass
      and not tgisinternal
      and tgname in (
        'evidence_file_access_events_reject_update_delete',
        'evidence_file_access_events_reject_truncate'
      )
  ) <> 2 then
    raise exception 'EVD-003 append-only access-log triggers changed';
  end if;
end
$evd_schema_inventory$;

do $evd_context$
declare
  target_evidence_id uuid;
  target_deal_id uuid;
  target_seller_id uuid;
  target_buyer_id uuid;
  target_outsider_id uuid;
  target_admin_id uuid;
begin
  select
    evidence.id,
    deal.id,
    deal.seller_id,
    deal.buyer_id,
    outsider.id,
    administrator.id
  into
    target_evidence_id,
    target_deal_id,
    target_seller_id,
    target_buyer_id,
    target_outsider_id,
    target_admin_id
  from public.deal_evidence evidence
  join public.deals deal on deal.id = evidence.deal_id
  join lateral (
    select profile.id
    from public.profiles profile
    where profile.app_role <> 'admin'
      and profile.id not in (deal.seller_id, deal.buyer_id)
    order by profile.created_at
    limit 1
  ) outsider on true
  join lateral (
    select profile.id
    from public.profiles profile
    where profile.app_role = 'admin'
    order by profile.created_at
    limit 1
  ) administrator on true
  where deal.buyer_id is not null
  order by evidence.created_at desc
  limit 1;

  if target_evidence_id is null
     or target_deal_id is null
     or target_seller_id is null
     or target_buyer_id is null
     or target_outsider_id is null
     or target_admin_id is null then
    raise exception 'EVD-003 production authorization fixture is incomplete';
  end if;

  if not exists (
    select 1
    from public.deal_disputes dispute
    where dispute.deal_id = target_deal_id
  ) then
    insert into public.deal_disputes (
      deal_id,
      opened_by,
      reason,
      status
    )
    values (
      target_deal_id,
      target_seller_id,
      'Rollback-only EVD case authorization fixture',
      'cancelled'
    );
  end if;

  perform set_config('evd.evidence_id', target_evidence_id::text, true);
  perform set_config('evd.seller_id', target_seller_id::text, true);
  perform set_config('evd.buyer_id', target_buyer_id::text, true);
  perform set_config('evd.outsider_id', target_outsider_id::text, true);
  perform set_config('evd.admin_id', target_admin_id::text, true);
end
$evd_context$;

set local role authenticated;

do $evd_authorization_matrix$
declare
  target_evidence_id uuid := current_setting('evd.evidence_id')::uuid;
  target_seller_id uuid := current_setting('evd.seller_id')::uuid;
  target_buyer_id uuid := current_setting('evd.buyer_id')::uuid;
  target_outsider_id uuid := current_setting('evd.outsider_id')::uuid;
  target_admin_id uuid := current_setting('evd.admin_id')::uuid;
  visible boolean;
begin
  perform set_config('request.jwt.claim.sub', target_seller_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_seller_id, 'role', 'authenticated')::text,
    true
  );
  select exists (
    select 1 from public.deal_evidence_safe
    where id = target_evidence_id
  ) into visible;
  if not visible then
    raise exception 'EVD-003 seller lost participant evidence metadata access';
  end if;

  perform set_config('request.jwt.claim.sub', target_buyer_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_buyer_id, 'role', 'authenticated')::text,
    true
  );
  select exists (
    select 1 from public.deal_evidence_safe
    where id = target_evidence_id
  ) into visible;
  if not visible then
    raise exception 'EVD-003 buyer lost participant evidence metadata access';
  end if;

  perform set_config('request.jwt.claim.sub', target_outsider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_outsider_id, 'role', 'authenticated')::text,
    true
  );
  select exists (
    select 1 from public.deal_evidence_safe
    where id = target_evidence_id
  ) into visible;
  if visible then
    raise exception 'EVD-003 outsider read another deal evidence record';
  end if;

  perform set_config('request.jwt.claim.sub', target_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_admin_id, 'role', 'authenticated')::text,
    true
  );
  select exists (
    select 1 from public.deal_evidence_safe
    where id = target_evidence_id
  ) into visible;
  if not visible then
    raise exception 'EVD-003 administrator lost dispute-case metadata access';
  end if;
end
$evd_authorization_matrix$;

rollback;
