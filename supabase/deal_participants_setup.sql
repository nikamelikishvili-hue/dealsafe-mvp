-- Private participant record for accepted deals.
-- Only the authenticated seller or buyer can call this function successfully.

drop function if exists public.get_deal_participants(uuid);

create function public.get_deal_participants(p_deal_id uuid)
returns table (
  seller_name text,
  seller_verification text,
  buyer_name text,
  buyer_verification text,
  accepted_at timestamptz,
  viewer_role text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    seller.display_name,
    seller.verification_status::text,
    buyer.display_name,
    buyer.verification_status::text,
    acceptance.accepted_at,
    case
      when deal.seller_id = auth.uid() then 'seller'
      when deal.buyer_id = auth.uid() then 'buyer'
    end
  from public.deals deal
  join public.profiles seller on seller.id = deal.seller_id
  join public.profiles buyer on buyer.id = deal.buyer_id
  left join lateral (
    select min(record.accepted_at) as accepted_at
    from public.agreement_versions version
    join public.agreement_acceptances record
      on record.agreement_version_id = version.id
    where version.deal_id = deal.id
      and record.signer_id = deal.buyer_id
  ) acceptance on true
  where deal.id = p_deal_id
    and auth.uid() is not null
    and auth.uid() in (deal.seller_id, deal.buyer_id)
    and deal.buyer_id is not null
    and deal.status in ('accepted', 'completed', 'disputed', 'cancelled');
$$;

revoke all on function public.get_deal_participants(uuid) from public;
grant execute on function public.get_deal_participants(uuid) to authenticated;
