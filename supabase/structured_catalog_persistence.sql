-- Persists versioned, structured listing identity without exposing participant
-- or restricted evidence fields. Safe to rerun after the production RBAC migration.

alter table public.deals
  add column if not exists category_id text,
  add column if not exists catalog_version text,
  add column if not exists catalog_brand_id text,
  add column if not exists catalog_brand_label text,
  add column if not exists catalog_model_id text,
  add column if not exists catalog_model_label text,
  add column if not exists model_year smallint,
  add column if not exists catalog_variant_id text,
  add column if not exists catalog_variant_label text;

-- Existing deals predate the governed catalog. Mark them explicitly instead of
-- guessing a category from their free-form title.
update public.deals
set category_id = coalesce(category_id, 'general'),
    catalog_version = coalesce(catalog_version, 'legacy')
where category_id is null or catalog_version is null;

alter table public.deals
  alter column category_id set default 'general',
  alter column category_id set not null,
  alter column catalog_version set default 'legacy',
  alter column catalog_version set not null;

do $catalog_constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deals'::regclass
      and conname = 'deals_category_id_check'
  ) then
    alter table public.deals add constraint deals_category_id_check check (
      category_id in (
        'phone','tablet','laptop','vehicle','watch','camera','gaming','tools',
        'business','jewelry','collectible','general'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deals'::regclass
      and conname = 'deals_catalog_version_check'
  ) then
    alter table public.deals add constraint deals_catalog_version_check check (
      catalog_version = 'legacy'
      or (
        char_length(catalog_version) <= 40
        and catalog_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deals'::regclass
      and conname = 'deals_catalog_ids_check'
  ) then
    alter table public.deals add constraint deals_catalog_ids_check check (
      (catalog_brand_id is null or catalog_brand_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
      and (catalog_model_id is null or catalog_model_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
      and (catalog_variant_id is null or catalog_variant_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
      and (catalog_model_id is null or catalog_brand_id is not null)
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deals'::regclass
      and conname = 'deals_catalog_labels_check'
  ) then
    alter table public.deals add constraint deals_catalog_labels_check check (
      (catalog_brand_label is null or char_length(trim(catalog_brand_label)) between 1 and 80)
      and (catalog_model_label is null or char_length(trim(catalog_model_label)) between 1 and 100)
      and (catalog_variant_label is null or char_length(trim(catalog_variant_label)) between 1 and 60)
      and (catalog_brand_label is null or catalog_brand_id is not null)
      and (catalog_model_label is null or catalog_model_id is not null)
      and (catalog_variant_label is null or catalog_variant_id is not null)
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deals'::regclass
      and conname = 'deals_model_year_check'
  ) then
    alter table public.deals add constraint deals_model_year_check check (
      model_year is null
      or (category_id = 'vehicle' and model_year between 1886 and 2100)
    );
  end if;
end
$catalog_constraints$;

create index if not exists deals_catalog_facets_idx
on public.deals (category_id, catalog_brand_id, catalog_model_id, model_year)
where status in ('published','accepted','completed');

-- The browser can write only the reviewed structured columns, and RLS still
-- requires the signed-in seller to own a draft row.
grant insert (
  category_id, catalog_version,
  catalog_brand_id, catalog_brand_label,
  catalog_model_id, catalog_model_label, model_year,
  catalog_variant_id, catalog_variant_label
) on public.deals to authenticated;

grant update (
  category_id, catalog_version,
  catalog_brand_id, catalog_brand_label,
  catalog_model_id, catalog_model_label, model_year,
  catalog_variant_id, catalog_variant_label
) on public.deals to authenticated;

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
  v_catalog jsonb;
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

  v_catalog := jsonb_strip_nulls(jsonb_build_object(
    'category_id',v_deal.category_id,
    'catalog_version',v_deal.catalog_version,
    'brand_id',v_deal.catalog_brand_id,
    'brand_label',v_deal.catalog_brand_label,
    'model_id',v_deal.catalog_model_id,
    'model_label',v_deal.catalog_model_label,
    'model_year',v_deal.model_year,
    'variant_id',v_deal.catalog_variant_id,
    'variant_label',v_deal.catalog_variant_label
  ));

  delete from public.agreement_versions version
  where version.deal_id=v_deal.id and version.version=1
    and not exists(
      select 1 from public.agreement_acceptances acceptance
      where acceptance.agreement_version_id=version.id
    );

  v_hash:=encode(extensions.digest(concat_ws('|',
    v_deal.title,v_deal.description,v_deal.price_cents,v_deal.currency,
    v_deal.condition,v_deal.delivery_method,v_deal.expires_at,
    v_deal.category_id,v_deal.catalog_version,v_deal.catalog_brand_id,
    v_deal.catalog_brand_label,v_deal.catalog_model_id,v_deal.catalog_model_label,
    v_deal.model_year,v_deal.catalog_variant_id,v_deal.catalog_variant_label,
    'seller_has_authority','item_not_stolen_counterfeit_or_prohibited',
    'known_defects_disclosed'
  ),'sha256'),'hex');

  insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by)
  values(v_deal.id,1,jsonb_build_object(
    'title',v_deal.title,'description',v_deal.description,'price_cents',v_deal.price_cents,
    'currency',v_deal.currency,'condition',v_deal.condition,
    'delivery_method',v_deal.delivery_method,'expires_at',v_deal.expires_at,
    'catalog_identity',v_catalog,
    'seller_declarations',jsonb_build_object(
      'has_authority_to_sell',true,'not_stolen_counterfeit_or_prohibited',true,
      'known_defects_and_material_facts_disclosed',true,'attested_at',v_now
    )),
    v_hash,auth.uid())
  on conflict(deal_id,version) do update
  set terms_json=excluded.terms_json,content_hash=excluded.content_hash,
      created_by=excluded.created_by,created_at=v_now;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal.id,auth.uid(),'seller_declarations_recorded',jsonb_build_object(
    'agreement_version',1,'category_id',v_deal.category_id,
    'catalog_version',v_deal.catalog_version,
    'has_authority_to_sell',true,
    'not_stolen_counterfeit_or_prohibited',true,'known_defects_disclosed',true
  ));

  return next v_deal;
end;
$$;

create or replace function public.update_published_deal(
  p_deal_id uuid,
  p_title text,
  p_description text,
  p_price_cents bigint,
  p_condition text,
  p_delivery_method text
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_deal public.deals%rowtype;
  v_version integer;
  v_catalog jsonb;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or v_deal.seller_id<>auth.uid() then raise exception 'Only the seller can edit this deal'; end if;
  if v_deal.status<>'published' or v_deal.buyer_id is not null then raise exception 'Accepted deals cannot be edited'; end if;
  if char_length(trim(p_title)) not between 3 and 120 or char_length(trim(p_description))<3 or p_price_cents<1 then raise exception 'Enter valid deal details'; end if;
  if p_condition not in('Like new','Good','Fair') or p_delivery_method not in('Meet in person','Ship to buyer') then raise exception 'Invalid condition or handoff method'; end if;

  v_version:=greatest(v_deal.current_agreement_version,1)+1;
  v_catalog := jsonb_strip_nulls(jsonb_build_object(
    'category_id',v_deal.category_id,
    'catalog_version',v_deal.catalog_version,
    'brand_id',v_deal.catalog_brand_id,
    'brand_label',v_deal.catalog_brand_label,
    'model_id',v_deal.catalog_model_id,
    'model_label',v_deal.catalog_model_label,
    'model_year',v_deal.model_year,
    'variant_id',v_deal.catalog_variant_id,
    'variant_label',v_deal.catalog_variant_label
  ));

  update public.deals
  set title=trim(p_title),description=trim(p_description),price_cents=p_price_cents,
      condition=p_condition,delivery_method=p_delivery_method,
      current_agreement_version=v_version,updated_at=now()
  where id=p_deal_id;

  insert into public.agreement_versions(deal_id,version,terms_json,content_hash,created_by)
  values(
    p_deal_id,
    v_version,
    jsonb_build_object(
      'title',trim(p_title),'description',trim(p_description),
      'price_cents',p_price_cents,'currency',v_deal.currency,
      'condition',p_condition,'delivery_method',p_delivery_method,
      'expires_at',v_deal.expires_at,'catalog_identity',v_catalog
    ),
    encode(extensions.digest(concat_ws('|',
      trim(p_title),trim(p_description),p_price_cents,v_deal.currency,
      p_condition,p_delivery_method,v_deal.expires_at,
      v_deal.category_id,v_deal.catalog_version,v_deal.catalog_brand_id,
      v_deal.catalog_brand_label,v_deal.catalog_model_id,v_deal.catalog_model_label,
      v_deal.model_year,v_deal.catalog_variant_id,v_deal.catalog_variant_label
    ),'sha256'),'hex'),
    auth.uid()
  );

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(p_deal_id,auth.uid(),'deal_updated',jsonb_build_object(
    'agreement_version',v_version,'category_id',v_deal.category_id,
    'catalog_version',v_deal.catalog_version
  ));
  return v_version;
end;
$$;

drop function if exists public.get_public_deal(text);
create function public.get_public_deal(p_public_id text)
returns table (
  id uuid,
  public_id text,
  title text,
  description text,
  price_cents bigint,
  currency character(3),
  condition text,
  serial_last_four text,
  delivery_method text,
  status public.deal_status,
  agreement_version integer,
  seller_name text,
  seller_contact_verified boolean,
  seller_verification public.verification_status,
  category_id text,
  catalog_version text,
  catalog_brand_id text,
  catalog_brand_label text,
  catalog_model_id text,
  catalog_model_label text,
  model_year smallint,
  catalog_variant_id text,
  catalog_variant_label text,
  created_at timestamptz,
  expires_at timestamptz,
  media_paths text[]
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    deal.id,deal.public_id,deal.title,deal.description,deal.price_cents,
    deal.currency,deal.condition,deal.serial_last_four,deal.delivery_method,
    deal.status,greatest(deal.current_agreement_version,1),
    seller.display_name,seller_auth.email_confirmed_at is not null,
    seller.verification_status,
    deal.category_id,deal.catalog_version,
    deal.catalog_brand_id,deal.catalog_brand_label,
    deal.catalog_model_id,deal.catalog_model_label,deal.model_year,
    deal.catalog_variant_id,deal.catalog_variant_label,
    deal.created_at,deal.expires_at,
    coalesce(
      array_agg(media.storage_path order by media.sort_order)
        filter (where media.id is not null),
      '{}'::text[]
    )
  from public.deals deal
  join public.profiles seller on seller.id=deal.seller_id
  join auth.users seller_auth on seller_auth.id=deal.seller_id
  left join public.deal_media media on media.deal_id=deal.id
  where deal.public_id=upper(trim(p_public_id))
    and deal.status in ('published','accepted','completed')
    and not exists(
      select 1 from public.deal_moderation moderation
      where moderation.deal_id=deal.id and moderation.status='hidden'
    )
  group by deal.id,seller.display_name,seller.verification_status,
    seller_auth.email_confirmed_at;
$$;

drop function if exists public.get_my_saved_deals();
create function public.get_my_saved_deals()
returns table(
  id uuid,
  public_id text,
  title text,
  description text,
  price_cents bigint,
  currency character(3),
  condition text,
  serial_last_four text,
  delivery_method text,
  status public.deal_status,
  current_agreement_version integer,
  created_at timestamptz,
  expires_at timestamptz,
  seller_name text,
  seller_contact_verified boolean,
  seller_verification public.verification_status,
  category_id text,
  catalog_version text,
  catalog_brand_id text,
  catalog_brand_label text,
  catalog_model_id text,
  catalog_model_label text,
  model_year smallint,
  catalog_variant_id text,
  catalog_variant_label text,
  media_paths text[],
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    deal.id,deal.public_id,deal.title,deal.description,deal.price_cents,
    deal.currency,deal.condition,deal.serial_last_four,deal.delivery_method,
    deal.status,deal.current_agreement_version,deal.created_at,deal.expires_at,
    seller.display_name,seller_auth.email_confirmed_at is not null,
    seller.verification_status,
    deal.category_id,deal.catalog_version,
    deal.catalog_brand_id,deal.catalog_brand_label,
    deal.catalog_model_id,deal.catalog_model_label,deal.model_year,
    deal.catalog_variant_id,deal.catalog_variant_label,
    coalesce(
      array_agg(media.storage_path order by media.sort_order)
        filter (where media.id is not null),
      '{}'::text[]
    ),
    saved.created_at
  from public.deal_watchlist saved
  join public.deals deal on deal.id=saved.deal_id
  join public.profiles seller on seller.id=deal.seller_id
  join auth.users seller_auth on seller_auth.id=deal.seller_id
  left join public.deal_media media on media.deal_id=deal.id
  where saved.user_id=auth.uid()
    and deal.status in ('published','accepted','completed')
    and public.is_saved_deal_visible(deal.id)
  group by deal.id,seller.display_name,seller.verification_status,
    seller_auth.email_confirmed_at,saved.created_at
  order by saved.created_at desc;
$$;

revoke all on function public.publish_deal_with_seller_declarations(
  uuid,text,text,bigint,text,text,text,text,integer
) from public, anon, authenticated;
revoke all on function public.update_published_deal(
  uuid,text,text,bigint,text,text
) from public, anon, authenticated;
revoke all on function public.get_public_deal(text)
from public, anon, authenticated;
revoke all on function public.get_my_saved_deals()
from public, anon, authenticated;

grant execute on function public.publish_deal_with_seller_declarations(
  uuid,text,text,bigint,text,text,text,text,integer
) to authenticated;
grant execute on function public.update_published_deal(
  uuid,text,text,bigint,text,text
) to authenticated;
grant execute on function public.get_public_deal(text)
to anon, authenticated;
grant execute on function public.get_my_saved_deals()
to authenticated;

notify pgrst, 'reload schema';
