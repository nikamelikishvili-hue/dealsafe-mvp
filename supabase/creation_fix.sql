-- Fixes Deal Link creation when pgcrypto is installed in the extensions schema. Safe to rerun.
create or replace function public.create_initial_agreement()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by)
  values(new.id,1,jsonb_build_object('title',new.title,'description',new.description,'price_cents',new.price_cents,'currency',new.currency,'condition',new.condition,'delivery_method',new.delivery_method),encode(extensions.digest(concat_ws('|',new.title,new.description,new.price_cents,new.currency,new.condition,new.delivery_method),'sha256'),'hex'),new.seller_id)
  on conflict(deal_id,version) do nothing;
  return new;
end; $$;
