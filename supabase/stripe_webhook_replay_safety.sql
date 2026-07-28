-- Atomic Stripe webhook claiming and provider-state application for the US Sandbox beta.
-- Run after stripe_protected_payments_setup.sql. Safe to rerun.

alter table public.stripe_webhook_events
  add column if not exists status text,
  add column if not exists attempt_count integer,
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists stripe_created_at timestamptz,
  add column if not exists livemode boolean,
  add column if not exists outcome text,
  add column if not exists payment_id uuid references public.protected_payments(id) on delete set null;

update public.stripe_webhook_events
set status = coalesce(status, 'processed'),
    attempt_count = coalesce(attempt_count, 1),
    claimed_at = coalesce(claimed_at, processed_at),
    stripe_created_at = coalesce(stripe_created_at, processed_at),
    livemode = coalesce(livemode, false),
    outcome = coalesce(outcome, 'historical_processed')
where status is null;

alter table public.stripe_webhook_events
  alter column status set default 'processing',
  alter column status set not null,
  alter column attempt_count set default 1,
  alter column attempt_count set not null,
  alter column claimed_at set default now(),
  alter column claimed_at set not null,
  alter column stripe_created_at set not null,
  alter column livemode set not null,
  alter column processed_at drop not null,
  alter column processed_at drop default;

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_status_check;
alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_status_check
  check (status in ('processing', 'processed', 'failed'));

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_attempt_count_check;
alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_attempt_count_check
  check (attempt_count between 1 and 100);

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_error_code_check;
alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_error_code_check
  check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$');

alter table public.protected_payments
  add column if not exists state_event_created_at timestamptz,
  add column if not exists state_event_id text;

create index if not exists stripe_webhook_events_status_claimed_idx
  on public.stripe_webhook_events(status, claimed_at);
create index if not exists stripe_webhook_events_payment_id_idx
  on public.stripe_webhook_events(payment_id)
  where payment_id is not null;

comment on table public.stripe_webhook_events is
  'Service-only Stripe delivery ledger. Raw provider payloads and payment credentials are never stored.';
comment on column public.stripe_webhook_events.claim_token is
  'Short-lived worker fencing token. A reclaimed event invalidates the prior worker.';
comment on column public.protected_payments.state_event_created_at is
  'Provider event time for the last accepted payment-state transition.';

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stripe_created_at timestamptz,
  p_livemode boolean,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.stripe_webhook_events%rowtype;
  v_token uuid := gen_random_uuid();
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 900);
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]{8,255}$' then
    raise exception using errcode = '22023', message = 'invalid_event_id';
  end if;
  if p_event_type is null or p_event_type !~ '^[a-z0-9_.]{1,100}$' then
    raise exception using errcode = '22023', message = 'invalid_event_type';
  end if;
  if p_stripe_created_at is null or p_stripe_created_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid_event_time';
  end if;
  if coalesce(p_livemode, false) then
    raise exception using errcode = '22023', message = 'live_mode_not_allowed';
  end if;

  insert into public.stripe_webhook_events (
    id, event_type, status, attempt_count, claim_token, claimed_at,
    stripe_created_at, livemode, processed_at
  )
  values (
    p_event_id, p_event_type, 'processing', 1, v_token, now(),
    p_stripe_created_at, false, null
  )
  on conflict (id) do nothing
  returning * into v_event;

  if found then
    return jsonb_build_object('disposition', 'claimed', 'claimToken', v_token);
  end if;

  select *
  into v_event
  from public.stripe_webhook_events
  where id = p_event_id
  for update;

  if v_event.event_type <> p_event_type then
    raise exception using errcode = '22023', message = 'event_type_mismatch';
  end if;
  if v_event.livemode <> false then
    raise exception using errcode = '22023', message = 'event_mode_mismatch';
  end if;
  if v_event.status = 'processed' then
    return jsonb_build_object('disposition', 'processed');
  end if;
  if v_event.status = 'processing'
     and v_event.claimed_at >= now() - make_interval(secs => v_lease_seconds) then
    return jsonb_build_object('disposition', 'in_progress');
  end if;
  if v_event.attempt_count >= 100 then
    raise exception using errcode = '54000', message = 'event_attempt_limit';
  end if;

  update public.stripe_webhook_events
  set status = 'processing',
      attempt_count = attempt_count + 1,
      claim_token = v_token,
      claimed_at = now(),
      failed_at = null,
      last_error_code = null,
      outcome = null,
      processed_at = null
  where id = p_event_id;

  return jsonb_build_object('disposition', 'claimed', 'claimToken', v_token);
end;
$$;

create or replace function public.fail_stripe_webhook_event(
  p_event_id text,
  p_claim_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,64}$' then
    p_error_code := 'processing_failed';
  end if;

  update public.stripe_webhook_events
  set status = 'failed',
      failed_at = now(),
      last_error_code = p_error_code,
      claim_token = null,
      outcome = null,
      processed_at = null
  where id = p_event_id
    and status = 'processing'
    and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.apply_stripe_webhook_event(
  p_event_id text,
  p_claim_token uuid,
  p_event_type text,
  p_deal_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_payment_status text,
  p_failure_code text,
  p_failure_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.stripe_webhook_events%rowtype;
  v_payment public.protected_payments%rowtype;
  v_matches uuid[];
  v_previous_status text;
  v_next_status text;
  v_outcome text := 'ignored_event_type';
  v_transitioned boolean := false;
  v_state_time timestamptz;
begin
  select *
  into v_event
  from public.stripe_webhook_events
  where id = p_event_id
  for update;

  if not found
     or v_event.status <> 'processing'
     or v_event.claim_token is distinct from p_claim_token
     or v_event.event_type <> p_event_type then
    raise exception using errcode = '40001', message = 'webhook_claim_lost';
  end if;

  if p_event_type not in (
    'checkout.session.completed',
    'checkout.session.expired',
    'payment_intent.processing',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'charge.dispute.created',
    'charge.refunded'
  ) then
    update public.stripe_webhook_events
    set status = 'processed',
        processed_at = now(),
        outcome = v_outcome,
        claim_token = null,
        last_error_code = null
    where id = p_event_id;
    return jsonb_build_object('outcome', v_outcome);
  end if;

  select array_agg(distinct payment.id)
  into v_matches
  from public.protected_payments payment
  where (p_deal_id is not null and payment.deal_id = p_deal_id)
     or (p_checkout_session_id is not null and payment.checkout_session_id = p_checkout_session_id)
     or (p_payment_intent_id is not null and payment.payment_intent_id = p_payment_intent_id)
     or (p_charge_id is not null and payment.charge_id = p_charge_id);

  if coalesce(cardinality(v_matches), 0) = 0 then
    raise exception using errcode = 'P0002', message = 'payment_reference_not_found';
  end if;
  if cardinality(v_matches) <> 1 then
    raise exception using errcode = '23000', message = 'payment_reference_conflict';
  end if;

  select *
  into v_payment
  from public.protected_payments
  where id = v_matches[1]
  for update;

  if (p_deal_id is not null and v_payment.deal_id <> p_deal_id)
     or (p_checkout_session_id is not null
         and v_payment.checkout_session_id is not null
         and v_payment.checkout_session_id <> p_checkout_session_id)
     or (p_payment_intent_id is not null
         and v_payment.payment_intent_id is not null
         and v_payment.payment_intent_id <> p_payment_intent_id)
     or (p_charge_id is not null
         and v_payment.charge_id is not null
         and v_payment.charge_id <> p_charge_id) then
    raise exception using errcode = '23000', message = 'payment_identifier_mismatch';
  end if;

  v_previous_status := v_payment.status;
  v_next_status := v_previous_status;
  v_state_time := coalesce(v_payment.state_event_created_at, '-infinity'::timestamptz);

  if p_event_type = 'checkout.session.completed' then
    if p_payment_status = 'paid'
       and v_previous_status in ('checkout_created', 'processing', 'failed', 'expired')
       and v_event.stripe_created_at >= v_state_time then
      v_next_status := 'funds_secured';
    elsif p_payment_status <> 'paid'
       and v_previous_status in ('checkout_created', 'processing', 'failed', 'expired')
       and v_event.stripe_created_at >= v_state_time then
      v_next_status := 'processing';
    end if;
  elsif p_event_type = 'checkout.session.expired' then
    if v_previous_status = 'checkout_created'
       and v_event.stripe_created_at >= v_state_time then
      v_next_status := 'expired';
    end if;
  elsif p_event_type = 'payment_intent.processing' then
    if v_previous_status in ('checkout_created', 'processing', 'failed', 'expired')
       and v_event.stripe_created_at >= v_state_time then
      v_next_status := 'processing';
    end if;
  elsif p_event_type = 'payment_intent.succeeded' then
    if v_previous_status in ('checkout_created', 'processing', 'failed', 'expired')
       and v_event.stripe_created_at >= v_state_time then
      v_next_status := 'funds_secured';
    end if;
  elsif p_event_type = 'payment_intent.payment_failed' then
    if v_previous_status in ('checkout_created', 'processing', 'failed')
       and v_event.stripe_created_at >= v_state_time then
      v_next_status := 'failed';
    end if;
  elsif p_event_type = 'charge.dispute.created' then
    if v_previous_status <> 'refunded' then
      v_next_status := 'disputed';
    end if;
  elsif p_event_type = 'charge.refunded' then
    v_next_status := 'refunded';
  end if;

  v_transitioned := v_next_status <> v_previous_status;
  if v_transitioned then
    v_outcome := 'transitioned';
  elsif v_next_status = v_previous_status
        and (
          (p_checkout_session_id is not null and v_payment.checkout_session_id is null)
          or (p_payment_intent_id is not null and v_payment.payment_intent_id is null)
          or (p_charge_id is not null and v_payment.charge_id is null)
        ) then
    v_outcome := 'identifier_enriched';
  else
    v_outcome := 'ignored_state_regression';
  end if;

  update public.protected_payments
  set status = v_next_status,
      checkout_session_id = coalesce(checkout_session_id, p_checkout_session_id),
      payment_intent_id = coalesce(payment_intent_id, p_payment_intent_id),
      charge_id = coalesce(charge_id, p_charge_id),
      checkout_url = case
        when v_next_status in ('expired', 'funds_secured', 'refunded') then null
        else checkout_url
      end,
      failure_message = case
        when v_next_status = 'failed' then left(coalesce(p_failure_message, 'Payment was not completed.'), 240)
        when v_next_status in ('processing', 'funds_secured') then null
        else failure_message
      end,
      paid_at = case
        when v_next_status = 'funds_secured' then coalesce(paid_at, v_event.stripe_created_at)
        else paid_at
      end,
      disputed_at = case
        when v_next_status = 'disputed' then coalesce(disputed_at, v_event.stripe_created_at)
        else disputed_at
      end,
      refunded_at = case
        when v_next_status = 'refunded' then coalesce(refunded_at, v_event.stripe_created_at)
        else refunded_at
      end,
      state_event_created_at = case
        when v_transitioned then v_event.stripe_created_at
        else state_event_created_at
      end,
      state_event_id = case
        when v_transitioned then p_event_id
        else state_event_id
      end,
      updated_at = case
        when v_transitioned or v_outcome = 'identifier_enriched' then now()
        else updated_at
      end
  where id = v_payment.id;

  if v_transitioned and v_next_status = 'funds_secured' then
    insert into public.deal_payment_records (
      deal_id, method, proposed_by, buyer_confirmed_at,
      buyer_marked_sent_at, seller_marked_received_at, updated_at
    )
    values (
      v_payment.deal_id, 'card_invoice', v_payment.seller_id,
      v_event.stripe_created_at, v_event.stripe_created_at,
      v_event.stripe_created_at, now()
    )
    on conflict (deal_id) do update
    set method = excluded.method,
        proposed_by = excluded.proposed_by,
        buyer_confirmed_at = excluded.buyer_confirmed_at,
        buyer_marked_sent_at = excluded.buyer_marked_sent_at,
        seller_marked_received_at = excluded.seller_marked_received_at,
        updated_at = excluded.updated_at;

    insert into public.audit_events (deal_id, actor_id, event_type, metadata)
    values (
      v_payment.deal_id,
      v_payment.buyer_id,
      'payment_funds_secured',
      jsonb_build_object('provider', 'stripe', 'provider_event_id', p_event_id)
    );
  elsif v_transitioned and v_next_status = 'disputed' then
    update public.deals
    set status = 'disputed', updated_at = now()
    where id = v_payment.deal_id
      and status in ('accepted', 'completed', 'disputed');

    insert into public.audit_events (deal_id, actor_id, event_type, metadata)
    values (
      v_payment.deal_id,
      null,
      'payment_provider_dispute_opened',
      jsonb_build_object('provider', 'stripe', 'provider_event_id', p_event_id)
    );
  elsif v_transitioned and v_next_status = 'refunded' then
    insert into public.audit_events (deal_id, actor_id, event_type, metadata)
    values (
      v_payment.deal_id,
      null,
      'payment_provider_refunded',
      jsonb_build_object('provider', 'stripe', 'provider_event_id', p_event_id)
    );
  end if;

  update public.stripe_webhook_events
  set status = 'processed',
      processed_at = now(),
      outcome = v_outcome,
      payment_id = v_payment.id,
      claim_token = null,
      last_error_code = null
  where id = p_event_id;

  return jsonb_build_object(
    'outcome', v_outcome,
    'paymentStatus', v_next_status,
    'transitioned', v_transitioned
  );
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, integer) from public, anon, authenticated;
revoke all on function public.fail_stripe_webhook_event(text, uuid, text) from public, anon, authenticated;
revoke all on function public.apply_stripe_webhook_event(text, uuid, text, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, integer) to service_role;
grant execute on function public.fail_stripe_webhook_event(text, uuid, text) to service_role;
grant execute on function public.apply_stripe_webhook_event(text, uuid, text, uuid, text, text, text, text, text, text) to service_role;
