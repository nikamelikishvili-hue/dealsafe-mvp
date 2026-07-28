-- SEC-003: opt-in user MFA and mandatory AAL2 for privileged application roles.
-- Apply after active_session_enforcement.sql. Safe to rerun.

begin;

create schema if not exists dealsafe_private;

create or replace function dealsafe_private.is_current_mfa_assurance_sufficient()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_claims jsonb := auth.jwt();
  request_user_id uuid;
  request_aal text := coalesce(auth.jwt() ->> 'aal', 'aal1');
  application_role text;
  has_verified_factor boolean := false;
begin
  if coalesce(request_claims ->> 'role', '') <> 'authenticated' then
    return false;
  end if;

  begin
    request_user_id := nullif(request_claims ->> 'sub', '')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if request_user_id is null or request_user_id is distinct from auth.uid() then
    return false;
  end if;

  select profile.app_role
  into application_role
  from public.profiles as profile
  where profile.id = request_user_id;

  select exists (
    select 1
    from auth.mfa_factors as factor
    where factor.user_id = request_user_id
      and factor.status = 'verified'
  )
  into has_verified_factor;

  return case
    when coalesce(application_role, 'member') in ('support', 'compliance', 'admin')
      or has_verified_factor
    then request_aal = 'aal2'
    else request_aal in ('aal1', 'aal2')
  end;
end;
$$;

revoke all on function dealsafe_private.is_current_mfa_assurance_sufficient()
  from public, anon, authenticated, service_role;
grant execute on function dealsafe_private.is_current_mfa_assurance_sufficient()
  to authenticated, service_role;

create or replace function public.enforce_active_auth_session()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  request_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if request_role in ('', 'anon', 'service_role') then
    return;
  end if;

  if request_role <> 'authenticated'
     or not public.is_current_auth_session_active() then
    raise sqlstate 'PGRST'
      using
        message = jsonb_build_object(
          'code', 'DEALIVRA_SESSION_REVOKED',
          'message', 'Your session is no longer active. Sign in again to continue.'
        )::text,
        detail = jsonb_build_object('status', 401)::text;
  end if;

  if not dealsafe_private.is_current_mfa_assurance_sufficient() then
    raise sqlstate 'PGRST'
      using
        message = jsonb_build_object(
          'code', 'DEALIVRA_MFA_REQUIRED',
          'message', 'Multi-factor verification is required for this account.'
        )::text,
        detail = jsonb_build_object('status', 403)::text;
  end if;
end;
$$;

revoke all on function public.enforce_active_auth_session()
  from public, anon, authenticated, service_role;
grant execute on function public.enforce_active_auth_session()
  to anon, authenticated, service_role;

drop policy if exists "MFA assurance required for protected accounts"
  on storage.objects;
create policy "MFA assurance required for protected accounts"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select dealsafe_private.is_current_mfa_assurance_sufficient()))
  with check ((select dealsafe_private.is_current_mfa_assurance_sufficient()));

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
