-- Private account-session visibility for the signed-in user only.
-- Session revocation remains delegated to the Supabase Auth API.

create or replace function public.get_my_account_sessions()
returns table (
  session_id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  expires_at timestamptz,
  user_agent text,
  current_session boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sessions.id as session_id,
    sessions.created_at,
    coalesce(
      sessions.refreshed_at at time zone 'UTC',
      sessions.updated_at,
      sessions.created_at
    ) as last_active_at,
    sessions.not_after as expires_at,
    left(
      coalesce(nullif(btrim(sessions.user_agent), ''), 'Unknown device'),
      512
    ) as user_agent,
    sessions.id::text = coalesce(auth.jwt() ->> 'session_id', '') as current_session
  from auth.sessions as sessions
  where auth.uid() is not null
    and sessions.user_id = auth.uid()
  order by current_session desc, last_active_at desc
  limit 20;
$$;

comment on function public.get_my_account_sessions() is
  'Returns a minimal, IP-free list of auth sessions owned by the current user.';

revoke all on function public.get_my_account_sessions() from public, anon;
grant execute on function public.get_my_account_sessions() to authenticated;
