-- DAT-005 production verification.
-- This suite creates one transaction-local probe event and proves that update,
-- delete, and truncate are rejected before rolling the probe back.

begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

do $$
declare
  column_type text;
  column_nullable text;
  column_default text;
  trigger_count integer;
  mutation_policy_count integer;
  correlation_index_count integer;
begin
  select data_type, is_nullable, column_default
  into column_type, column_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'audit_events'
    and column_name = 'correlation_id';

  if column_type is distinct from 'uuid'
    or column_nullable is distinct from 'NO'
    or column_default not like '%gen_random_uuid()%'
  then
    raise exception 'DAT-005 correlation column contract changed';
  end if;

  if exists (
    select 1
    from public.audit_events
    where correlation_id is null
  ) then
    raise exception 'DAT-005 found an audit event without a correlation ID';
  end if;

  select count(*)
  into correlation_index_count
  from pg_index index_record
  join pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  where index_record.indrelid = 'public.audit_events'::regclass
    and index_relation.relname = 'audit_events_correlation_idx'
    and index_record.indisvalid
    and index_record.indisready
    and pg_get_indexdef(index_record.indexrelid)
      like '%USING btree (correlation_id)%';

  if correlation_index_count <> 1 then
    raise exception 'DAT-005 correlation index contract changed';
  end if;

  select count(*)
  into trigger_count
  from pg_trigger
  where tgrelid = 'public.audit_events'::regclass
    and not tgisinternal
    and tgenabled = 'O'
    and tgname in (
      'audit_events_reject_update_delete',
      'audit_events_reject_truncate'
    );

  if trigger_count <> 2 then
    raise exception 'DAT-005 append-only trigger inventory changed';
  end if;

  select count(*)
  into mutation_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'audit_events'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

  if mutation_policy_count <> 0 then
    raise exception 'DAT-005 audit table gained a direct mutation policy';
  end if;

  if has_table_privilege('anon', 'public.audit_events', 'INSERT')
    or has_table_privilege('anon', 'public.audit_events', 'UPDATE')
    or has_table_privilege('anon', 'public.audit_events', 'DELETE')
    or has_table_privilege('anon', 'public.audit_events', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.audit_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.audit_events', 'DELETE')
    or has_table_privilege('authenticated', 'public.audit_events', 'TRUNCATE')
  then
    raise exception 'DAT-005 ordinary roles gained direct audit mutation privileges';
  end if;

  if not has_table_privilege('service_role', 'public.audit_events', 'SELECT')
    or not has_table_privilege('service_role', 'public.audit_events', 'INSERT')
    or has_table_privilege('service_role', 'public.audit_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.audit_events', 'DELETE')
    or has_table_privilege('service_role', 'public.audit_events', 'TRUNCATE')
  then
    raise exception 'DAT-005 service-role append-only privileges changed';
  end if;

  if has_function_privilege(
    'public',
    'public.reject_audit_event_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.reject_audit_event_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reject_audit_event_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.reject_audit_event_mutation()',
    'EXECUTE'
  ) then
    raise exception 'DAT-005 trigger helper became directly executable';
  end if;
end;
$$;

do $$
declare
  probe_deal_id uuid;
  probe_actor_id uuid;
  probe_event_id bigint;
  probe_correlation_id uuid;
begin
  select deal_id, actor_id
  into probe_deal_id, probe_actor_id
  from public.audit_events
  where deal_id is not null
    and actor_id is not null
  order by id
  limit 1;

  if probe_deal_id is null or probe_actor_id is null then
    raise exception 'DAT-005 requires one existing audit relationship for rollback proof';
  end if;

  insert into public.audit_events (
    deal_id,
    actor_id,
    event_type,
    metadata
  )
  values (
    probe_deal_id,
    probe_actor_id,
    'dat005_rollback_probe',
    jsonb_build_object('rollback_probe', true)
  )
  returning id, correlation_id
  into probe_event_id, probe_correlation_id;

  if probe_correlation_id is null then
    raise exception 'DAT-005 new event did not receive a correlation ID';
  end if;

  begin
    update public.audit_events
    set metadata = jsonb_build_object('tampered', true)
    where id = probe_event_id;
    raise exception 'DAT-005 UPDATE unexpectedly succeeded';
  exception
    when sqlstate '55000' then
      null;
  end;

  begin
    delete from public.audit_events
    where id = probe_event_id;
    raise exception 'DAT-005 DELETE unexpectedly succeeded';
  exception
    when sqlstate '55000' then
      null;
  end;

  begin
    execute 'truncate table public.audit_events';
    raise exception 'DAT-005 TRUNCATE unexpectedly succeeded';
  exception
    when sqlstate '55000' then
      null;
  end;

  if not exists (
    select 1
    from public.audit_events
    where id = probe_event_id
      and correlation_id = probe_correlation_id
      and metadata = jsonb_build_object('rollback_probe', true)
  ) then
    raise exception 'DAT-005 immutable probe changed after blocked mutation attempts';
  end if;
end;
$$;

rollback;
