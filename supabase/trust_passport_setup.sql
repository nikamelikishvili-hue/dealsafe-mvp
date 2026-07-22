-- Opt-in Digital Trust Passport. Safe to rerun.
alter table public.profiles
  add column if not exists trust_public_id text;

alter table public.profiles
  add column if not exists trust_profile_enabled boolean not null default false;

update public.profiles
set trust_public_id = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where trust_public_id is null;

create unique index if not exists profiles_trust_public_id_key
  on public.profiles(trust_public_id);

alter table public.profiles
  alter column trust_public_id
  set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

alter table public.profiles
  alter column trust_public_id set not null;

create or replace function public.get_my_trust_passport_settings()
returns table(public_id text, enabled boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.trust_public_id, p.trust_profile_enabled
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.set_trust_passport_enabled(p_enabled boolean)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_public_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set trust_profile_enabled = coalesce(p_enabled, false)
  where id = auth.uid()
  returning trust_public_id into v_public_id;

  if v_public_id is null then
    raise exception 'Profile was not found';
  end if;

  return v_public_id;
end;
$$;

create or replace function public.get_public_trust_passport(p_public_id text)
returns table(
  display_name text,
  verification_status public.verification_status,
  member_since timestamptz,
  completed_deals bigint,
  completed_sales bigint,
  completed_purchases bigint,
  rating_count bigint,
  average_rating numeric,
  recent_ratings jsonb
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.display_name,
    p.verification_status,
    p.created_at,
    (select count(*) from public.deals d
      where d.status = 'completed' and (d.seller_id = p.id or d.buyer_id = p.id)),
    (select count(*) from public.deals d
      where d.status = 'completed' and d.seller_id = p.id),
    (select count(*) from public.deals d
      where d.status = 'completed' and d.buyer_id = p.id),
    (select count(*) from public.ratings r where r.subject_id = p.id),
    (select round(avg(r.stars)::numeric, 1) from public.ratings r where r.subject_id = p.id),
    coalesce((
      select jsonb_agg(recent order by recent.created_at desc)
      from (
        select r.stars, r.created_at
        from public.ratings r
        where r.subject_id = p.id
        order by r.created_at desc
        limit 5
      ) recent
    ), '[]'::jsonb)
  from public.profiles p
  where p.trust_public_id = upper(trim(p_public_id))
    and p.trust_profile_enabled = true;
$$;

revoke all on function public.get_my_trust_passport_settings() from public;
revoke all on function public.set_trust_passport_enabled(boolean) from public;
revoke all on function public.get_public_trust_passport(text) from public;

grant execute on function public.get_my_trust_passport_settings() to authenticated;
grant execute on function public.set_trust_passport_enabled(boolean) to authenticated;
grant execute on function public.get_public_trust_passport(text) to anon, authenticated;
