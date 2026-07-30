-- Dealivra production authentication and authorization hardening.
-- Safe to rerun after the complete Dealivra schema has been installed.
--
-- This migration intentionally keeps public Deal Link reads behind a small
-- SECURITY DEFINER RPC allowlist. Anonymous users receive no direct access to
-- base tables, private records, mutation RPCs, or operational helper routines.

begin;

alter table public.profiles
  add column if not exists app_role text not null default 'member';

alter table public.profiles
  drop constraint if exists profiles_app_role_check;

alter table public.profiles
  add constraint profiles_app_role_check
  check (app_role in ('member', 'support', 'compliance', 'admin'));

-- Preserve existing administrators while moving authorization away from the
-- legacy boolean. Role assignment remains server-controlled.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_admin'
  ) then
    execute 'update public.profiles set app_role = ''admin'' where is_admin = true';
  end if;
end
$$;

create or replace function public.current_user_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(
    (select profile.app_role from public.profiles profile where profile.id = auth.uid()),
    'anonymous'
  );
$$;

create or replace function public.is_dealsafe_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.app_role = 'admin'
    );
$$;

-- Replace broad PUBLIC policies with explicit authenticated-only policies.
drop policy if exists "profiles self insert" on public.profiles;
drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

create policy "profiles self insert"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id and app_role = 'member');

create policy "profiles self read"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles self update"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "participants read deals" on public.deals;
drop policy if exists "seller inserts deals" on public.deals;
drop policy if exists "seller updates deals" on public.deals;
drop policy if exists "seller inserts draft deals" on public.deals;
drop policy if exists "seller updates own draft deals" on public.deals;

create policy "participants read deals"
on public.deals
for select
to authenticated
using (seller_id = (select auth.uid()) or buyer_id = (select auth.uid()));

create policy "seller inserts draft deals"
on public.deals
for insert
to authenticated
with check (
  seller_id = (select auth.uid())
  and buyer_id is null
  and status = 'draft'
  and current_agreement_version = 0
  and published_at is null
);

create policy "seller updates own draft deals"
on public.deals
for update
to authenticated
using (seller_id = (select auth.uid()) and status = 'draft')
with check (
  seller_id = (select auth.uid())
  and buyer_id is null
  and status = 'draft'
  and current_agreement_version = 0
  and published_at is null
);

-- These indexes support both participant lookups and the ownership predicates
-- used by the policies above. Partial indexing avoids storing null buyers.
create index if not exists deals_seller_id_idx
on public.deals (seller_id);

create index if not exists deals_buyer_id_idx
on public.deals (buyer_id)
where buyer_id is not null;

-- Remove direct Data API access first, then grant the minimum used by the SPA.
revoke all privileges on all tables in schema public from anon, authenticated;

grant select on table
  public.profiles,
  public.deals,
  public.deal_media,
  public.deal_meetings,
  public.deal_shipments,
  public.deal_evidence,
  public.deal_disputes,
  public.ratings
to authenticated;

grant insert (seller_id, title, description, price_cents, currency, condition,
  serial_last_four, delivery_method, status, current_agreement_version,
  published_at, expires_at)
on public.deals
to authenticated;

grant update (title, description, price_cents, currency, condition,
  serial_last_four, delivery_method, expires_at, updated_at)
on public.deals
to authenticated;

-- CAT-004 is additive and may be deployed after this hardening file. Preserve
-- least-privilege draft writes when those structured columns are present,
-- while keeping this migration safe against an older production schema.
do $catalog_column_grants$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deals'
      and column_name = 'category_id'
  ) then
    execute 'grant insert (
      category_id, catalog_version,
      catalog_brand_id, catalog_brand_label,
      catalog_model_id, catalog_model_label, model_year,
      catalog_variant_id, catalog_variant_label
    ) on public.deals to authenticated';

    execute 'grant update (
      category_id, catalog_version,
      catalog_brand_id, catalog_brand_label,
      catalog_model_id, catalog_model_label, model_year,
      catalog_variant_id, catalog_variant_label
    ) on public.deals to authenticated';
  end if;
end
$catalog_column_grants$;

grant update (display_name)
on public.profiles
to authenticated;

grant insert, delete
on public.deal_media
to authenticated;

grant insert
on public.deal_evidence
to authenticated;

-- PostgreSQL grants EXECUTE to PUBLIC when functions are created. Remove that
-- default and rebuild a deliberate API allowlist.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

revoke all privileges on all functions in schema public
from public, anon, authenticated;

do $$
declare
  routine record;
  anonymous_api constant text[] := array[
    'get_deal_acceptance_protection',
    'get_deal_risk_assessment',
    'get_public_agreement_document',
    'get_public_agreement_history',
    'get_public_deal',
    'get_public_seller_declaration',
    'get_public_seller_trust_profile',
    'get_public_trust_passport',
    'verify_agreement_record'
  ];
  authenticated_api constant text[] := array[
    'accept_deal',
    'ask_deal_question',
    'assert_my_sensitive_change_allowed',
    'cancel_deal',
    'claim_support_case',
    'complete_handoff',
    'configure_buyer_access_code',
    'confirm_meeting',
    'confirm_shipment_delivery',
    'create_deal_shipment',
    'create_support_case',
    'current_user_app_role',
    'generate_handoff_pin',
    'get_admin_catalog_adoption',
    'get_admin_disputes',
    'get_admin_reports',
    'get_admin_revenue_summary',
    'get_admin_revenue_transactions',
    'get_deal_action_plan',
    'get_deal_delivery_details',
    'get_deal_inquiries',
    'get_deal_inspection',
    'get_deal_messages',
    'get_deal_offers',
    'get_deal_participants',
    'get_deal_payment_record',
    'get_deal_timeline',
    'get_my_account_sessions',
    'get_my_notifications',
    'get_my_profile_summary',
    'get_my_saved_deals',
    'get_my_support_cases',
    'get_my_sensitive_change_holds',
    'get_my_stripe_connect_status',
    'get_my_trust_passport_settings',
    'get_protected_payment_status',
    'get_privileged_mfa_recovery_cases',
    'get_seller_shipping_evidence_readiness',
    'get_support_case',
    'get_support_queue',
    'is_current_user_deal_seller',
    'is_deal_saved',
    'is_dealsafe_admin',
    'make_deal_offer',
    'mark_all_activity_read',
    'mark_arrived',
    'mark_deal_activity_read',
    'open_deal_dispute',
    'open_privileged_mfa_recovery_case',
    'propose_meeting',
    'publish_deal_with_seller_declarations',
    'record_deal_inspection',
    'record_privileged_recovery_identity_proof',
    'renew_deal_link',
    'reorder_deal_media',
    'reply_deal_inquiry',
    'reply_support_case',
    'report_public_deal',
    'request_identity_verification',
    'resolve_deal_dispute',
    'resolve_deal_report',
    'resolve_support_case',
    'review_privileged_mfa_recovery_case',
    'respond_to_offer',
    'send_deal_message',
    'set_deal_delivery_details',
    'set_deal_moderation_status',
    'set_deal_saved',
    'set_trust_passport_enabled',
    'submit_rating',
    'update_published_deal'
  ];
begin
  for routine in
    select routine_proc.oid::regprocedure as signature
    from pg_proc routine_proc
    join pg_namespace namespace on namespace.oid = routine_proc.pronamespace
    where namespace.nspname = 'public'
      and routine_proc.proname = any (anonymous_api)
  loop
    execute format(
      'grant execute on function %s to anon, authenticated',
      routine.signature
    );
  end loop;

  for routine in
    select routine_proc.oid::regprocedure as signature
    from pg_proc routine_proc
    join pg_namespace namespace on namespace.oid = routine_proc.pronamespace
    where namespace.nspname = 'public'
      and routine_proc.proname = any (authenticated_api)
  loop
    execute format(
      'grant execute on function %s to authenticated',
      routine.signature
    );
  end loop;
end
$$;

-- Trigger functions and database-maintenance helpers remain callable only by
-- their owner/service workflows, never through the public Data API.
revoke all on function public.handle_new_user()
from public, anon, authenticated;

commit;
