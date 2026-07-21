-- Run once in Supabase SQL Editor. Safe to rerun.
create table if not exists public.deal_meetings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references public.deals(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  location_name text not null,
  address text not null,
  scheduled_at timestamptz not null,
  status text not null default 'proposed' check (status in ('proposed','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deal_meetings enable row level security;
drop policy if exists "participants read meetings" on public.deal_meetings;
create policy "participants read meetings" on public.deal_meetings for select to authenticated
using (exists (select 1 from public.deals d where d.id=deal_meetings.deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())));

create or replace function public.propose_meeting(p_deal_id uuid,p_location_name text,p_address text,p_scheduled_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.deals where id=p_deal_id and status='accepted' and (seller_id=auth.uid() or buyer_id=auth.uid())) then
    raise exception 'Only deal participants can schedule a meeting';
  end if;
  if p_scheduled_at <= now() then raise exception 'Meeting time must be in the future'; end if;
  insert into public.deal_meetings(deal_id,proposed_by,location_name,address,scheduled_at,status)
  values(p_deal_id,auth.uid(),trim(p_location_name),trim(p_address),p_scheduled_at,'proposed')
  on conflict(deal_id) do update set proposed_by=auth.uid(),confirmed_by=null,location_name=excluded.location_name,address=excluded.address,scheduled_at=excluded.scheduled_at,status='proposed',updated_at=now();
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'meeting_proposed');
end; $$;
revoke all on function public.propose_meeting(uuid,text,text,timestamptz) from public;
grant execute on function public.propose_meeting(uuid,text,text,timestamptz) to authenticated;

create or replace function public.confirm_meeting(p_deal_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_meeting public.deal_meetings%rowtype;
begin
  select * into v_meeting from public.deal_meetings where deal_id=p_deal_id for update;
  if not found then raise exception 'Meeting proposal not found'; end if;
  if v_meeting.proposed_by=auth.uid() then raise exception 'The other party must confirm the meeting'; end if;
  if not exists(select 1 from public.deals where id=p_deal_id and (seller_id=auth.uid() or buyer_id=auth.uid())) then raise exception 'Not a deal participant'; end if;
  update public.deal_meetings set status='confirmed',confirmed_by=auth.uid(),updated_at=now() where id=v_meeting.id;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'meeting_confirmed');
end; $$;
revoke all on function public.confirm_meeting(uuid) from public;
grant execute on function public.confirm_meeting(uuid) to authenticated;
