-- Durable per-user read state for DealSafe activity notifications.
-- Run after inquiry_setup.sql. Safe to run more than once.

create table if not exists public.deal_activity_reads(
  user_id uuid not null references public.profiles(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(user_id,deal_id)
);

create index if not exists deal_activity_reads_user_idx
  on public.deal_activity_reads(user_id,last_read_at desc);

alter table public.deal_activity_reads enable row level security;
revoke all on table public.deal_activity_reads from anon,authenticated;

create or replace function public.mark_deal_activity_read(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.deals deal
    where deal.id=p_deal_id
      and (
        deal.seller_id=auth.uid()
        or deal.buyer_id=auth.uid()
        or exists(
          select 1 from public.deal_inquiries inquiry
          where inquiry.deal_id=deal.id and inquiry.buyer_id=auth.uid()
        )
      )
  ) then raise exception 'Deal activity is unavailable'; end if;

  insert into public.deal_activity_reads(user_id,deal_id,last_read_at)
  values(auth.uid(),p_deal_id,now())
  on conflict(user_id,deal_id) do update set last_read_at=excluded.last_read_at;
end;
$$;

create or replace function public.mark_all_activity_read()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.deal_activity_reads(user_id,deal_id,last_read_at)
  select auth.uid(),accessible.deal_id,now()
  from (
    select deal.id deal_id from public.deals deal
    where deal.seller_id=auth.uid() or deal.buyer_id=auth.uid()
    union
    select inquiry.deal_id from public.deal_inquiries inquiry
    where inquiry.buyer_id=auth.uid()
  ) accessible
  where auth.uid() is not null
  on conflict(user_id,deal_id) do update set last_read_at=excluded.last_read_at;
$$;

drop function if exists public.get_my_notifications(integer);
create function public.get_my_notifications(p_limit integer default 12)
returns table(
  id text,
  deal_id uuid,
  public_id text,
  title text,
  event_type text,
  created_at timestamptz,
  is_mine boolean,
  is_read boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with events as (
    select audit.id::text id,deal.id deal_id,deal.public_id,deal.title,
      audit.event_type,audit.created_at,audit.actor_id=auth.uid() is_mine
    from public.audit_events audit
    join public.deals deal on deal.id=audit.deal_id
    where deal.seller_id=auth.uid() or deal.buyer_id=auth.uid()
    union all
    select ('inquiry-reply-'||inquiry.id::text),deal.id,deal.public_id,deal.title,
      'question_answered'::text,inquiry.replied_at,false
    from public.deal_inquiries inquiry
    join public.deals deal on deal.id=inquiry.deal_id
    where inquiry.buyer_id=auth.uid() and inquiry.replied_at is not null
      and deal.buyer_id is distinct from auth.uid()
  )
  select event.id,event.deal_id,event.public_id,event.title,event.event_type,
    event.created_at,event.is_mine,
    (event.is_mine or coalesce(activity_read.last_read_at>=event.created_at,false)) is_read
  from events event
  left join public.deal_activity_reads activity_read
    on activity_read.user_id=auth.uid() and activity_read.deal_id=event.deal_id
  order by event.created_at desc
  limit least(greatest(p_limit,1),50);
$$;

revoke all on function public.mark_deal_activity_read(uuid) from public;
revoke all on function public.mark_all_activity_read() from public;
revoke all on function public.get_my_notifications(integer) from public;
grant execute on function public.mark_deal_activity_read(uuid) to authenticated;
grant execute on function public.mark_all_activity_read() to authenticated;
grant execute on function public.get_my_notifications(integer) to authenticated;
