create index if not exists reports_open_deal_idx on public.reports(deal_id,status);
create unique index if not exists reports_one_open_per_reporter_deal_idx on public.reports(deal_id,reporter_id) where status='open';

create or replace function public.report_public_deal(
  p_public_id text,
  p_category text,
  p_details text
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_deal_id uuid;
  v_seller_id uuid;
  v_status public.deal_status;
  v_report_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to report this deal';
  end if;

  if coalesce(p_category,'') not in ('Suspected fraud','Prohibited item','Misleading information','Duplicate or stolen photos','Other') then
    raise exception 'Choose a valid report category';
  end if;

  if char_length(trim(coalesce(p_details,''))) not between 10 and 1000 then
    raise exception 'Report details must contain 10 to 1000 characters';
  end if;

  select id,seller_id,status into v_deal_id,v_seller_id,v_status
  from public.deals
  where public_id=upper(trim(p_public_id));

  if v_deal_id is null or v_status in ('draft','cancelled') then
    raise exception 'Deal is not available for reporting';
  end if;

  if v_seller_id=auth.uid() then
    raise exception 'You cannot report your own deal';
  end if;

  if exists(select 1 from public.reports where deal_id=v_deal_id and reporter_id=auth.uid() and status='open') then
    raise exception 'This account already submitted a report for this deal';
  end if;

  insert into public.reports(deal_id,reporter_id,reason,status)
  values(v_deal_id,auth.uid(),p_category||': '||trim(p_details),'open')
  returning id into v_report_id;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal_id,auth.uid(),'deal_reported',jsonb_build_object('category',p_category));

  return v_report_id;
end;
$$;

revoke all on function public.report_public_deal(text,text,text) from public;
grant execute on function public.report_public_deal(text,text,text) to authenticated;
