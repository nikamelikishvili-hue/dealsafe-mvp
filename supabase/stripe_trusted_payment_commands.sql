-- Trusted Stripe command boundary for the US Sandbox beta.
-- Run after stripe_webhook_replay_safety.sql and dispute_financial_resolution.sql.
-- Provider calls happen only after these service-only functions reserve and lock
-- the exact agreement, amount, currency, seller account, and legal transition.

alter table public.protected_payments
  add column if not exists agreement_version integer,
  add column if not exists fee_bps integer,
  add column if not exists fee_version text,
  add column if not exists checkout_attempt integer;

update public.protected_payments payment
set agreement_version = coalesce(payment.agreement_version, greatest(deal.current_agreement_version, 1)),
    fee_bps = coalesce(
      payment.fee_bps,
      round(payment.platform_fee_cents::numeric * 10000 / payment.item_amount_cents)::integer
    ),
    fee_version = coalesce(payment.fee_version, 'legacy_v1'),
    checkout_attempt = coalesce(payment.checkout_attempt, 1)
from public.deals deal
where deal.id = payment.deal_id
  and (
    payment.agreement_version is null
    or payment.fee_bps is null
    or payment.fee_version is null
    or payment.checkout_attempt is null
  );

alter table public.protected_payments
  alter column agreement_version set not null,
  alter column fee_bps set not null,
  alter column fee_version set not null,
  alter column checkout_attempt set not null,
  alter column checkout_attempt set default 1;

alter table public.protected_payments
  drop constraint if exists protected_payments_agreement_version_check;
alter table public.protected_payments
  add constraint protected_payments_agreement_version_check
  check (agreement_version between 1 and 1000000);

alter table public.protected_payments
  drop constraint if exists protected_payments_fee_bps_check;
alter table public.protected_payments
  add constraint protected_payments_fee_bps_check
  check (fee_bps between 0 and 2000);

alter table public.protected_payments
  drop constraint if exists protected_payments_fee_version_check;
alter table public.protected_payments
  add constraint protected_payments_fee_version_check
  check (fee_version ~ '^[a-z0-9][a-z0-9_.-]{0,39}$');

alter table public.protected_payments
  drop constraint if exists protected_payments_checkout_attempt_check;
alter table public.protected_payments
  add constraint protected_payments_checkout_attempt_check
  check (checkout_attempt between 1 and 100);

comment on column public.protected_payments.agreement_version is
  'Immutable accepted agreement version reserved before hosted Checkout.';
comment on column public.protected_payments.fee_version is
  'Versioned server-side fee policy reserved with the payment snapshot.';

create table if not exists public.stripe_financial_commands (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.protected_payments(id) on delete restrict,
  deal_id uuid not null references public.deals(id) on delete restrict,
  dispute_id uuid references public.deal_disputes(id) on delete restrict,
  command_type text not null check (command_type in (
    'checkout', 'release', 'dispute_refund', 'dispute_release'
  )),
  idempotency_key text not null unique
    check (idempotency_key ~ '^dealivra-[a-z0-9_.-]{8,220}$'),
  status text not null default 'prepared'
    check (status in ('prepared', 'succeeded', 'failed')),
  claim_token uuid,
  claimed_at timestamptz,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency = upper(currency) and char_length(currency) = 3),
  seller_stripe_account_id text not null,
  previous_payment_status text,
  agreement_version integer not null check (agreement_version between 1 and 1000000),
  fee_version text not null check (fee_version ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
  provider_object_id text unique,
  attempt_count integer not null default 1 check (attempt_count between 1 and 100),
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'prepared' and claim_token is not null and claimed_at is not null and completed_at is null)
    or (status in ('succeeded', 'failed') and claim_token is null)
  ),
  check (
    (command_type in ('checkout', 'release') and dispute_id is null)
    or (command_type in ('dispute_refund', 'dispute_release') and dispute_id is not null)
  )
);

create index if not exists stripe_financial_commands_payment_idx
  on public.stripe_financial_commands(payment_id, created_at desc);
create index if not exists stripe_financial_commands_deal_idx
  on public.stripe_financial_commands(deal_id, created_at desc);
create index if not exists stripe_financial_commands_dispute_idx
  on public.stripe_financial_commands(dispute_id, created_at desc)
  where dispute_id is not null;
create index if not exists stripe_financial_commands_requested_by_idx
  on public.stripe_financial_commands(requested_by);
create index if not exists stripe_financial_commands_status_claimed_idx
  on public.stripe_financial_commands(status, claimed_at);

alter table public.stripe_financial_commands enable row level security;
revoke all on table public.stripe_financial_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_financial_commands to service_role;

comment on table public.stripe_financial_commands is
  'Service-only fenced ledger for hosted Checkout, transfer, and refund commands. No raw provider payloads or errors.';

create or replace function public.prepare_stripe_checkout(
  p_deal_id uuid,
  p_buyer_id uuid,
  p_fee_bps integer,
  p_fee_version text,
  p_max_amount_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deals%rowtype;
  v_seller public.profiles%rowtype;
  v_payment public.protected_payments%rowtype;
  v_command public.stripe_financial_commands%rowtype;
  v_agreement public.agreement_versions%rowtype;
  v_acceptance_count integer;
  v_platform_fee bigint;
  v_seller_amount bigint;
  v_transfer_group text;
  v_token uuid := gen_random_uuid();
  v_attempt integer := 1;
  v_idempotency_key text;
begin
  if p_deal_id is null or p_buyer_id is null then
    raise exception using errcode = '22023', message = 'checkout_identity_required';
  end if;
  if p_fee_bps is null or p_fee_bps not between 0 and 2000 then
    raise exception using errcode = '22023', message = 'invalid_fee_policy';
  end if;
  if p_fee_version is null or p_fee_version !~ '^[a-z0-9][a-z0-9_.-]{0,39}$' then
    raise exception using errcode = '22023', message = 'invalid_fee_version';
  end if;
  if p_max_amount_cents is null or p_max_amount_cents not between 100 and 100000000 then
    raise exception using errcode = '22023', message = 'invalid_checkout_limit';
  end if;

  select *
  into v_deal
  from public.deals
  where id = p_deal_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'deal_not_found';
  end if;
  if v_deal.status <> 'accepted'
     or v_deal.buyer_id is distinct from p_buyer_id
     or v_deal.buyer_id is null
     or v_deal.seller_id = p_buyer_id then
    raise exception using errcode = '42501', message = 'checkout_not_authorized';
  end if;
  if upper(trim(v_deal.currency::text)) <> 'USD'
     or v_deal.price_cents not between 100 and p_max_amount_cents then
    raise exception using errcode = '22023', message = 'checkout_amount_not_allowed';
  end if;
  if v_deal.current_agreement_version < 1 then
    raise exception using errcode = '22023', message = 'current_agreement_required';
  end if;

  select *
  into v_agreement
  from public.agreement_versions
  where deal_id = v_deal.id
    and version = v_deal.current_agreement_version;

  if not found
     or v_agreement.terms_json ->> 'price_cents' <> v_deal.price_cents::text
     or upper(coalesce(v_agreement.terms_json ->> 'currency', '')) <> 'USD' then
    raise exception using errcode = '23000', message = 'agreement_snapshot_mismatch';
  end if;

  select count(distinct acceptance.signer_id)
  into v_acceptance_count
  from public.agreement_acceptances acceptance
  where acceptance.agreement_version_id = v_agreement.id
    and acceptance.signer_id in (v_deal.buyer_id, v_deal.seller_id);

  if v_acceptance_count <> 2 then
    raise exception using errcode = '23000', message = 'agreement_acceptance_incomplete';
  end if;

  select *
  into v_seller
  from public.profiles
  where id = v_deal.seller_id
  for update;

  if not found
     or v_seller.stripe_account_id is null
     or not v_seller.stripe_details_submitted
     or not v_seller.stripe_payouts_enabled
     or not v_seller.stripe_transfers_active then
    raise exception using errcode = '22023', message = 'seller_payouts_not_ready';
  end if;

  v_platform_fee := round(v_deal.price_cents::numeric * p_fee_bps / 10000)::bigint;
  v_seller_amount := v_deal.price_cents - v_platform_fee;
  if v_platform_fee < 0 or v_seller_amount <= 0 then
    raise exception using errcode = '22023', message = 'invalid_fee_amount';
  end if;
  v_transfer_group := 'DLV_' || replace(v_deal.id::text, '-', '');

  select *
  into v_payment
  from public.protected_payments
  where deal_id = v_deal.id
  for update;

  if found then
    if v_payment.buyer_id <> v_deal.buyer_id
       or v_payment.seller_id <> v_deal.seller_id
       or v_payment.seller_stripe_account_id <> v_seller.stripe_account_id
       or v_payment.item_amount_cents <> v_deal.price_cents
       or v_payment.platform_fee_cents <> v_platform_fee
       or v_payment.seller_amount_cents <> v_seller_amount
       or upper(v_payment.currency) <> 'USD'
       or v_payment.agreement_version <> v_deal.current_agreement_version
       or v_payment.fee_bps <> p_fee_bps
       or v_payment.fee_version <> p_fee_version then
      raise exception using errcode = '23000', message = 'checkout_snapshot_conflict';
    end if;

    if v_payment.status in (
      'processing', 'funds_secured', 'release_pending', 'released',
      'refund_pending', 'refunded', 'disputed', 'release_failed'
    ) then
      raise exception using errcode = '23000', message = 'payment_already_exists';
    end if;

    if v_payment.status = 'checkout_created'
       and v_payment.checkout_url is not null
       and v_payment.checkout_expires_at > now() + interval '60 seconds' then
      return jsonb_build_object(
        'disposition', 'reused',
        'paymentId', v_payment.id,
        'checkoutUrl', v_payment.checkout_url,
        'checkoutExpiresAt', v_payment.checkout_expires_at
      );
    end if;

    if (v_payment.payment_intent_id is not null or v_payment.charge_id is not null)
       and v_payment.status in ('checkout_created', 'failed', 'expired', 'cancelled') then
      raise exception using errcode = '23000', message = 'checkout_refresh_requires_review';
    end if;

    v_attempt := case
      when v_payment.status = 'checkout_created' then v_payment.checkout_attempt
      else least(v_payment.checkout_attempt + 1, 100)
    end;
    update public.protected_payments
    set status = 'checkout_created',
        checkout_attempt = v_attempt,
        checkout_session_id = null,
        checkout_url = null,
        checkout_expires_at = null,
        failure_message = null,
        updated_at = now()
    where id = v_payment.id
    returning * into v_payment;
  else
    insert into public.protected_payments (
      deal_id, buyer_id, seller_id, seller_stripe_account_id,
      item_amount_cents, platform_fee_cents, seller_amount_cents,
      currency, status, transfer_group, agreement_version, fee_bps,
      fee_version, checkout_attempt
    )
    values (
      v_deal.id, v_deal.buyer_id, v_deal.seller_id, v_seller.stripe_account_id,
      v_deal.price_cents, v_platform_fee, v_seller_amount,
      'USD', 'checkout_created', v_transfer_group, v_deal.current_agreement_version,
      p_fee_bps, p_fee_version, 1
    )
    returning * into v_payment;
  end if;

  v_idempotency_key := format(
    'dealivra-checkout-%s-v%s-fee%s-a%s',
    replace(v_payment.id::text, '-', ''),
    v_payment.agreement_version,
    v_payment.fee_version,
    v_payment.checkout_attempt
  );

  select *
  into v_command
  from public.stripe_financial_commands
  where idempotency_key = v_idempotency_key
  for update;

  if found then
    if v_command.status = 'succeeded'
       and v_payment.checkout_url is not null
       and v_payment.checkout_expires_at > now() + interval '60 seconds' then
      return jsonb_build_object(
        'disposition', 'reused',
        'paymentId', v_payment.id,
        'checkoutUrl', v_payment.checkout_url,
        'checkoutExpiresAt', v_payment.checkout_expires_at
      );
    end if;
    if v_command.status = 'prepared'
       and v_command.claimed_at > now() - interval '5 minutes' then
      return jsonb_build_object('disposition', 'in_progress');
    end if;
    if v_command.attempt_count >= 100 then
      raise exception using errcode = '54000', message = 'command_attempt_limit';
    end if;

    update public.stripe_financial_commands
    set status = 'prepared',
        claim_token = v_token,
        claimed_at = now(),
        attempt_count = attempt_count + 1,
        last_error_code = null,
        completed_at = null,
        updated_at = now()
    where id = v_command.id
    returning * into v_command;
  else
    insert into public.stripe_financial_commands (
      payment_id, deal_id, command_type, idempotency_key, status,
      claim_token, claimed_at, requested_by, amount_cents, currency,
      seller_stripe_account_id, previous_payment_status,
      agreement_version, fee_version
    )
    values (
      v_payment.id, v_deal.id, 'checkout', v_idempotency_key, 'prepared',
      v_token, now(), p_buyer_id, v_payment.item_amount_cents, v_payment.currency,
      v_payment.seller_stripe_account_id, null,
      v_payment.agreement_version, v_payment.fee_version
    )
    returning * into v_command;
  end if;

  return jsonb_build_object(
    'disposition', 'claimed',
    'commandId', v_command.id,
    'claimToken', v_command.claim_token,
    'idempotencyKey', v_command.idempotency_key,
    'paymentId', v_payment.id,
    'dealId', v_deal.id,
    'dealPublicId', v_deal.public_id,
    'title', left(v_deal.title, 120),
    'buyerId', v_deal.buyer_id,
    'sellerId', v_deal.seller_id,
    'sellerStripeAccountId', v_payment.seller_stripe_account_id,
    'itemAmountCents', v_payment.item_amount_cents,
    'platformFeeCents', v_payment.platform_fee_cents,
    'sellerAmountCents', v_payment.seller_amount_cents,
    'currency', v_payment.currency,
    'transferGroup', v_payment.transfer_group,
    'agreementVersion', v_payment.agreement_version,
    'feeVersion', v_payment.fee_version
  );
end;
$$;

create or replace function public.attach_stripe_checkout_session(
  p_command_id uuid,
  p_claim_token uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_checkout_url text,
  p_checkout_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_command public.stripe_financial_commands%rowtype;
  v_payment public.protected_payments%rowtype;
  v_updated integer;
begin
  if p_checkout_session_id is null
     or p_checkout_session_id !~ '^cs_test_[A-Za-z0-9_]{8,255}$'
     or (p_payment_intent_id is not null and p_payment_intent_id !~ '^pi_[A-Za-z0-9_]{8,255}$')
     or p_checkout_url is null
     or p_checkout_url !~ '^https://checkout[.]stripe[.]com/'
     or p_checkout_expires_at is null
     or p_checkout_expires_at <= now() + interval '60 seconds' then
    raise exception using errcode = '22023', message = 'invalid_checkout_session';
  end if;

  select *
  into v_command
  from public.stripe_financial_commands
  where id = p_command_id
  for update;

  if not found
     or v_command.command_type <> 'checkout'
     or v_command.status <> 'prepared'
     or v_command.claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'financial_command_claim_lost';
  end if;

  select *
  into v_payment
  from public.protected_payments
  where id = v_command.payment_id
  for update;

  if not found
     or v_payment.status not in ('checkout_created', 'processing', 'funds_secured')
     or (v_payment.checkout_session_id is not null and v_payment.checkout_session_id <> p_checkout_session_id)
     or (p_payment_intent_id is not null
         and v_payment.payment_intent_id is not null
         and v_payment.payment_intent_id <> p_payment_intent_id) then
    raise exception using errcode = '23000', message = 'checkout_session_conflict';
  end if;

  update public.protected_payments
  set checkout_session_id = p_checkout_session_id,
      payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
      checkout_url = p_checkout_url,
      checkout_expires_at = p_checkout_expires_at,
      failure_message = null,
      updated_at = now()
  where id = v_payment.id;

  update public.stripe_financial_commands
  set status = 'succeeded',
      provider_object_id = p_checkout_session_id,
      claim_token = null,
      last_error_code = null,
      completed_at = now(),
      updated_at = now()
  where id = v_command.id
    and status = 'prepared'
    and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception using errcode = '40001', message = 'financial_command_claim_lost';
  end if;

  insert into public.audit_events (deal_id, actor_id, event_type, metadata)
  values (
    v_command.deal_id,
    v_command.requested_by,
    'payment_checkout_created',
    jsonb_build_object('command_id', v_command.id, 'agreement_version', v_command.agreement_version)
  );

  return true;
end;
$$;

create or replace function public.prepare_stripe_financial_command(
  p_deal_id uuid,
  p_dispute_id uuid,
  p_command_type text,
  p_actor_id uuid,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_deal public.deals%rowtype;
  v_seller public.profiles%rowtype;
  v_payment public.protected_payments%rowtype;
  v_dispute public.deal_disputes%rowtype;
  v_command public.stripe_financial_commands%rowtype;
  v_token uuid := gen_random_uuid();
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 900);
  v_amount bigint;
  v_idempotency_key text;
  v_pending_status text;
begin
  if p_command_type not in ('release', 'dispute_refund', 'dispute_release')
     or p_deal_id is null
     or p_actor_id is null then
    raise exception using errcode = '22023', message = 'invalid_financial_command';
  end if;

  select *
  into v_actor
  from public.profiles
  where id = p_actor_id
  for update;

  if not found or v_actor.app_role <> 'admin' or not v_actor.is_admin then
    raise exception using errcode = '42501', message = 'admin_access_required';
  end if;

  select *
  into v_deal
  from public.deals
  where id = p_deal_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'deal_not_found';
  end if;

  select *
  into v_payment
  from public.protected_payments
  where deal_id = v_deal.id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'protected_payment_not_found';
  end if;

  select *
  into v_seller
  from public.profiles
  where id = v_deal.seller_id
  for update;

  if not found or v_seller.stripe_account_id is null then
    raise exception using errcode = '23000', message = 'seller_payouts_not_ready';
  end if;

  if v_deal.buyer_id is null
     or v_payment.deal_id <> v_deal.id
     or v_payment.buyer_id <> v_deal.buyer_id
     or v_payment.seller_id <> v_deal.seller_id
     or v_payment.seller_stripe_account_id <> v_seller.stripe_account_id
     or v_payment.item_amount_cents <> v_deal.price_cents
     or upper(v_payment.currency) <> upper(trim(v_deal.currency::text))
     or v_payment.seller_amount_cents + v_payment.platform_fee_cents <> v_payment.item_amount_cents
     or v_payment.payment_intent_id is null
     or v_payment.charge_id is null then
    raise exception using errcode = '23000', message = 'payment_snapshot_mismatch';
  end if;

  if upper(v_payment.currency) <> 'USD' then
    raise exception using errcode = '22023', message = 'payment_currency_not_allowed';
  end if;
  if p_command_type in ('release', 'dispute_release')
     and (
       not v_seller.stripe_details_submitted
       or not v_seller.stripe_payouts_enabled
       or not v_seller.stripe_transfers_active
     ) then
    raise exception using errcode = '23000', message = 'seller_payouts_not_ready';
  end if;

  if p_command_type = 'release' then
    if p_dispute_id is not null
       or v_deal.status <> 'completed'
       or exists (
         select 1
         from public.deal_disputes dispute
         where dispute.deal_id = v_deal.id
           and dispute.status in ('open', 'evidence_requested', 'under_review')
       ) then
      raise exception using errcode = '23000', message = 'release_not_eligible';
    end if;
    if v_payment.transfer_id is not null and v_payment.status = 'released' then
      return jsonb_build_object(
        'disposition', 'succeeded',
        'action', 'transfer',
        'providerObjectId', v_payment.transfer_id
      );
    end if;
    if v_payment.status not in ('funds_secured', 'release_failed', 'release_pending') then
      raise exception using errcode = '23000', message = 'illegal_payment_transition';
    end if;
    v_amount := v_payment.seller_amount_cents;
    v_pending_status := 'release_pending';
    v_idempotency_key := 'dealivra-release-' || replace(v_payment.id::text, '-', '');
  else
    if p_dispute_id is null or v_deal.status <> 'disputed' then
      raise exception using errcode = '23000', message = 'active_dispute_required';
    end if;

    select *
    into v_dispute
    from public.deal_disputes
    where id = p_dispute_id
      and deal_id = v_deal.id
    for update;

    if not found or v_dispute.status not in ('open', 'evidence_requested', 'under_review') then
      raise exception using errcode = '23000', message = 'active_dispute_required';
    end if;

    if p_command_type = 'dispute_refund' then
      if v_payment.refund_id is not null and v_payment.status = 'refunded' then
        return jsonb_build_object(
          'disposition', 'succeeded',
          'action', 'refund',
          'providerObjectId', v_payment.refund_id
        );
      end if;
      if v_payment.transfer_id is not null
         or v_payment.status not in (
           'funds_secured', 'disputed', 'release_failed', 'refund_pending'
         ) then
        raise exception using errcode = '23000', message = 'illegal_payment_transition';
      end if;
      v_amount := v_payment.item_amount_cents;
      v_pending_status := 'refund_pending';
      v_idempotency_key := format(
        'dealivra-dispute-refund-%s-%s',
        replace(v_payment.id::text, '-', ''),
        replace(v_dispute.id::text, '-', '')
      );
    else
      if v_payment.transfer_id is not null and v_payment.status = 'released' then
        return jsonb_build_object(
          'disposition', 'succeeded',
          'action', 'transfer',
          'providerObjectId', v_payment.transfer_id
        );
      end if;
      if v_payment.status not in (
        'funds_secured', 'disputed', 'release_failed', 'release_pending'
      ) then
        raise exception using errcode = '23000', message = 'illegal_payment_transition';
      end if;
      v_amount := v_payment.seller_amount_cents;
      v_pending_status := 'release_pending';
      v_idempotency_key := format(
        'dealivra-dispute-release-%s-%s',
        replace(v_payment.id::text, '-', ''),
        replace(v_dispute.id::text, '-', '')
      );
    end if;
  end if;

  select *
  into v_command
  from public.stripe_financial_commands
  where idempotency_key = v_idempotency_key
  for update;

  if found then
    if v_command.payment_id <> v_payment.id
       or v_command.deal_id <> v_deal.id
       or v_command.dispute_id is distinct from p_dispute_id
       or v_command.command_type <> p_command_type
       or v_command.amount_cents <> v_amount
       or v_command.currency <> v_payment.currency
       or v_command.seller_stripe_account_id <> v_payment.seller_stripe_account_id
       or v_command.agreement_version <> v_payment.agreement_version
       or v_command.fee_version <> v_payment.fee_version then
      raise exception using errcode = '23000', message = 'financial_command_snapshot_conflict';
    end if;
    if v_command.status = 'succeeded' then
      return jsonb_build_object(
        'disposition', 'succeeded',
        'action', case when p_command_type = 'dispute_refund' then 'refund' else 'transfer' end,
        'providerObjectId', v_command.provider_object_id
      );
    end if;
    if v_command.status = 'prepared'
       and v_command.claimed_at >= now() - make_interval(secs => v_lease_seconds) then
      return jsonb_build_object('disposition', 'in_progress');
    end if;
    if v_command.attempt_count >= 100 then
      raise exception using errcode = '54000', message = 'command_attempt_limit';
    end if;

    update public.stripe_financial_commands
    set status = 'prepared',
        claim_token = v_token,
        claimed_at = now(),
        attempt_count = attempt_count + 1,
        last_error_code = null,
        completed_at = null,
        updated_at = now()
    where id = v_command.id
    returning * into v_command;
  else
    insert into public.stripe_financial_commands (
      payment_id, deal_id, dispute_id, command_type, idempotency_key,
      status, claim_token, claimed_at, requested_by, amount_cents,
      currency, seller_stripe_account_id, previous_payment_status,
      agreement_version, fee_version
    )
    values (
      v_payment.id, v_deal.id, p_dispute_id, p_command_type, v_idempotency_key,
      'prepared', v_token, now(), p_actor_id, v_amount,
      v_payment.currency, v_payment.seller_stripe_account_id, v_payment.status,
      v_payment.agreement_version, v_payment.fee_version
    )
    returning * into v_command;
  end if;

  update public.protected_payments
  set status = v_pending_status,
      failure_message = null,
      updated_at = now()
  where id = v_payment.id;

  return jsonb_build_object(
    'disposition', 'claimed',
    'action', case when p_command_type = 'dispute_refund' then 'refund' else 'transfer' end,
    'commandId', v_command.id,
    'claimToken', v_command.claim_token,
    'idempotencyKey', v_command.idempotency_key,
    'paymentId', v_payment.id,
    'dealId', v_deal.id,
    'dealPublicId', v_deal.public_id,
    'buyerId', v_payment.buyer_id,
    'sellerId', v_payment.seller_id,
    'disputeId', p_dispute_id,
    'amountCents', v_amount,
    'itemAmountCents', v_payment.item_amount_cents,
    'currency', v_payment.currency,
    'sellerStripeAccountId', v_payment.seller_stripe_account_id,
    'paymentIntentId', v_payment.payment_intent_id,
    'chargeId', v_payment.charge_id,
    'transferGroup', v_payment.transfer_group,
    'agreementVersion', v_payment.agreement_version,
    'feeVersion', v_payment.fee_version
  );
end;
$$;

create or replace function public.finalize_stripe_financial_command(
  p_command_id uuid,
  p_claim_token uuid,
  p_provider_object_id text,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_command public.stripe_financial_commands%rowtype;
  v_payment public.protected_payments%rowtype;
  v_dispute public.deal_disputes%rowtype;
  v_note text := trim(coalesce(p_resolution_note, ''));
  v_now timestamptz := now();
  v_updated integer;
  v_action text;
begin
  select *
  into v_command
  from public.stripe_financial_commands
  where id = p_command_id
  for update;

  if not found
     or v_command.status <> 'prepared'
     or v_command.claim_token is distinct from p_claim_token
     or v_command.command_type = 'checkout' then
    raise exception using errcode = '40001', message = 'financial_command_claim_lost';
  end if;
  if (
      v_command.command_type in ('release', 'dispute_release')
      and (p_provider_object_id is null or p_provider_object_id !~ '^tr_[A-Za-z0-9_]{8,255}$')
    ) or (
      v_command.command_type = 'dispute_refund'
      and (p_provider_object_id is null or p_provider_object_id !~ '^re_[A-Za-z0-9_]{8,255}$')
    ) then
    raise exception using errcode = '22023', message = 'invalid_provider_object';
  end if;
  if v_command.dispute_id is not null and char_length(v_note) not between 3 and 1000 then
    raise exception using errcode = '22023', message = 'resolution_note_required';
  end if;

  select *
  into v_payment
  from public.protected_payments
  where id = v_command.payment_id
  for update;

  if not found
     or v_payment.deal_id <> v_command.deal_id
     or v_payment.item_amount_cents < v_command.amount_cents
     or v_payment.currency <> v_command.currency
     or v_payment.seller_stripe_account_id <> v_command.seller_stripe_account_id
     or v_payment.agreement_version <> v_command.agreement_version
     or v_payment.fee_version <> v_command.fee_version then
    raise exception using errcode = '23000', message = 'payment_snapshot_mismatch';
  end if;

  if v_command.command_type = 'dispute_refund' then
    if v_payment.status <> 'refund_pending'
       or v_payment.transfer_id is not null
       or (v_payment.refund_id is not null and v_payment.refund_id <> p_provider_object_id) then
      raise exception using errcode = '23000', message = 'illegal_payment_transition';
    end if;
    update public.protected_payments
    set status = 'refunded',
        refund_id = p_provider_object_id,
        refunded_at = v_now,
        failure_message = null,
        updated_at = v_now
    where id = v_payment.id;
    v_action := 'refund';
  else
    if v_payment.status <> 'release_pending'
       or v_payment.refund_id is not null
       or (v_payment.transfer_id is not null and v_payment.transfer_id <> p_provider_object_id) then
      raise exception using errcode = '23000', message = 'illegal_payment_transition';
    end if;
    update public.protected_payments
    set status = 'released',
        transfer_id = p_provider_object_id,
        released_at = v_now,
        failure_message = null,
        updated_at = v_now
    where id = v_payment.id;
    v_action := 'transfer';
  end if;

  if v_command.dispute_id is not null then
    select *
    into v_dispute
    from public.deal_disputes
    where id = v_command.dispute_id
      and deal_id = v_command.deal_id
    for update;

    if not found or v_dispute.status not in ('open', 'evidence_requested', 'under_review') then
      raise exception using errcode = '23000', message = 'active_dispute_required';
    end if;

    update public.deal_disputes
    set status = case
          when v_command.command_type = 'dispute_refund' then 'resolved_buyer'
          else 'resolved_seller'
        end,
        resolution_note = v_note,
        resolved_by = v_command.requested_by,
        resolved_at = v_now,
        updated_at = v_now
    where id = v_dispute.id
      and status in ('open', 'evidence_requested', 'under_review');

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using errcode = '40001', message = 'dispute_transition_lost';
    end if;

    update public.deals
    set status = case
          when v_command.command_type = 'dispute_refund' then 'cancelled'::public.deal_status
          else 'completed'::public.deal_status
        end,
        updated_at = v_now
    where id = v_command.deal_id
      and status = 'disputed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using errcode = '40001', message = 'deal_transition_lost';
    end if;
  end if;

  update public.stripe_financial_commands
  set status = 'succeeded',
      provider_object_id = p_provider_object_id,
      claim_token = null,
      last_error_code = null,
      completed_at = v_now,
      updated_at = v_now
  where id = v_command.id
    and status = 'prepared'
    and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception using errcode = '40001', message = 'financial_command_claim_lost';
  end if;

  insert into public.audit_events (deal_id, actor_id, event_type, metadata)
  values (
    v_command.deal_id,
    v_command.requested_by,
    case
      when v_command.command_type = 'release' then 'payment_released'
      when v_command.command_type = 'dispute_refund' then 'dispute_refunded'
      else 'dispute_released_to_seller'
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'command_id', v_command.id,
      'dispute_id', v_command.dispute_id,
      'agreement_version', v_command.agreement_version
    ))
  );

  return jsonb_build_object(
    'resolved', true,
    'action', v_action,
    'providerObjectId', p_provider_object_id
  );
end;
$$;

create or replace function public.fail_stripe_financial_command(
  p_command_id uuid,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_command public.stripe_financial_commands%rowtype;
  v_updated integer;
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,64}$' then
    p_error_code := 'provider_request_failed';
  end if;

  select *
  into v_command
  from public.stripe_financial_commands
  where id = p_command_id
  for update;

  if not found
     or v_command.status <> 'prepared'
     or v_command.claim_token is distinct from p_claim_token then
    return false;
  end if;

  if v_command.command_type = 'checkout' then
    update public.protected_payments
    set status = 'failed',
        failure_message = 'Checkout could not be started. Please try again.',
        updated_at = now()
    where id = v_command.payment_id
      and status = 'checkout_created'
      and checkout_session_id is null;
  elsif v_command.command_type = 'release' then
    update public.protected_payments
    set status = 'release_failed',
        failure_message = 'Seller payout needs an operations review before retrying.',
        updated_at = now()
    where id = v_command.payment_id
      and status = 'release_pending';
  elsif v_command.command_type in ('dispute_refund', 'dispute_release') then
    update public.protected_payments
    set status = 'disputed',
        failure_message = 'The financial resolution needs an operations review before retrying.',
        updated_at = now()
    where id = v_command.payment_id
      and status in ('refund_pending', 'release_pending');
  end if;

  update public.stripe_financial_commands
  set status = 'failed',
      claim_token = null,
      last_error_code = p_error_code,
      completed_at = now(),
      updated_at = now()
  where id = v_command.id
    and status = 'prepared'
    and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    insert into public.audit_events (deal_id, actor_id, event_type, metadata)
    values (
      v_command.deal_id,
      v_command.requested_by,
      'payment_command_failed',
      jsonb_build_object(
        'command_id', v_command.id,
        'command_type', v_command.command_type,
        'error_code', p_error_code
      )
    );
  end if;

  return v_updated = 1;
end;
$$;

revoke all on function public.prepare_stripe_checkout(uuid, uuid, integer, text, bigint)
  from public, anon, authenticated;
revoke all on function public.attach_stripe_checkout_session(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.prepare_stripe_financial_command(uuid, uuid, text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.finalize_stripe_financial_command(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_stripe_financial_command(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.prepare_stripe_checkout(uuid, uuid, integer, text, bigint)
  to service_role;
grant execute on function public.attach_stripe_checkout_session(uuid, uuid, text, text, text, timestamptz)
  to service_role;
grant execute on function public.prepare_stripe_financial_command(uuid, uuid, text, uuid, integer)
  to service_role;
grant execute on function public.finalize_stripe_financial_command(uuid, uuid, text, text)
  to service_role;
grant execute on function public.fail_stripe_financial_command(uuid, uuid, text)
  to service_role;
