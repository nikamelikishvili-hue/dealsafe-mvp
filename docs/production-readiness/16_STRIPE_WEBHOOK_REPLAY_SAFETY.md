# Stripe webhook replay and ordering safety

## Purpose

Stripe webhook delivery is at-least-once. An event may be duplicated, delayed,
retried after a timeout, or arrive after a later event. Dealivra therefore
cannot use “look up, mutate, then insert an event row” as its financial truth
boundary.

This control applies only to the US Sandbox beta. Live-mode webhook events are
rejected while real-money mode is disabled.

## Transaction boundary

The signature-authenticated Edge Function performs three service-only calls:

1. `claim_stripe_webhook_event` inserts or atomically claims the provider event.
2. `apply_stripe_webhook_event` locks the claim and payment, applies one legal
   transition, writes the participant payment record and material audit event,
   and finalizes the provider event in one database transaction.
3. `fail_stripe_webhook_event` records a bounded generic failure code when the
   transaction cannot be applied.

A claim includes a random fencing token. A worker whose lease expired cannot
finalize the event after a later worker has reclaimed it.

## Duplicate and recovery behavior

| Existing event state | Delivery response |
|---|---|
| Not present | Claim and process |
| `processed` | Return a successful duplicate acknowledgement |
| Fresh `processing` lease | Return a retryable conflict; do not mutate payment state |
| `failed` or expired lease | Issue a new fencing token and retry |
| Attempt limit reached | Fail closed for operator investigation |

The provider payload is not stored. The ledger retains the provider event ID,
type, provider time, Sandbox/live flag, bounded outcome, attempts, timestamps,
and related internal payment ID.

## Ordering rules

- Processing, failure, expiry, and success events cannot overwrite a later
  accepted provider-state timestamp.
- `funds_secured`, `released`, `disputed`, and `refunded` cannot be regressed by
  an older processing or failed event.
- A verified provider dispute may move an unrefunded payment to `disputed`.
- A verified refund is terminal for webhook processing and cannot be regressed
  by a later-delivered success event.
- Provider identifiers may be filled when missing, but a conflicting deal,
  Checkout Session, PaymentIntent, or Charge identifier fails the transaction.
- A supported event with no matching protected-payment record remains
  retryable instead of being silently acknowledged and lost.

## Privacy and authorization

- The webhook remains outside browser CORS because Stripe authenticates it
  with a raw-body signature and bounded timestamp.
- Claim, apply, and fail functions are executable only by `service_role`.
- Tables remain RLS-enabled and unavailable to anonymous or ordinary signed-in
  users.
- Payment credentials, raw payloads, card details, bank details, and raw
  provider errors are not stored.
- Customer-facing payment failures use a small reviewed message allowlist.

## Release evidence

Before merge and deployment:

- Repository tests must prove the claim/apply/fail boundary and the absence of
  direct webhook table/payment mutations in the Edge Function.
- Database tests must cover first claim, concurrent/fresh claim rejection,
  processed replay, failed-event reclaim, fencing-token rejection, illegal
  regression, identifier conflict, and atomic audit/finalization.
- The deployed webhook must keep `verify_jwt=false`; Stripe signature
  authentication is mandatory.
- The full repository release gate, protected Preview, CI, and exact-commit
  production deployment must pass.

This control completes PAY-002 only after deployed database evidence and Stripe
Sandbox replay/concurrency evidence pass. PAY-003 remains responsible for the
full payment command/state matrix outside webhook delivery.
