-- DBP-002: measured foreign-key coverage for current production hot paths.
--
-- These six indexes are backed by production pg_stat_statements evidence and
-- current application/RPC query shapes. The remaining foreign-key advisor
-- recommendations are deliberately excluded until their read or parent-row
-- maintenance value is demonstrated.

create index if not exists audit_events_deal_created_idx
  on public.audit_events(deal_id, created_at desc);

create index if not exists deal_activity_reads_deal_idx
  on public.deal_activity_reads(deal_id);

create index if not exists deal_media_deal_sort_idx
  on public.deal_media(deal_id, sort_order);

create index if not exists deal_messages_deal_created_idx
  on public.deal_messages(deal_id, created_at);

create index if not exists deal_offers_deal_created_idx
  on public.deal_offers(deal_id, created_at desc);

create index if not exists ratings_subject_created_idx
  on public.ratings(subject_id, created_at desc);
