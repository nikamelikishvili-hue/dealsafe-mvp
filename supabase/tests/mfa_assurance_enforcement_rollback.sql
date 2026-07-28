-- Rollback-only SEC-003 production proof.

begin;

do $sec_003_boundary$
declare
  helper_oid oid := 'dealsafe_private.is_current_mfa_assurance_sufficient()'::regprocedure::oid;
  helper_definition text := pg_get_functiondef(helper_oid);
  hook_definition text := pg_get_functiondef('public.enforce_active_auth_session()'::regprocedure);
begin
  if not (select prosecdef from pg_proc where oid = helper_oid)
     or not exists (
       select 1
       from pg_proc function_record
       cross join lateral unnest(coalesce(function_record.proconfig, array[]::text[])) setting
       where function_record.oid = helper_oid
         and setting like 'search_path=%'
     )
     or has_function_privilege('public', helper_oid, 'execute')
     or has_function_privilege('anon', helper_oid, 'execute')
     or not has_function_privilege('authenticated', helper_oid, 'execute')
     or not has_function_privilege('service_role', helper_oid, 'execute') then
    raise exception 'SEC-003 private assurance helper boundary is not exact';
  end if;

  if helper_definition !~ 'auth\.mfa_factors'
     or helper_definition !~ 'status = ''verified'''
     or helper_definition !~ '''support'', ''compliance'', ''admin'''
     or helper_definition !~ 'request_aal = ''aal2''' then
    raise exception 'SEC-003 role/factor assurance logic changed unexpectedly';
  end if;

  if hook_definition !~ 'DEALIVRA_MFA_REQUIRED'
     or hook_definition !~ '''status'', 403'
     or hook_definition !~ 'is_current_mfa_assurance_sufficient' then
    raise exception 'SEC-003 Data API fail-closed response is missing';
  end if;
end
$sec_003_boundary$;

do $sec_003_storage$
begin
  if not exists (
    select 1
    from pg_policy policy_record
    join pg_class table_record on table_record.oid = policy_record.polrelid
    join pg_namespace namespace_record on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'storage'
      and table_record.relname = 'objects'
      and policy_record.polname = 'MFA assurance required for protected accounts'
      and policy_record.polpermissive = false
      and policy_record.polroles = array['authenticated'::regrole::oid]
      and pg_get_expr(policy_record.polqual, policy_record.polrelid)
        ~ 'is_current_mfa_assurance_sufficient'
      and pg_get_expr(policy_record.polwithcheck, policy_record.polrelid)
        ~ 'is_current_mfa_assurance_sufficient'
  ) then
    raise exception 'SEC-003 restrictive Storage assurance policy is missing';
  end if;
end
$sec_003_storage$;

rollback;
