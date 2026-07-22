-- Privacy-preserving seller reputation shown on a public Deal Link. Safe to rerun.
create or replace function public.get_public_seller_trust_profile(p_public_id text)
returns table(
  display_name text,
  verification_status public.verification_status,
  member_since timestamptz,
  completed_sales bigint,
  rating_count bigint,
  average_rating numeric
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.display_name,p.verification_status,p.created_at,
    (select count(*) from public.deals completed
     where completed.seller_id=p.id and completed.status='completed'),
    (select count(*) from public.ratings rating where rating.subject_id=p.id),
    (select round(avg(rating.stars)::numeric,1) from public.ratings rating where rating.subject_id=p.id)
  from public.deals deal
  join public.profiles p on p.id=deal.seller_id
  where deal.public_id=upper(trim(p_public_id))
    and deal.status in ('published','accepted','completed')
    and not exists(
      select 1 from public.deal_moderation moderation
      where moderation.deal_id=deal.id and moderation.status='hidden'
    );
$$;

revoke all on function public.get_public_seller_trust_profile(text) from public;
grant execute on function public.get_public_seller_trust_profile(text) to anon,authenticated;
