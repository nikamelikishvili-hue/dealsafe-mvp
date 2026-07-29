-- Rollback-only SEC-003B / SEC-007 structural proof.

begin;

do $recovery_private_tables$
declare
  table_name text;
begin
  foreach table_name in array array[
    'privileged_mfa_recovery_cases',
    'sensitive_change_holds',
    'security_notification_outbox'
  ]::text[]
  loop
    if to_regclass(format('dealsafe_private.%I', table_name)) is null then
      raise exception 'SEC-003B private recovery table is missing: %', table_name;
    end if;

    if not exists (
      select 1
      from pg_class as table_record
      join pg_namespace as namespace_record
        on namespace_record.oid = table_record.relnamespace
      where namespace_record.nspname = 'dealsafe_private'
        and table_record.relname = table_name
        and table_record.relrowsecurity
    ) then
      raise exception 'SEC-003B private recovery table lacks RLS: %', table_name;
    end if;

    if has_table_privilege(
      'anon',
      format('dealsafe_private.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    ) or has_table_privilege(
      'authenticated',
      format('dealsafe_private.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    ) or has_table_privilege(
      'service_role',
      format('dealsafe_private.%I', table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    ) then
      raise exception 'SEC-003B private recovery table gained direct role access: %', table_name;
    end if;
  end loop;
end
$recovery_private_tables$;

do $recovery_function_boundaries$
declare
  authenticated_signature regprocedure;
  service_signature regprocedure;
  private_signature regprocedure;
  function_record record;
begin
  foreach private_signature in array array[
    'dealsafe_private.current_user_has_recent_totp_step_up()'::regprocedure,
    'dealsafe_private.current_security_operator_role()'::regprocedure,
    'dealsafe_private.require_security_operator(text[])'::regprocedure
  ]::regprocedure[]
  loop
    if has_function_privilege('public', private_signature, 'EXECUTE')
       or has_function_privilege('anon', private_signature, 'EXECUTE')
       or has_function_privilege('authenticated', private_signature, 'EXECUTE')
       or has_function_privilege('service_role', private_signature, 'EXECUTE') then
      raise exception 'SEC-003B private helper became directly executable: %',
        private_signature;
    end if;
  end loop;

  foreach authenticated_signature in array array[
    'public.open_privileged_mfa_recovery_case(uuid,text,text,text)'::regprocedure,
    'public.record_privileged_recovery_identity_proof(uuid,text,text)'::regprocedure,
    'public.review_privileged_mfa_recovery_case(uuid,text,text)'::regprocedure,
    'public.get_privileged_mfa_recovery_cases(text)'::regprocedure,
    'public.get_my_sensitive_change_holds()'::regprocedure,
    'public.assert_my_sensitive_change_allowed(text)'::regprocedure
  ]::regprocedure[]
  loop
    select
      routine.prosecdef,
      routine.proconfig
    into function_record
    from pg_proc as routine
    where routine.oid = authenticated_signature::oid;

    if not function_record.prosecdef
       or not exists (
         select 1
         from unnest(coalesce(function_record.proconfig, array[]::text[])) as setting
         where setting like 'search_path=%'
       )
       or has_function_privilege('public', authenticated_signature, 'EXECUTE')
       or has_function_privilege('anon', authenticated_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', authenticated_signature, 'EXECUTE') then
      raise exception 'SEC-003B authenticated RPC boundary is not exact: %',
        authenticated_signature;
    end if;
  end loop;

  foreach service_signature in array array[
    'public.complete_privileged_mfa_recovery_for_service(uuid,uuid,text,text)'::regprocedure,
    'public.is_sensitive_change_allowed_for_service(uuid,text)'::regprocedure,
    'public.claim_security_notification_delivery_batch(integer)'::regprocedure,
    'public.complete_security_notification_delivery(uuid,text,text)'::regprocedure,
    'public.get_security_notification_delivery_health_for_service()'::regprocedure
  ]::regprocedure[]
  loop
    select
      routine.prosecdef,
      routine.proconfig
    into function_record
    from pg_proc as routine
    where routine.oid = service_signature::oid;

    if not function_record.prosecdef
       or not exists (
         select 1
         from unnest(coalesce(function_record.proconfig, array[]::text[])) as setting
         where setting like 'search_path=%'
       )
       or has_function_privilege('public', service_signature, 'EXECUTE')
       or has_function_privilege('anon', service_signature, 'EXECUTE')
       or has_function_privilege('authenticated', service_signature, 'EXECUTE')
       or not has_function_privilege('service_role', service_signature, 'EXECUTE') then
      raise exception 'SEC-003B service RPC boundary is not exact: %',
        service_signature;
    end if;
  end loop;
end
$recovery_function_boundaries$;

do $recovery_state_machine$
declare
  open_definition text := pg_get_functiondef(
    'public.open_privileged_mfa_recovery_case(uuid,text,text,text)'::regprocedure
  );
  proof_definition text := pg_get_functiondef(
    'public.record_privileged_recovery_identity_proof(uuid,text,text)'::regprocedure
  );
  review_definition text := pg_get_functiondef(
    'public.review_privileged_mfa_recovery_case(uuid,text,text)'::regprocedure
  );
  completion_definition text := pg_get_functiondef(
    'public.complete_privileged_mfa_recovery_for_service(uuid,uuid,text,text)'::regprocedure
  );
  step_up_definition text := pg_get_functiondef(
    'dealsafe_private.current_user_has_recent_totp_step_up()'::regprocedure
  );
begin
  if step_up_definition !~ 'aal'
     or step_up_definition !~ 'aal2'
     or step_up_definition !~ 'totp'
     or step_up_definition !~ '10 minutes' then
    raise exception 'SEC-003B recent AAL2 TOTP boundary changed';
  end if;

  if open_definition !~ 'SELF_SERVICE_PROHIBITED'
     or open_definition !~ '''support'', ''compliance'', ''admin'''
     or open_definition !~ 'RECOVERY_CASE_ALREADY_OPEN'
     or open_definition !~ 'privileged_mfa_recovery_opened' then
    raise exception 'SEC-003B recovery case opening safeguards changed';
  end if;

  if proof_definition !~ 'status <> ''open'''
     or proof_definition !~ 'SELF_ATTESTATION_PROHIBITED'
     or proof_definition !~ 'identity_verified' then
    raise exception 'SEC-003B identity re-proofing state changed';
  end if;

  if review_definition !~ '''compliance'', ''admin'''
     or review_definition !~ 'SECOND_REVIEWER_REQUIRED'
     or review_definition !~ 'requested_by'
     or review_definition !~ 'identity_verified' then
    raise exception 'SEC-003B dual-control review state changed';
  end if;

  if completion_definition !~ 'auth\.sessions'
     or completion_definition !~ 'auth\.mfa_factors'
     or completion_definition !~ '72 hours'
     or completion_definition !~ '''payout'', ''email'', ''mfa'''
     or completion_definition !~ 'privileged_mfa_recovery_completed' then
    raise exception 'SEC-003B service completion or cooldown state changed';
  end if;
end
$recovery_state_machine$;

do $notification_delivery_health$
declare
  health_signature regprocedure :=
    'public.get_security_notification_delivery_health_for_service()'::regprocedure;
  health_definition text := pg_get_functiondef(health_signature);
  result_shape text := pg_get_function_result(health_signature::oid);
begin
  if result_shape !~ '^TABLE\(ready_count integer, retrying_count integer, dead_letter_count integer, oldest_pending_age_minutes integer\)$' then
    raise exception 'SEC-007 delivery health result shape changed';
  end if;

  if health_definition !~ 'service_role'
     or health_definition !~ 'delivery_attempts >= 5'
     or health_definition !~ '5256000'
     or health_definition ~ 'target_user_id|recovery_case_id|payload|delivery_reference' then
    raise exception 'SEC-007 delivery health privacy or dead-letter boundary changed';
  end if;
end
$notification_delivery_health$;

do $recovery_immutable_history$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.audit_events'::regclass
      and not tgisinternal
      and tgenabled = 'O'
      and tgname = 'audit_events_reject_update_delete'
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.audit_events'::regclass
      and not tgisinternal
      and tgenabled = 'O'
      and tgname = 'audit_events_reject_truncate'
  ) then
    raise exception 'SEC-003B immutable recovery event dependency is missing';
  end if;
end
$recovery_immutable_history$;

rollback;
