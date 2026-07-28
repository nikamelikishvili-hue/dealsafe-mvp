-- DAT-004: remove an unnecessary elevated execution boundary from the
-- PostgREST active-session pre-request hook without changing its role grants
-- or fail-closed behavior for authenticated sessions.

begin;

alter function public.enforce_active_auth_session()
  security invoker;

revoke all on function public.enforce_active_auth_session()
  from public, anon, authenticated, service_role;

grant execute on function public.enforce_active_auth_session()
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
