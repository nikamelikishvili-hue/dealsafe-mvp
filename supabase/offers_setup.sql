-- Run once in Supabase SQL Editor. Safe to rerun.
create table if not exists public.deal_offers(
  id uuid primary key default gen_random_uuid(),deal_id uuid not null references public.deals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),amount_cents bigint not null check(amount_cents>0),typed_name text not null,
  status text not null default 'pending' check(status in('pending','accepted','declined','withdrawn')),created_at timestamptz not null default now(),responded_at timestamptz
);
alter table public.deal_offers enable row level security;

create or replace function public.make_deal_offer(p_public_id text,p_amount_cents bigint,p_typed_name text)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;
begin
  select * into v_deal from public.deals where public_id=p_public_id and status='published' and expires_at>now();
  if not found then raise exception 'This deal is not accepting offers'; end if;
  if v_deal.seller_id=auth.uid() then raise exception 'Seller cannot make an offer'; end if;
  if p_amount_cents<100 or char_length(trim(p_typed_name))<2 then raise exception 'Enter a valid offer and full name'; end if;
  update public.deal_offers set status='withdrawn',responded_at=now() where deal_id=v_deal.id and buyer_id=auth.uid() and status='pending';
  insert into public.deal_offers(deal_id,buyer_id,amount_cents,typed_name) values(v_deal.id,auth.uid(),p_amount_cents,trim(p_typed_name));
  insert into public.audit_events(deal_id,actor_id,event_type) values(v_deal.id,auth.uid(),'offer_made');
end; $$;
revoke all on function public.make_deal_offer(text,bigint,text) from public;grant execute on function public.make_deal_offer(text,bigint,text) to authenticated;

create or replace function public.get_deal_offers(p_deal_id uuid)
returns table(id uuid,amount_cents bigint,status text,buyer_name text,created_at timestamptz,is_mine boolean)
language sql security definer set search_path=public as $$
 select o.id,o.amount_cents,o.status,p.display_name,o.created_at,o.buyer_id=auth.uid() from public.deal_offers o join public.deals d on d.id=o.deal_id join public.profiles p on p.id=o.buyer_id
 where o.deal_id=p_deal_id and (d.seller_id=auth.uid() or o.buyer_id=auth.uid()) order by o.created_at desc;
$$;
revoke all on function public.get_deal_offers(uuid) from public;grant execute on function public.get_deal_offers(uuid) to authenticated;

create or replace function public.respond_to_offer(p_offer_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_offer public.deal_offers%rowtype;v_deal public.deals%rowtype;v_version integer;v_agreement_id uuid;v_seller_name text;
begin
 select * into v_offer from public.deal_offers where id=p_offer_id and status='pending' for update;if not found then raise exception 'Pending offer not found';end if;
 select * into v_deal from public.deals where id=v_offer.deal_id for update;if v_deal.seller_id<>auth.uid() then raise exception 'Only the seller can respond';end if;
 if not p_accept then update public.deal_offers set status='declined',responded_at=now() where id=p_offer_id;insert into public.audit_events(deal_id,actor_id,event_type) values(v_deal.id,auth.uid(),'offer_declined');return;end if;
 if v_deal.status<>'published' or v_deal.expires_at<=now() then raise exception 'Deal is no longer available';end if;
 v_version:=greatest(v_deal.current_agreement_version,1)+1;
 insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by) values(v_deal.id,v_version,jsonb_build_object('title',v_deal.title,'description',v_deal.description,'price_cents',v_offer.amount_cents,'currency',v_deal.currency,'condition',v_deal.condition,'delivery_method',v_deal.delivery_method,'expires_at',v_deal.expires_at),encode(extensions.digest(concat_ws('|',v_deal.title,v_deal.description,v_offer.amount_cents,v_deal.currency,v_deal.condition,v_deal.delivery_method,v_deal.expires_at),'sha256'),'hex'),auth.uid()) returning id into v_agreement_id;
 insert into public.agreement_acceptances(agreement_version_id,signer_id,typed_name,consent_text) values(v_agreement_id,v_offer.buyer_id,v_offer.typed_name,'I offered this amount and accept this version of the Dealivra agreement.');
 select display_name into v_seller_name from public.profiles where id=auth.uid();insert into public.agreement_acceptances(agreement_version_id,signer_id,typed_name,consent_text) values(v_agreement_id,auth.uid(),v_seller_name,'I accept this offer and this version of the Dealivra agreement.');
 update public.deals set price_cents=v_offer.amount_cents,buyer_id=v_offer.buyer_id,status='accepted',current_agreement_version=v_version,updated_at=now() where id=v_deal.id;
 update public.deal_offers set status=case when id=p_offer_id then 'accepted' else 'declined' end,responded_at=now() where deal_id=v_deal.id and status='pending';
 insert into public.audit_events(deal_id,actor_id,event_type) values(v_deal.id,auth.uid(),'offer_accepted');
end; $$;
revoke all on function public.respond_to_offer(uuid,boolean) from public;grant execute on function public.respond_to_offer(uuid,boolean) to authenticated;
