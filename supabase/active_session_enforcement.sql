-- Enable only after active_session_validation.sql is applied and the protected
-- Edge Functions have been deployed with the matching session check.

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
  -- Public Deal Links and trusted service operations keep their existing
  -- behavior. Only signed-in end-user requests require an Auth session row.
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

revoke all on function public.enforce_active_auth_session() from public;
grant execute on function public.enforce_active_auth_session()
  to anon, authenticated, service_role;

alter role authenticator
  set pgrst.db_pre_request = 'public.enforce_active_auth_session';

drop policy if exists "authenticated sessions must be active"
  on storage.objects;
create policy "authenticated sessions must be active"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select public.is_current_auth_session_active()))
  with check ((select public.is_current_auth_session_active()));

notify pgrst, 'reload config';
