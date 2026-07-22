-- Records mandatory seller declarations when a private draft becomes public. Safe to rerun.

alter table public.deals
  add column if not exists seller_attested_at timestamptz;

create or replace function public.publish_deal_with_seller_declarations(
  p_deal_id uuid,
  p_title text,
  p_description text,
  p_price_cents bigint,
  p_currency text,
  p_condition text,
  p_serial_last_four text,
  p_delivery_method text,
  p_expires_in_days integer default 7
)
returns setof public.deals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
  v_now timestamptz := now();
  v_days integer := greatest(1,least(coalesce(p_expires_in_days,7),30));
  v_hash text;
begin
  if auth.uid() is null then raise exception 'Sign in before publishing'; end if;
  if char_length(trim(p_title)) not between 3 and 120 then raise exception 'Item title must contain 3 to 120 characters'; end if;
  if char_length(trim(p_description)) < 20 then raise exception 'Describe wear, repairs, or defects'; end if;
  if p_price_cents <= 0 then raise exception 'Price must be greater than zero'; end if;
  if char_length(trim(p_currency)) <> 3 then raise exception 'Choose a valid currency'; end if;

  update public.deals
  set title=trim(p_title),description=trim(p_description),price_cents=p_price_cents,
      currency=upper(trim(p_currency)),condition=p_condition,
      serial_last_four=nullif(trim(p_serial_last_four),''),delivery_method=p_delivery_method,
      status='published',current_agreement_version=1,published_at=v_now,
      seller_attested_at=v_now,expires_at=v_now+(v_days||' days')::interval,updated_at=v_now
  where id=p_deal_id and seller_id=auth.uid() and status='draft'
  returning * into v_deal;

  if not found then raise exception 'Private draft was not found'; end if;

  -- A draft agreement has never been public or accepted, so version 1 can be rebuilt at publication.
  delete from public.agreement_versions version
  where version.deal_id=v_deal.id and version.version=1
    and not exists(select 1 from public.agreement_acceptances acceptance where acceptance.agreement_version_id=version.id);

  v_hash:=encode(extensions.digest(concat_ws('|',v_deal.title,v_deal.description,v_deal.price_cents,v_deal.currency,v_deal.condition,v_deal.delivery_method,v_deal.expires_at,'seller_has_authority','item_not_stolen_counterfeit_or_prohibited','known_defects_disclosed'),'sha256'),'hex');

  insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by)
  values(v_deal.id,1,jsonb_build_object(
    'title',v_deal.title,'description',v_deal.description,'price_cents',v_deal.price_cents,
    'currency',v_deal.currency,'condition',v_deal.condition,'delivery_method',v_deal.delivery_method,
    'expires_at',v_deal.expires_at,'seller_declarations',jsonb_build_object(
      'has_authority_to_sell',true,'not_stolen_counterfeit_or_prohibited',true,
      'known_defects_and_material_facts_disclosed',true,'attested_at',v_now)),
    v_hash,auth.uid())
  on conflict(deal_id,version) do update
  set terms_json=excluded.terms_json,content_hash=excluded.content_hash,created_by=excluded.created_by,created_at=v_now;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal.id,auth.uid(),'seller_declarations_recorded',jsonb_build_object(
    'agreement_version',1,'has_authority_to_sell',true,
    'not_stolen_counterfeit_or_prohibited',true,'known_defects_disclosed',true));

  return next v_deal;
end;
$$;

revoke all on function public.publish_deal_with_seller_declarations(uuid,text,text,bigint,text,text,text,text,integer) from public;
grant execute on function public.publish_deal_with_seller_declarations(uuid,text,text,bigint,text,text,text,text,integer) to authenticated;
