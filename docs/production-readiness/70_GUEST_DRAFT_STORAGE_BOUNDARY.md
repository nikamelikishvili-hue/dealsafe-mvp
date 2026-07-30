# Guest draft storage boundary

## Objective

A guest should be able to recover an interrupted Deal creation flow without
turning browser storage into an indefinite repository of item or customer
information.

## Browser-storage contract

Guest recovery uses one versioned local-storage record with these controls:

- a 24-hour lifetime;
- a 16 KiB UTF-8 ceiling before parsing and before writing;
- title, description, and price limits aligned with the reviewed Deal request;
- sanitized, fixed-field catalog selection;
- USD, condition, handoff method, expiration, step, and review-state only;
- no serial number or VIN, photo or file bytes, account identifier, email,
  address, access code, authentication token, payment data, or agreement
  signature.

The previous seven-day record is removed rather than migrated. Future-dated,
expired, malformed, excessive, or unserializable records are deleted and the
creation flow starts safely from an empty draft.

## Verification

Automated coverage requires the versioned key, legacy removal, 24-hour
lifetime, read/write byte ceilings, description limit, and serial-number
exclusion. The complete release gate also verifies the request boundary,
TypeScript build, tests, secret scan, asset budgets, and Preview navigation.

Before public activation, protected Preview evidence must confirm recovery
within the lifetime, expiry, legacy cleanup, corrupted and oversized records,
account sign-in cleanup, user-requested reset, private-window behavior, and
storage-denied behavior.

## Rollout and rollback

This is a local browser privacy control and does not change server data. If
recovery compatibility fails, keep the shorter lifetime and sensitive-field
exclusions while repairing only the fixed recovery schema. Do not restore the
legacy record or persist secrets, identity, logistics, payment, or evidence
data.

No browser record was read or written during this local implementation. No
endpoint, environment, provider, Supabase, Vercel, Preview, Production,
public-access, customer, payment, payout, refund, dispute, or real-money state
was changed.
