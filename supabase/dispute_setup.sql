-- Run once in Supabase SQL Editor. Safe to rerun.
create or replace function public.cancel_deal(p_deal_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or v_deal.seller_id<>auth.uid() then raise exception 'Only the seller can cancel this deal'; end if;
  if v_deal.status not in ('published','accepted') then raise exception 'This deal can no longer be cancelled'; end if;
  if char_length(trim(p_reason))<5 then raise exception 'Please provide a cancellation reason'; end if;
  update public.deals set status='cancelled',updated_at=now() where id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type,metadata) values(p_deal_id,auth.uid(),'deal_cancelled',jsonb_build_object('reason',trim(p_reason)));
end; $$;
revoke all on function public.cancel_deal(uuid,text) from public;
grant execute on function public.cancel_deal(uuid,text) to authenticated;

create or replace function public.open_deal_dispute(p_deal_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype; v_payment_status text;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or (v_deal.seller_id<>auth.uid() and v_deal.buyer_id<>auth.uid()) then raise exception 'Only deal participants can report a problem'; end if;
  if v_deal.status not in ('accepted','completed') then raise exception 'Only an active or completed deal can be disputed'; end if;
  select status into v_payment_status from public.protected_payments where deal_id=p_deal_id;
  if v_payment_status in ('release_pending','released','refund_pending','refunded') then raise exception 'This deal can no longer be disputed because the funds are no longer protected'; end if;
  if char_length(trim(p_reason))<10 then raise exception 'Please describe the problem in more detail'; end if;
  insert into public.reports(deal_id,reporter_id,reason,status) values(p_deal_id,auth.uid(),trim(p_reason),'open');
  update public.deals set status='disputed',updated_at=now() where id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type,metadata) values(p_deal_id,auth.uid(),'dispute_opened',jsonb_build_object('reason',trim(p_reason)));
end; $$;
revoke all on function public.open_deal_dispute(uuid,text) from public;
grant execute on function public.open_deal_dispute(uuid,text) to authenticated;
