-- Run once in Supabase SQL Editor.
-- Exposes only an email-confirmed boolean. The seller email and confirmation date remain private.

create or replace function public.is_deal_publicly_visible(p_deal_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hidden boolean := false;
begin
  if to_regclass('public.deal_moderation') is null then
    return true;
  end if;

  execute 'select exists (
    select 1 from public.deal_moderation
    where deal_id = $1 and status = ''hidden''
  )'
  into v_hidden
  using p_deal_id;

  return not v_hidden;
end;
$$;

drop function if exists public.get_public_deal(text);
create function public.get_public_deal(p_public_id text)
returns table (
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
  agreement_version integer,
  seller_name text,
  seller_contact_verified boolean,
  seller_verification public.verification_status,
  created_at timestamptz,
  expires_at timestamptz,
  media_paths text[]
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
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
    greatest(deal.current_agreement_version, 1),
    seller.display_name,
    seller_auth.email_confirmed_at is not null,
    seller.verification_status,
    deal.created_at,
    deal.expires_at,
    coalesce(
      array_agg(media.storage_path order by media.sort_order)
        filter (where media.id is not null),
      '{}'::text[]
    )
  from public.deals deal
  join public.profiles seller on seller.id = deal.seller_id
  join auth.users seller_auth on seller_auth.id = deal.seller_id
  left join public.deal_media media on media.deal_id = deal.id
  where deal.public_id = p_public_id
    and deal.status in ('published','accepted','completed')
    and public.is_deal_publicly_visible(deal.id)
  group by deal.id, seller.display_name, seller.verification_status, seller_auth.email_confirmed_at;
$$;

drop function if exists public.get_my_saved_deals();
create function public.get_my_saved_deals()
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
  seller_contact_verified boolean,
  seller_verification public.verification_status,
  media_paths text[],
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
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
    seller_auth.email_confirmed_at is not null,
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
  join auth.users seller_auth on seller_auth.id = deal.seller_id
  left join public.deal_media media on media.deal_id = deal.id
  where saved.user_id = auth.uid()
    and deal.status in ('published','accepted','completed')
    and public.is_saved_deal_visible(deal.id)
  group by deal.id, seller.display_name, seller.verification_status,
    seller_auth.email_confirmed_at, saved.created_at
  order by saved.created_at desc;
$$;

revoke all on function public.is_deal_publicly_visible(uuid) from public;
revoke all on function public.get_public_deal(text) from public;
revoke all on function public.get_my_saved_deals() from public;

grant execute on function public.get_public_deal(text) to anon, authenticated;
grant execute on function public.get_my_saved_deals() to authenticated;

notify pgrst, 'reload schema';
