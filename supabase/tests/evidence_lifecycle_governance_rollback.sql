-- Rollback-only EVD-005 retention, legal hold, queue, and deletion proof.

begin;

do $evd005_schema_and_grants$
declare
  safe_view_options text[];
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deal_evidence'
      and column_name = 'retention_until'
  )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'deal_evidence'
        and column_name = 'lifecycle_status'
    )
    or has_table_privilege(
      'authenticated',
      'public.evidence_lifecycle_jobs',
      'SELECT'
    )
    or has_table_privilege(
      'authenticated',
      'public.evidence_legal_hold_events',
      'SELECT'
    )
    or has_function_privilege(
      'authenticated',
      'public.approve_evidence_deletion(uuid,uuid,text,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.approve_evidence_deletion(uuid,uuid,text,uuid)',
      'EXECUTE'
    )
    or has_table_privilege(
      'service_role',
      'public.evidence_lifecycle_events',
      'UPDATE'
    ) then
    raise exception 'EVD-005 lifecycle schema or grants changed';
  end if;

  if (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.evidence_lifecycle_events'::regclass
      and not tgisinternal
      and tgname in (
        'evidence_lifecycle_events_reject_update_delete',
        'evidence_lifecycle_events_reject_truncate'
      )
  ) <> 2
    or (
      select count(*)
      from pg_trigger
      where tgrelid = 'public.evidence_legal_hold_events'::regclass
        and not tgisinternal
        and tgname in (
          'evidence_legal_hold_events_reject_update_delete',
          'evidence_legal_hold_events_reject_truncate'
        )
    ) <> 2 then
    raise exception 'EVD-005 append-only lifecycle triggers changed';
  end if;

  select relation.reloptions
  into safe_view_options
  from pg_class as relation
  join pg_namespace as namespace_record
    on namespace_record.oid = relation.relnamespace
  where namespace_record.nspname = 'public'
    and relation.relname = 'deal_evidence_safe';

  if safe_view_options is null
     or not ('security_invoker=true' = any(safe_view_options))
     or not ('security_barrier=true' = any(safe_view_options))
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'deal_evidence_safe'
         and column_name = 'lifecycle_status'
     )
     or exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'deal_evidence_safe'
         and column_name in (
           'storage_path',
           'uploaded_by',
           'metadata',
           'scan_provider',
           'scan_reference'
         )
     ) then
    raise exception 'EVD-005 safe evidence projection changed';
  end if;

  if (
    select count(*)
    from cron.job
    where jobname in (
      'dealivra-evidence-lifecycle-inventory',
      'dealivra-evidence-maintenance-worker'
    )
  ) <> 2 then
    raise exception 'EVD-005 scheduled lifecycle jobs are missing';
  end if;
end
$evd005_schema_and_grants$;

do $evd005_fixture$
declare
  target_evidence_id uuid;
  target_deal_id uuid;
  target_actor_id uuid;
  target_admin_id uuid;
  maintenance_secret text;
begin
  select
    deal.id,
    deal.seller_id
  into
    target_deal_id,
    target_actor_id
  from public.deals as deal
  where not exists (
    select 1
    from public.deal_disputes as dispute
    where dispute.deal_id = deal.id
      and dispute.status in ('open', 'evidence_requested', 'under_review')
  )
  order by deal.created_at desc
  limit 1;

  select profile.id
  into target_admin_id
  from public.profiles as profile
  where profile.app_role in ('admin', 'compliance')
  order by profile.created_at
  limit 1;

  select decrypted_secret
  into maintenance_secret
  from vault.decrypted_secrets
  where name = 'dealivra_evidence_maintenance_secret'
  order by created_at desc
  limit 1;

  if target_deal_id is null
     or target_actor_id is null
     or target_admin_id is null
     or maintenance_secret is null then
    raise exception 'EVD-005 production rollback fixture is incomplete';
  end if;

  target_evidence_id := gen_random_uuid();

  insert into public.deal_evidence (
    id,
    deal_id,
    dispute_id,
    uploaded_by,
    uploader_role,
    evidence_type,
    storage_path,
    file_name,
    mime_type,
    file_size_bytes,
    sha256,
    metadata,
    detected_mime_type,
    scan_status,
    scan_provider,
    scan_reference,
    scanned_at,
    integrity_status,
    integrity_checked_at,
    retention_class,
    retention_until,
    lifecycle_status,
    deletion_requested_at
  )
  values (
    target_evidence_id,
    target_deal_id,
    null,
    target_actor_id,
    'seller',
    'seller_item_photo',
    target_actor_id::text || '/' || target_deal_id::text ||
      '/' || target_evidence_id::text || '.webp',
    'rollback-evidence.webp',
    'image/webp',
    123,
    repeat('a', 64),
    jsonb_build_object('rollbackFixture', true),
    'image/webp',
    'clean',
    'rollback-fixture',
    'rollback-fixture',
    now(),
    'unverified',
    null,
    'routine_evidence',
    now() - interval '1 day',
    'deletion_review',
    now()
  );

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
  values (
    'evidence_delete',
    target_evidence_id,
    'deal-evidence',
    target_actor_id::text || '/' || target_deal_id::text ||
      '/' || target_evidence_id::text || '.webp',
    'pending_review',
    'scheduled_inventory',
    'retention_period_elapsed',
    now() - interval '1 day',
    80
  );

  perform set_config('evd005.evidence_id', target_evidence_id::text, true);
  perform set_config('evd005.deal_id', target_deal_id::text, true);
  perform set_config('evd005.actor_id', target_actor_id::text, true);
  perform set_config('evd005.admin_id', target_admin_id::text, true);
  perform set_config('evd005.secret', maintenance_secret, true);
end
$evd005_fixture$;

set local role service_role;

do $evd005_scheduled_integrity_actor$
declare
  target_evidence_id uuid := current_setting('evd005.evidence_id')::uuid;
  recorded_status text;
begin
  select result.integrity_status
  into recorded_status
  from public.record_evidence_integrity_result(
    target_evidence_id,
    null,
    true,
    true,
    repeat('a', 64),
    123,
    'image/webp',
    gen_random_uuid()
  ) as result;

  if recorded_status <> 'verified'
     or not exists (
       select 1
       from public.evidence_integrity_events as event
       where event.evidence_id = target_evidence_id
         and event.checked_by is null
         and event.checked_by_service = 'scheduled_maintenance'
         and event.result = 'verified'
     ) then
    raise exception 'EVD-005 scheduled integrity actor was not recorded safely';
  end if;
end
$evd005_scheduled_integrity_actor$;

do $evd005_hold_blocks_deletion$
declare
  target_evidence_id uuid := current_setting('evd005.evidence_id')::uuid;
  target_admin_id uuid := current_setting('evd005.admin_id')::uuid;
  hold_key uuid;
begin
  hold_key := public.record_evidence_legal_hold_event(
    target_evidence_id,
    target_admin_id,
    'placed',
    'Rollback test legal hold preserves evidence during review.',
    null,
    gen_random_uuid()
  );

  if hold_key is null
     or not dealsafe_private.evidence_has_active_legal_hold(target_evidence_id)
     or not exists (
       select 1
       from public.evidence_lifecycle_jobs as job
       where job.evidence_id = target_evidence_id
         and job.job_type = 'evidence_delete'
         and job.status = 'blocked'
         and job.last_error_code = 'legal_hold_active'
     )
     or not exists (
       select 1
       from public.deal_evidence as evidence
       where evidence.id = target_evidence_id
         and evidence.lifecycle_status = 'retained'
         and evidence.deletion_requested_at is null
     ) then
    raise exception 'EVD-005 legal hold did not block deletion';
  end if;

  begin
    perform public.approve_evidence_deletion(
      target_evidence_id,
      target_admin_id,
      'Rollback test approval must fail while legal hold is active.',
      gen_random_uuid()
    );
    raise exception 'EVD-005 deletion approval bypassed legal hold';
  exception
    when others then
      if sqlerrm = 'EVD-005 deletion approval bypassed legal hold' then
        raise;
      end if;
  end;

  perform public.record_evidence_legal_hold_event(
    target_evidence_id,
    target_admin_id,
    'released',
    'Rollback test releases the legal hold after review completion.',
    hold_key,
    gen_random_uuid()
  );

  if dealsafe_private.evidence_has_active_legal_hold(target_evidence_id)
     or not exists (
       select 1
       from public.evidence_lifecycle_jobs as job
       where job.evidence_id = target_evidence_id
         and job.job_type = 'evidence_delete'
         and job.status = 'pending_review'
         and job.approved_by is null
     ) then
    raise exception 'EVD-005 hold release did not require a fresh review';
  end if;
end
$evd005_hold_blocks_deletion$;

do $evd005_approved_verified_deletion$
declare
  target_evidence_id uuid := current_setting('evd005.evidence_id')::uuid;
  target_admin_id uuid := current_setting('evd005.admin_id')::uuid;
  maintenance_secret text := current_setting('evd005.secret');
  approved_job_id uuid;
  claimed_job_id uuid;
  claimed_lease_token uuid;
begin
  approved_job_id := public.approve_evidence_deletion(
    target_evidence_id,
    target_admin_id,
    'Rollback test confirms elapsed retention and no active dispute or legal hold.',
    gen_random_uuid()
  );

  select claim.job_id, claim.lease_token
  into claimed_job_id, claimed_lease_token
  from public.claim_evidence_maintenance_jobs(
    maintenance_secret,
    1,
    gen_random_uuid()
  ) as claim
  where claim.job_id = approved_job_id;

  if claimed_job_id is null
     or claimed_lease_token is null
     or not exists (
       select 1
       from public.deal_evidence as evidence
       where evidence.id = target_evidence_id
         and evidence.lifecycle_status = 'deletion_processing'
     ) then
    raise exception 'EVD-005 approved deletion was not claimed with a lease';
  end if;

  perform public.complete_evidence_maintenance_job(
    maintenance_secret,
    claimed_job_id,
    claimed_lease_token,
    'evidence_deleted',
    null,
    jsonb_build_object(
      'bucket',
      'deal-evidence',
      'absenceVerified',
      true
    )
  );

  if not exists (
    select 1
    from public.deal_evidence as evidence
    where evidence.id = target_evidence_id
      and evidence.lifecycle_status = 'deleted'
      and evidence.scan_status = 'deleted'
      and evidence.integrity_status = 'deleted'
      and evidence.deleted_at is not null
      and evidence.storage_path = 'deleted/' || evidence.id::text
      and evidence.file_name is null
      and evidence.mime_type is null
      and evidence.sha256 is null
      and evidence.file_size_bytes is null
      and evidence.metadata = '{}'
  )
    or not exists (
      select 1
      from public.evidence_lifecycle_events as event
      where event.evidence_id = target_evidence_id
        and event.job_id = claimed_job_id
        and event.event_type = 'storage_delete_verified'
    )
    or not exists (
      select 1
      from public.evidence_lifecycle_events as event
      where event.evidence_id = target_evidence_id
        and event.job_id = claimed_job_id
        and event.event_type = 'metadata_redacted'
    ) then
    raise exception 'EVD-005 verified deletion did not redact metadata atomically';
  end if;
end
$evd005_approved_verified_deletion$;

reset role;

do $evd005_append_only$
declare
  target_evidence_id uuid := current_setting('evd005.evidence_id')::uuid;
begin
  begin
    update public.evidence_lifecycle_events
    set details = jsonb_build_object('tampered', true)
    where evidence_id = target_evidence_id;
    raise exception 'EVD-005 lifecycle history was mutable';
  exception
    when others then
      if sqlerrm = 'EVD-005 lifecycle history was mutable' then
        raise;
      end if;
  end;

  begin
    delete from public.evidence_legal_hold_events
    where evidence_id = target_evidence_id;
    raise exception 'EVD-005 legal hold history was mutable';
  exception
    when others then
      if sqlerrm = 'EVD-005 legal hold history was mutable' then
        raise;
      end if;
  end;
end
$evd005_append_only$;

rollback;
