-- Rollback-only PAY-004 database evidence. Safe for production verification.

begin;

do $$
declare
  v_commands_rls boolean;
  v_events_rls boolean;
begin
  select relrowsecurity into v_commands_rls
  from pg_class
  where oid = 'public.stripe_financial_commands'::regclass;

  select relrowsecurity into v_events_rls
  from pg_class
  where oid = 'public.stripe_webhook_events'::regclass;

  if not coalesce(v_commands_rls, false) or not coalesce(v_events_rls, false) then
    raise exception 'PAY-004 financial ledgers are not protected by RLS';
  end if;

  if has_table_privilege('anon', 'public.stripe_financial_commands', 'select')
     or has_table_privilege('authenticated', 'public.stripe_financial_commands', 'select')
     or has_table_privilege('anon', 'public.stripe_webhook_events', 'select')
     or has_table_privilege('authenticated', 'public.stripe_webhook_events', 'select')
     or has_table_privilege('anon', 'public.stripe_payment_operation_exceptions', 'select')
     or has_table_privilege('authenticated', 'public.stripe_payment_operation_exceptions', 'select')
     or not has_table_privilege('service_role', 'public.stripe_payment_operation_exceptions', 'select') then
    raise exception 'PAY-004 observability data is visible to a browser role';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_financial_commands'
      and column_name = 'correlation_id'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_financial_commands'
      and column_name = 'provider_request_id'
      and data_type = 'text'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'correlation_id'
      and data_type = 'uuid'
  ) then
    raise exception 'PAY-004 correlation columns are incomplete';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'stripe_financial_commands'
      and indexname = 'stripe_financial_commands_correlation_idx'
  ) or not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'stripe_webhook_events'
      and indexname = 'stripe_webhook_events_correlation_idx'
  ) then
    raise exception 'PAY-004 correlation indexes are incomplete';
  end if;
end;
$$;

rollback;
