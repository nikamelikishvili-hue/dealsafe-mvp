-- CAT-006: privacy-preserving catalog adoption metrics.
-- Safe to rerun after production_auth_rbac_hardening.sql and
-- structured_catalog_persistence.sql.

drop function if exists public.get_admin_catalog_adoption(integer);

create function public.get_admin_catalog_adoption(p_days integer default 30)
returns table(
  window_days integer,
  catalog_version text,
  category_id text,
  deal_count bigint,
  structured_brand_count bigint,
  structured_model_count bigint,
  manual_fallback_count bigint,
  draft_count bigint,
  published_count bigint,
  accepted_count bigint,
  completed_count bigint,
  latest_deal_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_dealsafe_admin() then
    raise exception 'Admin access required';
  end if;

  if p_days not in (7, 30, 90) then
    raise exception 'Catalog metric window must be 7, 30, or 90 days';
  end if;

  return query
  select
    p_days,
    deal.catalog_version,
    deal.category_id,
    count(*)::bigint,
    count(*) filter (
      where deal.catalog_brand_id is not null
        and deal.catalog_brand_id <> 'other'
    )::bigint,
    count(*) filter (
      where deal.catalog_model_id is not null
        and deal.catalog_model_id <> 'other'
    )::bigint,
    count(*) filter (
      where deal.catalog_version = 'legacy'
        or deal.category_id = 'general'
        or deal.catalog_brand_id = 'other'
        or deal.catalog_model_id = 'other'
    )::bigint,
    count(*) filter (where deal.status = 'draft')::bigint,
    count(*) filter (where deal.status = 'published')::bigint,
    count(*) filter (where deal.status = 'accepted')::bigint,
    count(*) filter (where deal.status = 'completed')::bigint,
    max(deal.created_at)
  from public.deals deal
  where deal.created_at >= now() - make_interval(days => p_days)
  group by deal.catalog_version, deal.category_id
  order by count(*) desc, deal.catalog_version desc, deal.category_id;
end;
$$;

comment on function public.get_admin_catalog_adoption(integer) is
  'Administrator-only aggregate catalog adoption counts. Returns no deal or participant identifiers.';

revoke all on function public.get_admin_catalog_adoption(integer) from public, anon;
grant execute on function public.get_admin_catalog_adoption(integer) to authenticated;
