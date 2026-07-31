-- DAT-002 defense-in-depth hardening for the private maintenance credential.
--
-- This migration is prepared for Staging review only. Do not apply it to
-- Production until the Staging database gate, worker invocation, and rollback
-- proof have passed.

begin;

do $private_settings_precondition$
begin
  if to_regclass('dealsafe_private.evidence_maintenance_settings') is null then
    raise exception 'DAT-002 private evidence maintenance settings are missing';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'dealsafe_private'
      and table_name = 'evidence_maintenance_settings'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then
    raise exception 'DAT-002 private evidence maintenance settings have an unexpected browser/service grant';
  end if;
end
$private_settings_precondition$;

alter table dealsafe_private.evidence_maintenance_settings
  enable row level security;

-- No row policy is intentional. The table is owned by the database owner and
-- is read only through the fixed-search-path SECURITY DEFINER verifier. Direct
-- browser and service-role table access remains denied.
revoke all on table dealsafe_private.evidence_maintenance_settings
  from public, anon, authenticated, service_role;

comment on table dealsafe_private.evidence_maintenance_settings is
  'Private owner-only evidence maintenance configuration. RLS has no direct-access policy by design.';

commit;
