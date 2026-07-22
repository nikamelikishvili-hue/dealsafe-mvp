-- Lets a seller extend or renew an unaccepted Deal Link.
-- Each renewal creates a new immutable agreement version. Safe to rerun.

create or replace function public.renew_deal_link(p_deal_id uuid,p_days integer)
returns table(agreement_version integer,expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deals%rowtype;
  v_new_version integer;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_days not in (1,3,7,14,30) then raise exception 'Choose a valid renewal period'; end if;

  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or v_deal.seller_id<>auth.uid() then raise exception 'Only the seller can renew this Deal Link'; end if;
  if v_deal.status<>'published' or v_deal.buyer_id is not null then raise exception 'Only an unaccepted published deal can be renewed'; end if;

  v_new_version:=greatest(v_deal.current_agreement_version,1)+1;
  v_expires_at:=now()+make_interval(days=>p_days);

  update public.deals
  set expires_at=v_expires_at,current_agreement_version=v_new_version,updated_at=now()
  where id=v_deal.id;

  insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by)
  values(
    v_deal.id,
    v_new_version,
    jsonb_build_object(
      'title',v_deal.title,'description',v_deal.description,'price_cents',v_deal.price_cents,
      'currency',v_deal.currency,'condition',v_deal.condition,
      'delivery_method',v_deal.delivery_method,'expires_at',v_expires_at
    ),
    encode(extensions.digest(concat_ws('|',v_deal.title,v_deal.description,v_deal.price_cents,
      v_deal.currency,v_deal.condition,v_deal.delivery_method,v_expires_at),'sha256'),'hex'),
    auth.uid()
  );

  update public.deal_offers
  set status='withdrawn',responded_at=now()
  where deal_id=v_deal.id and status='pending';

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal.id,auth.uid(),'deal_renewed',jsonb_build_object(
    'agreement_version',v_new_version,'expires_at',v_expires_at,'valid_for_days',p_days));

  return query select v_new_version,v_expires_at;
end;
$$;

revoke all on function public.renew_deal_link(uuid,integer) from public;
grant execute on function public.renew_deal_link(uuid,integer) to authenticated;
