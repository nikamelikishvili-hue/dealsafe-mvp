-- Administrator dispute review queue. Run after evidence_dispute_setup.sql.
-- This records a decision but never moves Stripe money by itself.

drop policy if exists "participants read deal evidence" on public.deal_evidence;
create policy "participants and admins read deal evidence" on public.deal_evidence
  for select to authenticated
  using (
    public.is_dealsafe_admin()
    or exists (
      select 1 from public.deals d
      where d.id = deal_evidence.deal_id
        and (d.seller_id = auth.uid() or d.buyer_id = auth.uid())
    )
  );

drop policy if exists "participants read deal evidence files" on storage.objects;
create policy "participants and admins read deal evidence files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deal-evidence'
    and (
      public.is_dealsafe_admin()
      or exists (
        select 1 from public.deals d
        where d.id = (storage.foldername(name))[2]::uuid
          and (d.seller_id = auth.uid() or d.buyer_id = auth.uid())
      )
    )
  );

drop function if exists public.get_admin_disputes(text);
create function public.get_admin_disputes(p_status text default 'open')
returns table(
  dispute_id uuid,
  deal_id uuid,
  public_id text,
  title text,
  reason text,
  dispute_status text,
  response_deadline timestamptz,
  opened_at timestamptz,
  opened_by_name text,
  seller_name text,
  buyer_name text,
  payment_status text,
  item_amount_cents bigint,
  currency text,
  resolution_note text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_dealsafe_admin() then raise exception 'Admin access required'; end if;
  if coalesce(p_status,'') not in ('open','resolved','all') then raise exception 'Invalid dispute status'; end if;
  return query
  select dd.id,d.id,d.public_id,d.title,dd.reason,dd.status,dd.response_deadline,dd.created_at,
         coalesce(opened.display_name,'Unknown'),seller.display_name,coalesce(buyer.display_name,'Not accepted'),
         coalesce(payment.status,'not_started'),coalesce(payment.item_amount_cents,d.price_cents),coalesce(payment.currency,d.currency),dd.resolution_note
  from public.deal_disputes dd
  join public.deals d on d.id=dd.deal_id
  left join public.profiles opened on opened.id=dd.opened_by
  join public.profiles seller on seller.id=d.seller_id
  left join public.profiles buyer on buyer.id=d.buyer_id
  left join public.protected_payments payment on payment.deal_id=d.id
  where p_status='all'
     or (p_status='open' and dd.status in ('open','evidence_requested','under_review'))
     or (p_status='resolved' and dd.status in ('resolved_buyer','resolved_seller','refunded','cancelled'))
  order by case when dd.status in ('open','evidence_requested','under_review') then 0 else 1 end,dd.created_at desc
  limit 200;
end;
$$;

drop function if exists public.resolve_deal_dispute(uuid,text,text);
create function public.resolve_deal_dispute(p_dispute_id uuid,p_decision text,p_resolution_note text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_deal_id uuid;
begin
  if not public.is_dealsafe_admin() then raise exception 'Admin access required'; end if;
  if coalesce(p_decision,'') not in ('resolved_buyer','resolved_seller','cancelled') then raise exception 'Invalid dispute decision'; end if;
  if char_length(trim(coalesce(p_resolution_note,''))) not between 3 and 1000 then raise exception 'Resolution note must contain 3 to 1000 characters'; end if;
  update public.deal_disputes
  set status=p_decision,resolution_note=trim(p_resolution_note),resolved_by=auth.uid(),resolved_at=now(),updated_at=now()
  where id=p_dispute_id and status in ('open','evidence_requested','under_review')
  returning deal_id into v_deal_id;
  if v_deal_id is null then raise exception 'Open dispute was not found'; end if;
  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal_id,auth.uid(),'dispute_'||p_decision,jsonb_build_object('dispute_id',p_dispute_id,'note',trim(p_resolution_note)));
end;
$$;

revoke all on function public.get_admin_disputes(text) from public;
revoke all on function public.resolve_deal_dispute(uuid,text,text) from public;
grant execute on function public.get_admin_disputes(text) to authenticated;
grant execute on function public.resolve_deal_dispute(uuid,text,text) to authenticated;
