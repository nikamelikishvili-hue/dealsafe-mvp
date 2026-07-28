-- EVD-005: evidence retention, legal hold, verified deletion, quarantine
-- cleanup, scheduled integrity inventory, and operator alerts.
--
-- Ordinary evidence deletion is deliberately two phase:
--   1. the database inventories an eligible record and opens a review job;
--   2. an authorized operator approves it, then the maintenance worker removes
--      the Storage object, verifies absence, and redacts the database metadata.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists dealsafe_private;
revoke all on schema dealsafe_private from public, anon, authenticated;

alter table public.deal_evidence
  add column if not exists retention_class text not null default 'routine_evidence',
  add column if not exists retention_until timestamptz,
  add column if not exists lifecycle_status text not null default 'retained',
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.deal_evidence
  drop constraint if exists deal_evidence_retention_class_check;
alter table public.deal_evidence
  add constraint deal_evidence_retention_class_check
  check (retention_class in ('routine_evidence', 'dispute_evidence'));

alter table public.deal_evidence
  drop constraint if exists deal_evidence_lifecycle_status_check;
alter table public.deal_evidence
  add constraint deal_evidence_lifecycle_status_check
  check (
    lifecycle_status in (
      'retained',
      'deletion_review',
      'deletion_approved',
      'deletion_processing',
      'deleted'
    )
  );

alter table public.deal_evidence
  drop constraint if exists deal_evidence_lifecycle_timestamp_check;
alter table public.deal_evidence
  add constraint deal_evidence_lifecycle_timestamp_check
  check (
    (
      lifecycle_status = 'retained'
      and deletion_requested_at is null
      and deleted_at is null
    )
    or (
      lifecycle_status in (
        'deletion_review',
        'deletion_approved',
        'deletion_processing'
      )
      and deletion_requested_at is not null
      and deleted_at is null
    )
    or (
      lifecycle_status = 'deleted'
      and deletion_requested_at is not null
      and deleted_at is not null
    )
  );

alter table public.deal_evidence
  drop constraint if exists deal_evidence_scan_status_check;
alter table public.deal_evidence
  add constraint deal_evidence_scan_status_check
  check (scan_status in ('clean', 'legacy_unscanned', 'deleted'));

alter table public.deal_evidence
  drop constraint if exists deal_evidence_integrity_status_check;
alter table public.deal_evidence
  add constraint deal_evidence_integrity_status_check
  check (
    integrity_status in (
      'unverified',
      'verified',
      'missing',
      'mismatch',
      'invalid',
      'deleted'
    )
  );

alter table public.deal_evidence
  drop constraint if exists deal_evidence_integrity_timestamp_check;
alter table public.deal_evidence
  add constraint deal_evidence_integrity_timestamp_check
  check (
    (
      integrity_status = 'unverified'
      and integrity_checked_at is null
    )
    or (
      integrity_status <> 'unverified'
      and integrity_checked_at is not null
    )
  );

create index if not exists deal_evidence_retention_inventory_idx
  on public.deal_evidence(retention_until, lifecycle_status)
  where lifecycle_status <> 'deleted';
create index if not exists deal_evidence_integrity_due_idx
  on public.deal_evidence(integrity_checked_at, lifecycle_status)
  where scan_status = 'clean' and lifecycle_status <> 'deleted';

create table if not exists public.evidence_legal_hold_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.deal_evidence(id),
  deal_id uuid not null references public.deals(id),
  hold_key uuid not null,
  action text not null check (action in ('placed', 'released')),
  reason text not null check (char_length(pg_catalog.btrim(reason)) between 10 and 1000),
  actor_id uuid not null references public.profiles(id),
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (hold_key, action)
);

create index if not exists evidence_legal_hold_events_evidence_created_idx
  on public.evidence_legal_hold_events(evidence_id, created_at desc);
create index if not exists evidence_legal_hold_events_deal_created_idx
  on public.evidence_legal_hold_events(deal_id, created_at desc);

alter table public.evidence_legal_hold_events enable row level security;
revoke all on table public.evidence_legal_hold_events
  from public, anon, authenticated;
revoke update, delete, truncate, trigger
  on table public.evidence_legal_hold_events
  from service_role;
grant select, insert
  on table public.evidence_legal_hold_events
  to service_role;

drop trigger if exists evidence_legal_hold_events_reject_update_delete
  on public.evidence_legal_hold_events;
create trigger evidence_legal_hold_events_reject_update_delete
before update or delete on public.evidence_legal_hold_events
for each row
execute function public.reject_audit_event_mutation();

drop trigger if exists evidence_legal_hold_events_reject_truncate
  on public.evidence_legal_hold_events;
create trigger evidence_legal_hold_events_reject_truncate
before truncate on public.evidence_legal_hold_events
for each statement
execute function public.reject_audit_event_mutation();

create table if not exists public.evidence_lifecycle_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (
    job_type in (
      'integrity_check',
      'quarantine_cleanup',
      'evidence_delete'
    )
  ),
  evidence_id uuid references public.deal_evidence(id),
  intake_id uuid references public.evidence_upload_intakes(id),
  bucket_name text not null check (
    bucket_name in ('deal-evidence', 'deal-evidence-quarantine')
  ),
  storage_path text not null,
  status text not null check (
    status in (
      'pending',
      'pending_review',
      'approved',
      'processing',
      'succeeded',
      'blocked',
      'failed',
      'cancelled'
    )
  ),
  source text not null check (
    source in ('scheduled_inventory', 'privacy_request', 'admin_request')
  ),
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{1,80}$'),
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approval_reason text,
  not_before timestamptz not null default now(),
  priority smallint not null default 50 check (priority between 1 and 100),
  attempts smallint not null default 0 check (attempts between 0 and 20),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (
      job_type in ('integrity_check', 'evidence_delete')
      and evidence_id is not null
      and intake_id is null
      and bucket_name = 'deal-evidence'
    )
    or (
      job_type = 'quarantine_cleanup'
      and evidence_id is null
      and intake_id is not null
      and bucket_name = 'deal-evidence-quarantine'
    )
  ),
  check (
    job_type <> 'evidence_delete'
    or status not in ('approved', 'processing', 'succeeded')
    or (
      approved_by is not null
      and approval_reason is not null
      and char_length(pg_catalog.btrim(approval_reason)) between 10 and 1000
    )
  ),
  check (
    (
      status = 'processing'
      and lease_token is not null
      and lease_expires_at is not null
    )
    or status <> 'processing'
  )
);

create unique index if not exists evidence_lifecycle_jobs_active_evidence_idx
  on public.evidence_lifecycle_jobs(job_type, evidence_id)
  where evidence_id is not null
    and status in (
      'pending',
      'pending_review',
      'approved',
      'processing',
      'blocked',
      'failed'
    );
create unique index if not exists evidence_lifecycle_jobs_active_intake_idx
  on public.evidence_lifecycle_jobs(job_type, intake_id)
  where intake_id is not null
    and status in ('pending', 'processing', 'failed');
create index if not exists evidence_lifecycle_jobs_claim_idx
  on public.evidence_lifecycle_jobs(status, not_before, priority desc, created_at)
  where status in ('pending', 'approved', 'processing');

alter table public.evidence_lifecycle_jobs enable row level security;
revoke all on table public.evidence_lifecycle_jobs
  from public, anon, authenticated;
revoke delete, truncate, trigger
  on table public.evidence_lifecycle_jobs
  from service_role;
grant select, insert, update
  on table public.evidence_lifecycle_jobs
  to service_role;

create table if not exists public.evidence_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid references public.deal_evidence(id),
  intake_id uuid references public.evidence_upload_intakes(id),
  job_id uuid references public.evidence_lifecycle_jobs(id),
  deal_id uuid references public.deals(id),
  event_type text not null check (
    event_type in (
      'retention_classified',
      'integrity_queued',
      'integrity_completed',
      'integrity_failed',
      'quarantine_cleanup_queued',
      'quarantine_deleted',
      'deletion_requested',
      'deletion_approved',
      'deletion_started',
      'deletion_blocked',
      'storage_delete_verified',
      'metadata_redacted',
      'deletion_failed',
      'legal_hold_placed',
      'legal_hold_released',
      'alert_acknowledged'
    )
  ),
  actor_id uuid references public.profiles(id),
  actor_kind text not null check (actor_kind in ('system', 'operator')),
  correlation_id uuid not null default gen_random_uuid(),
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (
    (actor_kind = 'system' and actor_id is null)
    or (actor_kind = 'operator' and actor_id is not null)
  )
);

create index if not exists evidence_lifecycle_events_evidence_created_idx
  on public.evidence_lifecycle_events(evidence_id, created_at desc);
create index if not exists evidence_lifecycle_events_job_created_idx
  on public.evidence_lifecycle_events(job_id, created_at desc);

alter table public.evidence_lifecycle_events enable row level security;
revoke all on table public.evidence_lifecycle_events
  from public, anon, authenticated;
revoke update, delete, truncate, trigger
  on table public.evidence_lifecycle_events
  from service_role;
grant select, insert
  on table public.evidence_lifecycle_events
  to service_role;

drop trigger if exists evidence_lifecycle_events_reject_update_delete
  on public.evidence_lifecycle_events;
create trigger evidence_lifecycle_events_reject_update_delete
before update or delete on public.evidence_lifecycle_events
for each row
execute function public.reject_audit_event_mutation();

drop trigger if exists evidence_lifecycle_events_reject_truncate
  on public.evidence_lifecycle_events;
create trigger evidence_lifecycle_events_reject_truncate
before truncate on public.evidence_lifecycle_events
for each statement
execute function public.reject_audit_event_mutation();

create table if not exists public.evidence_lifecycle_alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique check (
    dedupe_key ~ '^[a-z0-9:_-]{1,180}$'
  ),
  evidence_id uuid references public.deal_evidence(id),
  job_id uuid references public.evidence_lifecycle_jobs(id),
  alert_type text not null check (
    alert_type in (
      'deletion_review_required',
      'integrity_failure',
      'maintenance_failure',
      'legal_hold_block'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_role text not null check (owner_role in ('admin', 'compliance')),
  status text not null default 'open' check (
    status in ('open', 'acknowledged', 'resolved')
  ),
  summary text not null check (char_length(summary) between 5 and 240),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      status = 'open'
      and acknowledged_by is null
      and acknowledged_at is null
    )
    or (
      status in ('acknowledged', 'resolved')
      and acknowledged_by is not null
      and acknowledged_at is not null
    )
  )
);

create index if not exists evidence_lifecycle_alerts_open_idx
  on public.evidence_lifecycle_alerts(severity, created_at)
  where status = 'open';

alter table public.evidence_lifecycle_alerts enable row level security;
revoke all on table public.evidence_lifecycle_alerts
  from public, anon, authenticated;
revoke delete, truncate, trigger
  on table public.evidence_lifecycle_alerts
  from service_role;
grant select, insert, update
  on table public.evidence_lifecycle_alerts
  to service_role;

create table if not exists dealsafe_private.evidence_maintenance_settings (
  singleton boolean primary key default true check (singleton),
  secret_sha256 text not null check (secret_sha256 ~ '^[0-9a-f]{64}$'),
  project_url text not null check (
    project_url ~ '^https://[a-z0-9]+\.supabase\.co$'
  ),
  worker_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

revoke all on table dealsafe_private.evidence_maintenance_settings
  from public, anon, authenticated, service_role;

do $evidence_maintenance_secret$
declare
  maintenance_secret text;
  maintenance_url constant text := 'https://zbjtttdcsbnfzbpvhzfb.supabase.co';
begin
  select decrypted_secret
  into maintenance_secret
  from vault.decrypted_secrets
  where name = 'dealivra_evidence_maintenance_secret'
  order by created_at desc
  limit 1;

  if maintenance_secret is null then
    maintenance_secret := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      maintenance_secret,
      'dealivra_evidence_maintenance_secret',
      'Internal EVD-005 Cron-to-Edge maintenance credential.'
    );
  end if;

  if not exists (
    select 1
    from vault.secrets
    where name = 'dealivra_project_url'
  ) then
    perform vault.create_secret(
      maintenance_url,
      'dealivra_project_url',
      'Public Supabase project URL used by internal scheduled maintenance.'
    );
  end if;

  insert into dealsafe_private.evidence_maintenance_settings (
    singleton,
    secret_sha256,
    project_url,
    worker_enabled,
    updated_at
  )
  values (
    true,
    encode(extensions.digest(maintenance_secret, 'sha256'), 'hex'),
    maintenance_url,
    true,
    now()
  )
  on conflict (singleton) do update
  set
    secret_sha256 = excluded.secret_sha256,
    project_url = excluded.project_url,
    updated_at = excluded.updated_at;
end
$evidence_maintenance_secret$;

create or replace function dealsafe_private.is_evidence_maintenance_secret_valid(
  p_secret text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    settings.worker_enabled
    and p_secret is not null
    and char_length(p_secret) = 64
    and settings.secret_sha256 =
      pg_catalog.encode(extensions.digest(p_secret, 'sha256'), 'hex')
  from dealsafe_private.evidence_maintenance_settings as settings
  where settings.singleton = true;
$$;

revoke all on function dealsafe_private.is_evidence_maintenance_secret_valid(text)
  from public, anon, authenticated;
grant execute on function dealsafe_private.is_evidence_maintenance_secret_valid(text)
  to service_role;

create or replace function dealsafe_private.evidence_has_active_legal_hold(
  p_evidence_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evidence_legal_hold_events as placed
    where placed.evidence_id = p_evidence_id
      and placed.action = 'placed'
      and not exists (
        select 1
        from public.evidence_legal_hold_events as released
        where released.hold_key = placed.hold_key
          and released.action = 'released'
      )
  );
$$;

revoke all on function dealsafe_private.evidence_has_active_legal_hold(uuid)
  from public, anon, authenticated;
grant execute on function dealsafe_private.evidence_has_active_legal_hold(uuid)
  to service_role;

create or replace function dealsafe_private.require_evidence_operator(
  p_actor_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null
     or not exists (
       select 1
       from public.profiles as profile
       where profile.id = p_actor_id
         and profile.app_role in ('admin', 'compliance')
     ) then
    raise exception 'Evidence lifecycle operator authorization failed';
  end if;
end;
$$;

revoke all on function dealsafe_private.require_evidence_operator(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.record_evidence_legal_hold_event(
  p_evidence_id uuid,
  p_actor_id uuid,
  p_action text,
  p_reason text,
  p_hold_key uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_record record;
  resolved_hold_key uuid;
begin
  perform dealsafe_private.require_evidence_operator(p_actor_id);

  if p_evidence_id is null
     or p_action not in ('placed', 'released')
     or char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 10 and 1000
     or p_correlation_id is null then
    raise exception 'Legal hold input is invalid';
  end if;

  select evidence.id, evidence.deal_id, evidence.lifecycle_status
  into evidence_record
  from public.deal_evidence as evidence
  where evidence.id = p_evidence_id
  for update;

  if evidence_record.id is null then
    raise exception 'Evidence file was not found';
  end if;

  if evidence_record.lifecycle_status = 'deleted' then
    raise exception 'Deleted evidence cannot receive a legal hold';
  end if;

  if p_action = 'placed' then
    if dealsafe_private.evidence_has_active_legal_hold(p_evidence_id) then
      raise exception 'Evidence already has an active legal hold';
    end if;
    resolved_hold_key := coalesce(p_hold_key, gen_random_uuid());
  else
    resolved_hold_key := p_hold_key;
    if resolved_hold_key is null
       or not exists (
         select 1
         from public.evidence_legal_hold_events as placed
         where placed.hold_key = resolved_hold_key
           and placed.evidence_id = p_evidence_id
           and placed.action = 'placed'
           and not exists (
             select 1
             from public.evidence_legal_hold_events as released
             where released.hold_key = placed.hold_key
               and released.action = 'released'
           )
       ) then
      raise exception 'Active legal hold was not found';
    end if;
  end if;

  insert into public.evidence_legal_hold_events (
    evidence_id,
    deal_id,
    hold_key,
    action,
    reason,
    actor_id,
    correlation_id
  )
  values (
    evidence_record.id,
    evidence_record.deal_id,
    resolved_hold_key,
    p_action,
    pg_catalog.btrim(p_reason),
    p_actor_id,
    p_correlation_id
  );

  insert into public.evidence_lifecycle_events (
    evidence_id,
    deal_id,
    event_type,
    actor_id,
    actor_kind,
    correlation_id,
    details
  )
  values (
    evidence_record.id,
    evidence_record.deal_id,
    case when p_action = 'placed'
      then 'legal_hold_placed'
      else 'legal_hold_released'
    end,
    p_actor_id,
    'operator',
    p_correlation_id,
    jsonb_build_object('hold_key', resolved_hold_key)
  );

  if p_action = 'placed' then
    update public.evidence_lifecycle_jobs
    set
      status = 'blocked',
      last_error_code = 'legal_hold_active',
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
    where evidence_id = evidence_record.id
      and job_type = 'evidence_delete'
      and status in ('pending_review', 'approved', 'processing', 'failed');

    update public.deal_evidence
    set
      lifecycle_status = 'retained',
      deletion_requested_at = null
    where id = evidence_record.id
      and lifecycle_status in (
        'deletion_review',
        'deletion_approved',
        'deletion_processing'
      );

    insert into public.evidence_lifecycle_alerts (
      dedupe_key,
      evidence_id,
      alert_type,
      severity,
      owner_role,
      summary
    )
    values (
      'legal_hold:' || evidence_record.id::text,
      evidence_record.id,
      'legal_hold_block',
      'warning',
      'compliance',
      'Legal hold blocks evidence deletion until an authorized release is recorded.'
    )
    on conflict (dedupe_key) do update
    set
      status = 'open',
      acknowledged_by = null,
      acknowledged_at = null,
      updated_at = now();
  else
    update public.evidence_lifecycle_jobs
    set
      status = 'pending_review',
      approved_by = null,
      approval_reason = null,
      last_error_code = null,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
    where evidence_id = evidence_record.id
      and job_type = 'evidence_delete'
      and status = 'blocked';

    if found then
      update public.deal_evidence
      set
        lifecycle_status = 'deletion_review',
        deletion_requested_at = now()
      where id = evidence_record.id
        and lifecycle_status = 'retained';

      insert into public.evidence_lifecycle_alerts (
        dedupe_key,
        evidence_id,
        alert_type,
        severity,
        owner_role,
        summary
      )
      values (
        'deletion_review:' || evidence_record.id::text,
        evidence_record.id,
        'deletion_review_required',
        'warning',
        'compliance',
        'Released legal hold returned evidence to deletion review; a new approval is required.'
      )
      on conflict (dedupe_key) do update
      set
        status = 'open',
        summary = excluded.summary,
        acknowledged_by = null,
        acknowledged_at = null,
        updated_at = now();
    end if;
  end if;

  return resolved_hold_key;
end;
$$;

revoke all on function public.record_evidence_legal_hold_event(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.record_evidence_legal_hold_event(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid
) to service_role;

create or replace function public.refresh_evidence_lifecycle_inventory()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_intakes integer := 0;
  queued_quarantine integer := 0;
  queued_integrity integer := 0;
  classified_evidence integer := 0;
  queued_deletions integer := 0;
begin
  update public.evidence_upload_intakes
  set
    status = 'expired',
    rejection_code = coalesce(rejection_code, 'intake_expired')
  where (
      status = 'requested'
      and expires_at <= now()
    )
    or (
      status = 'processing'
      and expires_at <= now() - interval '15 minutes'
    );
  get diagnostics expired_intakes = row_count;

  with inserted as (
    insert into public.evidence_lifecycle_jobs (
      job_type,
      intake_id,
      bucket_name,
      storage_path,
      status,
      source,
      reason_code,
      not_before,
      priority
    )
    select
      'quarantine_cleanup',
      intake.id,
      'deal-evidence-quarantine',
      intake.storage_path,
      'pending',
      'scheduled_inventory',
      'expired_or_rejected_intake',
      greatest(intake.expires_at, intake.created_at + interval '30 minutes'),
      70
    from public.evidence_upload_intakes as intake
    where intake.status in ('expired', 'rejected', 'scan_failed')
      and not exists (
        select 1
        from public.evidence_lifecycle_jobs as job
        where job.job_type = 'quarantine_cleanup'
          and job.intake_id = intake.id
          and job.status in ('pending', 'processing', 'succeeded', 'failed')
      )
    on conflict do nothing
    returning id, intake_id
  )
  insert into public.evidence_lifecycle_events (
    intake_id,
    job_id,
    event_type,
    actor_kind,
    details
  )
  select
    inserted.intake_id,
    inserted.id,
    'quarantine_cleanup_queued',
    'system',
    jsonb_build_object('source', 'scheduled_inventory')
  from inserted;
  get diagnostics queued_quarantine = row_count;

  with inserted as (
    insert into public.evidence_lifecycle_jobs (
      job_type,
      evidence_id,
      bucket_name,
      storage_path,
      status,
      source,
      reason_code,
      not_before,
      priority
    )
    select
      'integrity_check',
      evidence.id,
      'deal-evidence',
      evidence.storage_path,
      'pending',
      'scheduled_inventory',
      case
        when evidence.integrity_checked_at is null
          then 'integrity_never_checked'
        else 'integrity_check_due'
      end,
      now(),
      case
        when evidence.integrity_status in ('missing', 'mismatch', 'invalid')
          then 100
        else 60
      end
    from public.deal_evidence as evidence
    where evidence.scan_status = 'clean'
      and evidence.lifecycle_status <> 'deleted'
      and (
        evidence.integrity_checked_at is null
        or evidence.integrity_checked_at <= now() - interval '30 days'
        or evidence.integrity_status in ('missing', 'mismatch', 'invalid')
      )
      and not exists (
        select 1
        from public.evidence_lifecycle_jobs as job
        where job.job_type = 'integrity_check'
          and job.evidence_id = evidence.id
          and job.status in ('pending', 'processing', 'failed')
      )
    on conflict do nothing
    returning id, evidence_id
  )
  insert into public.evidence_lifecycle_events (
    evidence_id,
    job_id,
    deal_id,
    event_type,
    actor_kind,
    details
  )
  select
    inserted.evidence_id,
    inserted.id,
    evidence.deal_id,
    'integrity_queued',
    'system',
    jsonb_build_object('cadence_days', 30)
  from inserted
  join public.deal_evidence as evidence
    on evidence.id = inserted.evidence_id;
  get diagnostics queued_integrity = row_count;

  with retention as (
    select
      evidence.id,
      case
        when exists (
          select 1
          from public.deal_disputes as dispute
          where dispute.deal_id = evidence.deal_id
        ) then 'dispute_evidence'
        else 'routine_evidence'
      end as retention_class,
      case
        when exists (
          select 1
          from public.deal_disputes as dispute
          where dispute.deal_id = evidence.deal_id
            and dispute.status in ('open', 'evidence_requested', 'under_review')
        ) then null
        when exists (
          select 1
          from public.deal_disputes as dispute
          where dispute.deal_id = evidence.deal_id
        ) then (
          select max(coalesce(dispute.resolved_at, dispute.updated_at))
          from public.deal_disputes as dispute
          where dispute.deal_id = evidence.deal_id
            and dispute.status in (
              'resolved_buyer',
              'resolved_seller',
              'refunded',
              'cancelled'
            )
        ) + interval '7 years'
        when deal.status in ('completed', 'cancelled') then
          coalesce(
            (
              select max(event.created_at)
              from public.audit_events as event
              where event.deal_id = evidence.deal_id
                and event.event_type in ('deal_completed', 'deal_cancelled')
            ),
            deal.updated_at
          ) + interval '1 year'
        else null
      end as retention_until
    from public.deal_evidence as evidence
    join public.deals as deal
      on deal.id = evidence.deal_id
    where evidence.lifecycle_status <> 'deleted'
  )
  update public.deal_evidence as evidence
  set
    retention_class = retention.retention_class,
    retention_until = retention.retention_until
  from retention
  where evidence.id = retention.id
    and (
      evidence.retention_class is distinct from retention.retention_class
      or evidence.retention_until is distinct from retention.retention_until
    );
  get diagnostics classified_evidence = row_count;

  with inserted as (
    insert into public.evidence_lifecycle_jobs (
      job_type,
      evidence_id,
      bucket_name,
      storage_path,
      status,
      source,
      reason_code,
      not_before,
      priority
    )
    select
      'evidence_delete',
      evidence.id,
      'deal-evidence',
      evidence.storage_path,
      'pending_review',
      'scheduled_inventory',
      'retention_period_elapsed',
      evidence.retention_until,
      80
    from public.deal_evidence as evidence
    where evidence.lifecycle_status = 'retained'
      and evidence.retention_until is not null
      and evidence.retention_until <= now()
      and not dealsafe_private.evidence_has_active_legal_hold(evidence.id)
      and not exists (
        select 1
        from public.deal_disputes as dispute
        where dispute.deal_id = evidence.deal_id
          and dispute.status in ('open', 'evidence_requested', 'under_review')
      )
      and not exists (
        select 1
        from public.evidence_lifecycle_jobs as job
        where job.job_type = 'evidence_delete'
          and job.evidence_id = evidence.id
          and job.status in (
            'pending_review',
            'approved',
            'processing',
            'blocked',
            'failed',
            'succeeded'
          )
      )
    on conflict do nothing
    returning id, evidence_id
  ),
  updated as (
    update public.deal_evidence as evidence
    set
      lifecycle_status = 'deletion_review',
      deletion_requested_at = now()
    from inserted
    where evidence.id = inserted.evidence_id
    returning evidence.id, evidence.deal_id
  ),
  events as (
    insert into public.evidence_lifecycle_events (
      evidence_id,
      job_id,
      deal_id,
      event_type,
      actor_kind,
      details
    )
    select
      inserted.evidence_id,
      inserted.id,
      evidence.deal_id,
      'deletion_requested',
      'system',
      jsonb_build_object(
        'retention_until',
        evidence.retention_until,
        'retention_class',
        evidence.retention_class
      )
    from inserted
    join public.deal_evidence as evidence
      on evidence.id = inserted.evidence_id
    returning evidence_id, job_id
  )
  insert into public.evidence_lifecycle_alerts (
    dedupe_key,
    evidence_id,
    job_id,
    alert_type,
    severity,
    owner_role,
    summary
  )
  select
    'deletion_review:' || events.evidence_id::text,
    events.evidence_id,
    events.job_id,
    'deletion_review_required',
    'warning',
    'compliance',
    'Evidence reached its retention date and requires an authorized deletion review.'
  from events
  on conflict (dedupe_key) do update
  set
    job_id = excluded.job_id,
    status = 'open',
    acknowledged_by = null,
    acknowledged_at = null,
    updated_at = now();
  get diagnostics queued_deletions = row_count;

  return jsonb_build_object(
    'expiredIntakes', expired_intakes,
    'queuedQuarantineCleanup', queued_quarantine,
    'queuedIntegrityChecks', queued_integrity,
    'classifiedEvidence', classified_evidence,
    'queuedDeletionReviews', queued_deletions,
    'refreshedAt', now()
  );
end;
$$;

revoke all on function public.refresh_evidence_lifecycle_inventory()
  from public, anon, authenticated, service_role;
grant execute on function public.refresh_evidence_lifecycle_inventory()
  to service_role;

create or replace function public.approve_evidence_deletion(
  p_evidence_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_record record;
  approved_job_id uuid;
begin
  perform dealsafe_private.require_evidence_operator(p_actor_id);

  if p_evidence_id is null
     or char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 10 and 1000
     or p_correlation_id is null then
    raise exception 'Deletion approval input is invalid';
  end if;

  select evidence.id, evidence.deal_id, evidence.retention_until
  into evidence_record
  from public.deal_evidence as evidence
  where evidence.id = p_evidence_id
    and evidence.lifecycle_status = 'deletion_review'
  for update;

  if evidence_record.id is null then
    raise exception 'Evidence deletion review was not found';
  end if;

  if evidence_record.retention_until is null
     or evidence_record.retention_until > now() then
    raise exception 'Evidence retention period has not elapsed';
  end if;

  if dealsafe_private.evidence_has_active_legal_hold(p_evidence_id) then
    raise exception 'Legal hold blocks evidence deletion';
  end if;

  if exists (
    select 1
    from public.deal_disputes as dispute
    where dispute.deal_id = evidence_record.deal_id
      and dispute.status in ('open', 'evidence_requested', 'under_review')
  ) then
    raise exception 'Active dispute blocks evidence deletion';
  end if;

  update public.evidence_lifecycle_jobs
  set
    status = 'approved',
    approved_by = p_actor_id,
    approval_reason = pg_catalog.btrim(p_reason),
    last_error_code = null,
    updated_at = now()
  where evidence_id = p_evidence_id
    and job_type = 'evidence_delete'
    and status = 'pending_review'
  returning id into approved_job_id;

  if approved_job_id is null then
    raise exception 'Pending evidence deletion job was not found';
  end if;

  update public.deal_evidence
  set lifecycle_status = 'deletion_approved'
  where id = p_evidence_id;

  insert into public.evidence_lifecycle_events (
    evidence_id,
    job_id,
    deal_id,
    event_type,
    actor_id,
    actor_kind,
    correlation_id,
    details
  )
  values (
    p_evidence_id,
    approved_job_id,
    evidence_record.deal_id,
    'deletion_approved',
    p_actor_id,
    'operator',
    p_correlation_id,
    jsonb_build_object('reason', pg_catalog.btrim(p_reason))
  );

  return approved_job_id;
end;
$$;

revoke all on function public.approve_evidence_deletion(
  uuid,
  uuid,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.approve_evidence_deletion(
  uuid,
  uuid,
  text,
  uuid
) to service_role;

create or replace function public.claim_evidence_maintenance_jobs(
  p_maintenance_secret text,
  p_limit integer,
  p_worker_id uuid
)
returns table (
  job_id uuid,
  lease_token uuid,
  job_type text,
  evidence_id uuid,
  intake_id uuid,
  bucket_name text,
  storage_path text,
  file_name text,
  mime_type text,
  detected_mime_type text,
  file_size_bytes bigint,
  sha256 text,
  uploader_role text,
  evidence_type text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(
    dealsafe_private.is_evidence_maintenance_secret_valid(
      p_maintenance_secret
    ),
    false
  ) then
    raise exception 'Evidence maintenance authentication failed';
  end if;

  if p_worker_id is null or p_limit not between 1 and 25 then
    raise exception 'Evidence maintenance claim input is invalid';
  end if;

  update public.evidence_lifecycle_jobs as job
  set
    status = case
      when job.job_type = 'evidence_delete' then 'approved'
      else 'pending'
    end,
    lease_token = null,
    lease_expires_at = null,
    last_error_code = 'worker_lease_expired',
    updated_at = now()
  where job.status = 'processing'
    and job.lease_expires_at <= now()
    and job.attempts < 5;

  update public.evidence_lifecycle_jobs as job
  set
    status = 'blocked',
    lease_token = null,
    lease_expires_at = null,
    last_error_code = case
      when dealsafe_private.evidence_has_active_legal_hold(job.evidence_id)
        then 'legal_hold_active'
      else 'active_dispute'
    end,
    updated_at = now()
  where job.job_type = 'evidence_delete'
    and job.status = 'approved'
    and (
      dealsafe_private.evidence_has_active_legal_hold(job.evidence_id)
      or exists (
        select 1
        from public.deal_evidence as evidence
        join public.deal_disputes as dispute
          on dispute.deal_id = evidence.deal_id
        where evidence.id = job.evidence_id
          and dispute.status in ('open', 'evidence_requested', 'under_review')
      )
    );

  return query
  with candidates as (
    select job.id
    from public.evidence_lifecycle_jobs as job
    where job.not_before <= now()
      and job.attempts < 5
      and (
        (
          job.job_type in ('integrity_check', 'quarantine_cleanup')
          and job.status = 'pending'
        )
        or (
          job.job_type = 'evidence_delete'
          and job.status = 'approved'
        )
      )
    order by job.priority desc, job.created_at, job.id
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update public.evidence_lifecycle_jobs as job
    set
      status = 'processing',
      attempts = job.attempts + 1,
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '10 minutes',
      last_error_code = null,
      updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.*
  ),
  deletion_events as (
    insert into public.evidence_lifecycle_events (
      evidence_id,
      job_id,
      deal_id,
      event_type,
      actor_kind,
      details
    )
    select
      claimed.evidence_id,
      claimed.id,
      evidence.deal_id,
      'deletion_started',
      'system',
      jsonb_build_object('worker_id', p_worker_id)
    from claimed
    join public.deal_evidence as evidence
      on evidence.id = claimed.evidence_id
    where claimed.job_type = 'evidence_delete'
    returning job_id
  ),
  lifecycle_updates as (
    update public.deal_evidence as evidence
    set lifecycle_status = 'deletion_processing'
    from claimed
    where evidence.id = claimed.evidence_id
      and claimed.job_type = 'evidence_delete'
    returning evidence.id
  )
  select
    claimed.id,
    claimed.lease_token,
    claimed.job_type,
    claimed.evidence_id,
    claimed.intake_id,
    claimed.bucket_name,
    claimed.storage_path,
    evidence.file_name,
    evidence.mime_type,
    evidence.detected_mime_type,
    evidence.file_size_bytes,
    evidence.sha256,
    evidence.uploader_role,
    evidence.evidence_type
  from claimed
  left join public.deal_evidence as evidence
    on evidence.id = claimed.evidence_id
  order by claimed.priority desc, claimed.created_at, claimed.id;
end;
$$;

revoke all on function public.claim_evidence_maintenance_jobs(
  text,
  integer,
  uuid
) from public, anon, authenticated;
grant execute on function public.claim_evidence_maintenance_jobs(
  text,
  integer,
  uuid
) to service_role;

create or replace function public.complete_evidence_maintenance_job(
  p_maintenance_secret text,
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_error_code text default null,
  p_details jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.evidence_lifecycle_jobs%rowtype;
  evidence_record record;
  lifecycle_event_type text;
begin
  if not coalesce(
    dealsafe_private.is_evidence_maintenance_secret_valid(
      p_maintenance_secret
    ),
    false
  ) then
    raise exception 'Evidence maintenance authentication failed';
  end if;

  if p_job_id is null
     or p_lease_token is null
     or p_outcome not in (
       'integrity_completed',
       'integrity_failed',
       'quarantine_deleted',
       'evidence_deleted',
       'failed'
     )
     or p_details is null then
    raise exception 'Evidence maintenance completion input is invalid';
  end if;

  select *
  into job_record
  from public.evidence_lifecycle_jobs as job
  where job.id = p_job_id
    and job.status = 'processing'
    and job.lease_token = p_lease_token
    and job.lease_expires_at > now()
  for update;

  if job_record.id is null then
    raise exception 'Active evidence maintenance lease was not found';
  end if;

  if p_outcome = 'evidence_deleted' then
    if job_record.job_type <> 'evidence_delete' then
      raise exception 'Evidence deletion outcome does not match the job';
    end if;

    select evidence.id, evidence.deal_id
    into evidence_record
    from public.deal_evidence as evidence
    where evidence.id = job_record.evidence_id
    for update;

    if evidence_record.id is null
       or dealsafe_private.evidence_has_active_legal_hold(evidence_record.id)
       or exists (
         select 1
         from public.deal_disputes as dispute
         where dispute.deal_id = evidence_record.deal_id
           and dispute.status in ('open', 'evidence_requested', 'under_review')
       ) then
      update public.evidence_lifecycle_jobs
      set
        status = 'blocked',
        lease_token = null,
        lease_expires_at = null,
        last_error_code = 'deletion_guard_changed',
        updated_at = now()
      where id = job_record.id;

      update public.deal_evidence
      set lifecycle_status = 'deletion_approved'
      where id = job_record.evidence_id
        and lifecycle_status = 'deletion_processing';

      insert into public.evidence_lifecycle_events (
        evidence_id,
        job_id,
        deal_id,
        event_type,
        actor_kind,
        details
      )
      values (
        job_record.evidence_id,
        job_record.id,
        evidence_record.deal_id,
        'deletion_blocked',
        'system',
        jsonb_build_object('reason_code', 'deletion_guard_changed')
      );
      return;
    end if;

    insert into public.evidence_lifecycle_events (
      evidence_id,
      job_id,
      deal_id,
      event_type,
      actor_kind,
      details
    )
    values (
      evidence_record.id,
      job_record.id,
      evidence_record.deal_id,
      'storage_delete_verified',
      'system',
      p_details
    );

    update public.deal_evidence
    set
      storage_path = 'deleted/' || id::text,
      file_name = null,
      mime_type = null,
      detected_mime_type = null,
      file_size_bytes = null,
      sha256 = null,
      metadata = '{}',
      scan_status = 'deleted',
      scan_provider = null,
      scan_reference = null,
      scanned_at = null,
      integrity_status = 'deleted',
      integrity_checked_at = now(),
      lifecycle_status = 'deleted',
      deleted_at = now()
    where id = evidence_record.id;

    insert into public.evidence_lifecycle_events (
      evidence_id,
      job_id,
      deal_id,
      event_type,
      actor_kind,
      details
    )
    values (
      evidence_record.id,
      job_record.id,
      evidence_record.deal_id,
      'metadata_redacted',
      'system',
      jsonb_build_object('retained_fields', array['id', 'deal_id', 'retention_class'])
    );

    update public.evidence_lifecycle_alerts
    set
      status = 'resolved',
      acknowledged_by = job_record.approved_by,
      acknowledged_at = coalesce(acknowledged_at, now()),
      updated_at = now()
    where evidence_id = evidence_record.id
      and alert_type = 'deletion_review_required'
      and status <> 'resolved';
  elsif p_outcome = 'quarantine_deleted' then
    if job_record.job_type <> 'quarantine_cleanup' then
      raise exception 'Quarantine outcome does not match the job';
    end if;
  elsif p_outcome in ('integrity_completed', 'integrity_failed') then
    if job_record.job_type <> 'integrity_check' then
      raise exception 'Integrity outcome does not match the job';
    end if;
  elsif p_outcome = 'failed' then
    if p_error_code is null
       or p_error_code !~ '^[a-z0-9_]{1,80}$' then
      raise exception 'Maintenance failure code is invalid';
    end if;
  end if;

  lifecycle_event_type := case p_outcome
    when 'integrity_completed' then 'integrity_completed'
    when 'integrity_failed' then 'integrity_failed'
    when 'quarantine_deleted' then 'quarantine_deleted'
    when 'evidence_deleted' then 'metadata_redacted'
    else 'deletion_failed'
  end;

  update public.evidence_lifecycle_jobs
  set
    status = case when p_outcome = 'failed' then 'failed' else 'succeeded' end,
    lease_token = null,
    lease_expires_at = null,
    last_error_code = case when p_outcome = 'failed' then p_error_code else null end,
    completed_at = case when p_outcome = 'failed' then null else now() end,
    updated_at = now()
  where id = job_record.id;

  if p_outcome <> 'evidence_deleted' then
    insert into public.evidence_lifecycle_events (
      evidence_id,
      intake_id,
      job_id,
      deal_id,
      event_type,
      actor_kind,
      details
    )
    select
      job_record.evidence_id,
      job_record.intake_id,
      job_record.id,
      evidence.deal_id,
      lifecycle_event_type,
      'system',
      p_details || case when p_error_code is null
        then '{}'
        else jsonb_build_object('error_code', p_error_code)
      end
    from (select 1) as singleton
    left join public.deal_evidence as evidence
      on evidence.id = job_record.evidence_id;
  end if;

  if p_outcome in ('integrity_failed', 'failed') then
    insert into public.evidence_lifecycle_alerts (
      dedupe_key,
      evidence_id,
      job_id,
      alert_type,
      severity,
      owner_role,
      summary
    )
    values (
      'maintenance:' || job_record.id::text,
      job_record.evidence_id,
      job_record.id,
      case when p_outcome = 'integrity_failed'
        then 'integrity_failure'
        else 'maintenance_failure'
      end,
      case when p_outcome = 'integrity_failed' then 'critical' else 'warning' end,
      'admin',
      case when p_outcome = 'integrity_failed'
        then 'Evidence failed its scheduled integrity verification and is blocked from use.'
        else 'Evidence maintenance needs operator review after a bounded worker failure.'
      end
    )
    on conflict (dedupe_key) do update
    set
      status = 'open',
      acknowledged_by = null,
      acknowledged_at = null,
      updated_at = now();
  end if;
end;
$$;

revoke all on function public.complete_evidence_maintenance_job(
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.complete_evidence_maintenance_job(
  text,
  uuid,
  uuid,
  text,
  text,
  jsonb
) to service_role;

create or replace function public.get_evidence_lifecycle_admin_snapshot(
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform dealsafe_private.require_evidence_operator(p_actor_id);

  select jsonb_build_object(
    'generatedAt', now(),
    'counts', jsonb_build_object(
      'openAlerts', (
        select count(*)
        from public.evidence_lifecycle_alerts
        where status = 'open'
      ),
      'integrityQueued', (
        select count(*)
        from public.evidence_lifecycle_jobs
        where job_type = 'integrity_check'
          and status in ('pending', 'processing', 'failed')
      ),
      'quarantineQueued', (
        select count(*)
        from public.evidence_lifecycle_jobs
        where job_type = 'quarantine_cleanup'
          and status in ('pending', 'processing', 'failed')
      ),
      'deletionReviews', (
        select count(*)
        from public.evidence_lifecycle_jobs
        where job_type = 'evidence_delete'
          and status in ('pending_review', 'approved', 'processing', 'blocked', 'failed')
      ),
      'activeLegalHolds', (
        select count(*)
        from public.evidence_legal_hold_events as placed
        where placed.action = 'placed'
          and not exists (
            select 1
            from public.evidence_legal_hold_events as released
            where released.hold_key = placed.hold_key
              and released.action = 'released'
          )
      )
    ),
    'jobs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobId', job.id,
          'jobType', job.job_type,
          'status', job.status,
          'evidenceId', job.evidence_id,
          'publicId', deal.public_id,
          'title', deal.title,
          'retentionClass', evidence.retention_class,
          'retentionUntil', evidence.retention_until,
          'lifecycleStatus', evidence.lifecycle_status,
          'reasonCode', job.reason_code,
          'attempts', job.attempts,
          'lastErrorCode', job.last_error_code,
          'createdAt', job.created_at,
          'updatedAt', job.updated_at,
          'activeHold', coalesce(
            dealsafe_private.evidence_has_active_legal_hold(job.evidence_id),
            false
          ),
          'holdKey', hold_state.hold_key
        )
        order by job.priority desc, job.created_at
      )
      from public.evidence_lifecycle_jobs as job
      left join public.deal_evidence as evidence
        on evidence.id = job.evidence_id
      left join public.deals as deal
        on deal.id = evidence.deal_id
      left join lateral (
        select placed.hold_key
        from public.evidence_legal_hold_events as placed
        where placed.evidence_id = job.evidence_id
          and placed.action = 'placed'
          and not exists (
            select 1
            from public.evidence_legal_hold_events as released
            where released.hold_key = placed.hold_key
              and released.action = 'released'
          )
        order by placed.created_at desc
        limit 1
      ) as hold_state on true
      where job.status in (
        'pending',
        'pending_review',
        'approved',
        'processing',
        'blocked',
        'failed'
      )
      limit 100
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alertId', alert.id,
          'alertType', alert.alert_type,
          'severity', alert.severity,
          'ownerRole', alert.owner_role,
          'status', alert.status,
          'summary', alert.summary,
          'evidenceId', alert.evidence_id,
          'jobId', alert.job_id,
          'createdAt', alert.created_at
        )
        order by
          case alert.severity
            when 'critical' then 1
            when 'warning' then 2
            else 3
          end,
          alert.created_at
      )
      from public.evidence_lifecycle_alerts as alert
      where alert.status in ('open', 'acknowledged')
      limit 100
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_evidence_lifecycle_admin_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.get_evidence_lifecycle_admin_snapshot(uuid)
  to service_role;

create or replace function public.acknowledge_evidence_lifecycle_alert(
  p_alert_id uuid,
  p_actor_id uuid,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alert_record record;
begin
  perform dealsafe_private.require_evidence_operator(p_actor_id);

  update public.evidence_lifecycle_alerts
  set
    status = 'acknowledged',
    acknowledged_by = p_actor_id,
    acknowledged_at = now(),
    updated_at = now()
  where id = p_alert_id
    and status = 'open'
  returning evidence_id, job_id
  into alert_record;

  if not found then
    raise exception 'Open lifecycle alert was not found';
  end if;

  insert into public.evidence_lifecycle_events (
    evidence_id,
    job_id,
    event_type,
    actor_id,
    actor_kind,
    correlation_id
  )
  values (
    alert_record.evidence_id,
    alert_record.job_id,
    'alert_acknowledged',
    p_actor_id,
    'operator',
    p_correlation_id
  );
end;
$$;

revoke all on function public.acknowledge_evidence_lifecycle_alert(
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.acknowledge_evidence_lifecycle_alert(
  uuid,
  uuid,
  uuid
) to service_role;

alter table public.evidence_integrity_events
  alter column checked_by drop not null;
alter table public.evidence_integrity_events
  add column if not exists checked_by_service text;

alter table public.evidence_integrity_events
  drop constraint if exists evidence_integrity_events_checker_check;
alter table public.evidence_integrity_events
  add constraint evidence_integrity_events_checker_check
  check (
    (
      checked_by is not null
      and checked_by_service is null
    )
    or (
      checked_by is null
      and checked_by_service = 'scheduled_maintenance'
    )
  );

create or replace function public.record_evidence_integrity_result(
  p_evidence_id uuid,
  p_checked_by uuid,
  p_storage_present boolean,
  p_structure_valid boolean,
  p_observed_sha256 text,
  p_observed_size_bytes bigint,
  p_observed_mime_type text,
  p_correlation_id uuid default gen_random_uuid()
)
returns table (
  integrity_status text,
  integrity_checked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_record record;
  normalized_observed_sha256 text;
  normalized_observed_mime_type text;
  resolved_status text;
  checked_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_evidence_id is null
     or p_storage_present is null
     or p_structure_valid is null
     or p_correlation_id is null then
    raise exception 'Evidence integrity input is incomplete';
  end if;

  select
    evidence.id,
    evidence.deal_id,
    evidence.scan_status,
    evidence.lifecycle_status,
    pg_catalog.lower(pg_catalog.btrim(evidence.sha256)) as sha256,
    evidence.file_size_bytes,
    pg_catalog.lower(
      pg_catalog.btrim(evidence.detected_mime_type)
    ) as detected_mime_type
  into evidence_record
  from public.deal_evidence as evidence
  where evidence.id = p_evidence_id
  for update;

  if evidence_record.id is null
     or evidence_record.lifecycle_status = 'deleted' then
    raise exception 'Evidence file was not found';
  end if;

  if p_checked_by is not null
     and not exists (
       select 1
       from public.profiles as profile
       where profile.id = p_checked_by
     ) then
    raise exception 'Evidence integrity actor was not found';
  end if;

  normalized_observed_sha256 :=
    pg_catalog.lower(pg_catalog.btrim(coalesce(p_observed_sha256, '')));
  normalized_observed_mime_type :=
    pg_catalog.lower(pg_catalog.btrim(coalesce(p_observed_mime_type, '')));

  resolved_status := case
    when not p_storage_present then 'missing'
    when not p_structure_valid then 'invalid'
    when evidence_record.scan_status <> 'clean'
      or evidence_record.sha256 !~ '^[0-9a-f]{64}$'
      or normalized_observed_sha256 !~ '^[0-9a-f]{64}$'
      or normalized_observed_sha256 <> evidence_record.sha256
      or p_observed_size_bytes is distinct from evidence_record.file_size_bytes
      or normalized_observed_mime_type
        is distinct from evidence_record.detected_mime_type
      then 'mismatch'
    else 'verified'
  end;

  update public.deal_evidence
  set
    integrity_status = resolved_status,
    integrity_checked_at = checked_at
  where id = evidence_record.id;

  insert into public.evidence_integrity_events (
    evidence_id,
    deal_id,
    checked_by,
    checked_by_service,
    result,
    expected_sha256,
    observed_sha256,
    expected_size_bytes,
    observed_size_bytes,
    expected_mime_type,
    observed_mime_type,
    correlation_id,
    created_at
  )
  values (
    evidence_record.id,
    evidence_record.deal_id,
    p_checked_by,
    case when p_checked_by is null
      then 'scheduled_maintenance'
      else null
    end,
    resolved_status,
    nullif(evidence_record.sha256, ''),
    nullif(normalized_observed_sha256, ''),
    evidence_record.file_size_bytes,
    p_observed_size_bytes,
    nullif(evidence_record.detected_mime_type, ''),
    nullif(normalized_observed_mime_type, ''),
    p_correlation_id,
    checked_at
  );

  return query
  select resolved_status, checked_at;
end;
$$;

revoke all on function public.record_evidence_integrity_result(
  uuid,
  uuid,
  boolean,
  boolean,
  text,
  bigint,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.record_evidence_integrity_result(
  uuid,
  uuid,
  boolean,
  boolean,
  text,
  bigint,
  text,
  uuid
) to service_role;

grant select (
  retention_class,
  retention_until,
  lifecycle_status,
  deleted_at
) on table public.deal_evidence
to authenticated;

drop view if exists public.deal_evidence_safe;
create view public.deal_evidence_safe
with (security_invoker = true, security_barrier = true)
as
select
  evidence.id,
  evidence.deal_id,
  evidence.dispute_id,
  evidence.uploader_role,
  evidence.evidence_type,
  evidence.file_name,
  evidence.mime_type,
  evidence.detected_mime_type,
  evidence.file_size_bytes,
  evidence.sha256,
  evidence.scan_status,
  evidence.scanned_at,
  evidence.integrity_status,
  evidence.integrity_checked_at,
  evidence.retention_class,
  evidence.retention_until,
  evidence.lifecycle_status,
  evidence.deleted_at,
  evidence.created_at
from public.deal_evidence as evidence;

revoke all on table public.deal_evidence_safe
  from public, anon, authenticated;
grant select on table public.deal_evidence_safe
  to authenticated;

do $schedule_evidence_lifecycle_jobs$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'dealivra-evidence-lifecycle-inventory';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'dealivra-evidence-lifecycle-inventory',
    '15 4 * * *',
    'select public.refresh_evidence_lifecycle_inventory()'
  );

  select jobid into existing_job_id
  from cron.job
  where jobname = 'dealivra-evidence-maintenance-worker';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'dealivra-evidence-maintenance-worker',
    '*/15 * * * *',
    $worker$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'dealivra_project_url'
          order by created_at desc
          limit 1
        ) || '/functions/v1/evidence-maintenance',
        headers := jsonb_build_object(
          'Content-Type',
          'application/json',
          'x-dealivra-maintenance-secret',
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'dealivra_evidence_maintenance_secret'
            order by created_at desc
            limit 1
          )
        ),
        body := jsonb_build_object('action', 'run', 'limit', 20),
        timeout_milliseconds := 10000
      );
    $worker$
  );
end
$schedule_evidence_lifecycle_jobs$;

comment on table public.evidence_legal_hold_events is
  'Append-only operator-scoped evidence hold and release history.';
comment on table public.evidence_lifecycle_jobs is
  'Private bounded maintenance queue; retained-evidence deletion requires operator approval.';
comment on table public.evidence_lifecycle_events is
  'Append-only evidence retention, maintenance, hold, and verified deletion ledger.';
comment on table public.evidence_lifecycle_alerts is
  'Operator-owned alert queue for lifecycle review and maintenance failures.';
comment on function public.refresh_evidence_lifecycle_inventory() is
  'Scheduled inventory that queues integrity/quarantine work and opens deletion review without deleting retained evidence.';

notify pgrst, 'reload schema';

commit;
