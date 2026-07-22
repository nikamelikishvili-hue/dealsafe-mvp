-- Private delivery details for shipped deals. Safe to rerun.
-- Run after shipping_setup.sql, inspection_receipt_setup.sql, and deal_action_plan_setup.sql.

create table if not exists public.deal_delivery_details (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  recipient_name text not null check (char_length(recipient_name) between 2 and 100),
  full_address text not null check (char_length(full_address) between 10 and 500),
  country text not null check (char_length(country) between 2 and 80),
  instructions text check (char_length(instructions) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_delivery_details enable row level security;
revoke all on table public.deal_delivery_details from public, anon, authenticated;

drop function if exists public.set_deal_delivery_details(uuid,text,text,text,text);
create function public.set_deal_delivery_details(
  p_deal_id uuid,
  p_recipient_name text,
  p_full_address text,
  p_country text,
  p_instructions text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_deal public.deals%rowtype;
begin
  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found or v_deal.buyer_id <> auth.uid() or v_deal.status <> 'accepted'
    or v_deal.delivery_method <> 'Ship to buyer' then
    raise exception 'Only the buyer can save an address for an accepted shipped deal';
  end if;
  if exists(select 1 from public.deal_shipments where deal_id = p_deal_id) then
    raise exception 'Delivery address is locked after shipping starts';
  end if;
  if char_length(coalesce(trim(p_recipient_name),'')) not between 2 and 100
    or char_length(coalesce(trim(p_full_address),'')) not between 10 and 500
    or char_length(coalesce(trim(p_country),'')) not between 2 and 80
    or char_length(coalesce(trim(p_instructions),'')) > 500 then
    raise exception 'Complete the required delivery address fields';
  end if;

  insert into public.deal_delivery_details(
    deal_id,buyer_id,recipient_name,full_address,country,instructions
  ) values(
    p_deal_id,auth.uid(),trim(p_recipient_name),trim(p_full_address),trim(p_country),nullif(trim(p_instructions),'')
  ) on conflict(deal_id) do update set
    buyer_id=excluded.buyer_id,
    recipient_name=excluded.recipient_name,
    full_address=excluded.full_address,
    country=excluded.country,
    instructions=excluded.instructions,
    updated_at=now();

  insert into public.audit_events(deal_id,actor_id,event_type)
  values(p_deal_id,auth.uid(),'delivery_address_saved');
end;
$$;

drop function if exists public.get_deal_delivery_details(uuid);
create function public.get_deal_delivery_details(p_deal_id uuid)
returns table(
  recipient_name text,
  full_address text,
  country text,
  instructions text,
  updated_at timestamptz,
  locked boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select details.recipient_name,details.full_address,details.country,details.instructions,
    details.updated_at,exists(select 1 from public.deal_shipments where deal_id=deal.id)
  from public.deals deal
  join public.deal_delivery_details details on details.deal_id=deal.id
  where deal.id=p_deal_id
    and auth.uid() is not null
    and auth.uid() in (deal.seller_id,deal.buyer_id)
    and deal.delivery_method='Ship to buyer'
    and deal.status in ('accepted','completed','disputed','cancelled');
$$;

create or replace function public.create_deal_shipment(p_deal_id uuid,p_carrier text,p_tracking_number text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(
    select 1 from public.deals where id=p_deal_id and seller_id=auth.uid()
      and status='accepted' and delivery_method='Ship to buyer'
  ) then raise exception 'Shipment is unavailable for this deal'; end if;
  if not exists(select 1 from public.deal_delivery_details where deal_id=p_deal_id) then
    raise exception 'Buyer delivery address is required before shipping';
  end if;
  if char_length(trim(p_carrier))<2 or char_length(trim(p_tracking_number))<4 then
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

-- Extend the protected action plan with delivery-address readiness.
drop function if exists public.get_deal_action_plan(uuid);
create function public.get_deal_action_plan(p_deal_id uuid)
returns table (
  viewer_role text,
  deal_status text,
  meeting_status text,
  seller_arrived boolean,
  buyer_arrived boolean,
  handoff_code_ready boolean,
  shipment_status text,
  inspection_recorded boolean,
  rating_submitted boolean,
  delivery_address_ready boolean
)
language sql stable security definer set search_path=public,pg_temp
as $$
  select
    case when deal.seller_id=auth.uid() then 'seller' else 'buyer' end,
    deal.status::text,meeting.status,coalesce(meeting.seller_arrived,false),
    coalesce(meeting.buyer_arrived,false),meeting.handoff_pin_hash is not null,shipment.status,
    exists(select 1 from public.deal_inspections inspection where inspection.deal_id=deal.id and inspection.agreement_version=greatest(deal.current_agreement_version,1)),
    exists(select 1 from public.ratings rating where rating.deal_id=deal.id and rating.author_id=auth.uid()),
    exists(select 1 from public.deal_delivery_details details where details.deal_id=deal.id)
  from public.deals deal
  left join public.deal_meetings meeting on meeting.deal_id=deal.id
  left join public.deal_shipments shipment on shipment.deal_id=deal.id
  where deal.id=p_deal_id and auth.uid() is not null
    and auth.uid() in (deal.seller_id,deal.buyer_id) and deal.buyer_id is not null
    and deal.status in ('accepted','completed','disputed','cancelled');
$$;

revoke all on function public.set_deal_delivery_details(uuid,text,text,text,text) from public;
revoke all on function public.get_deal_delivery_details(uuid) from public;
revoke all on function public.create_deal_shipment(uuid,text,text) from public;
revoke all on function public.get_deal_action_plan(uuid) from public;
grant execute on function public.set_deal_delivery_details(uuid,text,text,text,text) to authenticated;
grant execute on function public.get_deal_delivery_details(uuid) to authenticated;
grant execute on function public.create_deal_shipment(uuid,text,text) to authenticated;
grant execute on function public.get_deal_action_plan(uuid) to authenticated;
