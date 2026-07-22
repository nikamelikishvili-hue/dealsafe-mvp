-- Adds reversible administrator controls for unsafe Deal Links. Safe to rerun.
create table if not exists public.deal_moderation (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  status text not null default 'visible' check (status in ('visible','hidden')),
  note text not null,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.deal_moderation enable row level security;
revoke all on table public.deal_moderation from public, anon, authenticated;

drop function if exists public.get_admin_reports(text);
create function public.get_admin_reports(p_status text default 'open')
returns table(
  report_id uuid,
  deal_id uuid,
  public_id text,
  title text,
  reason text,
  report_status text,
  moderation_status text,
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
  select r.id,d.id,d.public_id,d.title,r.reason,r.status,
         coalesce(dm.status,'visible'),r.created_at,
         coalesce(reporter.display_name,'Unknown'),seller.display_name,r.resolution_note
  from public.reports r
  join public.deals d on d.id=r.deal_id
  left join public.deal_moderation dm on dm.deal_id=d.id
  left join public.profiles reporter on reporter.id=r.reporter_id
  join public.profiles seller on seller.id=d.seller_id
  where p_status='all' or r.status=p_status
  order by case when r.status='open' then 0 else 1 end,r.created_at desc
  limit 200;
end;
$$;

create or replace function public.set_deal_moderation_status(
  p_deal_id uuid,
  p_status text,
  p_note text
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_dealsafe_admin() then raise exception 'Admin access required'; end if;
  if coalesce(p_status,'') not in ('visible','hidden') then raise exception 'Invalid moderation status'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 3 and 500 then raise exception 'Moderation note must contain 3 to 500 characters'; end if;
  if not exists(select 1 from public.deals where id=p_deal_id) then raise exception 'Deal not found'; end if;

  insert into public.deal_moderation(deal_id,status,note,updated_by,updated_at)
  values(p_deal_id,p_status,trim(p_note),auth.uid(),now())
  on conflict(deal_id) do update
  set status=excluded.status,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

  insert into public.audit_events(deal_id,actor_id,event_type,metadata)
  values(p_deal_id,auth.uid(),case when p_status='hidden' then 'deal_hidden' else 'deal_restored' end,
         jsonb_build_object('note',trim(p_note)));
end;
$$;

-- A hidden deal cannot be changed or accepted until an administrator restores it.
create or replace function public.block_hidden_deal_changes() returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is not null
     and exists(select 1 from public.deal_moderation where deal_id=old.id and status='hidden')
     and not public.is_dealsafe_admin()
  then
    raise exception 'This deal is unavailable while under review';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_hidden_deal on public.deals;
create trigger protect_hidden_deal
before update on public.deals
for each row execute function public.block_hidden_deal_changes();

create or replace function public.block_hidden_deal_offers() returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is not null
     and exists(select 1 from public.deal_moderation where deal_id=new.deal_id and status='hidden')
     and not public.is_dealsafe_admin()
  then
    raise exception 'This deal is unavailable while under review';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_hidden_deal_offers on public.deal_offers;
create trigger protect_hidden_deal_offers
before insert or update on public.deal_offers
for each row execute function public.block_hidden_deal_offers();

drop function if exists public.get_public_deal(text);
create function public.get_public_deal(p_public_id text)
returns table (id uuid,public_id text,title text,description text,price_cents bigint,
currency char(3),condition text,serial_last_four text,delivery_method text,
status public.deal_status,agreement_version integer,seller_name text,
seller_verification public.verification_status,created_at timestamptz,expires_at timestamptz,media_paths text[])
language sql stable security definer set search_path=public as $$
select d.id,d.public_id,d.title,d.description,d.price_cents,d.currency,d.condition,d.serial_last_four,
d.delivery_method,d.status,greatest(d.current_agreement_version,1),p.display_name,p.verification_status,d.created_at,d.expires_at,
coalesce(array_agg(m.storage_path order by m.sort_order) filter(where m.id is not null),'{}')
from public.deals d
join public.profiles p on p.id=d.seller_id
left join public.deal_media m on m.deal_id=d.id
where d.public_id=p_public_id
  and d.status in('published','accepted','completed')
  and not exists(select 1 from public.deal_moderation dm where dm.deal_id=d.id and dm.status='hidden')
group by d.id,p.display_name,p.verification_status;
$$;

revoke all on function public.get_admin_reports(text) from public;
revoke all on function public.set_deal_moderation_status(uuid,text,text) from public;
revoke all on function public.get_public_deal(text) from public;
grant execute on function public.get_admin_reports(text) to authenticated;
grant execute on function public.set_deal_moderation_status(uuid,text,text) to authenticated;
grant execute on function public.get_public_deal(text) to anon,authenticated;
