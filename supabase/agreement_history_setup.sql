-- Privacy-safe public history of published agreement versions.
-- Safe to run more than once.

create or replace function public.get_public_agreement_history(p_public_id text)
returns table(
  version integer,
  price_cents bigint,
  currency text,
  condition text,
  delivery_method text,
  content_hash text,
  created_at timestamptz,
  acceptance_count bigint,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    agreement.version,
    case
      when coalesce(agreement.terms_json->>'price_cents','') ~ '^[0-9]+$'
        then (agreement.terms_json->>'price_cents')::bigint
      else deal.price_cents
    end,
    coalesce(nullif(agreement.terms_json->>'currency',''),deal.currency),
    coalesce(nullif(agreement.terms_json->>'condition',''),deal.condition),
    coalesce(nullif(agreement.terms_json->>'delivery_method',''),deal.delivery_method),
    coalesce(agreement.canonical_hash,agreement.content_hash),
    agreement.created_at,
    count(acceptance.id),
    agreement.version=greatest(deal.current_agreement_version,1)
  from public.deals deal
  join public.agreement_versions agreement on agreement.deal_id=deal.id
  left join public.agreement_acceptances acceptance on acceptance.agreement_version_id=agreement.id
  where deal.public_id=upper(trim(p_public_id))
    and deal.status in ('published','accepted','completed','disputed')
  group by deal.id,agreement.id
  order by agreement.version desc;
$$;

revoke all on function public.get_public_agreement_history(text) from public;
grant execute on function public.get_public_agreement_history(text) to anon,authenticated;
