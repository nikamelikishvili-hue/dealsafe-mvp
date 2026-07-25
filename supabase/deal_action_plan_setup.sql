-- Private, role-aware progress summary for accepted Dealivra transactions.
-- Run after meeting_setup.sql, completion_setup.sql, shipping_setup.sql,
-- inspection_receipt_setup.sql, and deal_participants_setup.sql.

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
  rating_submitted boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case when deal.seller_id = auth.uid() then 'seller' else 'buyer' end,
    deal.status::text,
    meeting.status,
    coalesce(meeting.seller_arrived, false),
    coalesce(meeting.buyer_arrived, false),
    meeting.handoff_pin_hash is not null,
    shipment.status,
    exists(
      select 1 from public.deal_inspections inspection
      where inspection.deal_id = deal.id
        and inspection.agreement_version = greatest(deal.current_agreement_version, 1)
    ),
    exists(
      select 1 from public.ratings rating
      where rating.deal_id = deal.id and rating.author_id = auth.uid()
    )
  from public.deals deal
  left join public.deal_meetings meeting on meeting.deal_id = deal.id
  left join public.deal_shipments shipment on shipment.deal_id = deal.id
  where deal.id = p_deal_id
    and auth.uid() is not null
    and auth.uid() in (deal.seller_id, deal.buyer_id)
    and deal.buyer_id is not null
    and deal.status in ('accepted', 'completed', 'disputed', 'cancelled');
$$;

revoke all on function public.get_deal_action_plan(uuid) from public;
grant execute on function public.get_deal_action_plan(uuid) to authenticated;
