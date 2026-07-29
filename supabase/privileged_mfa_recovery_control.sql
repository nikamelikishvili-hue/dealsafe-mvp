-- SEC-003B / SEC-007: dual-control privileged MFA recovery, immutable case
-- history, security-notification outbox, and post-recovery sensitive-change
-- cooldowns.
--
-- Apply only after:
--   production_auth_rbac_hardening.sql
--   immutable_material_audit_events.sql
--
-- This migration does not remove Auth factors or sessions. A separately
-- approved service workflow must revoke both before it can finalize a case.

begin;

create schema if not exists dealsafe_private;

create table if not exists dealsafe_private.privileged_mfa_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  case_reference text not null unique,
  reason_code text not null check (
    reason_code in (
      'lost_all_factors',
      'suspected_factor_compromise',
      'device_loss'
    )
  ),
  opening_evidence_reference text not null,
  status text not null default 'open' check (
    status in (
      'open',
      'identity_verified',
      'approved',
      'rejected',
      'completed',
      'cancelled'
    )
  ),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  identity_proof_method text check (
    identity_proof_method is null
    or identity_proof_method in (
      'government_id_plus_live_check',
      'provider_assisted_reproof',
      'document_and_video_review'
    )
  ),
  identity_evidence_reference text,
  identity_verified_by uuid references public.profiles(id) on delete restrict,
  identity_verified_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  review_decision text check (
    review_decision is null or review_decision in ('approve', 'reject')
  ),
  review_note text,
  reviewed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  session_revocation_reference text,
  factor_revocation_reference text,
  completed_at timestamptz,
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_by <> target_user_id),
  check (reviewed_by is null or reviewed_by <> target_user_id),
  check (reviewed_by is null or reviewed_by <> requested_by),
  check (
    status not in ('identity_verified', 'approved', 'rejected', 'completed')
    or (
      identity_proof_method is not null
      and identity_evidence_reference is not null
      and identity_verified_by is not null
      and identity_verified_at is not null
    )
  ),
  check (
    status not in ('approved', 'rejected', 'completed')
    or (
      reviewed_by is not null
      and review_decision is not null
      and review_note is not null
      and reviewed_at is not null
    )
  ),
  check (
    status <> 'completed'
    or (
      review_decision = 'approve'
      and completed_by is not null
      and session_revocation_reference is not null
      and factor_revocation_reference is not null
      and completed_at is not null
      and cooldown_until > completed_at
    )
  )
);

create unique index if not exists privileged_mfa_recovery_one_active_target_idx
  on dealsafe_private.privileged_mfa_recovery_cases(target_user_id)
  where status in ('open', 'identity_verified', 'approved');

create index if not exists privileged_mfa_recovery_status_idx
  on dealsafe_private.privileged_mfa_recovery_cases(status, requested_at);

create table if not exists dealsafe_private.sensitive_change_holds (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  recovery_case_id uuid not null
    references dealsafe_private.privileged_mfa_recovery_cases(id) on delete restrict,
  scope text not null check (scope in ('payout', 'email', 'mfa')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  release_reference text,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (
    (released_at is null and release_reference is null)
    or (released_at is not null and release_reference is not null)
  )
);

create unique index if not exists sensitive_change_one_open_hold_idx
  on dealsafe_private.sensitive_change_holds(target_user_id, scope)
  where released_at is null;

create index if not exists sensitive_change_holds_lookup_idx
  on dealsafe_private.sensitive_change_holds(target_user_id, expires_at)
  where released_at is null;

create table if not exists dealsafe_private.security_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  recovery_case_id uuid
    references dealsafe_private.privileged_mfa_recovery_cases(id) on delete restrict,
  template_key text not null check (
    template_key in (
      'privileged_mfa_recovery_opened',
      'privileged_mfa_recovery_identity_verified',
      'privileged_mfa_recovery_approved',
      'privileged_mfa_recovery_rejected',
      'privileged_mfa_recovery_completed'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  deliver_after timestamptz not null default now(),
  delivery_attempts integer not null default 0 check (delivery_attempts between 0 and 10),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  delivery_reference text,
  last_failure_code text,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object'),
  check (
    (delivered_at is null and delivery_reference is null)
    or (delivered_at is not null and delivery_reference is not null)
  )
);

create index if not exists security_notification_delivery_idx
  on dealsafe_private.security_notification_outbox(deliver_after, created_at)
  where delivered_at is null;

alter table dealsafe_private.privileged_mfa_recovery_cases enable row level security;
alter table dealsafe_private.sensitive_change_holds enable row level security;
alter table dealsafe_private.security_notification_outbox enable row level security;

revoke all on table
  dealsafe_private.privileged_mfa_recovery_cases,
  dealsafe_private.sensitive_change_holds,
  dealsafe_private.security_notification_outbox
from public, anon, authenticated, service_role;

create or replace function dealsafe_private.current_user_has_recent_totp_step_up()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(auth.jwt() -> 'amr') = 'array'
          then auth.jwt() -> 'amr'
          else '[]'::jsonb
        end
      ) as method
      where method ->> 'method' = 'totp'
        and coalesce(method ->> 'timestamp', '') ~ '^[0-9]+$'
        and to_timestamp((method ->> 'timestamp')::double precision)
          between now() - interval '10 minutes' and now() + interval '1 minute'
    );
$$;

create or replace function dealsafe_private.current_security_operator_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.app_role
      from public.profiles as profile
      where profile.id = auth.uid()
    ),
    'anonymous'
  );
$$;

create or replace function dealsafe_private.require_security_operator(
  p_allowed_roles text[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  application_role text;
begin
  if not dealsafe_private.current_user_has_recent_totp_step_up() then
    raise exception 'DEALIVRA_RECOVERY_RECENT_TOTP_REQUIRED'
      using errcode = 'P0001';
  end if;

  application_role := dealsafe_private.current_security_operator_role();
  if application_role <> all(p_allowed_roles) then
    raise exception 'DEALIVRA_RECOVERY_ROLE_REQUIRED'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function
  dealsafe_private.current_user_has_recent_totp_step_up(),
  dealsafe_private.current_security_operator_role(),
  dealsafe_private.require_security_operator(text[])
from public, anon, authenticated, service_role;

create or replace function public.open_privileged_mfa_recovery_case(
  p_target_user_id uuid,
  p_case_reference text,
  p_reason_code text,
  p_evidence_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_id uuid;
  normalized_case_reference text := upper(btrim(coalesce(p_case_reference, '')));
  normalized_evidence_reference text := btrim(coalesce(p_evidence_reference, ''));
  target_role text;
begin
  perform dealsafe_private.require_security_operator(
    array['support', 'compliance', 'admin']::text[]
  );

  if p_target_user_id is null or p_target_user_id = auth.uid() then
    raise exception 'DEALIVRA_RECOVERY_SELF_SERVICE_PROHIBITED'
      using errcode = '42501';
  end if;
  if normalized_case_reference !~ '^[A-Z0-9][A-Z0-9._/-]{7,63}$'
     or normalized_case_reference
       ~* '\m(password|passcode|token|secret|otp|totp|private key|seed phrase)\M' then
    raise exception 'DEALIVRA_RECOVERY_REFERENCE_INVALID'
      using errcode = '22023';
  end if;
  if normalized_evidence_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{7,119}$'
     or normalized_evidence_reference ~* '\m(password|passcode|token|secret|otp|totp|private key|seed phrase)\M'
     or normalized_evidence_reference ~ '[@=]' then
    raise exception 'DEALIVRA_RECOVERY_EVIDENCE_REFERENCE_INVALID'
      using errcode = '22023';
  end if;
  if p_reason_code not in (
    'lost_all_factors',
    'suspected_factor_compromise',
    'device_loss'
  ) then
    raise exception 'DEALIVRA_RECOVERY_REASON_INVALID'
      using errcode = '22023';
  end if;

  select profile.app_role
  into target_role
  from public.profiles as profile
  where profile.id = p_target_user_id;

  if target_role not in ('support', 'compliance', 'admin') then
    raise exception 'DEALIVRA_RECOVERY_PRIVILEGED_TARGET_REQUIRED'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from dealsafe_private.privileged_mfa_recovery_cases as recovery_case
    where recovery_case.target_user_id = p_target_user_id
      and recovery_case.status in ('open', 'identity_verified', 'approved')
  ) then
    raise exception 'DEALIVRA_RECOVERY_CASE_ALREADY_OPEN'
      using errcode = '23505';
  end if;

  insert into dealsafe_private.privileged_mfa_recovery_cases (
    target_user_id,
    case_reference,
    reason_code,
    opening_evidence_reference,
    requested_by
  )
  values (
    p_target_user_id,
    normalized_case_reference,
    p_reason_code,
    normalized_evidence_reference,
    auth.uid()
  )
  returning id into case_id;

  insert into public.audit_events(actor_id, event_type, metadata)
  values (
    auth.uid(),
    'privileged_mfa_recovery_opened',
    jsonb_build_object(
      'case_id', case_id,
      'case_reference', normalized_case_reference,
      'target_user_id', p_target_user_id,
      'reason_code', p_reason_code
    )
  );

  insert into dealsafe_private.security_notification_outbox (
    target_user_id,
    recovery_case_id,
    template_key,
    payload
  )
  values (
    p_target_user_id,
    case_id,
    'privileged_mfa_recovery_opened',
    jsonb_build_object('case_reference', normalized_case_reference)
  );

  return case_id;
end;
$$;

create or replace function public.record_privileged_recovery_identity_proof(
  p_case_id uuid,
  p_proof_method text,
  p_evidence_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_case dealsafe_private.privileged_mfa_recovery_cases%rowtype;
  normalized_evidence_reference text := btrim(coalesce(p_evidence_reference, ''));
begin
  perform dealsafe_private.require_security_operator(
    array['support', 'compliance', 'admin']::text[]
  );

  if p_proof_method not in (
    'government_id_plus_live_check',
    'provider_assisted_reproof',
    'document_and_video_review'
  ) then
    raise exception 'DEALIVRA_RECOVERY_PROOF_METHOD_INVALID'
      using errcode = '22023';
  end if;
  if normalized_evidence_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{7,119}$'
     or normalized_evidence_reference ~* '\m(password|passcode|token|secret|otp|totp|private key|seed phrase)\M'
     or normalized_evidence_reference ~ '[@=]' then
    raise exception 'DEALIVRA_RECOVERY_EVIDENCE_REFERENCE_INVALID'
      using errcode = '22023';
  end if;

  select *
  into recovery_case
  from dealsafe_private.privileged_mfa_recovery_cases
  where id = p_case_id
  for update;

  if not found or recovery_case.status <> 'open' then
    raise exception 'DEALIVRA_RECOVERY_OPEN_CASE_REQUIRED'
      using errcode = '55000';
  end if;
  if recovery_case.target_user_id = auth.uid() then
    raise exception 'DEALIVRA_RECOVERY_SELF_ATTESTATION_PROHIBITED'
      using errcode = '42501';
  end if;

  update dealsafe_private.privileged_mfa_recovery_cases
  set
    identity_proof_method = p_proof_method,
    identity_evidence_reference = normalized_evidence_reference,
    identity_verified_by = auth.uid(),
    identity_verified_at = now(),
    status = 'identity_verified',
    updated_at = now()
  where id = p_case_id;

  insert into public.audit_events(actor_id, event_type, metadata)
  values (
    auth.uid(),
    'privileged_mfa_recovery_identity_verified',
    jsonb_build_object(
      'case_id', p_case_id,
      'target_user_id', recovery_case.target_user_id,
      'proof_method', p_proof_method
    )
  );

  insert into dealsafe_private.security_notification_outbox (
    target_user_id,
    recovery_case_id,
    template_key,
    payload
  )
  values (
    recovery_case.target_user_id,
    p_case_id,
    'privileged_mfa_recovery_identity_verified',
    jsonb_build_object('case_reference', recovery_case.case_reference)
  );
end;
$$;

create or replace function public.review_privileged_mfa_recovery_case(
  p_case_id uuid,
  p_decision text,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_case dealsafe_private.privileged_mfa_recovery_cases%rowtype;
  normalized_review_note text := btrim(coalesce(p_review_note, ''));
  next_status text;
  next_template text;
begin
  perform dealsafe_private.require_security_operator(
    array['compliance', 'admin']::text[]
  );

  if p_decision not in ('approve', 'reject') then
    raise exception 'DEALIVRA_RECOVERY_REVIEW_DECISION_INVALID'
      using errcode = '22023';
  end if;
  if normalized_review_note !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{11,119}$'
     or normalized_review_note ~* '\m(password|passcode|token|secret|otp|totp|private key|seed phrase)\M'
     or normalized_review_note ~ '[@=]' then
    raise exception 'DEALIVRA_RECOVERY_REVIEW_NOTE_INVALID'
      using errcode = '22023';
  end if;

  select *
  into recovery_case
  from dealsafe_private.privileged_mfa_recovery_cases
  where id = p_case_id
  for update;

  if not found or recovery_case.status <> 'identity_verified' then
    raise exception 'DEALIVRA_RECOVERY_IDENTITY_PROOF_REQUIRED'
      using errcode = '55000';
  end if;
  if auth.uid() in (recovery_case.target_user_id, recovery_case.requested_by) then
    raise exception 'DEALIVRA_RECOVERY_SECOND_REVIEWER_REQUIRED'
      using errcode = '42501';
  end if;

  next_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  next_template := case
    when p_decision = 'approve' then 'privileged_mfa_recovery_approved'
    else 'privileged_mfa_recovery_rejected'
  end;

  update dealsafe_private.privileged_mfa_recovery_cases
  set
    reviewed_by = auth.uid(),
    review_decision = p_decision,
    review_note = normalized_review_note,
    reviewed_at = now(),
    status = next_status,
    updated_at = now()
  where id = p_case_id;

  insert into public.audit_events(actor_id, event_type, metadata)
  values (
    auth.uid(),
    next_template,
    jsonb_build_object(
      'case_id', p_case_id,
      'target_user_id', recovery_case.target_user_id,
      'decision', p_decision
    )
  );

  insert into dealsafe_private.security_notification_outbox (
    target_user_id,
    recovery_case_id,
    template_key,
    payload
  )
  values (
    recovery_case.target_user_id,
    p_case_id,
    next_template,
    jsonb_build_object('case_reference', recovery_case.case_reference)
  );
end;
$$;

create or replace function public.complete_privileged_mfa_recovery_for_service(
  p_case_id uuid,
  p_executor_id uuid,
  p_session_revocation_reference text,
  p_factor_revocation_reference text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovery_case dealsafe_private.privileged_mfa_recovery_cases%rowtype;
  executor_role text;
  cooldown_deadline timestamptz := now() + interval '72 hours';
  normalized_session_reference text := btrim(coalesce(p_session_revocation_reference, ''));
  normalized_factor_reference text := btrim(coalesce(p_factor_revocation_reference, ''));
  hold_scope text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'DEALIVRA_RECOVERY_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;
  if normalized_session_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{7,119}$'
     or normalized_factor_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{7,119}$'
     or normalized_session_reference
       ~* '\m(password|passcode|token|secret|otp|totp|private key|seed phrase)\M'
     or normalized_factor_reference
       ~* '\m(password|passcode|token|secret|otp|totp|private key|seed phrase)\M'
     or normalized_session_reference ~ '[@=]'
     or normalized_factor_reference ~ '[@=]' then
    raise exception 'DEALIVRA_RECOVERY_REVOCATION_REFERENCE_INVALID'
      using errcode = '22023';
  end if;

  select profile.app_role
  into executor_role
  from public.profiles as profile
  where profile.id = p_executor_id;

  if executor_role not in ('compliance', 'admin') then
    raise exception 'DEALIVRA_RECOVERY_EXECUTOR_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  select *
  into recovery_case
  from dealsafe_private.privileged_mfa_recovery_cases
  where id = p_case_id
  for update;

  if not found
     or recovery_case.status <> 'approved'
     or recovery_case.review_decision <> 'approve'
     or p_executor_id = recovery_case.target_user_id then
    raise exception 'DEALIVRA_RECOVERY_APPROVED_CASE_REQUIRED'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from auth.sessions as session_record
    where session_record.user_id = recovery_case.target_user_id
  ) then
    raise exception 'DEALIVRA_RECOVERY_SESSIONS_STILL_ACTIVE'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from auth.mfa_factors as factor
    where factor.user_id = recovery_case.target_user_id
      and factor.status = 'verified'
  ) then
    raise exception 'DEALIVRA_RECOVERY_FACTORS_STILL_ACTIVE'
      using errcode = '55000';
  end if;

  update dealsafe_private.privileged_mfa_recovery_cases
  set
    completed_by = p_executor_id,
    session_revocation_reference = normalized_session_reference,
    factor_revocation_reference = normalized_factor_reference,
    completed_at = now(),
    cooldown_until = cooldown_deadline,
    status = 'completed',
    updated_at = now()
  where id = p_case_id;

  foreach hold_scope in array array['payout', 'email', 'mfa']::text[]
  loop
    insert into dealsafe_private.sensitive_change_holds (
      target_user_id,
      recovery_case_id,
      scope,
      expires_at
    )
    values (
      recovery_case.target_user_id,
      p_case_id,
      hold_scope,
      cooldown_deadline
    )
    on conflict (target_user_id, scope) where released_at is null
    do update set
      recovery_case_id = excluded.recovery_case_id,
      starts_at = now(),
      expires_at = greatest(
        dealsafe_private.sensitive_change_holds.expires_at,
        excluded.expires_at
      );
  end loop;

  insert into public.audit_events(actor_id, event_type, metadata)
  values (
    p_executor_id,
    'privileged_mfa_recovery_completed',
    jsonb_build_object(
      'case_id', p_case_id,
      'target_user_id', recovery_case.target_user_id,
      'cooldown_until', cooldown_deadline
    )
  );

  insert into dealsafe_private.security_notification_outbox (
    target_user_id,
    recovery_case_id,
    template_key,
    payload
  )
  values (
    recovery_case.target_user_id,
    p_case_id,
    'privileged_mfa_recovery_completed',
    jsonb_build_object(
      'case_reference', recovery_case.case_reference,
      'cooldown_until', cooldown_deadline
    )
  );

  return cooldown_deadline;
end;
$$;

create or replace function public.get_privileged_mfa_recovery_cases(
  p_status text default null
)
returns table (
  case_id uuid,
  case_reference text,
  target_user_id uuid,
  target_display_name text,
  target_role text,
  reason_code text,
  status text,
  requested_at timestamptz,
  identity_verified_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  cooldown_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform dealsafe_private.require_security_operator(
    array['support', 'compliance', 'admin']::text[]
  );

  if p_status is not null and p_status not in (
    'open',
    'identity_verified',
    'approved',
    'rejected',
    'completed',
    'cancelled'
  ) then
    raise exception 'DEALIVRA_RECOVERY_STATUS_INVALID'
      using errcode = '22023';
  end if;

  return query
  select
    recovery_case.id,
    recovery_case.case_reference,
    recovery_case.target_user_id,
    profile.display_name,
    profile.app_role,
    recovery_case.reason_code,
    recovery_case.status,
    recovery_case.requested_at,
    recovery_case.identity_verified_at,
    recovery_case.reviewed_at,
    recovery_case.completed_at,
    recovery_case.cooldown_until
  from dealsafe_private.privileged_mfa_recovery_cases as recovery_case
  join public.profiles as profile on profile.id = recovery_case.target_user_id
  where p_status is null or recovery_case.status = p_status
  order by recovery_case.requested_at desc
  limit 100;
end;
$$;

create or replace function public.get_my_sensitive_change_holds()
returns table (
  scope text,
  expires_at timestamptz,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    security_hold.scope,
    security_hold.expires_at,
    security_hold.released_at is null and security_hold.expires_at > now()
  from dealsafe_private.sensitive_change_holds as security_hold
  where auth.uid() is not null
    and security_hold.target_user_id = auth.uid()
  order by security_hold.expires_at desc, security_hold.scope;
$$;

create or replace function public.assert_my_sensitive_change_allowed(
  p_scope text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'DEALIVRA_RECOVERY_AUTH_REQUIRED'
      using errcode = '42501';
  end if;
  if p_scope not in ('payout', 'email', 'mfa') then
    raise exception 'DEALIVRA_SENSITIVE_CHANGE_SCOPE_INVALID'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from dealsafe_private.sensitive_change_holds as security_hold
    where security_hold.target_user_id = auth.uid()
      and security_hold.scope = p_scope
      and security_hold.released_at is null
      and security_hold.expires_at > now()
  ) then
    raise exception 'DEALIVRA_SENSITIVE_CHANGE_COOLDOWN'
      using
        errcode = 'P0001',
        hint = 'Wait until the recovery cooldown expires or use the documented dual-control escalation.';
  end if;
end;
$$;

create or replace function public.is_sensitive_change_allowed_for_service(
  p_user_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    and p_user_id is not null
    and p_scope in ('payout', 'email', 'mfa')
    and not exists (
      select 1
      from dealsafe_private.sensitive_change_holds as security_hold
      where security_hold.target_user_id = p_user_id
        and security_hold.scope = p_scope
        and security_hold.released_at is null
        and security_hold.expires_at > now()
    );
$$;

create or replace function public.claim_security_notification_delivery_batch(
  p_limit integer default 25
)
returns table (
  notification_id uuid,
  target_user_id uuid,
  template_key text,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'DEALIVRA_NOTIFICATION_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  with selected as (
    select notification.id
    from dealsafe_private.security_notification_outbox as notification
    where notification.delivered_at is null
      and notification.deliver_after <= now()
      and notification.delivery_attempts < 5
      and (
        notification.last_attempt_at is null
        or notification.last_attempt_at < now() - interval '5 minutes'
      )
    order by notification.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ),
  claimed as (
    update dealsafe_private.security_notification_outbox as notification
    set
      delivery_attempts = notification.delivery_attempts + 1,
      last_attempt_at = now(),
      last_failure_code = null
    from selected
    where notification.id = selected.id
    returning
      notification.id,
      notification.target_user_id,
      notification.template_key,
      notification.payload
  )
  select claimed.id, claimed.target_user_id, claimed.template_key, claimed.payload
  from claimed;
end;
$$;

create or replace function public.complete_security_notification_delivery(
  p_notification_id uuid,
  p_delivery_reference text,
  p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_reference text := btrim(coalesce(p_delivery_reference, ''));
  normalized_failure text := nullif(btrim(coalesce(p_failure_code, '')), '');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'DEALIVRA_NOTIFICATION_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;
  if normalized_reference !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{7,119}$'
     or normalized_reference ~ '[@=]'
     or (
       normalized_failure is not null
       and normalized_failure !~ '^[a-z0-9_]{3,64}$'
     ) then
    raise exception 'DEALIVRA_NOTIFICATION_DELIVERY_REFERENCE_INVALID'
      using errcode = '22023';
  end if;

  update dealsafe_private.security_notification_outbox
  set
    delivered_at = case when normalized_failure is null then now() else null end,
    delivery_reference = case when normalized_failure is null then normalized_reference else null end,
    last_failure_code = normalized_failure
  where id = p_notification_id
    and delivered_at is null;

  if not found then
    raise exception 'DEALIVRA_NOTIFICATION_PENDING_RECORD_REQUIRED'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.get_security_notification_delivery_health_for_service()
returns table (
  ready_count integer,
  retrying_count integer,
  dead_letter_count integer,
  oldest_pending_age_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'DEALIVRA_NOTIFICATION_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (
      where notification.delivered_at is null
        and notification.deliver_after <= now()
        and notification.delivery_attempts = 0
    )::integer,
    count(*) filter (
      where notification.delivered_at is null
        and notification.delivery_attempts between 1 and 4
    )::integer,
    count(*) filter (
      where notification.delivered_at is null
        and notification.delivery_attempts >= 5
    )::integer,
    coalesce(
      greatest(
        0,
        least(
          floor(
            extract(
              epoch from (
                now() - min(notification.created_at)
                  filter (where notification.delivered_at is null)
              )
            ) / 60
          ),
          5256000
        )
      )::integer,
      0
    )
  from dealsafe_private.security_notification_outbox as notification;
end;
$$;

revoke all on function
  public.open_privileged_mfa_recovery_case(uuid, text, text, text),
  public.record_privileged_recovery_identity_proof(uuid, text, text),
  public.review_privileged_mfa_recovery_case(uuid, text, text),
  public.complete_privileged_mfa_recovery_for_service(uuid, uuid, text, text),
  public.get_privileged_mfa_recovery_cases(text),
  public.get_my_sensitive_change_holds(),
  public.assert_my_sensitive_change_allowed(text),
  public.is_sensitive_change_allowed_for_service(uuid, text),
  public.claim_security_notification_delivery_batch(integer),
  public.complete_security_notification_delivery(uuid, text, text),
  public.get_security_notification_delivery_health_for_service()
from public, anon, authenticated, service_role;

grant execute on function
  public.open_privileged_mfa_recovery_case(uuid, text, text, text),
  public.record_privileged_recovery_identity_proof(uuid, text, text),
  public.review_privileged_mfa_recovery_case(uuid, text, text),
  public.get_privileged_mfa_recovery_cases(text),
  public.get_my_sensitive_change_holds(),
  public.assert_my_sensitive_change_allowed(text)
to authenticated;

grant execute on function
  public.complete_privileged_mfa_recovery_for_service(uuid, uuid, text, text),
  public.is_sensitive_change_allowed_for_service(uuid, text),
  public.claim_security_notification_delivery_batch(integer),
  public.complete_security_notification_delivery(uuid, text, text),
  public.get_security_notification_delivery_health_for_service()
to service_role;

comment on table dealsafe_private.privileged_mfa_recovery_cases is
  'Dual-control case state for privileged all-factor-loss recovery. Direct table access is prohibited.';

comment on table dealsafe_private.security_notification_outbox is
  'Verified-channel notification jobs. Recipient addresses are resolved by the trusted delivery worker and are never stored here.';

comment on function public.complete_privileged_mfa_recovery_for_service(uuid, uuid, text, text) is
  'Finalizes an approved case only after the Auth provider contains no sessions or verified factors, then starts a 72-hour payout/email/MFA cooldown.';

comment on function public.get_security_notification_delivery_health_for_service() is
  'Returns privacy-safe queue counts and a bounded oldest-pending age for service monitoring; no user or message identifiers are exposed.';

notify pgrst, 'reload schema';

commit;
