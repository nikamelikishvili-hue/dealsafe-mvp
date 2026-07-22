-- Allows the seller to revise a published, unaccepted deal. Safe to rerun.
create or replace function public.update_published_deal(p_deal_id uuid,p_title text,p_description text,p_price_cents bigint,p_condition text,p_delivery_method text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;v_version integer;
begin
 select * into v_deal from public.deals where id=p_deal_id for update;
 if not found or v_deal.seller_id<>auth.uid() then raise exception 'Only the seller can edit this deal';end if;
 if v_deal.status<>'published' or v_deal.buyer_id is not null then raise exception 'Accepted deals cannot be edited';end if;
 if char_length(trim(p_title)) not between 3 and 120 or char_length(trim(p_description))<3 or p_price_cents<1 then raise exception 'Enter valid deal details';end if;
 if p_condition not in('Like new','Good','Fair') or p_delivery_method not in('Meet in person','Ship to buyer') then raise exception 'Invalid condition or handoff method';end if;
 v_version:=greatest(v_deal.current_agreement_version,1)+1;
 update public.deals set title=trim(p_title),description=trim(p_description),price_cents=p_price_cents,condition=p_condition,delivery_method=p_delivery_method,current_agreement_version=v_version,updated_at=now() where id=p_deal_id;
 insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by) values(p_deal_id,v_version,jsonb_build_object('title',trim(p_title),'description',trim(p_description),'price_cents',p_price_cents,'currency',v_deal.currency,'condition',p_condition,'delivery_method',p_delivery_method,'expires_at',v_deal.expires_at),encode(extensions.digest(concat_ws('|',trim(p_title),trim(p_description),p_price_cents,v_deal.currency,p_condition,p_delivery_method,v_deal.expires_at),'sha256'),'hex'),auth.uid());
 insert into public.audit_events(deal_id,actor_id,event_type,metadata) values(p_deal_id,auth.uid(),'deal_updated',jsonb_build_object('agreement_version',v_version));
 return v_version;
end; $$;
revoke all on function public.update_published_deal(uuid,text,text,bigint,text,text) from public;
grant execute on function public.update_published_deal(uuid,text,text,bigint,text,text) to authenticated;
