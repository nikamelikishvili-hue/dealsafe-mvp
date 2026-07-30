-- AGR-001: immutable, server-authoritative agreement documents.
-- Run after supabase/schema.sql and before exposing agreement PDFs.
-- Safe to run more than once. Existing legacy hashes are preserved.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.agreement_versions
  add column if not exists schema_version text,
  add column if not exists canonical_payload jsonb,
  add column if not exists canonical_hash text;

create or replace function private.build_agreement_canonical_payload(
  p_public_id text,
  p_version integer,
  p_terms_json jsonb,
  p_identifier text
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schema', 'dealivra.agreement.v1',
    'public_id', upper(trim(p_public_id)),
    'version', p_version,
    'title', coalesce(p_terms_json->>'title', ''),
    'description', coalesce(p_terms_json->>'description', ''),
    'identifier', nullif(trim(coalesce(p_identifier, '')), ''),
    'catalog_identity', p_terms_json->'catalog_identity',
    'seller_declarations', p_terms_json->'seller_declarations',
    'price_cents',
      case
        when coalesce(p_terms_json->>'price_cents', '') ~ '^[0-9]+$'
          then (p_terms_json->>'price_cents')::bigint
        else null
      end,
    'currency', upper(coalesce(p_terms_json->>'currency', 'USD')),
    'condition', coalesce(p_terms_json->>'condition', ''),
    'delivery_method', coalesce(p_terms_json->>'delivery_method', ''),
    'expires_at', nullif(p_terms_json->>'expires_at', '')
  );
$$;

revoke all on function private.build_agreement_canonical_payload(text, integer, jsonb, text)
from public, anon, authenticated;

-- Backfill immutable snapshots without replacing the legacy content_hash.
with agreement_snapshots as (
  select
    agreement.id,
    private.build_agreement_canonical_payload(
      deal.public_id,
      agreement.version,
      agreement.terms_json,
      null
    ) as payload
  from public.agreement_versions agreement
  join public.deals deal on deal.id = agreement.deal_id
  where agreement.canonical_payload is null
     or agreement.canonical_hash is null
     or agreement.schema_version is distinct from 'dealivra.agreement.v1'
)
update public.agreement_versions agreement
set
  schema_version = 'dealivra.agreement.v1',
  canonical_payload = snapshot.payload,
  canonical_hash = encode(
    extensions.digest(
      convert_to(snapshot.payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  )
from agreement_snapshots snapshot
where agreement.id = snapshot.id;

create or replace function private.populate_agreement_canonical_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_public_id text;
  v_identifier text;
begin
  select deal.public_id, deal.serial_last_four
  into v_public_id, v_identifier
  from public.deals deal
  where deal.id = new.deal_id;

  if v_public_id is null then
    raise exception 'Agreement deal was not found.';
  end if;

  new.schema_version := 'dealivra.agreement.v1';
  new.canonical_payload := private.build_agreement_canonical_payload(
    v_public_id,
    new.version,
    new.terms_json,
    v_identifier
  );
  new.canonical_hash := encode(
    extensions.digest(
      convert_to(new.canonical_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  return new;
end;
$$;

revoke all on function private.populate_agreement_canonical_record()
from public, anon, authenticated;

drop trigger if exists populate_agreement_canonical_record
on public.agreement_versions;

create trigger populate_agreement_canonical_record
before insert on public.agreement_versions
for each row
execute function private.populate_agreement_canonical_record();

create or replace function private.prevent_agreement_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Published agreement versions are immutable.';
end;
$$;

revoke all on function private.prevent_agreement_version_mutation()
from public, anon, authenticated;

drop trigger if exists prevent_agreement_version_mutation
on public.agreement_versions;

create trigger prevent_agreement_version_mutation
before update on public.agreement_versions
for each row
execute function private.prevent_agreement_version_mutation();

create or replace function public.get_public_agreement_document(
  p_public_id text,
  p_version integer default null
)
returns table(
  schema_version text,
  public_id text,
  version integer,
  title text,
  description text,
  identifier text,
  catalog_identity jsonb,
  seller_declarations jsonb,
  price_cents bigint,
  currency text,
  condition text,
  delivery_method text,
  expires_at text,
  content_hash text,
  legacy_content_hash text,
  created_at timestamptz,
  acceptance_count bigint,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    agreement.schema_version,
    agreement.canonical_payload->>'public_id',
    agreement.version,
    agreement.canonical_payload->>'title',
    agreement.canonical_payload->>'description',
    agreement.canonical_payload->>'identifier',
    agreement.canonical_payload->'catalog_identity',
    agreement.canonical_payload->'seller_declarations',
    case
      when coalesce(agreement.canonical_payload->>'price_cents', '') ~ '^[0-9]+$'
        then (agreement.canonical_payload->>'price_cents')::bigint
      else null
    end,
    agreement.canonical_payload->>'currency',
    agreement.canonical_payload->>'condition',
    agreement.canonical_payload->>'delivery_method',
    agreement.canonical_payload->>'expires_at',
    agreement.canonical_hash,
    agreement.content_hash,
    agreement.created_at,
    count(acceptance.id),
    agreement.version = greatest(deal.current_agreement_version, 1)
  from public.deals deal
  join public.agreement_versions agreement on agreement.deal_id = deal.id
  left join public.agreement_acceptances acceptance
    on acceptance.agreement_version_id = agreement.id
  where deal.public_id = upper(trim(p_public_id))
    and upper(trim(p_public_id)) ~ '^[A-Z0-9]{6,32}$'
    and deal.status in ('published', 'accepted', 'completed', 'disputed')
    and agreement.canonical_payload is not null
    and agreement.canonical_hash ~ '^[a-f0-9]{64}$'
    and (
      p_version is null
        and agreement.version = greatest(deal.current_agreement_version, 1)
      or agreement.version = p_version
    )
  group by deal.id, agreement.id
  order by agreement.version desc
  limit 1;
$$;

revoke all on function public.get_public_agreement_document(text, integer)
from public, anon, authenticated;
grant execute on function public.get_public_agreement_document(text, integer)
to anon, authenticated;

create or replace function public.get_public_agreement_history(p_public_id text)
returns table(
  version integer,
  price_cents bigint,
  currency text,
  condition text,
  delivery_method text,
  content_hash text,
  created_at timestamptz,
  acceptance_count bigint,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    agreement.version,
    case
      when coalesce(agreement.terms_json->>'price_cents', '') ~ '^[0-9]+$'
        then (agreement.terms_json->>'price_cents')::bigint
      else deal.price_cents
    end,
    coalesce(nullif(agreement.terms_json->>'currency', ''), deal.currency),
    coalesce(nullif(agreement.terms_json->>'condition', ''), deal.condition),
    coalesce(
      nullif(agreement.terms_json->>'delivery_method', ''),
      deal.delivery_method
    ),
    coalesce(agreement.canonical_hash, agreement.content_hash),
    agreement.created_at,
    count(acceptance.id),
    agreement.version = greatest(deal.current_agreement_version, 1)
  from public.deals deal
  join public.agreement_versions agreement on agreement.deal_id = deal.id
  left join public.agreement_acceptances acceptance
    on acceptance.agreement_version_id = agreement.id
  where deal.public_id = upper(trim(p_public_id))
    and deal.status in ('published', 'accepted', 'completed', 'disputed')
  group by deal.id, agreement.id
  order by agreement.version desc;
$$;

revoke all on function public.get_public_agreement_history(text)
from public, anon, authenticated;
grant execute on function public.get_public_agreement_history(text)
to anon, authenticated;

create or replace function public.verify_agreement_record(
  p_public_id text,
  p_content_hash text
)
returns table(
  matched boolean,
  public_id text,
  version integer,
  is_current boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    true,
    deal.public_id,
    agreement.version,
    agreement.version = greatest(deal.current_agreement_version, 1),
    agreement.created_at
  from public.deals deal
  join public.agreement_versions agreement on agreement.deal_id = deal.id
  where deal.public_id = upper(trim(p_public_id))
    and (
      lower(agreement.canonical_hash) = lower(trim(p_content_hash))
      or lower(agreement.content_hash) = lower(trim(p_content_hash))
    )
    and trim(p_content_hash) ~ '^[A-Fa-f0-9]{64}$'
    and deal.status in ('published', 'accepted', 'completed', 'disputed')
  order by
    (agreement.version = greatest(deal.current_agreement_version, 1)) desc,
    agreement.version desc
  limit 1;
$$;

revoke all on function public.verify_agreement_record(text, text)
from public, anon, authenticated;
grant execute on function public.verify_agreement_record(text, text)
to anon, authenticated;

comment on column public.agreement_versions.content_hash is
  'Legacy agreement hash retained for backward verification.';
comment on column public.agreement_versions.canonical_payload is
  'Immutable, versioned public agreement terms used by UI and PDF rendering.';
comment on column public.agreement_versions.canonical_hash is
  'SHA-256 of canonical_payload::text, generated and owned by PostgreSQL.';
