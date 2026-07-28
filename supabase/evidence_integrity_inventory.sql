-- EVD-004: append-only evidence integrity inventory and safe-viewer gate.

begin;

alter table public.deal_evidence
  add column if not exists integrity_status text not null default 'unverified',
  add column if not exists integrity_checked_at timestamptz;

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
      'invalid'
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

alter table public.deal_evidence
  drop constraint if exists deal_evidence_verified_integrity_contract;
alter table public.deal_evidence
  add constraint deal_evidence_verified_integrity_contract
  check (
    integrity_status <> 'verified'
    or (
      scan_status = 'clean'
      and sha256 ~ '^[0-9a-f]{64}$'
      and file_size_bytes > 0
      and detected_mime_type in (
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime'
      )
    )
  );

create table if not exists public.evidence_integrity_events (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.deal_evidence(id),
  deal_id uuid not null references public.deals(id),
  checked_by uuid not null references public.profiles(id),
  result text not null check (
    result in ('verified', 'missing', 'mismatch', 'invalid')
  ),
  expected_sha256 text,
  observed_sha256 text,
  expected_size_bytes bigint,
  observed_size_bytes bigint,
  expected_mime_type text,
  observed_mime_type text,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (
    expected_sha256 is null
    or expected_sha256 ~ '^[0-9a-f]{64}$'
  ),
  check (
    observed_sha256 is null
    or observed_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create index if not exists evidence_integrity_events_evidence_created_idx
  on public.evidence_integrity_events(evidence_id, created_at desc);
create index if not exists evidence_integrity_events_deal_created_idx
  on public.evidence_integrity_events(deal_id, created_at desc);

alter table public.evidence_integrity_events enable row level security;
revoke all on table public.evidence_integrity_events
  from public, anon, authenticated;
revoke update, delete, truncate, trigger
  on table public.evidence_integrity_events
  from service_role;
grant select, insert
  on table public.evidence_integrity_events
  to service_role;

drop trigger if exists evidence_integrity_events_reject_update_delete
  on public.evidence_integrity_events;
create trigger evidence_integrity_events_reject_update_delete
before update or delete on public.evidence_integrity_events
for each row
execute function public.reject_audit_event_mutation();

drop trigger if exists evidence_integrity_events_reject_truncate
  on public.evidence_integrity_events;
create trigger evidence_integrity_events_reject_truncate
before truncate on public.evidence_integrity_events
for each statement
execute function public.reject_audit_event_mutation();

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
     or p_checked_by is null
     or p_storage_present is null
     or p_structure_valid is null
     or p_correlation_id is null then
    raise exception 'Evidence integrity input is incomplete';
  end if;

  select
    evidence.id,
    evidence.deal_id,
    evidence.scan_status,
    pg_catalog.lower(pg_catalog.btrim(evidence.sha256)) as sha256,
    evidence.file_size_bytes,
    pg_catalog.lower(
      pg_catalog.btrim(evidence.detected_mime_type)
    ) as detected_mime_type
  into evidence_record
  from public.deal_evidence as evidence
  where evidence.id = p_evidence_id
  for update;

  if evidence_record.id is null then
    raise exception 'Evidence file was not found';
  end if;

  if not exists (
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
  integrity_status,
  integrity_checked_at
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
  evidence.created_at
from public.deal_evidence as evidence;

revoke all on table public.deal_evidence_safe
  from public, anon, authenticated;
grant select on table public.deal_evidence_safe
  to authenticated;

comment on table public.evidence_integrity_events is
  'Append-only byte, size, type, and digest verification history for private evidence.';
comment on function public.record_evidence_integrity_result(
  uuid,
  uuid,
  boolean,
  boolean,
  text,
  bigint,
  text,
  uuid
) is
  'Service-only atomic evidence integrity status and append-only event writer.';
comment on view public.deal_evidence_safe is
  'Participant/case-scoped evidence metadata and latest integrity status without storage paths or scanner internals.';

notify pgrst, 'reload schema';

commit;
