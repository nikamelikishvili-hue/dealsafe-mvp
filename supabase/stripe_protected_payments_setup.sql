-- Stripe Connect protected payments for the US Sandbox beta. Safe to rerun.
-- Run after payment_status_setup.sql. This never stores card or bank details.

alter table public.profiles add column if not exists stripe_account_id text;
alter table public.profiles add column if not exists stripe_details_submitted boolean not null default false;
alter table public.profiles add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_transfers_active boolean not null default false;
alter table public.profiles add column if not exists stripe_onboarding_updated_at timestamptz;

create unique index if not exists profiles_stripe_account_id_key
on public.profiles(stripe_account_id) where stripe_account_id is not null;

create table if not exists public.protected_payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.deals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  seller_stripe_account_id text not null,
  item_amount_cents bigint not null check(item_amount_cents > 0),
  platform_fee_cents bigint not null default 0 check(platform_fee_cents >= 0),
  seller_amount_cents bigint not null check(seller_amount_cents > 0),
  currency text not null check(currency = upper(currency) and char_length(currency) = 3),
  status text not null default 'checkout_created' check(status in (
    'checkout_created','processing','funds_secured','release_pending','released',
    'failed','expired','cancelled','refund_pending','refunded','disputed','release_failed'
  )),
  checkout_session_id text unique,
  payment_intent_id text unique,
  charge_id text unique,
  transfer_id text unique,
  transfer_group text not null,
  checkout_url text,
  checkout_expires_at timestamptz,
  failure_message text,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(seller_amount_cents + platform_fee_cents = item_amount_cents),
  check(buyer_id <> seller_id)
);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.protected_payments enable row level security;
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.protected_payments from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;

drop function if exists public.get_my_stripe_connect_status();
create function public.get_my_stripe_connect_status()
returns table(
  connected boolean,
  details_submitted boolean,
  payouts_enabled boolean,
  transfers_active boolean,
  ready boolean,
  updated_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp as $$
  select profile.stripe_account_id is not null,
    profile.stripe_details_submitted,
    profile.stripe_payouts_enabled,
    profile.stripe_transfers_active,
    profile.stripe_account_id is not null and profile.stripe_details_submitted
      and profile.stripe_payouts_enabled and profile.stripe_transfers_active,
    profile.stripe_onboarding_updated_at
  from public.profiles profile
  where profile.id=auth.uid();
$$;

drop function if exists public.get_protected_payment_status(uuid);
create function public.get_protected_payment_status(p_deal_id uuid)
returns table(
  status text,
  item_amount_cents bigint,
  platform_fee_cents bigint,
  seller_amount_cents bigint,
  currency text,
  checkout_expires_at timestamptz,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  failure_message text,
  seller_connected boolean,
  seller_payouts_ready boolean,
  viewer_role text
)
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(payment.status,'not_started'),
    coalesce(payment.item_amount_cents,deal.price_cents::bigint),
    coalesce(payment.platform_fee_cents,0::bigint),
    coalesce(payment.seller_amount_cents,deal.price_cents::bigint),
    coalesce(payment.currency,deal.currency),payment.checkout_expires_at,
    payment.paid_at,payment.released_at,payment.refunded_at,payment.disputed_at,
    payment.failure_message,seller.stripe_account_id is not null,
    seller.stripe_account_id is not null and seller.stripe_details_submitted
      and seller.stripe_payouts_enabled and seller.stripe_transfers_active,
    case when deal.seller_id=auth.uid() then 'seller' else 'buyer' end
  from public.deals deal
  join public.profiles seller on seller.id=deal.seller_id
  left join public.protected_payments payment on payment.deal_id=deal.id
  where deal.id=p_deal_id and auth.uid() is not null
    and auth.uid() in (deal.seller_id,deal.buyer_id)
    and deal.status in ('accepted','completed','disputed','cancelled');
$$;

-- Payment truth now comes from verified Stripe webhooks, not participant buttons.
revoke execute on function public.set_deal_payment_method(uuid,text) from authenticated;
revoke execute on function public.confirm_deal_payment_method(uuid) from authenticated;
revoke execute on function public.mark_deal_payment_sent(uuid) from authenticated;
revoke execute on function public.mark_deal_payment_received(uuid) from authenticated;

revoke all on function public.get_my_stripe_connect_status() from public;
revoke all on function public.get_protected_payment_status(uuid) from public;
grant execute on function public.get_my_stripe_connect_status() to authenticated;
grant execute on function public.get_protected_payment_status(uuid) to authenticated;

