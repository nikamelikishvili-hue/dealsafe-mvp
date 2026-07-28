-- DBP-002 production verification.
--
-- This suite is read-only. Transaction-local planner settings are rolled back.

begin;

set local enable_seqscan = off;
set local enable_bitmapscan = off;

do $$
declare
  actual_indexes jsonb;
  expected_indexes constant jsonb := '[
    {
      "index_name": "audit_events_deal_created_idx",
      "table_name": "audit_events",
      "columns": ["deal_id", "created_at"],
      "orders": ["ASC", "DESC"]
    },
    {
      "index_name": "deal_activity_reads_deal_idx",
      "table_name": "deal_activity_reads",
      "columns": ["deal_id"],
      "orders": ["ASC"]
    },
    {
      "index_name": "deal_media_deal_sort_idx",
      "table_name": "deal_media",
      "columns": ["deal_id", "sort_order"],
      "orders": ["ASC", "ASC"]
    },
    {
      "index_name": "deal_messages_deal_created_idx",
      "table_name": "deal_messages",
      "columns": ["deal_id", "created_at"],
      "orders": ["ASC", "ASC"]
    },
    {
      "index_name": "deal_offers_deal_created_idx",
      "table_name": "deal_offers",
      "columns": ["deal_id", "created_at"],
      "orders": ["ASC", "DESC"]
    },
    {
      "index_name": "ratings_subject_created_idx",
      "table_name": "ratings",
      "columns": ["subject_id", "created_at"],
      "orders": ["ASC", "DESC"]
    }
  ]'::jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'index_name', index_row.index_name,
      'table_name', index_row.table_name,
      'columns', index_row.columns,
      'orders', index_row.orders
    )
    order by index_row.index_name
  )
  into actual_indexes
  from (
    select
      index_class.relname as index_name,
      table_class.relname as table_name,
      jsonb_agg(attribute.attname order by key_position.ordinality) as columns,
      jsonb_agg(
        case
          when (
            (index_catalog.indoption::smallint[])[key_position.ordinality - 1] & 1
          ) = 1
            then 'DESC'
          else 'ASC'
        end
        order by key_position.ordinality
      ) as orders
    from pg_index index_catalog
    join pg_class index_class on index_class.oid = index_catalog.indexrelid
    join pg_class table_class on table_class.oid = index_catalog.indrelid
    join pg_namespace namespace on namespace.oid = table_class.relnamespace
    cross join lateral unnest(index_catalog.indkey::smallint[])
      with ordinality as key_position(attribute_number, ordinality)
    join pg_attribute attribute
      on attribute.attrelid = table_class.oid
     and attribute.attnum = key_position.attribute_number
    where namespace.nspname = 'public'
      and index_class.relname = any(array[
        'audit_events_deal_created_idx',
        'deal_activity_reads_deal_idx',
        'deal_media_deal_sort_idx',
        'deal_messages_deal_created_idx',
        'deal_offers_deal_created_idx',
        'ratings_subject_created_idx'
      ])
      and index_catalog.indisvalid
      and index_catalog.indisready
      and index_catalog.indpred is null
      and index_catalog.indexprs is null
      and index_catalog.indnkeyatts = index_catalog.indnatts
    group by index_class.relname, table_class.relname
  ) index_row;

  if actual_indexes is distinct from expected_indexes then
    raise exception 'DBP-002 hot-path index inventory changed';
  end if;
end;
$$;

do $$
declare
  plan_json json;
begin
  execute $query$
    explain (format json, costs false)
    select id
    from public.audit_events
    where deal_id = '00000000-0000-0000-0000-000000000000'::uuid
    order by created_at desc
  $query$ into plan_json;
  if plan_json::text not like '%audit_events_deal_created_idx%' then
    raise exception 'DBP-002 audit timeline query did not use its index';
  end if;

  execute $query$
    explain (format json, costs false)
    select user_id
    from public.deal_activity_reads
    where deal_id = '00000000-0000-0000-0000-000000000000'::uuid
  $query$ into plan_json;
  if plan_json::text not like '%deal_activity_reads_deal_idx%' then
    raise exception 'DBP-002 reverse activity-read lookup did not use its index';
  end if;

  execute $query$
    explain (format json, costs false)
    select storage_path, sort_order
    from public.deal_media
    where deal_id = '00000000-0000-0000-0000-000000000000'::uuid
    order by sort_order
  $query$ into plan_json;
  if plan_json::text not like '%deal_media_deal_sort_idx%' then
    raise exception 'DBP-002 media lookup did not use its index';
  end if;

  execute $query$
    explain (format json, costs false)
    select id, sender_id, body, created_at
    from public.deal_messages
    where deal_id = '00000000-0000-0000-0000-000000000000'::uuid
    order by created_at
    limit 200
  $query$ into plan_json;
  if plan_json::text not like '%deal_messages_deal_created_idx%' then
    raise exception 'DBP-002 chat history query did not use its index';
  end if;

  execute $query$
    explain (format json, costs false)
    select id, amount_cents, status, created_at
    from public.deal_offers
    where deal_id = '00000000-0000-0000-0000-000000000000'::uuid
    order by created_at desc
  $query$ into plan_json;
  if plan_json::text not like '%deal_offers_deal_created_idx%' then
    raise exception 'DBP-002 offer history query did not use its index';
  end if;

  execute $query$
    explain (format json, costs false)
    select stars, comment, created_at
    from public.ratings
    where subject_id = '00000000-0000-0000-0000-000000000000'::uuid
    order by created_at desc
    limit 5
  $query$ into plan_json;
  if plan_json::text not like '%ratings_subject_created_idx%' then
    raise exception 'DBP-002 reputation history query did not use its index';
  end if;
end;
$$;

rollback;
