-- Private, account-backed Saved Deal Links. Safe to rerun.
create table if not exists public.deal_watchlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deal_id)
);

create index if not exists deal_watchlist_user_created_idx
  on public.deal_watchlist(user_id, created_at desc);

alter table public.deal_watchlist enable row level security;

-- Moderation was introduced in a later setup file. This helper keeps the
-- Watchlist compatible with projects that have not installed it yet.
create or replace function public.is_saved_deal_visible(p_deal_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_visible boolean;
begin
  if to_regclass('public.deal_moderation') is null then
    return true;
  end if;

  execute 'select not exists(
    select 1 from public.deal_moderation
    where deal_id = $1 and status = ''hidden''
  )'
  into v_visible
  using p_deal_id;

  return coalesce(v_visible, true);
end;
$$;

create or replace function public.is_deal_saved(p_public_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists(
    select 1
    from public.deal_watchlist saved
    join public.deals deal on deal.id = saved.deal_id
    where saved.user_id = auth.uid()
      and deal.public_id = upper(trim(p_public_id))
  );
$$;

create or replace function public.set_deal_saved(p_public_id text, p_saved boolean)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_deal_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select deal.id into v_deal_id
  from public.deals deal
  where deal.public_id = upper(trim(p_public_id))
    and deal.status in ('published','accepted','completed')
    and public.is_saved_deal_visible(deal.id);

  if v_deal_id is null then
    raise exception 'Deal Link is unavailable';
  end if;

  if coalesce(p_saved, false) then
    insert into public.deal_watchlist(user_id, deal_id)
    values(auth.uid(), v_deal_id)
    on conflict (user_id, deal_id) do nothing;
  else
    delete from public.deal_watchlist
    where user_id = auth.uid() and deal_id = v_deal_id;
  end if;

  return coalesce(p_saved, false);
end;
$$;

create or replace function public.get_my_saved_deals()
returns table(
  id uuid,
  public_id text,
  title text,
  description text,
  price_cents bigint,
  currency character(3),
  condition text,
  serial_last_four text,
  delivery_method text,
  status public.deal_status,
  current_agreement_version integer,
  created_at timestamptz,
  expires_at timestamptz,
  seller_name text,
  seller_verification public.verification_status,
  media_paths text[],
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    deal.id,
    deal.public_id,
    deal.title,
    deal.description,
    deal.price_cents,
    deal.currency,
    deal.condition,
    deal.serial_last_four,
    deal.delivery_method,
    deal.status,
    deal.current_agreement_version,
    deal.created_at,
    deal.expires_at,
    seller.display_name,
    seller.verification_status,
    coalesce(
      array_agg(media.storage_path order by media.sort_order)
        filter (where media.id is not null),
      '{}'::text[]
    ),
    saved.created_at
  from public.deal_watchlist saved
  join public.deals deal on deal.id = saved.deal_id
  join public.profiles seller on seller.id = deal.seller_id
  left join public.deal_media media on media.deal_id = deal.id
  where saved.user_id = auth.uid()
    and deal.status in ('published','accepted','completed')
    and public.is_saved_deal_visible(deal.id)
  group by deal.id, seller.display_name, seller.verification_status, saved.created_at
  order by saved.created_at desc;
$$;

revoke all on table public.deal_watchlist from anon, authenticated;
revoke all on function public.is_saved_deal_visible(uuid) from public;
revoke all on function public.is_deal_saved(text) from public;
revoke all on function public.set_deal_saved(text, boolean) from public;
revoke all on function public.get_my_saved_deals() from public;

grant execute on function public.is_deal_saved(text) to authenticated;
grant execute on function public.set_deal_saved(text, boolean) to authenticated;
grant execute on function public.get_my_saved_deals() to authenticated;
