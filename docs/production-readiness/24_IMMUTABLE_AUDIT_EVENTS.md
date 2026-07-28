# Immutable material audit events

## Purpose

Dealivra uses `public.audit_events` as the material history behind deal
timelines, payment transitions, delivery evidence, moderation, and disputes.
DAT-005 makes that history append-only for every application role and gives
every event an opaque correlation identifier.

This control protects the application record from accidental or compromised
runtime mutation. It is not a cryptographic ledger, an external write-once
archive, or a substitute for backup, retention, legal-hold, and independent
monitoring controls.

## Production inventory before DAT-005

- The table contained 179 events across 27 event types.
- Every event had a deal and actor relationship, but none had a correlation
  identifier in a dedicated column or common metadata key.
- RLS was enabled with no direct table policies.
- `anon` and `authenticated` had no table privileges.
- `service_role` could select, insert, update, delete, and truncate.
- Thirty-five current public functions referenced the audit table; reviewed
  application writers operate through fixed, elevated server-authoritative
  functions rather than direct browser table writes.
- No user trigger prevented update, delete, or truncate.

## Required database contract

1. `correlation_id` is a non-null UUID.
2. PostgreSQL generates a UUID when a reviewed writer does not provide one.
3. Existing events receive transactionally backfilled identifiers.
4. Correlation identifiers are indexed for operator and incident lookup.
5. `anon` and `authenticated` have no direct insert, update, delete, or
   truncate privilege.
6. `service_role` may append and read, but may not update, delete, or truncate.
7. Enabled triggers reject update, delete, and truncate with SQLSTATE `55000`,
   including attempts made through a role that bypasses RLS.
8. The trigger helper is `SECURITY INVOKER`, has an empty search path, and is
   not directly executable by application roles.
9. RLS remains enabled and no direct mutation policy is introduced.

One correlation identifier currently names one event. A future reviewed
server-side command may intentionally reuse an identifier across multiple
events created by the same operation. The column therefore is indexed but not
unique.

## Writer rules

- The browser never inserts into `audit_events`.
- A business transition writes its state and material event in one database
  transaction.
- The database, not caller-supplied metadata, supplies the default correlation
  identifier.
- `actor_id`, `deal_id`, `event_type`, metadata, correlation identifier, and
  creation time are immutable after insertion.
- Customer-visible errors must not expose internal identifiers. Operators may
  use a correlation identifier only inside authorized support and incident
  workflows.

## Retention and exceptional access

There is no application deletion escape hatch. The table owner can still make
reviewed DDL changes, as every PostgreSQL owner can. Any future retention or
legal-hold implementation must:

- run through a separately approved migration or narrowly scoped archival
  procedure;
- document the event classes and authority;
- preserve an external backup or archive as required;
- produce a deletion manifest and review evidence;
- restore the append-only triggers and least-privilege grants before commit.

Ordinary support, administrator, payment, and Edge Function roles may never
disable the triggers.

## Verification and rollback

`supabase/tests/immutable_material_audit_events_rollback.sql` must pass before
and after migration. It verifies:

- the column, default, index, triggers, grants, and policy inventory;
- complete correlation coverage;
- database-generated correlation on a transaction-local event;
- blocked update, delete, and truncate attempts;
- unchanged probe contents after every blocked mutation;
- a final full rollback.

Rollback of this control is not an ordinary runtime action. Removing
correlation identifiers or restoring mutation privileges would lower an audit
security boundary and requires an explicit production decision record.

## Release boundary

DAT-005 does not authorize public launch, real-money processing, automatic
payout, or deletion of production history. Public/custom domains and live
financial capabilities remain disabled until their separate gates pass.
