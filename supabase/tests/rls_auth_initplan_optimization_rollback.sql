-- Rollback-only DBP-001 RLS performance and authorization proof.
-- Safe for production: test writes and JWT/role settings are transaction-local.

begin;

do $dbp_001_policy_inventory$
declare
  expected_policies constant text[] := array[
    'deal_disputes.participants read deal disputes.SELECT',
    'deal_evidence.participants and case admins read safe evidence.SELECT',
    'deal_media.participants read media records.SELECT',
    'deal_media.seller deletes media records.DELETE',
    'deal_media.seller inserts media records.INSERT',
    'deal_meetings.participants read meetings.SELECT',
    'deal_messages.participants read messages.SELECT',
    'deal_shipments.participants read shipments.SELECT',
    'ratings.participants read ratings.SELECT'
  ];
  actual_policies text[];
begin
  select coalesce(
    array_agg(
      policy.tablename || '.' || policy.policyname || '.' || policy.cmd
      order by policy.tablename, policy.policyname, policy.cmd
    ),
    array[]::text[]
  )
  into actual_policies
  from pg_policies policy
  where policy.schemaname = 'public'
    and (
      (policy.tablename = 'deal_disputes'
        and policy.policyname = 'participants read deal disputes')
      or (policy.tablename = 'deal_evidence'
        and policy.policyname =
          'participants and case admins read safe evidence')
      or (policy.tablename = 'deal_media'
        and policy.policyname in (
          'participants read media records',
          'seller deletes media records',
          'seller inserts media records'
        ))
      or (policy.tablename = 'deal_meetings'
        and policy.policyname = 'participants read meetings')
      or (policy.tablename = 'deal_messages'
        and policy.policyname = 'participants read messages')
      or (policy.tablename = 'deal_shipments'
        and policy.policyname = 'participants read shipments')
      or (policy.tablename = 'ratings'
        and policy.policyname = 'participants read ratings')
    );

  if actual_policies is distinct from expected_policies then
    raise exception 'DBP-001 governed RLS policy inventory changed: %', actual_policies;
  end if;

  if exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and (
        policy.tablename || '.' || policy.policyname || '.' || policy.cmd
      ) = any(expected_policies)
      and (
        policy.permissive <> 'PERMISSIVE'
        or policy.roles is distinct from array['authenticated']::name[]
        or position(
          'SELECT auth.uid() AS uid'
          in coalesce(policy.qual, '') || coalesce(policy.with_check, '')
        ) = 0
      )
  ) then
    raise exception 'DBP-001 RLS role, command, or Auth InitPlan boundary changed';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'deal_evidence'
      and policy.policyname =
        'participants and case admins read safe evidence'
      and position(
        'SELECT is_dealsafe_admin() AS is_dealsafe_admin'
        in coalesce(policy.qual, '')
      ) > 0
  ) then
    raise exception 'DBP-001 administrator evidence InitPlan boundary changed';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.deal_messages',
    'select'
  ) then
    raise exception 'DBP-001 RPC-only message table gained direct SELECT access';
  end if;
end
$dbp_001_policy_inventory$;

do $dbp_001_context$
declare
  target_table text;
  target_deal_id uuid;
  seller_id uuid;
  buyer_id uuid;
  outsider_id uuid;
begin
  foreach target_table in array array[
    'deal_disputes',
    'deal_evidence',
    'deal_media',
    'deal_meetings',
    'deal_shipments',
    'ratings'
  ]
  loop
    execute format(
      'select deal.id, deal.seller_id, deal.buyer_id, outsider.id
         from public.%I row_record
         join public.deals deal on deal.id = row_record.deal_id
         join lateral (
           select profile.id
           from public.profiles profile
           where profile.app_role <> ''admin''
             and profile.id not in (deal.seller_id, deal.buyer_id)
           order by profile.created_at
           limit 1
         ) outsider on true
        where deal.buyer_id is not null
        order by deal.created_at desc
        limit 1',
      target_table
    )
    into target_deal_id, seller_id, buyer_id, outsider_id;

    if target_deal_id is null
       or seller_id is null
       or buyer_id is null
       or outsider_id is null then
      raise exception 'DBP-001 missing production fixture for %', target_table;
    end if;

    perform set_config(
      'dbp_001.' || target_table || '.deal_id',
      target_deal_id::text,
      true
    );
    perform set_config(
      'dbp_001.' || target_table || '.seller_id',
      seller_id::text,
      true
    );
    perform set_config(
      'dbp_001.' || target_table || '.buyer_id',
      buyer_id::text,
      true
    );
    perform set_config(
      'dbp_001.' || target_table || '.outsider_id',
      outsider_id::text,
      true
    );
  end loop;
end
$dbp_001_context$;

set local role authenticated;

do $dbp_001_read_matrix$
declare
  target_table text;
  target_deal_id uuid;
  seller_id uuid;
  buyer_id uuid;
  outsider_id uuid;
  row_visible boolean;
begin
  foreach target_table in array array[
    'deal_disputes',
    'deal_evidence',
    'deal_media',
    'deal_meetings',
    'deal_shipments',
    'ratings'
  ]
  loop
    target_deal_id := current_setting(
      'dbp_001.' || target_table || '.deal_id'
    )::uuid;
    seller_id := current_setting(
      'dbp_001.' || target_table || '.seller_id'
    )::uuid;
    buyer_id := current_setting(
      'dbp_001.' || target_table || '.buyer_id'
    )::uuid;
    outsider_id := current_setting(
      'dbp_001.' || target_table || '.outsider_id'
    )::uuid;

    perform set_config('request.jwt.claim.sub', seller_id::text, true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', seller_id, 'role', 'authenticated')::text,
      true
    );
    execute format(
      'select exists(select 1 from public.%I where deal_id = $1)',
      target_table
    )
    into row_visible
    using target_deal_id;
    if not row_visible then
      raise exception 'DBP-001 seller lost RLS read access to %', target_table;
    end if;

    perform set_config('request.jwt.claim.sub', buyer_id::text, true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', buyer_id, 'role', 'authenticated')::text,
      true
    );
    execute format(
      'select exists(select 1 from public.%I where deal_id = $1)',
      target_table
    )
    into row_visible
    using target_deal_id;
    if not row_visible then
      raise exception 'DBP-001 buyer lost RLS read access to %', target_table;
    end if;

    perform set_config('request.jwt.claim.sub', outsider_id::text, true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', outsider_id, 'role', 'authenticated')::text,
      true
    );
    execute format(
      'select exists(select 1 from public.%I where deal_id = $1)',
      target_table
    )
    into row_visible
    using target_deal_id;
    if row_visible then
      raise exception 'DBP-001 outsider gained RLS read access to %', target_table;
    end if;
  end loop;
end
$dbp_001_read_matrix$;

do $dbp_001_write_matrix$
declare
  media_deal_id uuid := current_setting('dbp_001.deal_media.deal_id')::uuid;
  media_seller_id uuid := current_setting('dbp_001.deal_media.seller_id')::uuid;
  media_outsider_id uuid := current_setting(
    'dbp_001.deal_media.outsider_id'
  )::uuid;
  media_id uuid;
  affected_rows integer;
begin
  perform set_config('request.jwt.claim.sub', media_seller_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', media_seller_id, 'role', 'authenticated')::text,
    true
  );
  insert into public.deal_media(deal_id, storage_path, sort_order)
  values(media_deal_id, 'dbp-001/seller-positive.jpg', 2147483001)
  returning id into media_id;

  perform set_config('request.jwt.claim.sub', media_outsider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', media_outsider_id, 'role', 'authenticated')::text,
    true
  );
  begin
    insert into public.deal_media(deal_id, storage_path, sort_order)
    values(media_deal_id, 'dbp-001/outsider-denied.jpg', 2147483002);
    raise exception 'DBP-001 outsider inserted a media record';
  exception when insufficient_privilege then
    null;
  end;

  delete from public.deal_media where id = media_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'DBP-001 outsider deleted a seller media record';
  end if;

  perform set_config('request.jwt.claim.sub', media_seller_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', media_seller_id, 'role', 'authenticated')::text,
    true
  );
  delete from public.deal_media where id = media_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'DBP-001 seller lost media delete access';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.deal_evidence',
    'INSERT'
  ) then
    raise exception 'DBP-001 browser evidence INSERT was restored';
  end if;
end
$dbp_001_write_matrix$;

rollback;
