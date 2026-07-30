# Evidence lifecycle governance

## Scope

EVD-005 governs what happens after a private evidence object is accepted into
the clean vault. It adds retention classification, scheduled inventory,
quarantine cleanup, legal hold, operator alerts, and verified deletion without
turning an elapsed date into an irreversible automatic delete.

The periods in the current data model implement the proposals already recorded
in [04_DATA_ACCESS_RETENTION.md](04_DATA_ACCESS_RETENTION.md):

- routine evidence: one year after an undisputed close;
- dispute evidence: seven years after the final case resolution.

These periods remain provisional until US privacy/payments counsel approves the
published policy. Changing them requires a reviewed migration and decision
record.

## Two-phase deletion

An elapsed retention date opens a `pending_review` job. It does not delete a
file.

An authorized administrator or compliance operator must:

1. record a 10–1,000 character policy/case reason;
2. confirm that the retention date has elapsed;
3. pass a fresh active-dispute check;
4. pass a fresh active-Legal-Hold check;
5. explicitly approve the exact evidence record.

The scheduled worker repeats the dispute and hold checks when it claims the
approved job. It then removes the object through the Storage API, attempts to
download the same path to prove absence, and only then calls the atomic database
completion function.

The completion transaction replaces the storage path with a tombstone, clears
the original filename, MIME values, size, SHA-256, scanner fields, and metadata,
and records `storage_delete_verified` plus `metadata_redacted` events. Stable
record/deal identifiers and the retention class remain so backup recovery and
audit reconciliation can reapply the deletion ledger.

Supabase requires object deletion through the Storage API; deleting only the
`storage.objects` SQL row can orphan the underlying object. The worker therefore
never performs direct SQL object deletion.

## Legal hold

Legal holds are append-only events, not an editable flag.

- `placed` and `released` rows share one random hold key.
- Only an administrator or compliance operator may place or release a hold.
- Placing a hold blocks any review/approved/processing deletion job, clears the
  deletion request state, and keeps the evidence available to an authorized
  participant or case reviewer.
- Releasing a hold never restores an old approval. An elapsed deletion returns
  to `pending_review` and requires a new operator reason and approval.
- Hold/release events and their correlation IDs cannot be updated, deleted, or
  truncated by browser or service roles.

## Scheduled work

Supabase Cron runs:

- a daily database inventory at 04:15 UTC;
- a bounded maintenance worker every 15 minutes.

The inventory:

- expires stale one-time quarantine intakes;
- queues cleanup for expired/rejected/scan-failed quarantine paths;
- queues clean-vault integrity checks when never checked, older than 30 days, or
  currently unsafe;
- classifies routine versus dispute evidence and calculates the retention date;
- opens operator-reviewed deletion jobs and alerts after retention elapses.

The worker claims at most 20 jobs per invocation and leases them for ten
minutes. It retries an expired lease, stops after five bounded attempts, and
creates an operator alert instead of looping indefinitely.

Integrity jobs require the Storage object's reported size to equal the
database-owned expected size and read exactly that many bytes through a
cancelling stream capped at 50 MB. A mismatch is recorded as an invalid
integrity observation without hashing or retaining a larger object in memory.

The Cron-to-Edge credential is generated inside the database, encrypted through
Supabase Vault, sent only in a dedicated internal header, and compared as a
SHA-256 digest inside a service-only function. The raw credential is not stored
in source control, Cron SQL, an application table, or the browser.

The worker's custom internal authentication is why
`evidence-maintenance` does not use the platform JWT gateway. Browser operator
actions still require an active user session, exact origin validation, and an
administrator/compliance role check.

## Operator workspace and alerts

The restricted Evidence lifecycle center shows:

- active lifecycle alerts;
- scheduled integrity and quarantine queues;
- deletion reviews;
- active legal holds;
- bounded attempts and safe-stop reason codes;
- operator reason fields for approval, hold, and release.

Raw object paths, scanner references, maintenance credentials, and Vault values
are never returned to this UI. Alert acknowledgement is recorded in the
append-only lifecycle ledger.

## Verification

The rollback-only database suite is:

`supabase/tests/evidence_lifecycle_governance_rollback.sql`

It proves:

- browser roles cannot read private lifecycle/hold tables or execute mutation
  functions;
- service roles cannot mutate append-only lifecycle/hold history;
- both Cron jobs exist;
- scheduled integrity checks use an explicit system actor instead of fabricating
  a customer/operator identity;
- a legal hold blocks deletion and its release requires a new review;
- approval produces a bounded leased job;
- verified completion redacts metadata and appends both deletion proof events.

Repository tests additionally enforce that:

- the scheduled endpoint has custom secret authentication;
- only the Storage API removes objects;
- absence is checked before the database completion call;
- the regular evidence viewer rejects any non-retained lifecycle state;
- the admin center never receives a storage path or maintenance secret.

## Release evidence

- Draft PR [#71](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/71)
  contains the isolated EVD-005 implementation.
- GitHub workflow run 88 passed on review head
  `8f9c1cd327d23415f9dbe518a13c534d51a02054`.
- Protected Preview `dpl_6BxH5tgSHadZupTtDSxoxk5NMFJc` is READY on that
  head, has no build/runtime error, requires Vercel Authentication, returns
  `x-robots-tag: noindex`, and has no custom production domain.
- Production migrations are active as:
  - `evidence_lifecycle_governance` version `20260728165554`;
  - `evidence_lifecycle_claim_fix` version `20260728170054`;
  - `evidence_lifecycle_fk_indexes` version `20260728170533`.
- `evidence-maintenance` version 1 is ACTIVE with bundle SHA-256
  `88c8af31072dfedcfe5004aa49e95daba971ef1b95ada953ad0fb0fd057685bc`.
- JWT-protected `evidence-files` version 3 is ACTIVE with bundle SHA-256
  `a57bace444daee803eed27ea44171712e84f81a08182b3441fc1273dc277191c`.
- The live rollback suite passed after proving that Legal Hold blocks deletion,
  release requires fresh review, job claims are bounded, and completion
  redacts metadata only after verified object absence.
- The authenticated worker returned HTTP 200 with zero claimed jobs because no
  evidence was eligible. A request with an invalid maintenance secret returned
  HTTP 403.
- Both Cron jobs are active. The worker reads its credential through Vault; the
  raw value is absent from source, Cron SQL, application tables, and browser
  responses.
- All four new private tables have RLS enabled. Browser roles have no direct
  DML or function execution grants; service-role access is explicit.
- Database advisor verification reports no unindexed foreign keys for the new
  lifecycle tables and no executable Security Definer warnings for the seven
  new lifecycle functions.
- `pg_net` remains in the platform-managed `public` schema because the installed
  extension is not relocatable. Leaked-password protection remains a global
  launch blocker to resolve before external authentication is enabled.

## Release boundary

No existing production evidence is deleted as part of rollout verification.
The existing eleven legacy-unscanned rows remain preserved and unusable for
shipping or viewing. The scanner remains unconfigured and fail-closed.

This work does not authorize public launch, external private beta, real-money
processing, automatic payout, or evidence upload activation.
