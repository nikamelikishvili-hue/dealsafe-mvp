-- Private payment acknowledgements for accepted deals. Safe to rerun.
-- Run after completion_setup.sql, inspection_receipt_setup.sql,
-- delivery_details_setup.sql, and deal_action_plan_setup.sql.
-- This records participant statements only; DealSafe does not move or verify money.
-- New deals are electronic-payment only. cash_at_handoff remains in the table
-- constraint solely so historical beta records continue to load.

create table if not exists public.deal_payment_records (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  method text not null check(method in ('cash_at_handoff','bank_transfer','payment_app','card_invoice','other')),
  proposed_by uuid not null references public.profiles(id),
  buyer_confirmed_at timestamptz,
  buyer_marked_sent_at timestamptz,
  seller_marked_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_payment_records enable row level security;
revoke all on table public.deal_payment_records from public, anon, authenticated;

drop function if exists public.set_deal_payment_method(uuid,text);
create function public.set_deal_payment_method(p_deal_id uuid,p_method text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_deal public.deals%rowtype;v_existing public.deal_payment_records%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or v_deal.seller_id<>auth.uid() or v_deal.status<>'accepted' then
    raise exception 'Only the seller can record a payment method for an accepted deal';
  end if;
  if p_method not in ('bank_transfer','payment_app','card_invoice') then
    raise exception 'DealSafe accepts only electronic payment methods';
  end if;
  select * into v_existing from public.deal_payment_records where deal_id=p_deal_id;
  if found and (v_existing.buyer_confirmed_at is not null
    or v_existing.buyer_marked_sent_at is not null
    or v_existing.seller_marked_received_at is not null) then
    raise exception 'Payment method is locked after confirmation';
  end if;

  insert into public.deal_payment_records(deal_id,method,proposed_by)
  values(p_deal_id,p_method,auth.uid())
  on conflict(deal_id) do update set method=excluded.method,proposed_by=excluded.proposed_by,
    buyer_confirmed_at=null,buyer_marked_sent_at=null,seller_marked_received_at=null,updated_at=now();

  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'payment_method_recorded');
end;
$$;

drop function if exists public.confirm_deal_payment_method(uuid);
create function public.confirm_deal_payment_method(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.deals where id=p_deal_id and buyer_id=auth.uid() and status='accepted') then
    raise exception 'Only the buyer can confirm the payment method';
  end if;
  update public.deal_payment_records set buyer_confirmed_at=now(),updated_at=now()
  where deal_id=p_deal_id and buyer_confirmed_at is null;
  if not found then raise exception 'Payment method is unavailable or already confirmed'; end if;
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'payment_method_confirmed');
end;
$$;

drop function if exists public.mark_deal_payment_sent(uuid);
create function public.mark_deal_payment_sent(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.deals where id=p_deal_id and buyer_id=auth.uid() and status='accepted') then
    raise exception 'Only the buyer can mark payment sent';
  end if;
  update public.deal_payment_records set buyer_marked_sent_at=now(),updated_at=now()
  where deal_id=p_deal_id and buyer_confirmed_at is not null and buyer_marked_sent_at is null;
  if not found then raise exception 'Confirm the payment method before recording payment'; end if;
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'payment_marked_sent');
end;
$$;

drop function if exists public.mark_deal_payment_received(uuid);
create function public.mark_deal_payment_received(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.deals where id=p_deal_id and seller_id=auth.uid() and status='accepted') then
    raise exception 'Only the seller can confirm payment received';
  end if;
  update public.deal_payment_records set seller_marked_received_at=now(),updated_at=now()
  where deal_id=p_deal_id and buyer_confirmed_at is not null and seller_marked_received_at is null;
  if not found then raise exception 'Buyer must confirm the payment method first'; end if;
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'payment_received');
end;
$$;

drop function if exists public.get_deal_payment_record(uuid);
create function public.get_deal_payment_record(p_deal_id uuid)
returns table(
  method text,
  buyer_confirmed_at timestamptz,
  buyer_marked_sent_at timestamptz,
  seller_marked_received_at timestamptz,
  updated_at timestamptz,
  viewer_role text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select payment.method,payment.buyer_confirmed_at,payment.buyer_marked_sent_at,
    payment.seller_marked_received_at,payment.updated_at,
    case when deal.seller_id=auth.uid() then 'seller' else 'buyer' end
  from public.deals deal
  join public.deal_payment_records payment on payment.deal_id=deal.id
  where deal.id=p_deal_id and auth.uid() is not null
    and auth.uid() in (deal.seller_id,deal.buyer_id)
    and deal.status in ('accepted','completed','disputed','cancelled');
$$;

-- Do not reveal a handoff PIN until both parties have arrived and payment is acknowledged.
create or replace function public.generate_handoff_pin(p_deal_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_pin text;
begin
  if not exists(select 1 from public.deals deal join public.deal_meetings meeting on meeting.deal_id=deal.id
    where deal.id=p_deal_id and deal.seller_id=auth.uid() and deal.status='accepted'
      and meeting.status='confirmed' and meeting.seller_arrived and meeting.buyer_arrived) then
    raise exception 'Both parties must arrive before generating a PIN';
  end if;
  if not exists(select 1 from public.deal_payment_records payment
    where payment.deal_id=p_deal_id and payment.seller_marked_received_at is not null) then
    raise exception 'Seller must confirm payment received before generating a PIN';
  end if;
  v_pin:=lpad((floor(random()*1000000))::int::text,6,'0');
  update public.deal_meetings set handoff_pin_hash=encode(extensions.digest(v_pin,'sha256'),'hex'),
    pin_created_at=now(),updated_at=now() where deal_id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'handoff_pin_generated');
  return v_pin;
end;
$$;

-- Require the seller's acknowledgement before an in-person handoff completes.
create or replace function public.complete_handoff(p_deal_id uuid,p_pin text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_deal public.deals%rowtype;v_meeting public.deal_meetings%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  select * into v_meeting from public.deal_meetings where deal_id=p_deal_id;
  if v_deal.buyer_id<>auth.uid() then raise exception 'Only the buyer can confirm receipt'; end if;
  if not(v_meeting.seller_arrived and v_meeting.buyer_arrived) then raise exception 'Both parties must arrive first'; end if;
  if not exists(select 1 from public.deal_payment_records payment where payment.deal_id=p_deal_id and payment.seller_marked_received_at is not null) then
    raise exception 'Seller must confirm payment received before handoff';
  end if;
  if not exists(select 1 from public.deal_inspections inspection where inspection.deal_id=p_deal_id and inspection.buyer_id=auth.uid() and inspection.agreement_version=greatest(v_deal.current_agreement_version,1)) then
    raise exception 'Save the inspection receipt before completing the deal';
  end if;
  if v_meeting.handoff_pin_hash is null or v_meeting.handoff_pin_hash<>encode(extensions.digest(trim(p_pin),'sha256'),'hex') then
    raise exception 'Incorrect handoff PIN';
  end if;
  update public.deals set status='completed',updated_at=now() where id=p_deal_id;
  update public.deal_meetings set handoff_pin_hash=null,updated_at=now() where deal_id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'deal_completed');
end;
$$;

-- Require both a protected address and payment acknowledgement before dispatch.
create or replace function public.create_deal_shipment(p_deal_id uuid,p_carrier text,p_tracking_number text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.deals where id=p_deal_id and seller_id=auth.uid()
    and status='accepted' and delivery_method='Ship to buyer') then
    raise exception 'Shipment is unavailable for this deal';
  end if;
  if not exists(select 1 from public.deal_delivery_details where deal_id=p_deal_id) then
    raise exception 'Buyer delivery address is required before shipping';
  end if;
  if not exists(select 1 from public.deal_payment_records payment where payment.deal_id=p_deal_id and payment.seller_marked_received_at is not null) then
    raise exception 'Confirm payment received before shipping';
  end if;
  if char_length(coalesce(trim(p_carrier),''))<2 or char_length(coalesce(trim(p_tracking_number),''))<4 then
    raise exception 'Carrier and tracking number are required';
  end if;
  insert into public.deal_shipments(deal_id,carrier,tracking_number)
  values(p_deal_id,trim(p_carrier),trim(p_tracking_number))
  on conflict(deal_id) do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,
    status='shipped',shipped_at=now(),delivered_at=null,updated_at=now();
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'item_shipped');
end;
$$;

-- Extend the protected action plan with payment readiness.
drop function if exists public.get_deal_action_plan(uuid);
create function public.get_deal_action_plan(p_deal_id uuid)
returns table(
  viewer_role text,
  deal_status text,
  meeting_status text,
  seller_arrived boolean,
  buyer_arrived boolean,
  handoff_code_ready boolean,
  shipment_status text,
  inspection_recorded boolean,
  rating_submitted boolean,
  delivery_address_ready boolean,
  payment_method_recorded boolean,
  payment_method_confirmed boolean,
  payment_marked_sent boolean,
  payment_received boolean
)
language sql stable security definer set search_path=public,pg_temp
as $$
  select
    case when deal.seller_id=auth.uid() then 'seller' else 'buyer' end,
    deal.status::text,meeting.status,coalesce(meeting.seller_arrived,false),
    coalesce(meeting.buyer_arrived,false),meeting.handoff_pin_hash is not null,shipment.status,
    exists(select 1 from public.deal_inspections inspection where inspection.deal_id=deal.id and inspection.agreement_version=greatest(deal.current_agreement_version,1)),
    exists(select 1 from public.ratings rating where rating.deal_id=deal.id and rating.author_id=auth.uid()),
    deal.delivery_method<>'Ship to buyer' or exists(select 1 from public.deal_delivery_details details where details.deal_id=deal.id),
    payment.deal_id is not null,payment.buyer_confirmed_at is not null,
    payment.buyer_marked_sent_at is not null,payment.seller_marked_received_at is not null
  from public.deals deal
  left join public.deal_meetings meeting on meeting.deal_id=deal.id
  left join public.deal_shipments shipment on shipment.deal_id=deal.id
  left join public.deal_payment_records payment on payment.deal_id=deal.id
  where deal.id=p_deal_id and auth.uid() is not null
    and auth.uid() in (deal.seller_id,deal.buyer_id) and deal.buyer_id is not null
    and deal.status in ('accepted','completed','disputed','cancelled');
$$;

revoke all on function public.set_deal_payment_method(uuid,text) from public;
revoke all on function public.confirm_deal_payment_method(uuid) from public;
revoke all on function public.mark_deal_payment_sent(uuid) from public;
revoke all on function public.mark_deal_payment_received(uuid) from public;
revoke all on function public.get_deal_payment_record(uuid) from public;
revoke all on function public.generate_handoff_pin(uuid) from public;
revoke all on function public.complete_handoff(uuid,text) from public;
revoke all on function public.create_deal_shipment(uuid,text,text) from public;
revoke all on function public.get_deal_action_plan(uuid) from public;
grant execute on function public.set_deal_payment_method(uuid,text) to authenticated;
grant execute on function public.confirm_deal_payment_method(uuid) to authenticated;
grant execute on function public.mark_deal_payment_sent(uuid) to authenticated;
grant execute on function public.mark_deal_payment_received(uuid) to authenticated;
grant execute on function public.get_deal_payment_record(uuid) to authenticated;
grant execute on function public.generate_handoff_pin(uuid) to authenticated;
grant execute on function public.complete_handoff(uuid,text) to authenticated;
grant execute on function public.create_deal_shipment(uuid,text,text) to authenticated;
grant execute on function public.get_deal_action_plan(uuid) to authenticated;
