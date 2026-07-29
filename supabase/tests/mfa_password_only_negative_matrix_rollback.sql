-- SEC-003 password-only negative matrix.
-- Run only after mfa_assurance_enforcement.sql in a protected environment.
-- The test changes request-local JWT claims and rolls back without recording a
-- user identifier, factor identifier, token, or secret.

begin;

do $password_only_database_boundary$
declare
  protected_user_id uuid;
  password_only_claims jsonb;
  aal2_claims jsonb;
begin
  select profile.id
  into protected_user_id
  from public.profiles as profile
  where profile.app_role in ('support', 'compliance', 'admin')
  order by profile.id
  limit 1;

  if protected_user_id is null then
    raise exception 'SEC-003 matrix requires one privileged test account';
  end if;

  password_only_claims := jsonb_build_object(
    'sub', protected_user_id,
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  );
  perform set_config('request.jwt.claims', password_only_claims::text, true);

  if dealsafe_private.is_current_mfa_assurance_sufficient() then
    raise exception 'SEC-003 password-only privileged request was accepted';
  end if;

  aal2_claims := password_only_claims
    || jsonb_build_object(
      'aal', 'aal2',
      'amr', jsonb_build_array(
        jsonb_build_object(
          'method', 'password',
          'timestamp', extract(epoch from now())::bigint
        ),
        jsonb_build_object(
          'method', 'totp',
          'timestamp', extract(epoch from now())::bigint
        )
      )
    );
  perform set_config('request.jwt.claims', aal2_claims::text, true);

  if not dealsafe_private.is_current_mfa_assurance_sufficient() then
    raise exception 'SEC-003 AAL2 control request was unexpectedly rejected';
  end if;
end
$password_only_database_boundary$;

do $password_only_shared_enforcement$
declare
  hook_definition text := pg_get_functiondef(
    'public.enforce_active_auth_session()'::regprocedure
  );
begin
  if hook_definition !~ 'is_current_mfa_assurance_sufficient'
     or hook_definition !~ 'DEALIVRA_MFA_REQUIRED'
     or hook_definition !~ '''status'', 403' then
    raise exception 'SEC-003 Data API password-only rejection is not wired';
  end if;

  if not exists (
    select 1
    from pg_policy as policy_record
    join pg_class as table_record
      on table_record.oid = policy_record.polrelid
    join pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'storage'
      and table_record.relname = 'objects'
      and policy_record.polname = 'MFA assurance required for protected accounts'
      and not policy_record.polpermissive
      and pg_get_expr(policy_record.polqual, policy_record.polrelid)
        ~ 'is_current_mfa_assurance_sufficient'
      and pg_get_expr(policy_record.polwithcheck, policy_record.polrelid)
        ~ 'is_current_mfa_assurance_sufficient'
  ) then
    raise exception 'SEC-003 Storage password-only rejection is not wired';
  end if;
end
$password_only_shared_enforcement$;

rollback;
