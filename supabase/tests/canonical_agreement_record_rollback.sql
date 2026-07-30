-- Rollback-only AGR-001 canonical agreement evidence.
-- Safe for production verification: all attempted writes are transaction-local.

begin;

do $agr_001_columns_and_backfill$
declare
  missing_columns text[];
begin
  select array_agg(expected.column_name order by expected.column_name)
  into missing_columns
  from (
    values
      ('canonical_hash'),
      ('canonical_payload'),
      ('schema_version')
  ) as expected(column_name)
  where not exists (
    select 1
    from information_schema.columns column_record
    where column_record.table_schema = 'public'
      and column_record.table_name = 'agreement_versions'
      and column_record.column_name = expected.column_name
  );

  if missing_columns is not null then
    raise exception 'AGR-001 canonical columns are missing: %', missing_columns;
  end if;

  if exists (
    select 1
    from public.agreement_versions agreement
    where agreement.schema_version is distinct from 'dealivra.agreement.v1'
      or agreement.canonical_payload is null
      or agreement.canonical_payload->>'schema'
        is distinct from 'dealivra.agreement.v1'
      or agreement.canonical_hash is null
      or agreement.canonical_hash !~ '^[a-f0-9]{64}$'
      or agreement.canonical_hash is distinct from encode(
        extensions.digest(
          convert_to(agreement.canonical_payload::text, 'UTF8'),
          'sha256'
        ),
        'hex'
      )
  ) then
    raise exception 'AGR-001 canonical backfill or SHA-256 integrity failed';
  end if;
end
$agr_001_columns_and_backfill$;

do $agr_001_builder_boundary$
declare
  builder_oid oid :=
    'private.build_agreement_canonical_payload(text,integer,jsonb,text)'
      ::regprocedure::oid;
  first_payload jsonb;
  second_payload jsonb;
begin
  if (select prosecdef from pg_proc where oid = builder_oid)
     or (select provolatile <> 'i' from pg_proc where oid = builder_oid)
     or not exists (
       select 1
       from pg_proc function_record
       cross join lateral
         unnest(coalesce(function_record.proconfig, array[]::text[])) setting
       where function_record.oid = builder_oid
         and setting = 'search_path=""'
     )
     or has_function_privilege('public', builder_oid, 'execute')
     or has_function_privilege('anon', builder_oid, 'execute')
     or has_function_privilege('authenticated', builder_oid, 'execute') then
    raise exception 'AGR-001 canonical builder boundary changed';
  end if;

  first_payload := private.build_agreement_canonical_payload(
    ' ab12cd34 ',
    3,
    '{
      "title": "Camera",
      "description": "Body and lens",
      "price_cents": "125000",
      "currency": "usd",
      "condition": "Used - excellent",
      "delivery_method": "Ship to buyer",
      "expires_at": "2026-08-01T12:00:00Z",
      "catalog_identity": {"brand_label": "Example"},
      "seller_declarations": {"lawful_item": true}
    }'::jsonb,
    '9876'
  );

  second_payload := private.build_agreement_canonical_payload(
    ' ab12cd34 ',
    3,
    '{
      "title": "Camera",
      "description": "Body and lens",
      "price_cents": "125000",
      "currency": "usd",
      "condition": "Used - excellent",
      "delivery_method": "Ship to buyer",
      "expires_at": "2026-08-01T12:00:00Z",
      "catalog_identity": {"brand_label": "Example"},
      "seller_declarations": {"lawful_item": true}
    }'::jsonb,
    '9876'
  );

  if first_payload is distinct from second_payload
     or first_payload->>'schema' <> 'dealivra.agreement.v1'
     or first_payload->>'public_id' <> 'AB12CD34'
     or first_payload->>'currency' <> 'USD'
     or first_payload->>'identifier' <> '9876'
     or first_payload->'catalog_identity'->>'brand_label' <> 'Example'
     or (first_payload->'seller_declarations'->>'lawful_item')::boolean
       is distinct from true then
    raise exception 'AGR-001 canonical payload is not deterministic or complete';
  end if;
end
$agr_001_builder_boundary$;

do $agr_001_trigger_boundary$
declare
  insert_trigger_oid oid;
  immutable_trigger_oid oid;
  sample_id uuid;
begin
  select trigger_record.oid
  into insert_trigger_oid
  from pg_trigger trigger_record
  where trigger_record.tgrelid = 'public.agreement_versions'::regclass
    and trigger_record.tgname = 'populate_agreement_canonical_record'
    and not trigger_record.tgisinternal
    and trigger_record.tgenabled <> 'D';

  select trigger_record.oid
  into immutable_trigger_oid
  from pg_trigger trigger_record
  where trigger_record.tgrelid = 'public.agreement_versions'::regclass
    and trigger_record.tgname = 'prevent_agreement_version_mutation'
    and not trigger_record.tgisinternal
    and trigger_record.tgenabled <> 'D';

  if insert_trigger_oid is null or immutable_trigger_oid is null then
    raise exception 'AGR-001 canonical or immutability trigger is missing';
  end if;

  select agreement.id
  into sample_id
  from public.agreement_versions agreement
  order by agreement.created_at
  limit 1;

  if sample_id is not null then
    begin
      update public.agreement_versions
      set terms_json = terms_json
      where id = sample_id;

      raise exception 'AGR-001 agreement mutation unexpectedly succeeded';
    exception
      when others then
        if sqlerrm = 'AGR-001 agreement mutation unexpectedly succeeded'
           or sqlerrm <> 'Published agreement versions are immutable.' then
          raise;
        end if;
    end;
  end if;
end
$agr_001_trigger_boundary$;

do $agr_001_public_document_boundary$
declare
  document_oid oid :=
    'public.get_public_agreement_document(text,integer)'::regprocedure::oid;
  function_definition text;
begin
  select lower(pg_get_functiondef(document_oid))
  into function_definition;

  if not (select prosecdef from pg_proc where oid = document_oid)
     or (select provolatile <> 's' from pg_proc where oid = document_oid)
     or not exists (
       select 1
       from pg_proc function_record
       cross join lateral
         unnest(coalesce(function_record.proconfig, array[]::text[])) setting
       where function_record.oid = document_oid
         and setting = 'search_path=""'
     )
     or has_function_privilege('public', document_oid, 'execute')
     or not has_function_privilege('anon', document_oid, 'execute')
     or not has_function_privilege('authenticated', document_oid, 'execute')
     or position('email' in function_definition) > 0
     or position('phone' in function_definition) > 0
     or position('serial_ciphertext' in function_definition) > 0
     or position('typed_name' in function_definition) > 0
     or position('ip_hash' in function_definition) > 0
     or position('user_agent' in function_definition) > 0
     or position('storage_path' in function_definition) > 0 then
    raise exception 'AGR-001 public agreement privacy boundary changed';
  end if;

  perform *
  from public.get_public_agreement_document('../private', null);

  if found then
    raise exception 'AGR-001 invalid public identifier unexpectedly returned data';
  end if;
end
$agr_001_public_document_boundary$;

rollback;
