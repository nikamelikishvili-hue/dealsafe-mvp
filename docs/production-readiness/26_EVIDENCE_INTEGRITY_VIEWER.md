# Evidence integrity inventory and safe viewer

## Scope

EVD-004 adds a second verification boundary after malware scanning. A file can
be scanned clean at upload time and still become missing, replaced, truncated,
or incorrectly served later. The viewer therefore treats every open request as
a new integrity decision.

This control does not enable external evidence uploads. Scanner activation and
the EVD-001/002/003 staging matrix remain separate release gates.

## Open-time verification

The JWT-protected `evidence-files` function performs this sequence before it
issues any short-lived URL:

1. Verify the signed-in user is a deal participant or an administrator assigned
   to an existing dispute for that deal.
2. Deny legacy or non-clean evidence.
3. Download the private vault object through the service boundary.
4. Parse the bytes again as canonical metadata-free WebP, MP4, MOV, or WebM.
5. Recompute SHA-256 and compare it with the immutable upload fingerprint.
6. Compare the byte length and detected MIME type with the evidence record.
7. Atomically update the latest safe status and append an integrity event.
8. Issue a 60-second URL only when the recorded result is `verified`.

`missing`, `invalid`, and `mismatch` results fail closed. They do not produce a
viewing URL.

## Inventory and audit data

`deal_evidence` exposes only these latest safe integrity fields to an authorized
participant or dispute-case reviewer:

- `integrity_status`;
- `integrity_checked_at`;
- the existing SHA-256 fingerprint, scan status, detected MIME type, size, and
  scan timestamp.

The complete append-only event is stored in `evidence_integrity_events`. It
contains expected and observed fingerprint, size, MIME type, actor, deal,
evidence, correlation ID, result, and time. Browser roles cannot read or write
this table. The service role may insert and select, but cannot update, delete,
truncate, or disable its mutation-denial triggers.

The service-only `record_evidence_integrity_result` function derives the result
from database-owned expectations and observed values. Browser roles cannot
execute it.

## Browser viewer boundary

The application no longer opens a Storage signed URL in a new tab and the admin
queue no longer prefetches every evidence URL.

The shared viewer:

- requests one file only after an explicit user action;
- accepts only a bounded, verified manifest;
- immediately fetches the short-lived source with no credentials, no referrer,
  and no cache;
- checks the response type and byte length again;
- places bytes in a local `Blob` with an allowlisted image/video MIME type;
- renders only an `<img>` or `<video>` element;
- never uses an iframe, object, embed, HTML parser, or active document viewer;
- revokes the local object URL when the dialog closes;
- shows scan status, integrity status, size, type, timestamps, and full SHA-256;
- supports Escape, focus restoration, a named close control, mobile layout, and
  reduced-motion behavior.

The download action uses the same verified local blob, not the remote signed
URL.

## Verification

The rollback-only database suite is:

`supabase/tests/evidence_integrity_inventory_rollback.sql`

It proves:

- integrity columns and safe projection exist;
- browser roles cannot read the raw event inventory or execute its writer;
- the service role can write but cannot mutate append-only history;
- matching observations produce `verified`;
- a digest mismatch produces `mismatch`;
- both results are appended and the latest safe status is updated atomically.

Repository tests additionally lock the open-time order: private download and
byte/hash verification must occur before signed URL creation.

## Deployment evidence

- Draft PR [#70](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/70)
  contains exactly the 12 reviewed EVD-004 files.
- GitHub workflow `30372585274` (run 84) completed successfully for exact head
  `2211a4551fecbd5b79b4bcdd3eab913c8974f456`.
- Protected Preview `dpl_Fe11mQ672ZQV4wMCeDqhzWnTm4jC` is READY on that exact
  head, has no build error, redirects through Vercel Authentication, and
  returns `x-robots-tag: noindex`.
- Migration `evidence_integrity_inventory` applied as version
  `20260728151953`.
- JWT-protected Edge Function `evidence-files` version 2 is ACTIVE with bundle
  SHA-256 `af110dfe15325bd925415b94add9db9f4f72b88516fe8b4a82d2e787355095d4`.
- The post-migration rollback suite passed on the live schema.
- Browser roles cannot read or insert integrity events and cannot execute the
  integrity recorder. The service role can execute it, and two mutation-denial
  triggers protect the event inventory.
- The participant-safe view exposes the latest integrity status and timestamp
  without storage path, scanner provider, or scanner reference.
- Eleven pre-existing records remain `legacy_unscanned`; no existing record is
  marked integrity-verified and no integrity event was fabricated during
  rollout.

## Remaining release gates

- Run a staging clean-object view and deliberate object-replacement negative
  test after a scanner gateway is selected.
- Add scheduled full-vault integrity inventory, alert routing, and operator
  remediation ownership.
- Complete EVD-005 retention, deletion, quarantine cleanup, and legal hold.

This work does not authorize public launch, external private beta, real-money
processing, automatic payout, or evidence upload activation.
