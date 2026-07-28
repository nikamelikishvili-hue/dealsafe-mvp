-- Emergency rollback for SEC-003 database enforcement.

begin;

drop policy if exists "MFA assurance required for protected accounts"
  on storage.objects;

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
end;
$$;

revoke all on function public.enforce_active_auth_session()
  from public, anon, authenticated, service_role;
grant execute on function public.enforce_active_auth_session()
  to anon, authenticated, service_role;

drop function if exists dealsafe_private.is_current_mfa_assurance_sufficient();

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
