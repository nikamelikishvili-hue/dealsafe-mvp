-- Private pre-acceptance questions between potential buyers and the seller.
-- Safe to run more than once.

create table if not exists public.deal_inquiries(
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 5 and 1000),
  seller_reply text check(seller_reply is null or char_length(seller_reply) between 2 and 1000),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists deal_inquiries_deal_created_idx on public.deal_inquiries(deal_id,created_at desc);
create index if not exists deal_inquiries_buyer_created_idx on public.deal_inquiries(buyer_id,created_at desc);
alter table public.deal_inquiries enable row level security;
revoke all on table public.deal_inquiries from anon,authenticated;

create or replace function public.ask_deal_question(p_public_id text,p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deals%rowtype;
  v_inquiry_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_body)) not between 5 and 1000 then raise exception 'Question must be 5 to 1000 characters'; end if;

  select * into v_deal from public.deals
  where public_id=upper(trim(p_public_id)) and status='published';
  if not found or v_deal.expires_at<=now() then raise exception 'This deal is not accepting questions'; end if;
  if v_deal.seller_id=auth.uid() then raise exception 'Seller cannot ask themselves a question'; end if;

  insert into public.deal_inquiries(deal_id,buyer_id,body)
  values(v_deal.id,auth.uid(),trim(p_body)) returning id into v_inquiry_id;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_deal.id,auth.uid(),'question_asked',jsonb_build_object('inquiry_id',v_inquiry_id));
  return v_inquiry_id;
end;
$$;

create or replace function public.get_deal_inquiries(p_deal_id uuid)
returns table(
  id uuid,
  buyer_name text,
  body text,
  seller_reply text,
  created_at timestamptz,
  replied_at timestamptz,
  is_mine boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select inquiry.id,buyer.display_name,inquiry.body,inquiry.seller_reply,
    inquiry.created_at,inquiry.replied_at,inquiry.buyer_id=auth.uid()
  from public.deal_inquiries inquiry
  join public.deals deal on deal.id=inquiry.deal_id
  join public.profiles buyer on buyer.id=inquiry.buyer_id
  where inquiry.deal_id=p_deal_id
    and (deal.seller_id=auth.uid() or inquiry.buyer_id=auth.uid())
  order by inquiry.created_at desc
  limit 100;
$$;

create or replace function public.is_current_user_deal_seller(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists(
    select 1 from public.deals where id=p_deal_id and seller_id=auth.uid()
  );
$$;

create or replace function public.reply_deal_inquiry(p_inquiry_id uuid,p_reply text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inquiry public.deal_inquiries%rowtype;
  v_seller_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_reply)) not between 2 and 1000 then raise exception 'Reply must be 2 to 1000 characters'; end if;

  select * into v_inquiry
  from public.deal_inquiries inquiry
  where inquiry.id=p_inquiry_id
  for update;
  if not found then raise exception 'Question was not found'; end if;

  select seller_id into v_seller_id from public.deals where id=v_inquiry.deal_id;
  if v_seller_id<>auth.uid() then raise exception 'Only the seller can reply'; end if;
  if v_inquiry.seller_reply is not null then raise exception 'Question was already answered'; end if;

  update public.deal_inquiries
  set seller_reply=trim(p_reply),replied_at=now()
  where id=v_inquiry.id;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(v_inquiry.deal_id,auth.uid(),'question_answered',jsonb_build_object(
    'inquiry_id',v_inquiry.id,'buyer_id',v_inquiry.buyer_id));
end;
$$;

revoke all on function public.ask_deal_question(text,text) from public;
revoke all on function public.get_deal_inquiries(uuid) from public;
revoke all on function public.is_current_user_deal_seller(uuid) from public;
revoke all on function public.reply_deal_inquiry(uuid,text) from public;
grant execute on function public.ask_deal_question(text,text) to authenticated;
grant execute on function public.get_deal_inquiries(uuid) to authenticated;
grant execute on function public.is_current_user_deal_seller(uuid) to authenticated;
grant execute on function public.reply_deal_inquiry(uuid,text) to authenticated;

-- Include seller answers in the questioner's activity menu even before acceptance.
drop function if exists public.get_my_notifications(integer);
create function public.get_my_notifications(p_limit integer default 12)
returns table(id text,deal_id uuid,public_id text,title text,event_type text,created_at timestamptz,is_mine boolean)
language sql
security definer
set search_path = public, pg_temp
as $$
  select event.id,event.deal_id,event.public_id,event.title,event.event_type,event.created_at,event.is_mine
  from (
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
  ) event
  order by event.created_at desc
  limit least(greatest(p_limit,1),50);
$$;

revoke all on function public.get_my_notifications(integer) from public;
grant execute on function public.get_my_notifications(integer) to authenticated;
