# Acceptance protection recovery

## Security behavior

Buyer-code protection is now modeled as `idle`, `loading`, `ready`, or `error`
rather than silently defaulting a failed read to unprotected. A real Deal cannot
be accepted until the latest protection read succeeds. The acceptance mutation
still performs its own authoritative server check immediately before writing.

Seller publishing and buyer review surfaces both show an explicit loading or
retryable error state. Neither surface labels a Deal as link-only while the
protection status is unknown. Static demo behavior remains usable without a
provider dependency.

## Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.
