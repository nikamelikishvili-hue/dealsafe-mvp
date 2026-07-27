alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.reports add column if not exists resolution_note text;

-- Keep the administrator flag server-controlled. Signed-in users may still
-- update their own display name through the existing profile screen.
revoke update on table public.profiles from public, anon, authenticated;
grant update(display_name) on table public.profiles to authenticated;

create or replace function public.is_dealsafe_admin() returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists(
      select 1 from public.profiles
      where id=auth.uid() and app_role='admin'
    );
$$;

create or replace function public.get_admin_reports(p_status text default 'open')
returns table(
  report_id uuid,
  deal_id uuid,
  public_id text,
  title text,
  reason text,
  report_status text,
  created_at timestamptz,
  reporter_name text,
  seller_name text,
  resolution_note text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_dealsafe_admin() then raise exception 'Admin access required'; end if;
  if coalesce(p_status,'') not in ('open','reviewed','dismissed','all') then raise exception 'Invalid report status'; end if;
  return query
  select r.id,d.id,d.public_id,d.title,r.reason,r.status,r.created_at,
         coalesce(reporter.display_name,'Unknown'),seller.display_name,r.resolution_note
  from public.reports r
  join public.deals d on d.id=r.deal_id
  left join public.profiles reporter on reporter.id=r.reporter_id
  join public.profiles seller on seller.id=d.seller_id
  where p_status='all' or r.status=p_status
  order by case when r.status='open' then 0 else 1 end,r.created_at desc
  limit 200;
end;
$$;

create or replace function public.resolve_deal_report(
  p_report_id uuid,
  p_decision text,
  p_resolution_note text
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_deal_id uuid;
begin
  if not public.is_dealsafe_admin() then raise exception 'Admin access required'; end if;
  if coalesce(p_decision,'') not in ('reviewed','dismissed') then raise exception 'Invalid report decision'; end if;
  if char_length(trim(coalesce(p_resolution_note,''))) not between 3 and 500 then raise exception 'Resolution note must contain 3 to 500 characters'; end if;

  update public.reports
  set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),resolution_note=trim(p_resolution_note)
  where id=p_report_id and status='open'
  returning deal_id into v_deal_id;

  if v_deal_id is null then raise exception 'Open report was not found'; end if;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal_id,auth.uid(),'report_'||p_decision,jsonb_build_object('report_id',p_report_id));
end;
$$;

revoke all on function public.is_dealsafe_admin() from public;
revoke all on function public.get_admin_reports(text) from public;
revoke all on function public.resolve_deal_report(uuid,text,text) from public;
grant execute on function public.is_dealsafe_admin() to authenticated;
grant execute on function public.get_admin_reports(text) to authenticated;
grant execute on function public.resolve_deal_report(uuid,text,text) to authenticated;

-- After running this file, promote the first administrator in the SQL Editor:
-- update public.profiles set is_admin=true
-- where id=(select id from auth.users where lower(email)=lower('YOUR_EMAIL@example.com'));
