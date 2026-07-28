# RLS policy performance

## Purpose

Dealivra's Row Level Security policies are authorization controls first and
query predicates second. Performance remediation may never broaden visibility
or turn an authorization rule into an application-only check.

DBP-001 addresses the remaining Supabase `auth_rls_initplan` findings by
evaluating `auth.uid()` and the administrator helper once per SQL statement
instead of once for every candidate row.

## Governed policies

Ten policies across seven protected tables are in scope:

- participant reads for media, meetings, ratings, messages, shipments,
  disputes, and evidence;
- seller-only media insert and delete;
- seller-or-buyer evidence insert;
- participant-or-administrator evidence read.

The role (`authenticated`), command, permissive mode, deal relationship, upload
identity, uploader role, and administrator decision remain unchanged.

## Required evidence

`supabase/tests/rls_auth_initplan_optimization_rollback.sql` must prove against
production that:

- the exact ten-policy inventory, commands, and roles are unchanged;
- every Auth helper is represented as a statement-level InitPlan;
- the seller and buyer can still read a real row in all six browser-readable
  tables;
- an unrelated ordinary member cannot read any selected deal row;
- the message table remains RPC-only without a direct browser `SELECT` grant;
- only the seller can insert and delete a selected media record;
- the seller and buyer can upload evidence with their correct role;
- an unrelated user cannot upload evidence;
- every test write and role/JWT change is rolled back.

The migration must first pass with the assertions inside one production
transaction that is rolled back. After migration, the same suite must pass
again and the Supabase performance advisor must no longer report the ten
governed `auth_rls_initplan` findings.

## Change control

This optimization does not justify adding browser table grants, removing RLS,
using client-supplied ownership fields, or caching identity across requests.
Any policy-semantic change requires a separate security review.

Foreign-key index recommendations are intentionally excluded from DBP-001.
They require query-frequency, write-cost, and size evidence and will be handled
as a separate measured batch.
