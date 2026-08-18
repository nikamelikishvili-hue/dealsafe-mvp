# Shipping readiness recovery

## Product behavior

The seller navigation now distinguishes a readiness check that is still
loading from one that succeeded and one that failed. A provider failure cannot
be presented as a valid incomplete checklist.

When the latest check fails, the primary Deal action explains that shipping
readiness is unavailable and provides a direct retry. If a previous successful
value exists, it remains in memory for continuity but the error status still
blocks progression until a fresh read succeeds.

## Reliability boundary

- Every request remains scoped to the active Deal and current session token.
- The existing effect cleanup prevents an obsolete request from updating the
  active Deal.
- Retry increments the existing evidence revision and reuses the same bounded
  provider path.
- A failed read never unlocks tracking or shipment progression.

## Verification

Foundation coverage asserts distinct loading, ready, and error states, the
retry action, stale-value preservation, and removal of the former silent
failure-to-incomplete conversion. Full repository verification and Preview
smoke remain required.

## Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability is changed by this work.
