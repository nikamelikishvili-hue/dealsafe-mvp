-- Run once in Supabase SQL Editor. Safe to rerun.
create or replace function public.get_my_profile_summary()
returns table(display_name text, verification_status public.verification_status, member_since timestamptz, completed_deals bigint, rating_count bigint, average_rating numeric, recent_ratings jsonb)
language sql security definer set search_path=public as $$
  select p.display_name,p.verification_status,p.created_at,
    (select count(*) from public.deals d where d.status='completed' and (d.seller_id=p.id or d.buyer_id=p.id)),
    (select count(*) from public.ratings r where r.subject_id=p.id),
    (select round(avg(r.stars)::numeric,1) from public.ratings r where r.subject_id=p.id),
    coalesce((select jsonb_agg(x order by x.created_at desc) from (select r.stars,r.comment,r.created_at from public.ratings r where r.subject_id=p.id order by r.created_at desc limit 5) x),'[]'::jsonb)
  from public.profiles p where p.id=auth.uid();
$$;
revoke all on function public.get_my_profile_summary() from public;
grant execute on function public.get_my_profile_summary() to authenticated;
