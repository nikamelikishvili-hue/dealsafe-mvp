-- Financial actions for administrator-reviewed disputes.
-- Run after stripe_protected_payments_setup.sql and admin_dispute_review.sql.
-- This migration is safe to run more than once.

alter table public.protected_payments
  add column if not exists refund_id text;

create unique index if not exists protected_payments_refund_id_key
  on public.protected_payments(refund_id)
  where refund_id is not null;

comment on column public.protected_payments.refund_id is
  'Stripe Refund ID created by the admin dispute resolution Edge Function.';
