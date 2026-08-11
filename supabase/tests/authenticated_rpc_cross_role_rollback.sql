-- Rollback-only DAT-004 signed-in RPC authorization evidence.
-- This suite is safe to execute against production: it changes only
-- transaction-local role/JWT settings and always rolls back.

begin;

do $dat_004_authenticated_inventory$
declare
  expected_signatures constant text[] := array[
    'accept_deal(text,text,text)',
    'ask_deal_question(text,text)',
    'assert_my_sensitive_change_allowed(text)',
    'can_admin_read_deal_evidence(uuid)',
    'cancel_deal(uuid,text)',
    'claim_support_case(text)',
    'complete_handoff(uuid,text)',
    'configure_buyer_access_code(uuid,boolean)',
    'confirm_meeting(uuid)',
    'confirm_shipment_delivery(uuid)',
    'create_deal_shipment(uuid,text,text)',
    'create_support_case(uuid,text,text,text)',
    'current_user_app_role()',
    'generate_handoff_pin(uuid)',
    'get_admin_catalog_adoption(integer)',
    'get_admin_disputes(text)',
    'get_admin_reports(text)',
    'get_admin_revenue_summary()',
    'get_admin_revenue_transactions(integer)',
    'get_deal_action_plan(uuid)',
    'get_deal_delivery_details(uuid)',
    'get_deal_inquiries(uuid)',
    'get_deal_inspection(uuid)',
    'get_deal_messages(uuid)',
    'get_deal_offers(uuid)',
    'get_deal_participants(uuid)',
    'get_deal_payment_record(uuid)',
    'get_deal_timeline(uuid)',
    'get_my_account_sessions()',
    'get_my_notifications(integer)',
    'get_my_profile_summary()',
    'get_my_saved_deals()',
    'get_my_sensitive_change_holds()',
    'get_my_stripe_connect_status()',
    'get_my_support_cases()',
    'get_my_trust_passport_settings()',
    'get_privileged_mfa_recovery_cases(text)',
    'get_protected_payment_status(uuid)',
    'get_seller_shipping_evidence_readiness(uuid)',
    'get_support_case(text)',
    'get_support_queue(text)',
    'is_current_auth_session_active()',
    'is_current_user_deal_seller(uuid)',
    'is_deal_saved(text)',
    'is_dealsafe_admin()',
    'make_deal_offer(text,bigint,text)',
    'mark_all_activity_read()',
    'mark_arrived(uuid)',
    'mark_deal_activity_read(uuid)',
    'open_deal_dispute(uuid,text)',
    'open_privileged_mfa_recovery_case(uuid,text,text,text)',
    'propose_meeting(uuid,text,text,timestamp with time zone)',
    'publish_deal_with_seller_declarations(uuid,text,text,bigint,text,text,text,text,integer)',
    'record_deal_inspection(uuid,boolean,boolean,boolean,boolean)',
    'record_privileged_recovery_identity_proof(uuid,text,text)',
    'renew_deal_link(uuid,integer)',
    'reorder_deal_media(uuid,text[])',
    'reply_deal_inquiry(uuid,text)',
    'reply_support_case(text,text)',
    'report_public_deal(text,text,text)',
    'request_identity_verification()',
    'resolve_deal_dispute(uuid,text,text)',
    'resolve_deal_report(uuid,text,text)',
    'resolve_support_case(text,text)',
    'respond_to_offer(uuid,boolean)',
    'review_privileged_mfa_recovery_case(uuid,text,text)',
    'send_deal_message(uuid,text)',
    'set_deal_delivery_details(uuid,text,text,text,text)',
    'set_deal_moderation_status(uuid,text,text)',
    'set_deal_saved(text,boolean)',
    'set_trust_passport_enabled(boolean)',
    'submit_rating(uuid,smallint,text)',
    'update_published_deal(uuid,text,text,bigint,text,text)'
  ];
  actual_signatures text[];
begin
  select coalesce(
    array_agg(
      function_record.oid::regprocedure::text
      order by function_record.oid::regprocedure::text
    ),
    array[]::text[]
  )
  into actual_signatures
  from pg_proc function_record
  join pg_namespace namespace_record
    on namespace_record.oid = function_record.pronamespace
  where namespace_record.nspname = 'public'
    and function_record.prosecdef
    and has_function_privilege('authenticated', function_record.oid, 'execute')
    and not has_function_privilege('anon', function_record.oid, 'execute');

  if actual_signatures is distinct from expected_signatures then
    raise exception
      'DAT-004 signed-in SECURITY DEFINER inventory changed: %',
      actual_signatures;
  end if;

  if exists (
    select 1
    from pg_proc function_record
    where function_record.oid::regprocedure::text = any(expected_signatures)
      and (
        has_function_privilege('public', function_record.oid, 'execute')
        or has_function_privilege('anon', function_record.oid, 'execute')
        or not has_function_privilege('authenticated', function_record.oid, 'execute')
        or not has_function_privilege('service_role', function_record.oid, 'execute')
        or not exists (
          select 1
          from unnest(coalesce(function_record.proconfig, array[]::text[])) setting
          where setting like 'search_path=%'
        )
      )
  ) then
    raise exception 'DAT-004 signed-in function grants or search paths are not exact';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    where function_record.oid::regprocedure::text = any(expected_signatures)
      and position('auth.uid()' in lower(pg_get_functiondef(function_record.oid))) = 0
      and position(
        'is_dealsafe_admin()'
        in lower(pg_get_functiondef(function_record.oid))
      ) = 0
      and position(
        'dealsafe_private.require_security_operator'
        in lower(pg_get_functiondef(function_record.oid))
      ) = 0
  ) then
    raise exception 'DAT-004 signed-in function lacks a reviewed identity boundary';
  end if;
end
$dat_004_authenticated_inventory$;

do $dat_004_context$
declare
  admin_id uuid;
  member_id uuid;
  target_deal_id uuid;
  seller_id uuid;
  buyer_id uuid;
  outsider_id uuid;
begin
  select profile.id
  into admin_id
  from public.profiles profile
  where profile.app_role = 'admin'
  order by profile.created_at
  limit 1;

  select profile.id
  into member_id
  from public.profiles profile
  where profile.app_role <> 'admin'
  order by profile.created_at
  limit 1;

  select candidate.id, candidate.seller_id, candidate.buyer_id, candidate.outsider_id
  into target_deal_id, seller_id, buyer_id, outsider_id
  from (
    select
      deal.id,
      deal.seller_id,
      deal.buyer_id,
      outsider.id as outsider_id
    from public.deals deal
    join lateral (
      select profile.id
      from public.profiles profile
      where profile.app_role <> 'admin'
        and profile.id not in (deal.seller_id, deal.buyer_id)
        and not exists (
          select 1
          from public.deal_inquiries inquiry
          where inquiry.deal_id = deal.id
            and inquiry.buyer_id = profile.id
        )
        and not exists (
          select 1
          from public.deal_offers offer
          where offer.deal_id = deal.id
            and offer.buyer_id = profile.id
        )
      order by profile.created_at
      limit 1
    ) outsider on true
    where deal.buyer_id is not null
      and deal.status in ('accepted', 'completed', 'disputed', 'cancelled')
    order by deal.created_at desc
    limit 1
  ) candidate;

  if admin_id is null
     or member_id is null
     or target_deal_id is null
     or seller_id is null
     or buyer_id is null
     or outsider_id is null then
    admin_id := gen_random_uuid();
    seller_id := gen_random_uuid();
    buyer_id := gen_random_uuid();
    outsider_id := gen_random_uuid();
    member_id := outsider_id;

    insert into auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values
      (
        admin_id,
        'authenticated',
        'authenticated',
        'dat004-admin-' || admin_id::text || '@example.invalid',
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"DAT-004 Admin"}'::jsonb,
        now(),
        now()
      ),
      (
        seller_id,
        'authenticated',
        'authenticated',
        'dat004-seller-' || seller_id::text || '@example.invalid',
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"DAT-004 Seller"}'::jsonb,
        now(),
        now()
      ),
      (
        buyer_id,
        'authenticated',
        'authenticated',
        'dat004-buyer-' || buyer_id::text || '@example.invalid',
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"DAT-004 Buyer"}'::jsonb,
        now(),
        now()
      ),
      (
        outsider_id,
        'authenticated',
        'authenticated',
        'dat004-outsider-' || outsider_id::text || '@example.invalid',
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"DAT-004 Outsider"}'::jsonb,
        now(),
        now()
      );

    insert into public.profiles (id, display_name, app_role)
    values
      (admin_id, 'DAT-004 Admin', 'admin'),
      (seller_id, 'DAT-004 Seller', 'member'),
      (buyer_id, 'DAT-004 Buyer', 'member'),
      (outsider_id, 'DAT-004 Outsider', 'member')
    on conflict (id) do update
      set display_name = excluded.display_name,
          app_role = excluded.app_role;

    insert into public.deals (
      seller_id,
      buyer_id,
      title,
      description,
      price_cents,
      condition,
      delivery_method,
      status,
      published_at
    )
    values (
      seller_id,
      buyer_id,
      'DAT-004 authorization fixture',
      'Rollback-only participant authorization fixture.',
      10000,
      'good',
      'shipping',
      'accepted',
      now()
    )
    returning id into target_deal_id;
  end if;

  perform set_config('dat004.admin_id', admin_id::text, true);
  perform set_config('dat004.member_id', member_id::text, true);
  perform set_config('dat004.deal_id', target_deal_id::text, true);
  perform set_config('dat004.seller_id', seller_id::text, true);
  perform set_config('dat004.buyer_id', buyer_id::text, true);
  perform set_config('dat004.outsider_id', outsider_id::text, true);
end
$dat_004_context$;

set local role authenticated;

do $dat_004_admin_matrix$
declare
  admin_id uuid := current_setting('dat004.admin_id')::uuid;
  member_id uuid := current_setting('dat004.member_id')::uuid;
  expected_denial constant text := 'Admin access required';
begin
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', member_id, 'role', 'authenticated')::text,
    true
  );

  if auth.uid() is distinct from member_id or public.is_dealsafe_admin() then
    raise exception 'DAT-004 ordinary-member JWT context is invalid';
  end if;

  begin
    perform public.get_admin_catalog_adoption(30);
    raise exception 'DAT-004 member unexpectedly read catalog adoption';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly read catalog adoption'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.get_admin_disputes('all');
    raise exception 'DAT-004 member unexpectedly read disputes';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly read disputes'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.get_admin_reports('all');
    raise exception 'DAT-004 member unexpectedly read reports';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly read reports'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.get_admin_revenue_summary();
    raise exception 'DAT-004 member unexpectedly read revenue summary';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly read revenue summary'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.get_admin_revenue_transactions(10);
    raise exception 'DAT-004 member unexpectedly read revenue transactions';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly read revenue transactions'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.resolve_deal_dispute(
      '00000000-0000-0000-0000-000000000000',
      'cancelled',
      'Authorization matrix'
    );
    raise exception 'DAT-004 member unexpectedly resolved a dispute';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly resolved a dispute'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.resolve_deal_report(
      '00000000-0000-0000-0000-000000000000',
      'dismissed',
      'Authorization matrix'
    );
    raise exception 'DAT-004 member unexpectedly resolved a report';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly resolved a report'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  begin
    perform public.set_deal_moderation_status(
      '00000000-0000-0000-0000-000000000000',
      'hidden',
      'Authorization matrix'
    );
    raise exception 'DAT-004 member unexpectedly moderated a deal';
  exception when others then
    if sqlerrm = 'DAT-004 member unexpectedly moderated a deal'
       or sqlerrm <> expected_denial then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text,
    true
  );

  if auth.uid() is distinct from admin_id or not public.is_dealsafe_admin() then
    raise exception 'DAT-004 administrator JWT context is invalid';
  end if;

  perform public.get_admin_catalog_adoption(30);
  perform public.get_admin_disputes('all');
  perform public.get_admin_reports('all');
  perform public.get_admin_revenue_summary();
  perform public.get_admin_revenue_transactions(10);

  begin
    perform public.resolve_deal_dispute(
      '00000000-0000-0000-0000-000000000000',
      'cancelled',
      'Authorization matrix'
    );
    raise exception 'DAT-004 admin dispute not-found guard was bypassed';
  exception when others then
    if sqlerrm = 'DAT-004 admin dispute not-found guard was bypassed'
       or sqlerrm <> 'Open dispute was not found' then
      raise;
    end if;
  end;

  begin
    perform public.resolve_deal_report(
      '00000000-0000-0000-0000-000000000000',
      'dismissed',
      'Authorization matrix'
    );
    raise exception 'DAT-004 admin report not-found guard was bypassed';
  exception when others then
    if sqlerrm = 'DAT-004 admin report not-found guard was bypassed'
       or sqlerrm <> 'Open report was not found' then
      raise;
    end if;
  end;

  begin
    perform public.set_deal_moderation_status(
      '00000000-0000-0000-0000-000000000000',
      'hidden',
      'Authorization matrix'
    );
    raise exception 'DAT-004 admin deal not-found guard was bypassed';
  exception when others then
    if sqlerrm = 'DAT-004 admin deal not-found guard was bypassed'
       or sqlerrm <> 'Deal not found' then
      raise;
    end if;
  end;
end
$dat_004_admin_matrix$;

do $dat_004_participant_matrix$
declare
  target_deal_id uuid := current_setting('dat004.deal_id')::uuid;
  seller_id uuid := current_setting('dat004.seller_id')::uuid;
  buyer_id uuid := current_setting('dat004.buyer_id')::uuid;
  outsider_id uuid := current_setting('dat004.outsider_id')::uuid;
begin
  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', outsider_id, 'role', 'authenticated')::text,
    true
  );

  if auth.uid() is distinct from outsider_id then
    raise exception 'DAT-004 outsider JWT context is invalid';
  end if;

  if exists(select 1 from public.get_deal_action_plan(target_deal_id))
     or exists(select 1 from public.get_deal_delivery_details(target_deal_id))
     or exists(select 1 from public.get_deal_inquiries(target_deal_id))
     or exists(select 1 from public.get_deal_messages(target_deal_id))
     or exists(select 1 from public.get_deal_offers(target_deal_id))
     or exists(select 1 from public.get_deal_participants(target_deal_id))
     or exists(select 1 from public.get_deal_payment_record(target_deal_id))
     or exists(select 1 from public.get_deal_timeline(target_deal_id))
     or exists(select 1 from public.get_protected_payment_status(target_deal_id))
     or exists(
       select 1
       from public.get_seller_shipping_evidence_readiness(target_deal_id)
     )
     or public.is_current_user_deal_seller(target_deal_id) then
    raise exception 'DAT-004 outsider read a participant-only deal record';
  end if;

  begin
    perform public.get_deal_inspection(target_deal_id);
    raise exception 'DAT-004 outsider unexpectedly read the inspection';
  exception when others then
    if sqlerrm = 'DAT-004 outsider unexpectedly read the inspection'
       or sqlerrm <> 'Not a deal participant' then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', seller_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', seller_id, 'role', 'authenticated')::text,
    true
  );

  if not exists(select 1 from public.get_deal_participants(target_deal_id))
     or not exists(select 1 from public.get_deal_action_plan(target_deal_id))
     or not public.is_current_user_deal_seller(target_deal_id) then
    raise exception 'DAT-004 seller positive access path failed';
  end if;

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', buyer_id, 'role', 'authenticated')::text,
    true
  );

  if not exists(select 1 from public.get_deal_participants(target_deal_id))
     or not exists(select 1 from public.get_deal_action_plan(target_deal_id))
     or public.is_current_user_deal_seller(target_deal_id) then
    raise exception 'DAT-004 buyer positive access path failed';
  end if;
end
$dat_004_participant_matrix$;

rollback;
