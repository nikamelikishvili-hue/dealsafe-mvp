-- Run once in Supabase SQL Editor. Safe to rerun.
create table if not exists public.deal_shipments(
  id uuid primary key default gen_random_uuid(),deal_id uuid unique not null references public.deals(id) on delete cascade,
  carrier text not null,tracking_number text not null,status text not null default 'shipped' check(status in('shipped','delivered')),
  shipped_at timestamptz not null default now(),delivered_at timestamptz,updated_at timestamptz not null default now()
);
alter table public.deal_shipments enable row level security;
drop policy if exists "participants read shipments" on public.deal_shipments;
create policy "participants read shipments" on public.deal_shipments for select to authenticated using(exists(select 1 from public.deals d where d.id=deal_shipments.deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())));

create or replace function public.create_deal_shipment(p_deal_id uuid,p_carrier text,p_tracking_number text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.deals where id=p_deal_id and seller_id=auth.uid() and status='accepted' and delivery_method='Ship to buyer') then raise exception 'Shipment is unavailable for this deal';end if;
 if char_length(trim(p_carrier))<2 or char_length(trim(p_tracking_number))<4 then raise exception 'Carrier and tracking number are required';end if;
 insert into public.deal_shipments(deal_id,carrier,tracking_number) values(p_deal_id,trim(p_carrier),trim(p_tracking_number)) on conflict(deal_id) do update set carrier=excluded.carrier,tracking_number=excluded.tracking_number,status='shipped',shipped_at=now(),delivered_at=null,updated_at=now();
 insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'item_shipped');
end; $$;
revoke all on function public.create_deal_shipment(uuid,text,text) from public;grant execute on function public.create_deal_shipment(uuid,text,text) to authenticated;

create or replace function public.confirm_shipment_delivery(p_deal_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.deals d join public.deal_shipments s on s.deal_id=d.id where d.id=p_deal_id and d.buyer_id=auth.uid() and d.status='accepted' and s.status='shipped') then raise exception 'Shipment cannot be confirmed';end if;
 update public.deal_shipments set status='delivered',delivered_at=now(),updated_at=now() where deal_id=p_deal_id;
 update public.deals set status='completed',updated_at=now() where id=p_deal_id;
 insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'shipment_delivered');
 insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'deal_completed');
end; $$;
revoke all on function public.confirm_shipment_delivery(uuid) from public;grant execute on function public.confirm_shipment_delivery(uuid) to authenticated;
