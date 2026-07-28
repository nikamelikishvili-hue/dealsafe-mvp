# Evidence file security

## Outcome

EVD-001 through EVD-003 now have a governed implementation boundary:

- one client/server/storage media allowlist;
- short-lived, server-approved quarantine paths;
- server-side byte-structure, declared-type, category, and size validation;
- fail-closed malware-scanner orchestration;
- clean-only promotion to the private evidence vault;
- no authenticated browser policy for reading final Storage objects;
- 60-second server-issued access URLs after participant or dispute-case
  authorization;
- append-only access records that omit object paths and signed tokens.

This is a control implementation, not evidence that the scanner provider or
cross-account runtime test is complete.

## Canonical policy

| Evidence class | Required canonical format | Maximum |
|---|---|---:|
| Seller item, serial/IMEI, or package-weight photo | metadata-free WebP | 10 MB |
| Seller packing video | MP4, MOV, or WebM | 50 MB |
| Buyer received-item or damage photo | metadata-free WebP | 10 MB |
| Buyer unboxing video | MP4, MOV, or WebM | 50 MB |
| Buyer other evidence | WebP, MP4, MOV, or WebM | 10/50 MB by media kind |

The browser re-encodes photos to WebP to remove ordinary EXIF metadata. The
server parses the actual WebP/ISO-base-media/WebM structure, rejects mismatched
content, and rejects WebP EXIF, XMP, ICC, and animation chunks. A filename,
extension, browser MIME value, or Storage metadata field never proves type.

The Storage buckets enforce the union allowlist and the absolute 50 MB ceiling.
The shared policy module enforces the narrower category limit in both the
browser and Edge Function.

## Intake and promotion

1. A signed-in participant asks the `evidence-files` function for one upload
   intake.
2. The function verifies the current Auth session, exact seller/buyer
   relationship, deal state, category/type pair, declared size, and a bounded
   per-account intake rate.
3. It creates a random path that expires after 15 minutes.
4. Storage RLS permits only that participant to upload only that exact path to
   `deal-evidence-quarantine`. The quarantine bucket has no browser read,
   update, or delete policy.
5. The function downloads the quarantined bytes with its server credential,
   compares the real size, parses the byte structure, calculates SHA-256, and
   sends the same bytes/hash to the approved malware-scanner gateway.
6. A response is accepted only when the verdict, SHA-256, engine, and scan
   reference satisfy the fixed response contract.
7. Only a `clean` result is copied to `deal-evidence` and recorded in
   `deal_evidence`. Rejected and failed files never become participant-readable.
8. The quarantine object is removed after finalization or rejection.

`DEALIVRA_MALWARE_SCANNER_URL` must be a separate HTTPS service and
`DEALIVRA_MALWARE_SCANNER_TOKEN` must contain a server secret. When either is
missing, the scanner returns malformed data, the hash differs, the request
times out, or the provider fails, the scanner remains fail-closed and the file
does not enter the evidence vault.

The local EICAR pre-check provides a deterministic rejection fixture. It is not
a replacement for the external malware engine.

## Private access

The final bucket has no authenticated `INSERT`, `SELECT`, `UPDATE`, or `DELETE`
policy. Participants can read only the safe metadata projection, which excludes
the object path, uploader identifier, internal metadata, scanner provider, and
scanner reference.

The Edge Function issues a 60-second URL only when:

- the requester is the deal seller or claimed buyer; or
- the requester is an administrator and the deal has a dispute case.

Every successful issuance appends an access record containing the evidence ID,
deal ID, requester, participant/case reason, expiry, correlation ID, and
timestamp. It never stores the signed URL or object path. Access records are
append-only for application roles.

Legacy evidence is marked `legacy_unscanned`. It remains visible as metadata for
an authorized participant, but it cannot receive a signed URL and cannot count
toward shipping readiness.

## Verification

Repository tests cover:

- role/category declarations and size limits;
- valid metadata-free WebP recognition;
- byte/type mismatch and metadata-bearing WebP rejection;
- EICAR fixture detection;
- hash-matched scanner response validation;
- exact bucket, policy, column-grant, view, and access-log contracts;
- seller, buyer, outsider, and dispute-case administrator metadata access.

The rollback-only SQL suite is
`supabase/tests/evidence_file_security_rollback.sql`.

## Current deployment state (2026-07-28)

- Draft PR
  [#69](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/69)
  passed workflow run 81 on exact reviewed head
  `7ec467d057cb830b79408fd53d08ee779ddd4ab5`.
- Protected Preview `dpl_CY1QTXNwmAPY1Wh2zZvho126yVkH` is READY on that
  exact head with no build error and no warning/error/fatal runtime event.
- Migration `evidence_file_security` is active as version `20260728135548`.
- JWT-protected `evidence-files` version 1 is ACTIVE.
- The live post-migration rollback matrix passed. Both buckets are private,
  the final bucket has zero direct browser policies, and authenticated users
  have no evidence insert or storage-path read grant.
- Eleven existing records are marked `legacy_unscanned`.
- The external scanner URL/token remain intentionally absent. Finalization
  therefore fails closed and evidence upload is not enabled for testers.

## Remaining activation gates

Before evidence uploads can be enabled for external testers:

1. Select a malware-scanning vendor or internally operated gateway after
   privacy, retention, region, DPA, reliability, and cost review.
2. Configure the two scanner secrets separately in staging and production.
3. Run clean, EICAR, provider-timeout, oversized, mismatched, malformed-media,
   cross-user, case-admin, and expired-URL tests against staging.
4. Verify quarantine cleanup and alerting for failed finalization.
5. Run a restore/integrity inventory for clean Storage objects.
6. Complete the safe viewer and retention/legal-hold work in EVD-004/005.

This package does not authorize public launch, external private beta, or
real-money operation. The site and payment/payout paths remain disabled.
