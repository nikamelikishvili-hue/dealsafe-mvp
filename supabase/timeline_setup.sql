-- Run once in Supabase SQL Editor. Safe to rerun.
create or replace function public.get_deal_timeline(p_deal_id uuid)
returns table(id text,event_type text,created_at timestamptz,is_mine boolean)
language sql security definer set search_path=public as $$
  select e.id,e.event_type,e.created_at,e.is_mine from (
    select ('created-'||d.id::text) id,'deal_published'::text event_type,d.created_at,true is_mine
    from public.deals d where d.id=p_deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())
    union all
    select a.id::text,a.event_type,a.created_at,a.actor_id=auth.uid()
    from public.audit_events a join public.deals d on d.id=a.deal_id
    where a.deal_id=p_deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())
  ) e order by e.created_at desc;
$$;
revoke all on function public.get_deal_timeline(uuid)
from public, anon, authenticated;
grant execute on function public.get_deal_timeline(uuid) to authenticated;
