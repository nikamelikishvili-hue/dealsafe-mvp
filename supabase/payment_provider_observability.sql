-- PAY-004 provider-error correlation for the US Stripe Sandbox beta.
-- Forward-compatible: no financial state or provider payload is rewritten.

alter table public.stripe_financial_commands
  add column if not exists correlation_id uuid,
  add column if not exists provider_request_id text;

alter table public.stripe_financial_commands
  drop constraint if exists stripe_financial_commands_provider_request_id_check;
alter table public.stripe_financial_commands
  add constraint stripe_financial_commands_provider_request_id_check
  check (
    provider_request_id is null
    or provider_request_id ~ '^req_[A-Za-z0-9_]{6,255}$'
  );

alter table public.stripe_webhook_events
  add column if not exists correlation_id uuid;

create index if not exists stripe_financial_commands_correlation_idx
  on public.stripe_financial_commands(correlation_id)
  where correlation_id is not null;
create index if not exists stripe_webhook_events_correlation_idx
  on public.stripe_webhook_events(correlation_id)
  where correlation_id is not null;

comment on column public.stripe_financial_commands.correlation_id is
  'Server-generated support reference joining one Dealivra operation to sanitized logs.';
comment on column public.stripe_financial_commands.provider_request_id is
  'Validated Stripe request identifier only. Raw provider responses and messages are never stored.';
comment on column public.stripe_webhook_events.correlation_id is
  'Server-generated support reference for one webhook delivery attempt.';

alter table public.stripe_financial_commands enable row level security;
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_financial_commands from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_financial_commands to service_role;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;

create or replace view public.stripe_payment_operation_exceptions
with (security_invoker = true)
as
  select
    'financial_command'::text as source,
    command.id::text as record_id,
    command.correlation_id,
    command.provider_request_id,
    command.status,
    command.last_error_code as error_code,
    command.attempt_count,
    command.created_at,
    command.updated_at
  from public.stripe_financial_commands command
  where command.status = 'failed'
     or (
       command.status = 'prepared'
       and command.claimed_at < now() - interval '5 minutes'
     )
  union all
  select
    'webhook_event'::text as source,
    event.id as record_id,
    event.correlation_id,
    null::text as provider_request_id,
    event.status,
    event.last_error_code as error_code,
    event.attempt_count,
    event.stripe_created_at as created_at,
    coalesce(event.processed_at, event.failed_at, event.claimed_at) as updated_at
  from public.stripe_webhook_events event
  where event.status = 'failed'
     or (
       event.status = 'processing'
       and event.claimed_at < now() - interval '5 minutes'
     );

revoke all on table public.stripe_payment_operation_exceptions
  from public, anon, authenticated;
grant select on table public.stripe_payment_operation_exceptions to service_role;

comment on view public.stripe_payment_operation_exceptions is
  'Service-only PAY-004 queue of failed or stale Stripe operations. Contains identifiers and bounded codes, never raw provider messages or payloads.';
