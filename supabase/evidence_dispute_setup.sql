-- Dealivra protection foundation: disputes and immutable evidence.
-- Run once in Supabase SQL Editor after dispute_setup.sql.
-- Safe to rerun.

create table if not exists public.deal_disputes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  reason text not null check (char_length(trim(reason)) between 10 and 2000),
  status text not null default 'open' check (status in ('open','evidence_requested','under_review','resolved_buyer','resolved_seller','refunded','cancelled')),
  response_deadline timestamptz not null default (now() + interval '72 hours'),
  resolution_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists deal_disputes_one_open_per_deal
  on public.deal_disputes(deal_id)
  where status in ('open','evidence_requested','under_review');

create index if not exists deal_disputes_deal_idx
  on public.deal_disputes(deal_id, created_at desc);

create table if not exists public.deal_evidence (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  dispute_id uuid references public.deal_disputes(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id),
  uploader_role text not null check (uploader_role in ('buyer','seller','admin')),
  evidence_type text not null check (evidence_type in (
    'seller_packing_video','seller_item_photo','seller_serial_number','seller_package_weight',
    'carrier_pickup_scan','carrier_delivery_scan','carrier_delivery_photo','carrier_weight',
    'buyer_unboxing_video','buyer_received_photo','buyer_damage_photo','chat_export','other'
  )),
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  sha256 text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists deal_evidence_deal_idx
  on public.deal_evidence(deal_id, created_at desc);

create index if not exists deal_evidence_dispute_idx
  on public.deal_evidence(dispute_id, created_at desc);

alter table public.deal_disputes enable row level security;
alter table public.deal_evidence enable row level security;

revoke all on table public.deal_disputes from public, anon, authenticated;
revoke all on table public.deal_evidence from public, anon, authenticated;
grant select on table public.deal_disputes to authenticated;
grant select, insert on table public.deal_evidence to authenticated;

drop policy if exists "participants read deal disputes" on public.deal_disputes;
create policy "participants read deal disputes" on public.deal_disputes
  for select to authenticated
  using (exists (
    select 1 from public.deals d
    where d.id = deal_disputes.deal_id
      and (d.seller_id = auth.uid() or d.buyer_id = auth.uid())
  ));

drop policy if exists "participants read deal evidence" on public.deal_evidence;
create policy "participants read deal evidence" on public.deal_evidence
  for select to authenticated
  using (exists (
    select 1 from public.deals d
    where d.id = deal_evidence.deal_id
      and (d.seller_id = auth.uid() or d.buyer_id = auth.uid())
  ));

drop policy if exists "participants upload deal evidence" on public.deal_evidence;
create policy "participants upload deal evidence" on public.deal_evidence
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      (uploader_role = 'seller' and exists (select 1 from public.deals d where d.id = deal_evidence.deal_id and d.seller_id = auth.uid()))
      or
      (uploader_role = 'buyer' and exists (select 1 from public.deals d where d.id = deal_evidence.deal_id and d.buyer_id = auth.uid()))
    )
  );

-- Keep the existing public API, but also create a structured dispute record.
create or replace function public.open_deal_dispute(p_deal_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_deal public.deals%rowtype;
  v_payment_status text;
  v_dispute_id uuid;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or (v_deal.seller_id<>auth.uid() and v_deal.buyer_id<>auth.uid()) then
    raise exception 'Only deal participants can report a problem';
  end if;
  if v_deal.status not in ('accepted','completed') then
    raise exception 'Only an active or completed deal can be disputed';
  end if;
  select status into v_payment_status from public.protected_payments where deal_id=p_deal_id;
  if v_payment_status in ('release_pending','released','refund_pending','refunded') then
    raise exception 'This deal can no longer be disputed because the funds are no longer protected';
  end if;
  if char_length(trim(p_reason))<10 then
    raise exception 'Please describe the problem in more detail';
  end if;
  if exists (select 1 from public.deal_disputes where deal_id=p_deal_id and status in ('open','evidence_requested','under_review')) then
    raise exception 'This deal already has an open dispute';
  end if;

  insert into public.deal_disputes(deal_id,opened_by,reason)
    values(p_deal_id,auth.uid(),trim(p_reason))
    returning id into v_dispute_id;
  insert into public.reports(deal_id,reporter_id,reason,status)
    values(p_deal_id,auth.uid(),trim(p_reason),'open');
  update public.deals set status='disputed',updated_at=now() where id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
    values(p_deal_id,auth.uid(),'dispute_opened',jsonb_build_object('reason',trim(p_reason),'dispute_id',v_dispute_id));
end; $$;

revoke all on function public.open_deal_dispute(uuid,text) from public;
grant execute on function public.open_deal_dispute(uuid,text) to authenticated;
