-- Rollback-only EVD-004 integrity inventory and authorization proof.

begin;

do $evd004_schema_inventory$
declare
  view_options text[];
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deal_evidence'
      and column_name = 'integrity_status'
  )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'deal_evidence'
        and column_name = 'integrity_checked_at'
    ) then
    raise exception 'EVD-004 evidence integrity inventory columns are missing';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.evidence_integrity_events',
    'SELECT'
  )
    or not has_table_privilege(
      'service_role',
      'public.evidence_integrity_events',
      'INSERT'
    )
    or has_table_privilege(
      'service_role',
      'public.evidence_integrity_events',
      'UPDATE'
    )
    or has_function_privilege(
      'authenticated',
      'public.record_evidence_integrity_result(uuid,uuid,boolean,boolean,text,bigint,text,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.record_evidence_integrity_result(uuid,uuid,boolean,boolean,text,bigint,text,uuid)',
      'EXECUTE'
    ) then
    raise exception 'EVD-004 integrity grants changed';
  end if;

  if (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.evidence_integrity_events'::regclass
      and not tgisinternal
      and tgname in (
        'evidence_integrity_events_reject_update_delete',
        'evidence_integrity_events_reject_truncate'
      )
  ) <> 2 then
    raise exception 'EVD-004 append-only integrity triggers changed';
  end if;

  select relation.reloptions
  into view_options
  from pg_class as relation
  join pg_namespace as namespace_record
    on namespace_record.oid = relation.relnamespace
  where namespace_record.nspname = 'public'
    and relation.relname = 'deal_evidence_safe';

  if view_options is null
     or not ('security_invoker=true' = any(view_options))
     or not ('security_barrier=true' = any(view_options))
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'deal_evidence_safe'
         and column_name = 'integrity_status'
     )
     or exists (
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
    raise exception 'EVD-004 safe integrity projection changed';
  end if;
end
$evd004_schema_inventory$;

do $evd004_fixture$
declare
  target_evidence_id uuid;
  target_deal_id uuid;
  target_actor_id uuid;
begin
  select
    evidence.id,
    evidence.deal_id,
    deal.seller_id
  into
    target_evidence_id,
    target_deal_id,
    target_actor_id
  from public.deal_evidence as evidence
  join public.deals as deal
    on deal.id = evidence.deal_id
  order by evidence.created_at desc
  limit 1;

  if target_evidence_id is null
     or target_deal_id is null
     or target_actor_id is null then
    raise exception 'EVD-004 production integrity fixture is incomplete';
  end if;

  update public.deal_evidence
  set
    mime_type = 'image/webp',
    detected_mime_type = 'image/webp',
    file_size_bytes = 123,
    sha256 = repeat('a', 64),
    scan_status = 'clean',
    scan_provider = 'rollback-fixture',
    scan_reference = 'rollback-fixture',
    scanned_at = now(),
    integrity_status = 'unverified',
    integrity_checked_at = null
  where id = target_evidence_id;

  perform set_config('evd004.evidence_id', target_evidence_id::text, true);
  perform set_config('evd004.deal_id', target_deal_id::text, true);
  perform set_config('evd004.actor_id', target_actor_id::text, true);
end
$evd004_fixture$;

set local role service_role;

do $evd004_service_results$
declare
  target_evidence_id uuid := current_setting('evd004.evidence_id')::uuid;
  target_deal_id uuid := current_setting('evd004.deal_id')::uuid;
  target_actor_id uuid := current_setting('evd004.actor_id')::uuid;
  recorded_status text;
  recorded_at timestamptz;
begin
  select result.integrity_status, result.integrity_checked_at
  into recorded_status, recorded_at
  from public.record_evidence_integrity_result(
    target_evidence_id,
    target_actor_id,
    true,
    true,
    repeat('a', 64),
    123,
    'image/webp',
    gen_random_uuid()
  ) as result;

  if recorded_status <> 'verified'
     or recorded_at is null
     or not exists (
       select 1
       from public.deal_evidence as evidence
       where evidence.id = target_evidence_id
         and evidence.integrity_status = 'verified'
         and evidence.integrity_checked_at = recorded_at
     )
     or not exists (
       select 1
       from public.evidence_integrity_events as event
       where event.evidence_id = target_evidence_id
         and event.deal_id = target_deal_id
         and event.checked_by = target_actor_id
         and event.result = 'verified'
         and event.expected_sha256 = repeat('a', 64)
         and event.observed_sha256 = repeat('a', 64)
     ) then
    raise exception 'EVD-004 matching bytes were not recorded as verified';
  end if;

  select result.integrity_status
  into recorded_status
  from public.record_evidence_integrity_result(
    target_evidence_id,
    target_actor_id,
    true,
    true,
    repeat('b', 64),
    123,
    'image/webp',
    gen_random_uuid()
  ) as result;

  if recorded_status <> 'mismatch'
     or not exists (
       select 1
       from public.deal_evidence as evidence
       where evidence.id = target_evidence_id
         and evidence.integrity_status = 'mismatch'
         and evidence.integrity_checked_at is not null
     )
     or (
       select count(*)
       from public.evidence_integrity_events as event
       where event.evidence_id = target_evidence_id
     ) <> 2 then
    raise exception 'EVD-004 digest mismatch did not fail closed';
  end if;
end
$evd004_service_results$;

reset role;

do $evd004_event_immutability$
declare
  target_evidence_id uuid := current_setting('evd004.evidence_id')::uuid;
begin
  begin
    update public.evidence_integrity_events
    set observed_size_bytes = 999
    where evidence_id = target_evidence_id;
    raise exception 'EVD-004 integrity history was mutable';
  exception
    when others then
      if sqlerrm = 'EVD-004 integrity history was mutable' then
        raise;
      end if;
  end;
end
$evd004_event_immutability$;

rollback;
