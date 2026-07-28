-- Rollback-only DAT-004 evidence. Safe for production verification.

begin;

do $dat_004_pre_request$
declare
  target_oid oid := 'public.enforce_active_auth_session()'::regprocedure::oid;
  role_setting text;
begin
  if (select prosecdef from pg_proc where oid = target_oid) then
    raise exception 'DAT-004 pre-request hook still uses SECURITY DEFINER';
  end if;

  if has_function_privilege('public', target_oid, 'execute')
     or not has_function_privilege('anon', target_oid, 'execute')
     or not has_function_privilege('authenticated', target_oid, 'execute')
     or not has_function_privilege('service_role', target_oid, 'execute') then
    raise exception 'DAT-004 pre-request hook grants are not exact';
  end if;

  select setting
  into role_setting
  from pg_roles role_record
  cross join lateral unnest(coalesce(role_record.rolconfig, array[]::text[])) setting
  where role_record.rolname = 'authenticator'
    and setting = 'pgrst.db_pre_request=public.enforce_active_auth_session';

  if role_setting is null then
    raise exception 'DAT-004 PostgREST pre-request hook is not configured';
  end if;
end
$dat_004_pre_request$;

do $dat_004_session_helper$
declare
  helper_oid oid := 'public.is_current_auth_session_active()'::regprocedure::oid;
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
    raise exception 'DAT-004 active-session helper boundary changed unexpectedly';
  end if;
end
$dat_004_session_helper$;

do $dat_004_public_projection_allowlist$
declare
  expected_signatures constant text[] := array[
    'get_deal_acceptance_protection(text)',
    'get_deal_risk_assessment(text)',
    'get_public_agreement_history(text)',
    'get_public_deal(text)',
    'get_public_seller_declaration(text)',
    'get_public_seller_trust_profile(text)',
    'get_public_trust_passport(text)',
    'verify_agreement_record(text,text)'
  ];
  actual_signatures text[];
begin
  select coalesce(array_agg(function_record.oid::regprocedure::text order by function_record.oid::regprocedure::text), array[]::text[])
  into actual_signatures
  from pg_proc function_record
  join pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
  where namespace_record.nspname = 'public'
    and function_record.prosecdef
    and has_function_privilege('anon', function_record.oid, 'execute');

  if actual_signatures is distinct from expected_signatures then
    raise exception 'DAT-004 anonymous SECURITY DEFINER allowlist changed: %', actual_signatures;
  end if;

  if exists (
    select 1
    from pg_proc function_record
    where function_record.oid::regprocedure::text = any(expected_signatures)
      and (
        has_function_privilege('public', function_record.oid, 'execute')
        or not has_function_privilege('authenticated', function_record.oid, 'execute')
        or not exists (
          select 1
          from unnest(coalesce(function_record.proconfig, array[]::text[])) setting
          where setting like 'search_path=%'
        )
      )
  ) then
    raise exception 'DAT-004 public projection boundary is not explicit';
  end if;
end
$dat_004_public_projection_allowlist$;

rollback;
