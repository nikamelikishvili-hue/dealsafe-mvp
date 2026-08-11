begin;

do $private_settings_rls_contract$
declare
  rls_enabled boolean;
  force_rls_enabled boolean;
  policy_count integer;
  unexpected_grants integer;
  verifier_security_definer boolean;
  verifier_config text[];
  verifier_acl text;
begin
  select class.relrowsecurity, class.relforcerowsecurity
  into rls_enabled, force_rls_enabled
  from pg_class as class
  join pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'dealsafe_private'
    and class.relname = 'evidence_maintenance_settings';

  if not coalesce(rls_enabled, false) then
    raise exception 'DAT-002 private evidence maintenance settings must have RLS enabled';
  end if;
  if coalesce(force_rls_enabled, false) then
    raise exception 'DAT-002 FORCE RLS would block the reviewed owner-only verifier';
  end if;

  select count(*)
  into policy_count
  from pg_policies
  where schemaname = 'dealsafe_private'
    and tablename = 'evidence_maintenance_settings';
  if policy_count <> 0 then
    raise exception 'DAT-002 private evidence maintenance settings must remain owner-only';
  end if;

  select count(*)
  into unexpected_grants
  from information_schema.role_table_grants
  where table_schema = 'dealsafe_private'
    and table_name = 'evidence_maintenance_settings'
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');
  if unexpected_grants <> 0 then
    raise exception 'DAT-002 private evidence maintenance settings expose unexpected direct grants';
  end if;

  select function_record.prosecdef, function_record.proconfig, function_record.proacl::text
  into verifier_security_definer, verifier_config, verifier_acl
  from pg_proc as function_record
  join pg_namespace as namespace on namespace.oid = function_record.pronamespace
  where namespace.nspname = 'dealsafe_private'
    and function_record.proname = 'is_evidence_maintenance_secret_valid'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_secret text';

  if not coalesce(verifier_security_definer, false)
     or not ('search_path=""' = any(coalesce(verifier_config, array[]::text[]))) then
    raise exception 'DAT-002 private maintenance verifier lost its fixed elevated boundary';
  end if;
  if verifier_acl is null
     or verifier_acl !~ 'service_role=X'
     or verifier_acl ~ '(^|,)(PUBLIC|anon|authenticated)=' then
    raise exception 'DAT-002 private maintenance verifier execute allowlist changed';
  end if;
end
$private_settings_rls_contract$;

rollback;
