-- Synthetic data for the unchanged 17 authorization suites, LOCAL ONLY.
-- The invoking runner must independently enforce its --local-disposable flag,
-- loopback PostgreSQL endpoint on port 54322, and a scrubbed environment.
-- This SQL flag is defense in depth, not proof of the connection's destination.
-- Run once after a data-free baseline restore, never against an existing app.
-- No password hash, session, MFA factor, provider object, or Storage object is
-- created. Cron entries are disabled SELECT 1 fixtures, not scheduler proof.

begin;

do $local_destination_required$
begin
  if current_setting('dealivra.local_fixture_bootstrap', true)
       is distinct from 'on'
     or current_database() <> 'postgres'
     or current_user <> 'postgres'
     or session_user <> 'postgres' then
    raise exception 'Local disposable fixture authorization is required';
  end if;
end
$local_destination_required$;

set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '20s';
set local lock_timeout = '2s';

do $fresh_local_database_required$
declare
  relation_name text;
  relation_record record;
  has_rows boolean;
begin
  foreach relation_name in array array[
    'auth.users', 'auth.identities', 'auth.sessions', 'auth.mfa_factors',
    'public.profiles', 'public.deals', 'public.agreement_versions',
    'public.agreement_acceptances', 'public.deal_disputes',
    'public.deal_evidence', 'public.deal_media', 'public.deal_meetings',
    'public.deal_shipments', 'public.ratings', 'public.audit_events',
    'public.protected_payments', 'public.evidence_integrity_events',
    'public.evidence_lifecycle_jobs', 'public.evidence_lifecycle_events',
    'public.evidence_legal_hold_events',
    'dealsafe_private.evidence_maintenance_settings',
    'storage.buckets', 'storage.objects', 'vault.secrets',
    'vault.decrypted_secrets', 'cron.job'
  ]::text[] loop
    if to_regclass(relation_name) is null then
      raise exception 'Local fixture bootstrap requires the complete reviewed schema';
    end if;
  end loop;

  if not exists (select 1 from pg_roles where rolname = 'authenticator')
     or to_regprocedure('public.enforce_active_auth_session()') is null
     or to_regprocedure('cron.schedule(text,text,text)') is null
     or to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is null then
    raise exception 'Local fixture bootstrap requires the reviewed helper dependencies';
  end if;

  -- Refuse imported credentials, destinations, jobs, and queued requests.
  -- Do not repair hosted URL/Cron defaults in the older setup scripts:
  -- those scripts are not a data-free local baseline.
  if exists (select 1 from vault.secrets)
     or exists (select 1 from cron.job)
     or exists (select 1 from dealsafe_private.evidence_maintenance_settings)
     or exists (select 1 from storage.buckets)
     or exists (select 1 from storage.objects) then
    raise exception 'Local fixture bootstrap refuses existing configuration or Storage data';
  end if;

  if to_regclass('net.http_request_queue') is not null then
    execute 'select exists (select 1 from net.http_request_queue)'
      into has_rows;
    if has_rows then
      raise exception 'Local fixture bootstrap refuses queued network requests';
    end if;
  end if;

  if exists (select 1 from auth.users)
     or exists (select 1 from auth.identities)
     or exists (select 1 from auth.sessions)
     or exists (select 1 from auth.mfa_factors) then
    raise exception 'Local fixture bootstrap refuses existing Auth data';
  end if;

  -- Check application tables without reading or emitting any row values.
  -- Foreign tables are refused rather than queried through an external server.
  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('public', 'private', 'dealsafe_private')
      and relation.relkind = 'f'
  ) then
    raise exception 'Local fixture bootstrap refuses foreign application tables';
  end if;

  for relation_record in
    select namespace.nspname, relation.relname
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('public', 'private', 'dealsafe_private')
      and relation.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_depend dependency
        where dependency.classid = 'pg_class'::regclass
          and dependency.objid = relation.oid
          and dependency.deptype = 'e'
      )
    order by namespace.nspname, relation.relname
  loop
    execute format(
      'select exists (select 1 from %I.%I)',
      relation_record.nspname,
      relation_record.relname
    ) into has_rows;
    if has_rows then
      raise exception 'Local fixture bootstrap refuses existing application data';
    end if;
  end loop;

  -- Do not allow an unexpected Auth/database webhook to run during inserts.
  if exists (
    select 1
    from pg_trigger trigger_record
    join pg_proc routine on routine.oid = trigger_record.tgfoid
    join pg_namespace function_namespace
      on function_namespace.oid = routine.pronamespace
    where not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and trigger_record.tgrelid in (
        'auth.users'::regclass, 'public.profiles'::regclass,
        'public.deals'::regclass, 'public.agreement_versions'::regclass,
        'public.agreement_acceptances'::regclass,
        'public.deal_disputes'::regclass, 'public.deal_evidence'::regclass,
        'public.deal_media'::regclass, 'public.deal_meetings'::regclass,
        'public.deal_shipments'::regclass, 'public.ratings'::regclass,
        'public.audit_events'::regclass, 'public.protected_payments'::regclass
      )
      and not (
        (trigger_record.tgrelid = 'auth.users'::regclass
          and trigger_record.tgname = 'on_auth_user_created'
          and function_namespace.nspname = 'public'
          and routine.proname = 'handle_new_user')
        or (trigger_record.tgrelid = 'public.deals'::regclass
          and function_namespace.nspname = 'public'
          and (
            (trigger_record.tgname = 'on_deal_created'
              and routine.proname = 'create_initial_agreement')
            or (trigger_record.tgname = 'protect_hidden_deal'
              and routine.proname = 'block_hidden_deal_changes')
          ))
        or (trigger_record.tgrelid = 'public.agreement_versions'::regclass
          and function_namespace.nspname = 'private'
          and (
            (trigger_record.tgname = 'populate_agreement_canonical_record'
              and routine.proname = 'populate_agreement_canonical_record')
            or (trigger_record.tgname = 'prevent_agreement_version_mutation'
              and routine.proname = 'prevent_agreement_version_mutation')
          ))
        or (trigger_record.tgrelid = 'public.audit_events'::regclass
          and trigger_record.tgname in (
            'audit_events_reject_update_delete', 'audit_events_reject_truncate'
          )
          and function_namespace.nspname = 'public'
          and routine.proname = 'reject_audit_event_mutation')
      )
  ) then
    raise exception 'Local fixture bootstrap refuses unexpected mutation triggers';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'cron.job'::regclass
      and attname = 'active'
      and atttypid = 'boolean'::regtype
      and not attisdropped
  ) then
    raise exception 'Local Cron must support inactive fixture registrations';
  end if;

  if exists (
    select 1 from pg_roles role_record
    cross join lateral unnest(coalesce(role_record.rolconfig, array[]::text[])) setting
    where role_record.rolname = 'authenticator'
      and setting like 'pgrst.db_pre_request=%'
      and setting <> 'pgrst.db_pre_request=public.enforce_active_auth_session'
  ) then
    raise exception 'Local authenticator has an unexpected pre-request configuration';
  end if;
end
$fresh_local_database_required$;

do $create_local_synthetic_fixtures$
declare
  seller_id uuid := gen_random_uuid();
  buyer_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  administrator_id uuid := gen_random_uuid();
  accepted_deal_id uuid := gen_random_uuid();
  completed_deal_id uuid := gen_random_uuid();
  evidence_id uuid := gen_random_uuid();
  maintenance_secret text;
  fixture_project_url constant text := 'https://localfixture.supabase.co';
  seller_account constant text := 'acct_LOCALFIXTUREONLY';
  inventory_job_id bigint;
  worker_job_id bigint;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select fixture.id, 'authenticated', 'authenticated',
    'local-' || fixture.label || '-' || fixture.id::text || '@example.invalid',
    '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', fixture.display_name, 'local_fixture', true),
    now(), now()
  from (values
    (seller_id, 'seller', 'Local Fixture Seller'),
    (buyer_id, 'buyer', 'Local Fixture Buyer'),
    (outsider_id, 'outsider', 'Local Fixture Outsider'),
    (administrator_id, 'admin', 'Local Fixture Administrator')
  ) as fixture(id, label, display_name);

  -- handle_new_user may already have created these exact profiles.
  insert into public.profiles (id, display_name, app_role, is_admin)
  values
    (seller_id, 'Local Fixture Seller', 'member', false),
    (buyer_id, 'Local Fixture Buyer', 'member', false),
    (outsider_id, 'Local Fixture Outsider', 'member', false),
    (administrator_id, 'Local Fixture Administrator', 'admin', true)
  on conflict (id) do update
    set display_name = excluded.display_name,
        app_role = excluded.app_role,
        is_admin = excluded.is_admin;

  update public.profiles
  set stripe_account_id = seller_account,
      stripe_details_submitted = true,
      stripe_payouts_enabled = true,
      stripe_transfers_active = true
  where id = seller_id;

  insert into public.deals (
    id, seller_id, buyer_id, title, description, price_cents, currency,
    condition, delivery_method, status, current_agreement_version,
    published_at, created_at
  ) values
    (accepted_deal_id, seller_id, buyer_id, 'Local authorization fixture',
      'Synthetic local-only authorization fixture; no item is for sale.',
      10000, 'USD', 'Good', 'Ship to buyer', 'accepted', 1,
      now(), now()),
    (completed_deal_id, seller_id, buyer_id, 'Local completed rating fixture',
      'Synthetic local-only completed deal used for the ratings policy.',
      10000, 'USD', 'Good', 'Ship to buyer', 'completed', 1,
      now() - interval '2 days', now() - interval '1 day');

  -- Keep the schema's initial-agreement/canonical triggers under test.
  -- Do not fabricate missing snapshots or update an immutable agreement.
  if (
    select count(*) from public.agreement_versions
    where deal_id in (accepted_deal_id, completed_deal_id) and version = 1
  ) <> 2 then
    raise exception 'Local initial-agreement trigger did not create both snapshots';
  end if;

  insert into public.agreement_acceptances (
    agreement_version_id, signer_id, typed_name, consent_text
  )
  select agreement.id, signer.id, signer.typed_name,
    'Synthetic local-only agreement acceptance; not a customer contract.'
  from public.agreement_versions agreement
  cross join (values
    (seller_id, 'Local Fixture Seller'),
    (buyer_id, 'Local Fixture Buyer')
  ) as signer(id, typed_name)
  where agreement.deal_id in (accepted_deal_id, completed_deal_id)
    and agreement.version = 1;

  insert into public.deal_disputes (deal_id, opened_by, reason, status)
  values (accepted_deal_id, seller_id,
    'Synthetic local-only authorization case.', 'cancelled');

  insert into public.deal_evidence (
    id, deal_id, uploaded_by, uploader_role, evidence_type, storage_path
  ) values (
    evidence_id, accepted_deal_id, seller_id, 'seller', 'seller_item_photo',
    seller_id::text || '/' || accepted_deal_id::text || '/' || evidence_id::text || '.webp'
  );

  insert into public.deal_media (deal_id, storage_path, sort_order)
  values (accepted_deal_id, 'local-fixtures/authorization-media.webp', 0);

  insert into public.deal_meetings (
    deal_id, proposed_by, location_name, address, scheduled_at
  ) values (
    accepted_deal_id, seller_id, 'Synthetic local meeting',
    'Local fixture only; not a real address', now() + interval '1 day'
  );

  insert into public.deal_shipments (deal_id, carrier, tracking_number)
  values (accepted_deal_id, 'Synthetic carrier', 'LOCAL-FIXTURE-ONLY');

  insert into public.ratings (deal_id, author_id, subject_id, stars, comment)
  values (completed_deal_id, buyer_id, seller_id, 5,
    'Synthetic local-only policy fixture.');

  insert into public.audit_events (deal_id, actor_id, event_type, metadata)
  values (accepted_deal_id, seller_id, 'local_fixture_created',
    '{"synthetic":true,"local_only":true}'::jsonb);

  insert into public.protected_payments (
    deal_id, buyer_id, seller_id, seller_stripe_account_id,
    item_amount_cents, platform_fee_cents, seller_amount_cents,
    currency, status, transfer_group, agreement_version,
    fee_bps, fee_version, checkout_attempt
  ) values (
    accepted_deal_id, buyer_id, seller_id, seller_account,
    10000, 300, 9700, 'USD', 'checkout_created', 'DLV_LOCAL_FIXTURE_ONLY',
    1, 300, 'local_fixture_v1', 1
  );

  insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
  ) values
    ('deal-evidence', 'deal-evidence', false, 52428800,
      array['image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
    ('deal-evidence-quarantine', 'deal-evidence-quarantine', false, 52428800,
      array['image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

  maintenance_secret := encode(extensions.gen_random_bytes(32), 'hex');
  perform vault.create_secret(
    maintenance_secret,
    'dealivra_evidence_maintenance_secret',
    'Synthetic disposable-local SQL fixture; never a hosted credential.'
  );
  insert into dealsafe_private.evidence_maintenance_settings (
    singleton, secret_sha256, project_url, worker_enabled
  ) values (
    true, encode(extensions.digest(maintenance_secret, 'sha256'), 'hex'),
    fixture_project_url, true
  );

  -- No worker/network command is copied from a hosted migration. New jobs
  -- remain invisible to other sessions until commit, when both are inactive.
  inventory_job_id := cron.schedule(
    'dealivra-evidence-lifecycle-inventory', '0 0 1 1 *', 'select 1'
  );
  worker_job_id := cron.schedule(
    'dealivra-evidence-maintenance-worker', '0 0 1 1 *', 'select 1'
  );
  perform cron.alter_job(job_id := inventory_job_id, active := false);
  perform cron.alter_job(job_id := worker_job_id, active := false);

  if (select count(*) from cron.job) <> 2
     or exists (select 1 from cron.job where active or command <> 'select 1')
     or exists (select 1 from public.evidence_lifecycle_jobs)
     or not coalesce(
       dealsafe_private.is_evidence_maintenance_secret_valid(maintenance_secret),
       false
     ) then
    raise exception 'Local maintenance fixtures failed their isolated safety boundary';
  end if;

  if (select count(*) from auth.users) <> 4
     or exists (select 1 from auth.users where encrypted_password <> '')
     or exists (select 1 from auth.sessions)
     or exists (select 1 from auth.identities)
     or exists (select 1 from auth.mfa_factors)
     or (select count(*) from public.profiles) <> 4
     or (select count(*) from public.deals) <> 2
     or (select count(*) from public.deal_evidence) <> 1
     or exists (select 1 from public.evidence_integrity_events)
     or exists (select 1 from storage.objects) then
    raise exception 'Local synthetic fixture inventory failed';
  end if;

  -- Role settings are not schema data and may be absent after a schema-only
  -- baseline restore. Set only this reviewed LOCAL pre-request hook; do not
  -- create/replace functions, change grants/RLS, or send reload notifications.
  if not exists (
    select 1 from pg_roles role_record
    cross join lateral unnest(coalesce(role_record.rolconfig, array[]::text[])) setting
    where role_record.rolname = 'authenticator'
      and setting = 'pgrst.db_pre_request=public.enforce_active_auth_session'
  ) then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.enforce_active_auth_session''';
  end if;

  maintenance_secret := null;
end
$create_local_synthetic_fixtures$;

commit;
