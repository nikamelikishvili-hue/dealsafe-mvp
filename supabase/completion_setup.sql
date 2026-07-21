-- Run once in Supabase SQL Editor. Safe to rerun.
alter table public.deal_meetings add column if not exists seller_arrived boolean not null default false;
alter table public.deal_meetings add column if not exists buyer_arrived boolean not null default false;
alter table public.deal_meetings add column if not exists handoff_pin_hash text;
alter table public.deal_meetings add column if not exists pin_created_at timestamptz;

create or replace function public.mark_arrived(p_deal_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id;
  if v_deal.seller_id=auth.uid() then update public.deal_meetings set seller_arrived=true,updated_at=now() where deal_id=p_deal_id and status='confirmed';
  elsif v_deal.buyer_id=auth.uid() then update public.deal_meetings set buyer_arrived=true,updated_at=now() where deal_id=p_deal_id and status='confirmed';
  else raise exception 'Not a deal participant'; end if;
  if not found then raise exception 'Confirmed meeting not found'; end if;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'participant_arrived');
end; $$;
revoke all on function public.mark_arrived(uuid) from public;
grant execute on function public.mark_arrived(uuid) to authenticated;

create or replace function public.generate_handoff_pin(p_deal_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_pin text;
begin
  if not exists(select 1 from public.deals d join public.deal_meetings m on m.deal_id=d.id where d.id=p_deal_id and d.seller_id=auth.uid() and m.status='confirmed' and m.seller_arrived and m.buyer_arrived) then
    raise exception 'Both parties must arrive before generating a PIN';
  end if;
  v_pin:=lpad((floor(random()*1000000))::int::text,6,'0');
  update public.deal_meetings set handoff_pin_hash=encode(extensions.digest(v_pin,'sha256'),'hex'),pin_created_at=now(),updated_at=now() where deal_id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'handoff_pin_generated');
  return v_pin;
end; $$;
revoke all on function public.generate_handoff_pin(uuid) from public;
grant execute on function public.generate_handoff_pin(uuid) to authenticated;

create or replace function public.complete_handoff(p_deal_id uuid,p_pin text)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;v_meeting public.deal_meetings%rowtype;
begin
  select * into v_deal from public.deals where id=p_deal_id for update;
  select * into v_meeting from public.deal_meetings where deal_id=p_deal_id;
  if v_deal.buyer_id<>auth.uid() then raise exception 'Only the buyer can confirm receipt'; end if;
  if not(v_meeting.seller_arrived and v_meeting.buyer_arrived) then raise exception 'Both parties must arrive first'; end if;
  if v_meeting.handoff_pin_hash is null or v_meeting.handoff_pin_hash<>encode(extensions.digest(trim(p_pin),'sha256'),'hex') then raise exception 'Incorrect handoff PIN'; end if;
  update public.deals set status='completed',updated_at=now() where id=p_deal_id;
  update public.deal_meetings set handoff_pin_hash=null,updated_at=now() where deal_id=p_deal_id;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'deal_completed');
end; $$;
revoke all on function public.complete_handoff(uuid,text) from public;
grant execute on function public.complete_handoff(uuid,text) to authenticated;

drop policy if exists "participants read ratings" on public.ratings;
create policy "participants read ratings" on public.ratings for select to authenticated
using(exists(select 1 from public.deals d where d.id=ratings.deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())));

create or replace function public.submit_rating(p_deal_id uuid,p_stars smallint,p_comment text)
returns void language plpgsql security definer set search_path=public as $$
declare v_deal public.deals%rowtype;v_subject uuid;
begin
  select * into v_deal from public.deals where id=p_deal_id and status='completed';
  if not found then raise exception 'Only completed deals can be rated'; end if;
  if v_deal.seller_id=auth.uid() then v_subject:=v_deal.buyer_id;
  elsif v_deal.buyer_id=auth.uid() then v_subject:=v_deal.seller_id;
  else raise exception 'Not a deal participant'; end if;
  if p_stars<1 or p_stars>5 then raise exception 'Rating must be 1 to 5'; end if;
  insert into public.ratings(deal_id,author_id,subject_id,stars,comment)
  values(p_deal_id,auth.uid(),v_subject,p_stars,nullif(trim(p_comment),''))
  on conflict(deal_id,author_id) do update set stars=excluded.stars,comment=excluded.comment;
end; $$;
revoke all on function public.submit_rating(uuid,smallint,text) from public;
grant execute on function public.submit_rating(uuid,smallint,text) to authenticated;
