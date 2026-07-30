-- OPS-001 / OPS-002: case-scoped customer support foundation.
-- Review source only. Apply after production_auth_rbac_hardening.sql and
-- immutable_material_audit_events.sql through the governed migration process.

begin;

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique
    default (
      'SC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
    ),
  requester_id uuid not null references public.profiles(id),
  deal_id uuid references public.deals(id),
  category text not null check (
    category in (
      'account_access',
      'deal_help',
      'payment_question',
      'delivery_issue',
      'safety_concern',
      'technical_issue',
      'other'
    )
  ),
  subject text not null check (char_length(trim(subject)) between 5 and 120),
  status text not null default 'open' check (
    status in (
      'open',
      'waiting_customer',
      'waiting_support',
      'resolved',
      'closed'
    )
  ),
  priority text not null default 'normal'
    check (priority in ('normal', 'urgent')),
  assigned_to uuid references public.profiles(id),
  first_response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public_reference ~ '^SC-[0-9A-F]{12}$'),
  check (resolution_due_at >= first_response_due_at),
  check (first_responded_at is null or first_responded_at >= created_at),
  check (resolved_at is null or resolved_at >= created_at),
  check (closed_at is null or closed_at >= created_at),
  check (
    (status = 'resolved' and resolved_at is not null and closed_at is null)
    or (status = 'closed' and closed_at is not null)
    or (
      status in ('open', 'waiting_customer', 'waiting_support')
      and resolved_at is null
      and closed_at is null
    )
  )
);

create unique index if not exists support_cases_one_active_context_idx
  on public.support_cases (
    requester_id,
    coalesce(deal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    category
  )
  where status in ('open', 'waiting_customer', 'waiting_support');

create index if not exists support_cases_requester_created_idx
  on public.support_cases(requester_id, created_at desc);

create index if not exists support_cases_queue_idx
  on public.support_cases(priority desc, first_response_due_at, created_at)
  where status in ('open', 'waiting_customer', 'waiting_support');

create index if not exists support_cases_assignee_idx
  on public.support_cases(assigned_to, updated_at desc)
  where assigned_to is not null;

create table if not exists public.support_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  author_role text not null check (
    author_role in ('requester', 'support', 'compliance', 'admin')
  ),
  body text not null check (char_length(trim(body)) between 10 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_case_messages_case_created_idx
  on public.support_case_messages(case_id, created_at, id);

alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;

revoke all on table public.support_cases
  from public, anon, authenticated;
revoke all on table public.support_case_messages
  from public, anon, authenticated;

drop policy if exists "support cases deny direct access"
  on public.support_cases;
drop policy if exists "support messages deny direct access"
  on public.support_case_messages;

create or replace function public.reject_support_message_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Support case messages are append-only'
    using errcode = '55000';
end;
$$;

revoke all on function public.reject_support_message_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists support_case_messages_reject_update_delete
  on public.support_case_messages;
create trigger support_case_messages_reject_update_delete
before update or delete on public.support_case_messages
for each row
execute function public.reject_support_message_mutation();

drop trigger if exists support_case_messages_reject_truncate
  on public.support_case_messages;
create trigger support_case_messages_reject_truncate
before truncate on public.support_case_messages
for each statement
execute function public.reject_support_message_mutation();

create or replace function public.create_support_case(
  p_deal_id uuid,
  p_category text,
  p_subject text,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  normalized_category text := lower(trim(coalesce(p_category, '')));
  normalized_subject text := trim(coalesce(p_subject, ''));
  normalized_message text := trim(coalesce(p_message, ''));
  created_case public.support_cases%rowtype;
  active_case_count integer;
  first_response_interval interval;
  resolution_interval interval;
begin
  if requester is null then
    raise exception 'Sign in to contact support';
  end if;
  if normalized_category not in (
    'account_access',
    'deal_help',
    'payment_question',
    'delivery_issue',
    'safety_concern',
    'technical_issue',
    'other'
  ) then
    raise exception 'Choose a valid support category';
  end if;
  if char_length(normalized_subject) not between 5 and 120 then
    raise exception 'Subject must contain 5 to 120 characters';
  end if;
  if char_length(normalized_message) not between 10 and 2000 then
    raise exception 'Message must contain 10 to 2000 characters';
  end if;
  if p_deal_id is not null and not exists (
    select 1
    from public.deals deal
    where deal.id = p_deal_id
      and requester in (deal.seller_id, deal.buyer_id)
  ) then
    raise exception 'The selected deal is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requester::text, 0));

  select count(*)
  into active_case_count
  from public.support_cases support_case
  where support_case.requester_id = requester
    and support_case.status in ('open', 'waiting_customer', 'waiting_support');

  if active_case_count >= 5 then
    raise exception 'Close an existing support case before opening another';
  end if;

  first_response_interval := case
    when normalized_category = 'safety_concern' then interval '1 hour'
    else interval '24 hours'
  end;
  resolution_interval := case
    when normalized_category = 'safety_concern' then interval '24 hours'
    else interval '72 hours'
  end;

  begin
    insert into public.support_cases(
      requester_id,
      deal_id,
      category,
      subject,
      priority,
      first_response_due_at,
      resolution_due_at
    )
    values (
      requester,
      p_deal_id,
      normalized_category,
      normalized_subject,
      case
        when normalized_category = 'safety_concern' then 'urgent'
        else 'normal'
      end,
      now() + first_response_interval,
      now() + resolution_interval
    )
    returning * into created_case;
  exception
    when unique_violation then
      raise exception 'An active support case already covers this topic';
  end;

  insert into public.support_case_messages(
    case_id,
    author_id,
    author_role,
    body
  )
  values (
    created_case.id,
    requester,
    'requester',
    normalized_message
  );

  insert into public.audit_events(deal_id, actor_id, event_type, metadata)
  values (
    p_deal_id,
    requester,
    'support_case_opened',
    jsonb_build_object(
      'support_case_id', created_case.id,
      'support_reference', created_case.public_reference,
      'category', normalized_category,
      'priority', created_case.priority
    )
  );

  return created_case.public_reference;
end;
$$;

create or replace function public.get_my_support_cases()
returns table(
  public_reference text,
  deal_public_id text,
  category text,
  subject text,
  status text,
  priority text,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    support_case.public_reference,
    deal.public_id,
    support_case.category,
    support_case.subject,
    support_case.status,
    support_case.priority,
    support_case.first_response_due_at,
    support_case.resolution_due_at,
    support_case.created_at,
    support_case.updated_at
  from public.support_cases support_case
  left join public.deals deal on deal.id = support_case.deal_id
  where auth.uid() is not null
    and support_case.requester_id = auth.uid()
  order by support_case.created_at desc, support_case.id desc
  limit 100;
$$;

create or replace function public.get_support_case(p_public_reference text)
returns table(
  public_reference text,
  deal_public_id text,
  category text,
  subject text,
  status text,
  priority text,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  message_id uuid,
  message_body text,
  message_author text,
  message_is_mine boolean,
  message_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  viewer_role text;
  normalized_reference text := upper(trim(coalesce(p_public_reference, '')));
  selected_case public.support_cases%rowtype;
begin
  if viewer is null then
    raise exception 'Sign in to view this support case';
  end if;
  if normalized_reference !~ '^SC-[0-9A-F]{12}$' then
    raise exception 'Support case was not found';
  end if;

  viewer_role := public.current_user_app_role();
  select *
  into selected_case
  from public.support_cases support_case
  where support_case.public_reference = normalized_reference
    and (
      support_case.requester_id = viewer
      or (
        viewer_role in ('support', 'compliance', 'admin')
        and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        and support_case.assigned_to = viewer
      )
    );

  if not found then
    raise exception 'Support case was not found';
  end if;

  return query
  select
    selected_case.public_reference,
    deal.public_id,
    selected_case.category,
    selected_case.subject,
    selected_case.status,
    selected_case.priority,
    selected_case.first_response_due_at,
    selected_case.resolution_due_at,
    selected_case.created_at,
    selected_case.updated_at,
    message.id,
    message.body,
    case
      when message.author_id = selected_case.requester_id then 'requester'
      else 'dealivra_support'
    end,
    message.author_id = viewer,
    message.created_at
  from public.support_case_messages message
  left join public.deals deal on deal.id = selected_case.deal_id
  where message.case_id = selected_case.id
  order by message.created_at, message.id
  limit 500;
end;
$$;

create or replace function public.reply_support_case(
  p_public_reference text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  normalized_reference text := upper(trim(coalesce(p_public_reference, '')));
  normalized_message text := trim(coalesce(p_message, ''));
  selected_case public.support_cases%rowtype;
  message_role text;
  next_status text;
begin
  if actor is null then
    raise exception 'Sign in to reply to support';
  end if;
  if normalized_reference !~ '^SC-[0-9A-F]{12}$' then
    raise exception 'Support case was not found';
  end if;
  if char_length(normalized_message) not between 10 and 2000 then
    raise exception 'Message must contain 10 to 2000 characters';
  end if;

  actor_role := public.current_user_app_role();
  select *
  into selected_case
  from public.support_cases support_case
  where support_case.public_reference = normalized_reference
  for update;

  if not found
     or selected_case.status in ('resolved', 'closed')
     or not (
       selected_case.requester_id = actor
       or (
         actor_role in ('support', 'compliance', 'admin')
         and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
         and selected_case.assigned_to = actor
       )
     ) then
    raise exception 'Support case was not found';
  end if;

  if selected_case.requester_id = actor then
    message_role := 'requester';
    next_status := 'waiting_support';
  else
    message_role := actor_role;
    next_status := 'waiting_customer';
  end if;

  insert into public.support_case_messages(
    case_id,
    author_id,
    author_role,
    body
  )
  values (
    selected_case.id,
    actor,
    message_role,
    normalized_message
  );

  update public.support_cases
  set
    status = next_status,
    first_responded_at = case
      when message_role <> 'requester' then coalesce(first_responded_at, now())
      else first_responded_at
    end,
    updated_at = now()
  where id = selected_case.id;

  insert into public.audit_events(
    deal_id,
    actor_id,
    event_type,
    metadata
  )
  values (
    selected_case.deal_id,
    actor,
    'support_case_replied',
    jsonb_build_object(
      'support_case_id', selected_case.id,
      'support_reference', selected_case.public_reference,
      'actor_role', message_role,
      'next_status', next_status
    )
  );
end;
$$;

create or replace function public.get_support_queue(p_scope text default 'open')
returns table(
  public_reference text,
  category text,
  priority text,
  status text,
  assignment_state text,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  operator_id uuid := auth.uid();
  operator_role text := public.current_user_app_role();
  normalized_scope text := lower(trim(coalesce(p_scope, '')));
begin
  if operator_id is null
     or operator_role not in ('support', 'compliance', 'admin')
     or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Support access requires verified authorization';
  end if;
  if normalized_scope not in ('open', 'mine') then
    raise exception 'Choose a valid support queue';
  end if;

  return query
  select
    support_case.public_reference,
    support_case.category,
    support_case.priority,
    support_case.status,
    case
      when support_case.assigned_to = operator_id then 'mine'
      when support_case.assigned_to is null then 'unassigned'
      else 'assigned'
    end,
    support_case.first_response_due_at,
    support_case.resolution_due_at,
    support_case.created_at,
    support_case.updated_at
  from public.support_cases support_case
  where support_case.status in ('open', 'waiting_customer', 'waiting_support')
    and (
      (
        normalized_scope = 'open'
        and (
          support_case.assigned_to is null
          or support_case.assigned_to = operator_id
        )
      )
      or (
        normalized_scope = 'mine'
        and support_case.assigned_to = operator_id
      )
    )
  order by
    case when support_case.priority = 'urgent' then 0 else 1 end,
    support_case.first_response_due_at,
    support_case.created_at
  limit 200;
end;
$$;

create or replace function public.claim_support_case(p_public_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator_id uuid := auth.uid();
  operator_role text := public.current_user_app_role();
  normalized_reference text := upper(trim(coalesce(p_public_reference, '')));
  claimed_case public.support_cases%rowtype;
begin
  if operator_id is null
     or operator_role not in ('support', 'compliance', 'admin')
     or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Support access requires verified authorization';
  end if;
  if normalized_reference !~ '^SC-[0-9A-F]{12}$' then
    raise exception 'Support case was not found';
  end if;

  update public.support_cases
  set assigned_to = operator_id, updated_at = now()
  where public_reference = normalized_reference
    and status in ('open', 'waiting_customer', 'waiting_support')
    and (assigned_to is null or assigned_to = operator_id)
  returning * into claimed_case;

  if not found then
    raise exception 'Support case is unavailable';
  end if;

  insert into public.audit_events(deal_id, actor_id, event_type, metadata)
  values (
    claimed_case.deal_id,
    operator_id,
    'support_case_claimed',
    jsonb_build_object(
      'support_case_id', claimed_case.id,
      'support_reference', claimed_case.public_reference,
      'operator_role', operator_role
    )
  );
end;
$$;

create or replace function public.resolve_support_case(
  p_public_reference text,
  p_resolution_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator_id uuid := auth.uid();
  operator_role text := public.current_user_app_role();
  normalized_reference text := upper(trim(coalesce(p_public_reference, '')));
  normalized_message text := trim(coalesce(p_resolution_message, ''));
  selected_case public.support_cases%rowtype;
begin
  if operator_id is null
     or operator_role not in ('support', 'compliance', 'admin')
     or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Support access requires verified authorization';
  end if;
  if normalized_reference !~ '^SC-[0-9A-F]{12}$' then
    raise exception 'Support case was not found';
  end if;
  if char_length(normalized_message) not between 10 and 2000 then
    raise exception 'Resolution must contain 10 to 2000 characters';
  end if;

  select *
  into selected_case
  from public.support_cases support_case
  where support_case.public_reference = normalized_reference
    and support_case.assigned_to = operator_id
    and support_case.status in ('open', 'waiting_customer', 'waiting_support')
  for update;

  if not found then
    raise exception 'Support case is unavailable';
  end if;

  insert into public.support_case_messages(
    case_id,
    author_id,
    author_role,
    body
  )
  values (
    selected_case.id,
    operator_id,
    operator_role,
    normalized_message
  );

  update public.support_cases
  set
    status = 'resolved',
    first_responded_at = coalesce(first_responded_at, now()),
    resolved_at = now(),
    updated_at = now()
  where id = selected_case.id;

  insert into public.audit_events(deal_id, actor_id, event_type, metadata)
  values (
    selected_case.deal_id,
    operator_id,
    'support_case_resolved',
    jsonb_build_object(
      'support_case_id', selected_case.id,
      'support_reference', selected_case.public_reference,
      'operator_role', operator_role
    )
  );
end;
$$;

revoke all on function public.create_support_case(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.get_my_support_cases()
  from public, anon, authenticated;
revoke all on function public.get_support_case(text)
  from public, anon, authenticated;
revoke all on function public.reply_support_case(text, text)
  from public, anon, authenticated;
revoke all on function public.get_support_queue(text)
  from public, anon, authenticated;
revoke all on function public.claim_support_case(text)
  from public, anon, authenticated;
revoke all on function public.resolve_support_case(text, text)
  from public, anon, authenticated;

grant execute on function public.create_support_case(uuid, text, text, text)
  to authenticated;
grant execute on function public.get_my_support_cases()
  to authenticated;
grant execute on function public.get_support_case(text)
  to authenticated;
grant execute on function public.reply_support_case(text, text)
  to authenticated;
grant execute on function public.get_support_queue(text)
  to authenticated;
grant execute on function public.claim_support_case(text)
  to authenticated;
grant execute on function public.resolve_support_case(text, text)
  to authenticated;

comment on table public.support_cases is
  'Case-scoped support workflow. Direct Data API access is intentionally denied.';
comment on table public.support_case_messages is
  'Append-only support conversation available only through authorized RPCs.';

notify pgrst, 'reload schema';

commit;
