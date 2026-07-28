-- DAT-005: make material audit events append-only for every application role
-- and attach a database-generated correlation identifier to every event.

begin;

alter table public.audit_events
  add column if not exists correlation_id uuid;

update public.audit_events
set correlation_id = gen_random_uuid()
where correlation_id is null;

alter table public.audit_events
  alter column correlation_id set default gen_random_uuid(),
  alter column correlation_id set not null;

create index if not exists audit_events_correlation_idx
  on public.audit_events(correlation_id);

create or replace function public.reject_audit_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Audit events are append-only'
    using errcode = '55000';
end;
$$;

revoke all on function public.reject_audit_event_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists audit_events_reject_update_delete
  on public.audit_events;
create trigger audit_events_reject_update_delete
before update or delete on public.audit_events
for each row
execute function public.reject_audit_event_mutation();

drop trigger if exists audit_events_reject_truncate
  on public.audit_events;
create trigger audit_events_reject_truncate
before truncate on public.audit_events
for each statement
execute function public.reject_audit_event_mutation();

revoke insert, update, delete, truncate, trigger
  on table public.audit_events
  from public, anon, authenticated;

revoke update, delete, truncate, trigger
  on table public.audit_events
  from service_role;

grant select, insert
  on table public.audit_events
  to service_role;

comment on column public.audit_events.correlation_id is
  'Opaque identifier for tracing the operation that recorded this immutable event.';

comment on function public.reject_audit_event_mutation() is
  'DAT-005 defense-in-depth trigger: application roles may append audit events but may never update, delete, or truncate them.';

notify pgrst, 'reload schema';

commit;
