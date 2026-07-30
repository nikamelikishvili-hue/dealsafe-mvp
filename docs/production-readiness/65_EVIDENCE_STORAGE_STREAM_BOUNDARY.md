# Evidence Storage stream boundary

## Objective

An evidence record's expected size is server-owned, but a missing, replaced,
or dishonest Storage object can differ from that record. Scanning, hashing, or
viewing must not load an unbounded object before detecting the mismatch.

## Reviewed contract

The shared binary reader:

- accepts only a safe positive expected size under the canonical 50 MB limit;
- requires the Storage body's reported size to equal that expectation before
  allocation;
- preallocates one exact output buffer instead of retaining duplicate chunks;
- reads incrementally and cancels before received bytes cross either the
  expected or maximum size;
- rejects short, excessive, unreadable, or non-binary streams with a fixed
  content-free error.

Quarantine finalization maps a mismatch to the existing rejected-intake path.
The signed viewer appends an invalid integrity observation and issues no URL.
Scheduled maintenance records the safe observed size and invalid structure
without hashing the rejected body.

Canonical structure validation, SHA-256 comparison, malware scanning,
clean-only promotion, participant/case authorization, AAL2, lifecycle state,
Legal Hold, retention, append-only audit history, and verified deletion remain
unchanged.

## Verification

Release evidence must prove:

- exact multi-chunk bytes are returned unchanged;
- a dishonest stream is cancelled when it exceeds the expected size;
- a reported size mismatch fails before reading;
- `Blob.arrayBuffer()` is absent from the governed Edge Functions;
- finalization rejects and cleans up mismatched intake state;
- viewer and scheduled maintenance record a safe invalid result;
- evidence policy, scanner, integrity, lifecycle, type, secret, build-budget,
  and Preview smoke gates pass.

## Monitoring and rollback

Use only bounded `file_size_mismatch`, `evidence_integrity_failed`, and
scheduled integrity-status counts. Do not log file bytes, paths, filenames,
hash inputs, signed URLs, scanner secrets, or customer identifiers. A
regression freezes evidence activation and rolls back to the last verified
commit; never restore whole-body reads or increase the limit during an
incident.

## Activation boundary

This work is local and review-only. It downloads, uploads, promotes, views, or
deletes no Storage object; invokes no scanner; deploys no Edge Function;
applies no migration; changes no environment setting; and mutates no customer,
Supabase, Vercel, Preview, Production, public-access, payment, payout, refund,
dispute, or real-money state.
