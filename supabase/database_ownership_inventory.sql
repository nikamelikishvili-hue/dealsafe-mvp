\pset tuples_only on
\pset format unaligned

with objects as (
  select
    case class.relkind when 'r' then 'table' when 'p' then 'table' else 'view' end as object_kind,
    namespace.nspname || '.' || class.relname as object_identity,
    pg_get_userbyid(class.relowner) as owner_role,
    case when namespace.nspname = 'public' then 'data_api_candidate' else 'private_schema' end as exposure
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname in ('public', 'dealsafe_private')
    and class.relkind in ('r', 'p', 'v', 'm')

  union all

  select
    'function',
    namespace.nspname || '.' || routine.proname || '(' || pg_get_function_identity_arguments(routine.oid) || ')',
    pg_get_userbyid(routine.proowner),
    case when namespace.nspname = 'public' then 'data_api_candidate' else 'private_schema' end
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
  where namespace.nspname in ('public', 'dealsafe_private')

  union all

  select 'bucket', 'storage.' || bucket.id, 'postgres', case when bucket.public then 'public_object' else 'private_object' end
  from storage.buckets as bucket

  union all

  select
    'policy',
    policy.schemaname || '.' || policy.tablename || ':' || policy.policyname,
    pg_get_userbyid(class.relowner),
    array_to_string(policy.roles, ',')
  from pg_catalog.pg_policies as policy
  join pg_catalog.pg_namespace as namespace on namespace.nspname = policy.schemaname
  join pg_catalog.pg_class as class on class.relnamespace = namespace.oid and class.relname = policy.tablename
  where policy.schemaname in ('public', 'dealsafe_private', 'storage')

  union all

  select
    'grant',
    privilege.table_schema || '.' || privilege.table_name || ':' || privilege.grantee || ':' || privilege.privilege_type,
    privilege.grantor,
    privilege.grantee
  from information_schema.table_privileges as privilege
  where privilege.table_schema in ('public', 'dealsafe_private', 'storage')

  union all

  select
    'grant',
    privilege.specific_schema || '.' || privilege.specific_name || ':' || privilege.grantee || ':' || privilege.privilege_type,
    privilege.grantor,
    privilege.grantee
  from information_schema.routine_privileges as privilege
  where privilege.specific_schema in ('public', 'dealsafe_private')
), governed as (
  select
    object_kind,
    object_identity,
    owner_role,
    exposure,
    case
      when object_identity ~* '(stripe|payment|payout|refund|reconciliation|commission)' then 'finance_security'
      when object_identity ~* '(evidence|dispute|report|moderation|support|risk)' then 'trust_safety_security'
      when object_identity ~* '(auth|session|mfa|profile|notification|admin)' then 'identity_security'
      when object_kind in ('policy', 'grant') then 'database_security'
      else 'platform_engineering'
    end as steward
  from objects
)
select jsonb_build_object(
  'schema', 'dealivra.database-ownership-object.v1',
  'kind', object_kind,
  'identity', object_identity,
  'owner_role', owner_role,
  'exposure', exposure,
  'steward', steward
)::text
from governed
order by object_kind, object_identity;
