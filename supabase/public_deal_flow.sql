-- Run once in Supabase SQL Editor after auth_setup.sql.
-- Adds a privacy-limited public Deal Link and authenticated buyer acceptance.

create or replace function public.create_initial_agreement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.agreement_versions
    (deal_id, version, terms_json, content_hash, created_by)
  values
    (new.id, 1,
      jsonb_build_object(
        'title', new.title,
        'description', new.description,
        'price_cents', new.price_cents,
        'currency', new.currency,
        'condition', new.condition,
        'delivery_method', new.delivery_method
      ),
      encode(extensions.digest(concat_ws('|', new.title, new.description, new.price_cents, new.currency, new.condition, new.delivery_method), 'sha256'), 'hex'),
      new.seller_id)
  on conflict (deal_id, version) do nothing;
  return new;
end;
$$;

drop trigger if exists on_deal_created on public.deals;
create trigger on_deal_created
  after insert on public.deals
  for each row execute procedure public.create_initial_agreement();

insert into public.agreement_versions (deal_id, version, terms_json, content_hash, created_by)
select d.id, 1,
  jsonb_build_object(
    'title', d.title,
    'description', d.description,
    'price_cents', d.price_cents,
    'currency', d.currency,
    'condition', d.condition,
    'delivery_method', d.delivery_method
  ),
  encode(extensions.digest(concat_ws('|', d.title, d.description, d.price_cents, d.currency, d.condition, d.delivery_method), 'sha256'), 'hex'),
  d.seller_id
from public.deals d
on conflict (deal_id, version) do nothing;

create or replace function public.get_public_deal(p_public_id text)
returns table (
  id uuid, public_id text, title text, description text, price_cents bigint,
  currency char(3), condition text, serial_last_four text, delivery_method text,
  status public.deal_status, agreement_version integer, seller_name text,
  seller_verification public.verification_status, created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select d.id, d.public_id, d.title, d.description, d.price_cents, d.currency,
    d.condition, d.serial_last_four, d.delivery_method, d.status,
    greatest(d.current_agreement_version, 1), p.display_name, p.verification_status, d.created_at
  from public.deals d
  join public.profiles p on p.id = d.seller_id
  where d.public_id = p_public_id and d.status in ('published', 'accepted', 'completed');
$$;

revoke all on function public.get_public_deal(text) from public;
grant execute on function public.get_public_deal(text) to anon, authenticated;

create or replace function public.accept_deal(p_public_id text, p_typed_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
  v_agreement_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_typed_name)) < 2 then raise exception 'Full name is required'; end if;

  select * into v_deal from public.deals where public_id = p_public_id for update;
  if not found then raise exception 'Deal not found'; end if;
  if v_deal.seller_id = auth.uid() then raise exception 'Seller cannot accept their own deal'; end if;
  if v_deal.buyer_id is not null and v_deal.buyer_id <> auth.uid() then raise exception 'Deal already has a buyer'; end if;

  select id into v_agreement_id from public.agreement_versions
  where deal_id = v_deal.id and version = greatest(v_deal.current_agreement_version, 1);

  insert into public.agreement_acceptances
    (agreement_version_id, signer_id, typed_name, consent_text, user_agent)
  values
    (v_agreement_id, auth.uid(), trim(p_typed_name),
     'I reviewed the item facts and accept this version of the DealSafe agreement.', null)
  on conflict (agreement_version_id, signer_id) do nothing;

  update public.deals set buyer_id = auth.uid(), status = 'accepted', updated_at = now()
  where id = v_deal.id;

  insert into public.audit_events (deal_id, actor_id, event_type)
  values (v_deal.id, auth.uid(), 'buyer_accepted');
end;
$$;

revoke all on function public.accept_deal(text, text) from public;
grant execute on function public.accept_deal(text, text) to authenticated;
