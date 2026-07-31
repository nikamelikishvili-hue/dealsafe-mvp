begin;

do $database_security_contract$
declare
  public_table_without_rls text;
  private_table_without_rls text;
  private_browser_grant text;
  public_role_policy text;
  unsafe_elevated_function text;
  unsafe_public_view text;
begin
  select format('%I.%I', namespace.nspname, class.relname)
  into public_table_without_rls
  from pg_class as class
  join pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relkind in ('r', 'p')
    and not class.relrowsecurity
  order by class.relname
  limit 1;
  if public_table_without_rls is not null then
    raise exception 'DAT-002 exposed table lacks RLS: %', public_table_without_rls;
  end if;

  select format('%I.%I', namespace.nspname, class.relname)
  into private_table_without_rls
  from pg_class as class
  join pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'dealsafe_private'
    and class.relkind in ('r', 'p')
    and not class.relrowsecurity
  order by class.relname
  limit 1;
  if private_table_without_rls is not null then
    raise exception 'DAT-002 private defense-in-depth RLS is incomplete: %', private_table_without_rls;
  end if;

  select format('%I.%I -> %s', grant_row.table_schema, grant_row.table_name, grant_row.grantee)
  into private_browser_grant
  from information_schema.role_table_grants as grant_row
  where grant_row.table_schema = 'dealsafe_private'
    and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  order by grant_row.table_name, grant_row.grantee
  limit 1;
  if private_browser_grant is not null then
    raise exception 'DAT-002 private schema has a browser grant: %', private_browser_grant;
  end if;

  select format('%I.%I/%I', policy.schemaname, policy.tablename, policy.policyname)
  into public_role_policy
  from pg_policies as policy
  where 'public' = any(policy.roles)
    and policy.schemaname in ('public', 'storage', 'dealsafe_private')
  order by policy.schemaname, policy.tablename, policy.policyname
  limit 1;
  if public_role_policy is not null then
    raise exception 'DAT-002 policy targets PUBLIC instead of an explicit role: %', public_role_policy;
  end if;

  select function_record.oid::regprocedure::text
  into unsafe_elevated_function
  from pg_proc as function_record
  join pg_namespace as namespace on namespace.oid = function_record.pronamespace
  where function_record.prosecdef
    and namespace.nspname in ('public', 'dealsafe_private')
    and not exists (
      select 1
      from unnest(coalesce(function_record.proconfig, array[]::text[])) as setting
      where setting like 'search_path=%'
    )
  order by function_record.oid::regprocedure::text
  limit 1;
  if unsafe_elevated_function is not null then
    raise exception 'DAT-004 elevated function lacks a fixed search path: %', unsafe_elevated_function;
  end if;

  select format('%I.%I', namespace.nspname, class.relname)
  into unsafe_public_view
  from pg_class as class
  join pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relkind in ('v', 'm')
    and has_table_privilege('anon', class.oid, 'SELECT')
    and not coalesce(class.reloptions @> array['security_invoker=true'], false)
  order by class.relname
  limit 1;
  if unsafe_public_view is not null then
    raise exception 'DAT-002 anonymous view lacks security_invoker: %', unsafe_public_view;
  end if;
end
$database_security_contract$;

rollback;
