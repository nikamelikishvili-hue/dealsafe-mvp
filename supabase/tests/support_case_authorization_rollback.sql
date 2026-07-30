-- Rollback-only OPS-001 / OPS-002 support-case authorization proof.
-- Run after support_case_setup.sql in the governed verification environment.

begin;

do $support_storage_boundary$
declare
  case_table oid := 'public.support_cases'::regclass::oid;
  message_table oid := 'public.support_case_messages'::regclass::oid;
begin
  if not (select relrowsecurity from pg_class where oid = case_table)
     or not (select relrowsecurity from pg_class where oid = message_table)
     or has_table_privilege('public', case_table, 'select')
     or has_table_privilege('anon', case_table, 'select')
     or has_table_privilege('authenticated', case_table, 'select')
     or has_table_privilege('public', message_table, 'select')
     or has_table_privilege('anon', message_table, 'select')
     or has_table_privilege('authenticated', message_table, 'select')
     or has_table_privilege('authenticated', case_table, 'insert')
     or has_table_privilege('authenticated', message_table, 'insert') then
    raise exception 'Support tables are not deny-by-default';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_record
    where trigger_record.tgrelid = message_table
      and trigger_record.tgname =
        'support_case_messages_reject_update_delete'
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
  )
  or not exists (
    select 1
    from pg_trigger trigger_record
    where trigger_record.tgrelid = message_table
      and trigger_record.tgname = 'support_case_messages_reject_truncate'
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
  ) then
    raise exception 'Support messages are not append-only';
  end if;
end
$support_storage_boundary$;

do $support_rpc_boundary$
declare
  signature text;
  function_oid oid;
begin
  foreach signature in array array[
    'public.create_support_case(uuid,text,text,text)',
    'public.get_my_support_cases()',
    'public.get_support_case(text)',
    'public.reply_support_case(text,text)',
    'public.get_support_queue(text)',
    'public.claim_support_case(text)',
    'public.resolve_support_case(text,text)'
  ]
  loop
    function_oid := signature::regprocedure::oid;

    if not (select prosecdef from pg_proc where oid = function_oid)
       or not exists (
         select 1
         from pg_proc function_record
         cross join lateral
           unnest(coalesce(function_record.proconfig, array[]::text[])) setting
         where function_record.oid = function_oid
           and setting = 'search_path=""'
       )
       or has_function_privilege('public', function_oid, 'execute')
       or has_function_privilege('anon', function_oid, 'execute')
       or not has_function_privilege(
         'authenticated',
         function_oid,
         'execute'
       ) then
      raise exception 'Support RPC boundary changed for %', signature;
    end if;
  end loop;
end
$support_rpc_boundary$;

do $support_assignment_and_privacy_boundary$
declare
  detail_definition text :=
    lower(pg_get_functiondef('public.get_support_case(text)'::regprocedure));
  queue_definition text :=
    lower(pg_get_functiondef('public.get_support_queue(text)'::regprocedure));
  claim_definition text :=
    lower(pg_get_functiondef('public.claim_support_case(text)'::regprocedure));
  reply_definition text :=
    lower(
      pg_get_functiondef(
        'public.reply_support_case(text,text)'::regprocedure
      )
    );
  resolve_definition text :=
    lower(
      pg_get_functiondef(
        'public.resolve_support_case(text,text)'::regprocedure
      )
    );
begin
  if detail_definition !~ 'assigned_to = viewer'
     or detail_definition !~ 'requester_id = viewer'
     or detail_definition !~ 'auth\.jwt\(\).*aal.*aal2'
     or detail_definition !~ '''support'', ''compliance'', ''admin''' then
    raise exception 'Support detail assignment or AAL2 boundary changed';
  end if;

  if queue_definition ~ '\m(subject|message_body|requester_id|deal_id|email|phone)\M'
     or queue_definition !~ 'assigned_to is null'
     or queue_definition !~ 'assigned_to = operator_id'
     or queue_definition !~ 'auth\.jwt\(\).*aal.*aal2' then
    raise exception 'Support queue privacy or AAL2 boundary changed';
  end if;

  if claim_definition !~ 'assigned_to = operator_id'
     or claim_definition !~ 'assigned_to is null'
     or claim_definition !~ 'support_case_claimed'
     or reply_definition !~ 'assigned_to = actor'
     or reply_definition !~ 'support_case_replied'
     or resolve_definition !~ 'assigned_to = operator_id'
     or resolve_definition !~ 'support_case_resolved' then
    raise exception 'Support assignment or audit boundary changed';
  end if;
end
$support_assignment_and_privacy_boundary$;

do $support_sla_and_abuse_boundary$
declare
  create_definition text :=
    lower(
      pg_get_functiondef(
        'public.create_support_case(uuid,text,text,text)'::regprocedure
      )
    );
begin
  if create_definition !~ 'pg_advisory_xact_lock'
     or create_definition !~ 'active_case_count >= 5'
     or create_definition !~ 'interval ''1 hour'''
     or create_definition !~ 'interval ''24 hours'''
     or create_definition !~ 'interval ''72 hours'''
     or create_definition !~ 'support_case_opened'
     or not exists (
       select 1
       from pg_indexes index_record
       where index_record.schemaname = 'public'
         and index_record.tablename = 'support_cases'
         and index_record.indexname =
           'support_cases_one_active_context_idx'
         and index_record.indexdef ~* 'unique'
     ) then
    raise exception 'Support SLA, duplicate, or abuse boundary changed';
  end if;
end
$support_sla_and_abuse_boundary$;

rollback;
