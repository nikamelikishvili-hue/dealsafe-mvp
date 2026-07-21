-- Run once in Supabase SQL Editor. Safe to rerun.
create table if not exists public.deal_messages(
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check(char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.deal_messages enable row level security;
drop policy if exists "participants read messages" on public.deal_messages;
create policy "participants read messages" on public.deal_messages for select to authenticated using(exists(select 1 from public.deals d where d.id=deal_messages.deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())));

create or replace function public.send_deal_message(p_deal_id uuid,p_body text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.deals d where d.id=p_deal_id and d.status in ('accepted','completed','disputed') and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())) then raise exception 'Messaging is unavailable for this deal'; end if;
  if char_length(trim(p_body))<1 or char_length(trim(p_body))>1000 then raise exception 'Message must be 1 to 1000 characters'; end if;
  insert into public.deal_messages(deal_id,sender_id,body) values(p_deal_id,auth.uid(),trim(p_body));
end; $$;
revoke all on function public.send_deal_message(uuid,text) from public;
grant execute on function public.send_deal_message(uuid,text) to authenticated;

create or replace function public.get_deal_messages(p_deal_id uuid)
returns table(id bigint,sender_id uuid,sender_name text,body text,created_at timestamptz,is_mine boolean)
language sql security definer set search_path=public as $$
  select m.id,m.sender_id,p.display_name,m.body,m.created_at,m.sender_id=auth.uid()
  from public.deal_messages m join public.profiles p on p.id=m.sender_id join public.deals d on d.id=m.deal_id
  where m.deal_id=p_deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())
  order by m.created_at asc limit 200;
$$;
revoke all on function public.get_deal_messages(uuid) from public;
grant execute on function public.get_deal_messages(uuid) to authenticated;
