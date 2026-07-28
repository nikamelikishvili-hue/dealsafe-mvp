# Foreign-key index governance

## Purpose

Foreign-key advisor notices are candidates, not automatic migration
instructions. Every added index increases storage, write amplification, vacuum
work, and future maintenance. Dealivra adds an index only when current query
shapes, measured production activity, or a meaningful parent-row maintenance
path supports it.

DBP-002 covers six current hot paths:

- deal chat history by deal and creation time;
- deal media by deal and display order;
- audit timeline events by deal and creation time;
- offers by deal and creation time;
- reverse lookup of activity-read rows during deal maintenance;
- reputation history by subject and creation time.

## Selection evidence

The production statistics window began on 2026-07-15. At review time:

- `get_deal_messages` had more than 5,900 calls and its unindexed deal lookup
  accounted for more than 17 seconds of cumulative execution time;
- nested deal-media reads had more than 2,000 measured deal-id lookups;
- the audit table had 179 estimated live rows, over 19,000 sequential scans,
  and is used by both the deal timeline and participant notifications;
- offers are loaded by deal in newest-first order;
- the activity-read primary key begins with `user_id`, so it cannot support a
  reverse lookup by `deal_id`;
- trust summaries repeatedly filter ratings by `subject_id` and return the
  newest reputation records.

The selected indexes use the foreign-key column as the leading key and add an
ordering column only where the product query requires it.

## Required evidence

`supabase/tests/foreign_key_hot_path_indexes_rollback.sql` must prove against
production that:

- the exact six-index inventory, tables, columns, and sort directions match
  this decision;
- every index is valid, ready, non-partial, expression-free, and uses only key
  columns;
- with sequential and bitmap scans disabled transaction-locally, every
  governed query shape selects its intended index;
- verification performs no data writes and all local planner settings are
  rolled back.

The migration and verification suite must first pass together inside one
production transaction that is rolled back. After migration, the same suite
must pass again and the performance advisor must remove exactly the six
governed foreign-key notices.

## Deferred advisor notices

The remaining foreign-key notices stay visible and documented. They are not a
release failure at current table sizes and traffic. A later batch may promote a
candidate when query frequency, table growth, parent-row delete/update cost, or
an `EXPLAIN` plan demonstrates value.

Unused-index notices are also outside DBP-002. A newly created index may appear
unused until organic traffic reaches its query path; removal requires a
separate observation window and rollback plan.

## Change control

DBP-002 changes only physical access paths. It may not alter constraints,
tables, functions, grants, RLS policies, payment authority, retention, or
customer-visible behavior. Public launch, real-money processing, and automatic
payout remain disabled.
