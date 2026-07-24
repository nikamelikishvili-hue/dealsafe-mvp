-- DealSafe administrator revenue summary. Safe to rerun.
-- Run this in the Supabase SQL Editor after admin_reporting_setup.sql and
-- stripe_protected_payments_setup.sql.

drop function if exists public.get_admin_revenue_summary();
create or replace function public.get_admin_revenue_summary()
returns table(
  currency text,
  total_payment_volume_cents bigint,
  total_commission_earned_cents bigint,
  total_released_to_sellers_cents bigint,
  total_protected_cents bigint,
  total_refunded_cents bigint,
  payment_count bigint,
  released_count bigint,
  refunded_count bigint,
  disputed_count bigint
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_dealsafe_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    'USD'::text,
    coalesce(sum(payment.item_amount_cents) filter (where payment.status in (
      'processing','funds_secured','release_pending','released',
      'refund_pending','refunded','disputed','release_failed'
    )), 0)::bigint,
    coalesce(sum(payment.platform_fee_cents) filter (where payment.status = 'released'), 0)::bigint,
    coalesce(sum(payment.seller_amount_cents) filter (where payment.status = 'released'), 0)::bigint,
    coalesce(sum(payment.item_amount_cents) filter (where payment.status in (
      'funds_secured','release_pending','refund_pending','disputed','release_failed'
    )), 0)::bigint,
    coalesce(sum(payment.item_amount_cents) filter (where payment.status = 'refunded'), 0)::bigint,
    count(*) filter (where payment.status in (
      'processing','funds_secured','release_pending','released',
      'refund_pending','refunded','disputed','release_failed'
    )),
    count(*) filter (where payment.status = 'released'),
    count(*) filter (where payment.status = 'refunded'),
    count(*) filter (where payment.status = 'disputed')
  from public.protected_payments payment;
end;
$$;

revoke all on function public.get_admin_revenue_summary() from public, anon;
grant execute on function public.get_admin_revenue_summary() to authenticated;
