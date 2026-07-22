-- Durable buyer inspection receipt for in-person and shipped handoffs. Safe to rerun.
create table if not exists public.deal_inspections (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  agreement_version integer not null,
  item_reviewed boolean not null,
  price_confirmed boolean not null,
  handoff_confirmed boolean not null,
  reference_checked boolean not null,
  inspected_at timestamptz not null default now(),
  check(item_reviewed and price_confirmed and handoff_confirmed and reference_checked)
);

alter table public.deal_inspections enable row level security;
revoke all on table public.deal_inspections from public,anon,authenticated;

create or replace function public.record_deal_inspection(
  p_deal_id uuid,
  p_item_reviewed boolean,
  p_price_confirmed boolean,
  p_handoff_confirmed boolean,
  p_reference_checked boolean
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_deal public.deals%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id;
  if not found or v_deal.buyer_id<>auth.uid() or v_deal.status<>'accepted' then
    raise exception 'Only the buyer can record an inspection for an accepted deal';
  end if;
  if not(coalesce(p_item_reviewed,false) and coalesce(p_price_confirmed,false)
    and coalesce(p_handoff_confirmed,false) and coalesce(p_reference_checked,false)) then
    raise exception 'Complete every inspection check first';
  end if;
  if v_deal.delivery_method='Meet in person' and not exists(
    select 1 from public.deal_meetings meeting
    where meeting.deal_id=p_deal_id and meeting.status='confirmed'
      and meeting.seller_arrived and meeting.buyer_arrived
  ) then raise exception 'Both parties must arrive before inspection';
  elsif v_deal.delivery_method='Ship to buyer' and not exists(
    select 1 from public.deal_shipments shipment
    where shipment.deal_id=p_deal_id and shipment.status='shipped'
  ) then raise exception 'Shipment must be recorded before inspection';
  end if;

  insert into public.deal_inspections(
    deal_id,buyer_id,agreement_version,item_reviewed,price_confirmed,
    handoff_confirmed,reference_checked,inspected_at
  ) values(
    p_deal_id,auth.uid(),greatest(v_deal.current_agreement_version,1),true,true,true,true,now()
  ) on conflict(deal_id) do update set
    buyer_id=excluded.buyer_id,
    agreement_version=excluded.agreement_version,
    item_reviewed=true,price_confirmed=true,handoff_confirmed=true,reference_checked=true,
    inspected_at=now();

  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'item_inspected');
end;
$$;

create or replace function public.get_deal_inspection(p_deal_id uuid)
returns table(
  agreement_version integer,
  item_reviewed boolean,
  price_confirmed boolean,
  handoff_confirmed boolean,
  reference_checked boolean,
  inspected_at timestamptz,
  buyer_name text
)
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  if not exists(
    select 1 from public.deals deal
    where deal.id=p_deal_id and (deal.seller_id=auth.uid() or deal.buyer_id=auth.uid())
  ) then raise exception 'Not a deal participant'; end if;
  return query
  select inspection.agreement_version,inspection.item_reviewed,inspection.price_confirmed,
    inspection.handoff_confirmed,inspection.reference_checked,inspection.inspected_at,profile.display_name
  from public.deal_inspections inspection
  join public.profiles profile on profile.id=inspection.buyer_id
  where inspection.deal_id=p_deal_id;
end;
$$;

create or replace function public.complete_handoff(p_deal_id uuid,p_pin text)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;v_meeting public.deal_meetings%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  select * into v_meeting from public.deal_meetings where deal_id=p_deal_id;
  if v_deal.buyer_id<>auth.uid() then raise exception 'Only the buyer can confirm receipt'; end if;
  if not(v_meeting.seller_arrived and v_meeting.buyer_arrived) then raise exception 'Both parties must arrive first'; end if;
  if not exists(select 1 from public.deal_inspections inspection where inspection.deal_id=p_deal_id and inspection.buyer_id=auth.uid() and inspection.agreement_version=greatest(v_deal.current_agreement_version,1)) then raise exception 'Save the inspection receipt before completing the deal'; end if;
  if v_meeting.handoff_pin_hash is null or v_meeting.handoff_pin_hash<>encode(extensions.digest(trim(p_pin),'sha256'),'hex') then raise exception 'Incorrect handoff PIN'; end if;
  update public.deals set status='completed',updated_at=now() where id=p_deal_id;
  update public.deal_meetings set handoff_pin_hash=null,updated_at=now() where deal_id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'deal_completed');
end; $$;

create or replace function public.confirm_shipment_delivery(p_deal_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_version integer;
begin
  select greatest(d.current_agreement_version,1) into v_version
  from public.deals d join public.deal_shipments shipment on shipment.deal_id=d.id
  where d.id=p_deal_id and d.buyer_id=auth.uid() and d.status='accepted' and shipment.status='shipped';
  if v_version is null then raise exception 'Shipment cannot be confirmed'; end if;
  if not exists(select 1 from public.deal_inspections inspection where inspection.deal_id=p_deal_id and inspection.buyer_id=auth.uid() and inspection.agreement_version=v_version) then raise exception 'Save the inspection receipt before confirming delivery'; end if;
  update public.deal_shipments set status='delivered',delivered_at=now(),updated_at=now() where deal_id=p_deal_id;
  update public.deals set status='completed',updated_at=now() where id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'shipment_delivered');
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'deal_completed');
end; $$;

revoke all on function public.record_deal_inspection(uuid,boolean,boolean,boolean,boolean) from public;
revoke all on function public.get_deal_inspection(uuid) from public;
revoke all on function public.complete_handoff(uuid,text) from public;
revoke all on function public.confirm_shipment_delivery(uuid) from public;
grant execute on function public.record_deal_inspection(uuid,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.get_deal_inspection(uuid) to authenticated;
grant execute on function public.complete_handoff(uuid,text) to authenticated;
grant execute on function public.confirm_shipment_delivery(uuid) to authenticated;
