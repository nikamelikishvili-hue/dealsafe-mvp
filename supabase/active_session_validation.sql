-- Shared active-session validation for the Data API, Storage, and protected
-- Edge Functions. Apply this foundation before enabling enforcement.

create or replace function public.is_auth_session_active_for_service(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_session_id is not null
    and exists (
      select 1
      from auth.sessions as active_session
      where active_session.id = p_session_id
        and active_session.user_id = p_user_id
        and (
          active_session.not_after is null
          or active_session.not_after > now()
        )
    );
$$;

create or replace function public.is_current_auth_session_active()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_claims jsonb := auth.jwt();
  request_user_id uuid;
  request_session_id uuid;
begin
  if coalesce(request_claims ->> 'role', '') <> 'authenticated' then
    return false;
  end if;

  begin
    request_user_id := nullif(request_claims ->> 'sub', '')::uuid;
    request_session_id := nullif(request_claims ->> 'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if request_user_id is null
     or request_session_id is null
     or request_user_id is distinct from auth.uid() then
    return false;
  end if;

  return public.is_auth_session_active_for_service(
    request_user_id,
    request_session_id
  );
end;
$$;

revoke all on function public.is_auth_session_active_for_service(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.is_auth_session_active_for_service(uuid, uuid)
  to service_role;

revoke all on function public.is_current_auth_session_active()
  from public, anon;
grant execute on function public.is_current_auth_session_active()
  to authenticated, service_role;

