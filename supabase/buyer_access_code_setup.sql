-- Optional private buyer code for protected Deal Link acceptance.
-- Run after deal_expiration_setup.sql and seller_declaration_setup.sql.
-- Safe to run more than once.

alter table public.deals
  add column if not exists acceptance_code_hash text,
  add column if not exists acceptance_code_enabled_at timestamptz;

create table if not exists public.deal_acceptance_code_attempts(
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists deal_acceptance_code_attempts_recent_idx
  on public.deal_acceptance_code_attempts(deal_id,user_id,attempted_at desc);

alter table public.deal_acceptance_code_attempts enable row level security;
revoke all on table public.deal_acceptance_code_attempts from anon,authenticated;

create or replace function public.get_deal_acceptance_protection(p_public_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select deal.acceptance_code_hash is not null
    from public.deals deal
    where deal.public_id=upper(trim(p_public_id))
      and deal.status in('published','accepted','completed')
  ),false);
$$;

create or replace function public.configure_buyer_access_code(p_deal_id uuid,p_enabled boolean)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deal public.deals%rowtype;
  v_bytes bytea;
  v_number bigint;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found or v_deal.seller_id<>auth.uid() then raise exception 'Only the seller can manage buyer access'; end if;
  if v_deal.status<>'published' then raise exception 'Buyer access can only be changed on a published deal'; end if;

  if not p_enabled then
    update public.deals
    set acceptance_code_hash=null,acceptance_code_enabled_at=null,updated_at=now()
    where id=v_deal.id;
    delete from public.deal_acceptance_code_attempts where deal_id=v_deal.id;
    insert into public.audit_events(deal_id,actor_id,event_type)
    values(v_deal.id,auth.uid(),'buyer_access_protection_disabled');
    return null;
  end if;

  v_bytes:=extensions.gen_random_bytes(4);
  v_number:=(get_byte(v_bytes,0)::bigint<<24)+(get_byte(v_bytes,1)::bigint<<16)
    +(get_byte(v_bytes,2)::bigint<<8)+get_byte(v_bytes,3)::bigint;
  v_code:=lpad((v_number%1000000)::text,6,'0');

  update public.deals
  set acceptance_code_hash=encode(extensions.digest(v_deal.id::text||':'||v_code,'sha256'),'hex'),
      acceptance_code_enabled_at=now(),updated_at=now()
  where id=v_deal.id;
  delete from public.deal_acceptance_code_attempts where deal_id=v_deal.id;
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(v_deal.id,auth.uid(),'buyer_access_protection_enabled');
  return v_code;
end;
$$;

drop function if exists public.accept_deal(text,text);
drop function if exists public.accept_deal(text,text,text);
create function public.accept_deal(p_public_id text,p_typed_name text,p_access_code text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deal public.deals%rowtype;
  v_agreement_id uuid;
  v_failed_attempts integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_typed_name))<2 then raise exception 'Full name is required'; end if;
  select * into v_deal from public.deals where public_id=upper(trim(p_public_id)) for update;
  if not found then raise exception 'Deal not found'; end if;
  if v_deal.seller_id=auth.uid() then raise exception 'Seller cannot accept their own deal'; end if;
  if v_deal.status<>'published' then raise exception 'Deal is no longer available'; end if;
  if v_deal.expires_at<=now() then raise exception 'This Deal Link has expired'; end if;
  if v_deal.buyer_id is not null and v_deal.buyer_id<>auth.uid() then raise exception 'Deal already has a buyer'; end if;

  if v_deal.acceptance_code_hash is not null then
    delete from public.deal_acceptance_code_attempts
    where deal_id=v_deal.id and attempted_at<now()-interval '1 day';
    select count(*) into v_failed_attempts
    from public.deal_acceptance_code_attempts attempt
    where attempt.deal_id=v_deal.id and attempt.user_id=auth.uid()
      and attempt.attempted_at>now()-interval '15 minutes';
    if v_failed_attempts>=5 then return 'rate_limited'; end if;
    if p_access_code is null or p_access_code!~'^[0-9]{6}$'
      or v_deal.acceptance_code_hash<>encode(extensions.digest(v_deal.id::text||':'||p_access_code,'sha256'),'hex') then
      insert into public.deal_acceptance_code_attempts(deal_id,user_id)
      values(v_deal.id,auth.uid());
      return 'incorrect_code';
    end if;
  end if;

  select id into v_agreement_id from public.agreement_versions
  where deal_id=v_deal.id and version=greatest(v_deal.current_agreement_version,1);
  insert into public.agreement_acceptances(agreement_version_id,signer_id,typed_name,consent_text,user_agent)
  values(v_agreement_id,auth.uid(),trim(p_typed_name),'I reviewed the item facts and accept this version of the Dealivra agreement.',null)
  on conflict(agreement_version_id,signer_id) do nothing;
  update public.deals
  set buyer_id=auth.uid(),status='accepted',acceptance_code_hash=null,
      acceptance_code_enabled_at=null,updated_at=now()
  where id=v_deal.id;
  delete from public.deal_acceptance_code_attempts where deal_id=v_deal.id;
  insert into public.audit_events(deal_id,actor_id,event_type)
  values(v_deal.id,auth.uid(),'buyer_accepted');
  if v_deal.acceptance_code_hash is not null then
    insert into public.audit_events(deal_id,actor_id,event_type)
    values(v_deal.id,auth.uid(),'buyer_access_code_verified');
  end if;
  return 'accepted';
end;
$$;

revoke all on function public.get_deal_acceptance_protection(text) from public;
revoke all on function public.configure_buyer_access_code(uuid,boolean) from public;
revoke all on function public.accept_deal(text,text,text) from public;
grant execute on function public.get_deal_acceptance_protection(text) to anon,authenticated;
grant execute on function public.configure_buyer_access_code(uuid,boolean) to authenticated;
grant execute on function public.accept_deal(text,text,text) to authenticated;
