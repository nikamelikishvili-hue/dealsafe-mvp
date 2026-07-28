-- Rollback-only release evidence for PAY-003.
-- Execute only inside a transaction after stripe_trusted_payment_commands.sql.

do $$
declare
  v_seller_id uuid;
  v_buyer_id uuid;
  v_admin_id uuid;
  v_member_id uuid;
  v_seller_account text;
  v_deal_id uuid;
  v_payment_id uuid;
  v_agreement_id uuid;
  v_dispute_id uuid;
  v_result jsonb;
  v_result_two jsonb;
  v_command_id uuid;
  v_token uuid;
  v_old_token uuid;
  v_status text;
  v_dispute_status text;
  v_deal_status text;
  v_count integer;
begin
  select payment.seller_id, payment.buyer_id, payment.seller_stripe_account_id
  into v_seller_id, v_buyer_id, v_seller_account
  from public.protected_payments payment
  join public.profiles seller on seller.id = payment.seller_id
  where seller.stripe_account_id = payment.seller_stripe_account_id
    and seller.stripe_details_submitted
    and seller.stripe_payouts_enabled
    and seller.stripe_transfers_active
  limit 1;

  select id into v_admin_id
  from public.profiles
  where app_role = 'admin' and is_admin
  limit 1;

  select id into v_member_id
  from public.profiles
  where app_role = 'member'
    and not is_admin
    and id <> v_buyer_id
  limit 1;

  if v_seller_id is null
     or v_buyer_id is null
     or v_admin_id is null
     or v_member_id is null
     or v_seller_account is null then
    raise exception 'PAY-003 test fixtures are unavailable';
  end if;

  if has_table_privilege('anon', 'public.stripe_financial_commands', 'select')
     or has_table_privilege('authenticated', 'public.stripe_financial_commands', 'select')
     or not has_table_privilege('service_role', 'public.stripe_financial_commands', 'select') then
    raise exception 'financial command ledger grants are not deny-by-default';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.prepare_stripe_financial_command(uuid,uuid,text,uuid,integer)',
       'execute'
     ) then
    raise exception 'financial transition RPC is exposed to authenticated clients';
  end if;

  -- Checkout reservation freezes the accepted agreement, amount, fee, and seller account.
  insert into public.deals (
    seller_id, buyer_id, title, description, price_cents, currency,
    condition, delivery_method, status, current_agreement_version
  )
  values (
    v_seller_id, v_buyer_id, 'PAY-003 checkout test',
    'Rollback-only trusted checkout reservation.', 12500, 'USD',
    'Good', 'Ship to buyer', 'accepted', 1
  )
  returning id into v_deal_id;

  insert into public.agreement_versions (
    deal_id, version, terms_json, content_hash, created_by
  )
  values (
    v_deal_id,
    1,
    jsonb_build_object('title', 'PAY-003 checkout test', 'price_cents', 12500, 'currency', 'USD'),
    repeat('a', 64),
    v_seller_id
  )
  on conflict (deal_id, version) do update
  set terms_json = excluded.terms_json,
      content_hash = excluded.content_hash
  returning id into v_agreement_id;

  insert into public.agreement_acceptances (
    agreement_version_id, signer_id, typed_name, consent_text
  )
  values
    (v_agreement_id, v_seller_id, 'Seller', 'Rollback-only seller acceptance.'),
    (v_agreement_id, v_buyer_id, 'Buyer', 'Rollback-only buyer acceptance.')
  on conflict (agreement_version_id, signer_id) do nothing;

  v_result := public.prepare_stripe_checkout(
    v_deal_id, v_buyer_id, 300, 'sandbox_test_v1', 5000000
  );
  if v_result ->> 'disposition' <> 'claimed' then
    raise exception 'checkout reservation was not claimed';
  end if;
  v_payment_id := (v_result ->> 'paymentId')::uuid;
  v_command_id := (v_result ->> 'commandId')::uuid;
  v_token := (v_result ->> 'claimToken')::uuid;

  v_result_two := public.prepare_stripe_checkout(
    v_deal_id, v_buyer_id, 300, 'sandbox_test_v1', 5000000
  );
  if v_result_two ->> 'disposition' <> 'in_progress' then
    raise exception 'concurrent checkout reservation was not fenced';
  end if;

  begin
    perform public.prepare_stripe_checkout(
      v_deal_id, v_member_id, 300, 'sandbox_test_v1', 5000000
    );
    raise exception 'wrong checkout buyer was accepted';
  exception when insufficient_privilege then
    null;
  end;

  if not public.attach_stripe_checkout_session(
    v_command_id,
    v_token,
    'cs_test_PAY003_checkout_12345678',
    null,
    'https://checkout.stripe.com/c/pay/PAY003',
    now() + interval '30 minutes'
  ) then
    raise exception 'checkout session was not attached';
  end if;

  select status into v_status
  from public.stripe_financial_commands
  where id = v_command_id;
  if v_status <> 'succeeded' then
    raise exception 'checkout command did not succeed';
  end if;

  v_result_two := public.prepare_stripe_checkout(
    v_deal_id, v_buyer_id, 300, 'sandbox_test_v1', 5000000
  );
  if v_result_two ->> 'disposition' <> 'reused' then
    raise exception 'valid hosted Checkout was not reused';
  end if;

  select count(*) into v_count
  from public.audit_events
  where deal_id = v_deal_id and event_type = 'payment_checkout_created';
  if v_count <> 1 then
    raise exception 'checkout audit was not exactly once';
  end if;

  update public.deals set price_cents = 12600 where id = v_deal_id;
  begin
    perform public.prepare_stripe_checkout(
      v_deal_id, v_buyer_id, 300, 'sandbox_test_v1', 5000000
    );
    raise exception 'changed amount reused an immutable checkout';
  exception when integrity_constraint_violation then
    null;
  end;

  -- Manual release is admin-only, fenced, retry-safe, and auditable.
  insert into public.deals (
    seller_id, buyer_id, title, description, price_cents, currency,
    condition, delivery_method, status, current_agreement_version
  )
  values (
    v_seller_id, v_buyer_id, 'PAY-003 release test',
    'Rollback-only trusted seller release.', 22000, 'USD',
    'Good', 'Ship to buyer', 'completed', 1
  )
  returning id into v_deal_id;

  insert into public.protected_payments (
    deal_id, buyer_id, seller_id, seller_stripe_account_id,
    item_amount_cents, platform_fee_cents, seller_amount_cents,
    currency, status, payment_intent_id, charge_id, transfer_group,
    agreement_version, fee_bps, fee_version, checkout_attempt
  )
  values (
    v_deal_id, v_buyer_id, v_seller_id, v_seller_account,
    22000, 1000, 21000, 'USD', 'funds_secured',
    'pi_PAY003_release_12345678', 'ch_PAY003_release_12345678',
    'DLV_' || replace(v_deal_id::text, '-', ''), 1, 455, 'sandbox_test_v1', 1
  )
  returning id into v_payment_id;

  begin
    perform public.prepare_stripe_financial_command(
      v_deal_id, null, 'release', v_member_id, 300
    );
    raise exception 'non-admin release was accepted';
  exception when insufficient_privilege then
    null;
  end;

  v_result := public.prepare_stripe_financial_command(
    v_deal_id, null, 'release', v_admin_id, 300
  );
  if v_result ->> 'disposition' <> 'claimed'
     or (v_result ->> 'amountCents')::bigint <> 21000 then
    raise exception 'manual release snapshot was not claimed';
  end if;
  v_command_id := (v_result ->> 'commandId')::uuid;
  v_token := (v_result ->> 'claimToken')::uuid;

  v_result_two := public.prepare_stripe_financial_command(
    v_deal_id, null, 'release', v_admin_id, 300
  );
  if v_result_two ->> 'disposition' <> 'in_progress' then
    raise exception 'concurrent release was not fenced';
  end if;

  if not public.fail_stripe_financial_command(
    v_command_id, v_token, 'provider_verification_failed'
  ) then
    raise exception 'release failure was not recorded';
  end if;
  select status into v_status from public.protected_payments where id = v_payment_id;
  if v_status <> 'release_failed' then
    raise exception 'failed release did not enter the safe retry state';
  end if;

  v_old_token := v_token;
  v_result := public.prepare_stripe_financial_command(
    v_deal_id, null, 'release', v_admin_id, 300
  );
  v_token := (v_result ->> 'claimToken')::uuid;
  if v_result ->> 'disposition' <> 'claimed' or v_token = v_old_token then
    raise exception 'failed command was not reclaimed with a new fence';
  end if;

  begin
    perform public.finalize_stripe_financial_command(
      v_command_id, v_old_token, 'tr_PAY003_old_fence_12345678', null
    );
    raise exception 'stale release worker finalized the payment';
  exception when serialization_failure then
    null;
  end;

  v_result := public.finalize_stripe_financial_command(
    v_command_id, v_token, 'tr_PAY003_release_12345678', null
  );
  if not (v_result ->> 'resolved')::boolean then
    raise exception 'release was not finalized';
  end if;
  select status into v_status from public.protected_payments where id = v_payment_id;
  if v_status <> 'released' then
    raise exception 'payment did not reach released';
  end if;
  select count(*) into v_count
  from public.audit_events
  where deal_id = v_deal_id and event_type = 'payment_released';
  if v_count <> 1 then
    raise exception 'release audit was not exactly once';
  end if;

  -- Amount, currency, account, and state mismatches fail before a command is created.
  insert into public.deals (
    seller_id, buyer_id, title, description, price_cents, currency,
    condition, delivery_method, status, current_agreement_version
  )
  values (
    v_seller_id, v_buyer_id, 'PAY-003 mismatch test',
    'Rollback-only mismatch rejection.', 33000, 'USD',
    'Good', 'Ship to buyer', 'completed', 1
  )
  returning id into v_deal_id;

  insert into public.protected_payments (
    deal_id, buyer_id, seller_id, seller_stripe_account_id,
    item_amount_cents, platform_fee_cents, seller_amount_cents,
    currency, status, payment_intent_id, charge_id, transfer_group,
    agreement_version, fee_bps, fee_version, checkout_attempt
  )
  values (
    v_deal_id, v_buyer_id, v_seller_id, v_seller_account,
    33001, 1, 33000, 'USD', 'funds_secured',
    'pi_PAY003_mismatch_12345678', 'ch_PAY003_mismatch_12345678',
    'DLV_' || replace(v_deal_id::text, '-', ''), 1, 1, 'sandbox_test_v1', 1
  )
  returning id into v_payment_id;

  begin
    perform public.prepare_stripe_financial_command(
      v_deal_id, null, 'release', v_admin_id, 300
    );
    raise exception 'amount mismatch was accepted';
  exception when integrity_constraint_violation then
    null;
  end;

  update public.protected_payments
  set item_amount_cents = 33000,
      platform_fee_cents = 0,
      seller_amount_cents = 33000,
      currency = 'EUR'
  where id = v_payment_id;
  begin
    perform public.prepare_stripe_financial_command(
      v_deal_id, null, 'release', v_admin_id, 300
    );
    raise exception 'currency mismatch was accepted';
  exception when integrity_constraint_violation then
    null;
  end;

  update public.protected_payments
  set currency = 'USD',
      seller_stripe_account_id = 'acct_PAY003_mismatch_12345678'
  where id = v_payment_id;
  begin
    perform public.prepare_stripe_financial_command(
      v_deal_id, null, 'release', v_admin_id, 300
    );
    raise exception 'seller account mismatch was accepted';
  exception when integrity_constraint_violation then
    null;
  end;

  update public.protected_payments
  set seller_stripe_account_id = v_seller_account,
      status = 'checkout_created'
  where id = v_payment_id;
  begin
    perform public.prepare_stripe_financial_command(
      v_deal_id, null, 'release', v_admin_id, 300
    );
    raise exception 'illegal payment transition was accepted';
  exception when integrity_constraint_violation then
    null;
  end;

  -- Refund failure restores disputed state; a fenced retry resolves all records atomically.
  insert into public.deals (
    seller_id, buyer_id, title, description, price_cents, currency,
    condition, delivery_method, status, current_agreement_version
  )
  values (
    v_seller_id, v_buyer_id, 'PAY-003 refund test',
    'Rollback-only trusted dispute refund.', 44000, 'USD',
    'Good', 'Ship to buyer', 'disputed', 1
  )
  returning id into v_deal_id;

  insert into public.protected_payments (
    deal_id, buyer_id, seller_id, seller_stripe_account_id,
    item_amount_cents, platform_fee_cents, seller_amount_cents,
    currency, status, payment_intent_id, charge_id, transfer_group,
    agreement_version, fee_bps, fee_version, checkout_attempt
  )
  values (
    v_deal_id, v_buyer_id, v_seller_id, v_seller_account,
    44000, 2000, 42000, 'USD', 'disputed',
    'pi_PAY003_refund_12345678', 'ch_PAY003_refund_12345678',
    'DLV_' || replace(v_deal_id::text, '-', ''), 1, 455, 'sandbox_test_v1', 1
  )
  returning id into v_payment_id;

  insert into public.deal_disputes (deal_id, opened_by, reason)
  values (v_deal_id, v_buyer_id, 'Rollback-only payment dispute.')
  returning id into v_dispute_id;

  v_result := public.prepare_stripe_financial_command(
    v_deal_id, v_dispute_id, 'dispute_refund', v_admin_id, 300
  );
  v_command_id := (v_result ->> 'commandId')::uuid;
  v_token := (v_result ->> 'claimToken')::uuid;
  if (v_result ->> 'amountCents')::bigint <> 44000 then
    raise exception 'refund did not reserve the full trusted amount';
  end if;

  perform public.fail_stripe_financial_command(
    v_command_id, v_token, 'refund_provider_failed'
  );
  select status into v_status from public.protected_payments where id = v_payment_id;
  if v_status <> 'disputed' then
    raise exception 'failed refund did not restore disputed state';
  end if;

  v_result := public.prepare_stripe_financial_command(
    v_deal_id, v_dispute_id, 'dispute_refund', v_admin_id, 300
  );
  v_result_two := public.finalize_stripe_financial_command(
    (v_result ->> 'commandId')::uuid,
    (v_result ->> 'claimToken')::uuid,
    're_PAY003_refund_12345678',
    'Buyer refund approved after evidence review.'
  );
  if not (v_result_two ->> 'resolved')::boolean then
    raise exception 'refund was not finalized';
  end if;

  select payment.status, dispute.status, deal.status::text
  into v_status, v_dispute_status, v_deal_status
  from public.protected_payments payment
  join public.deal_disputes dispute on dispute.id = v_dispute_id
  join public.deals deal on deal.id = v_deal_id
  where payment.id = v_payment_id;

  if v_status <> 'refunded'
     or v_dispute_status <> 'resolved_buyer'
     or v_deal_status <> 'cancelled' then
    raise exception 'refund did not atomically resolve payment, dispute, and deal';
  end if;

  select count(*) into v_count
  from public.audit_events
  where deal_id = v_deal_id and event_type = 'dispute_refunded';
  if v_count <> 1 then
    raise exception 'refund audit was not exactly once';
  end if;
end;
$$;
