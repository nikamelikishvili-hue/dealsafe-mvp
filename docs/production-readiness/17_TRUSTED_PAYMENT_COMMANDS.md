# Trusted payment commands and invariants

## Purpose

PAY-003 makes the database, not the browser or an Edge Function read sequence,
the authority for every Checkout, seller-transfer, and dispute-refund command.
The control is limited to the US Stripe Sandbox beta. It does not authorize
real money, automatic payout, or a public launch.

## Immutable payment snapshot

Before hosted Checkout is created, one database transaction locks and verifies:

- the requester is the buyer of an accepted deal;
- the current agreement exists and both buyer and seller accepted that version;
- the agreement amount and currency match the deal;
- the seller's current Stripe account is connected and transfer-ready;
- the USD amount is inside the configured beta limit;
- the fee basis points and fee-policy version are valid;
- no conflicting payment snapshot or later payment state exists.

The payment record stores the agreement version, fee basis points, fee version,
amount split, currency, seller account, and Checkout attempt. A material
change fails closed instead of silently rewriting that snapshot.

## Fenced command ledger

`stripe_financial_commands` is service-only and RLS-enabled. Each command has:

- one database-generated command ID and random claim token;
- one provider idempotency key bound to the payment and relevant version/case;
- the exact amount, currency, seller account, agreement, and fee snapshot;
- a bounded status, attempt count, and generic failure code;
- an optional dispute reference and provider object ID.

Only the worker holding the current claim token may attach or finalize a
provider result. A failed or expired command receives a new token, invalidating
the prior worker. Raw Stripe payloads and raw provider errors are never stored.

## Checkout flow

1. The server refreshes the seller's provider readiness.
2. `prepare_stripe_checkout` locks and reserves the trusted snapshot.
3. Stripe Checkout receives the internal payment, participant, agreement, and
   fee references in server-created metadata.
4. The returned session is checked for Sandbox mode, amount, currency,
   deal reference, URL, and expiry.
5. `attach_stripe_checkout_session` records the provider session and one audit
   event under the original fencing token.

A still-valid session with the same snapshot is reused. A concurrent request
sees `in_progress`; it cannot create a second independent command.

## Release and dispute flow

- The first private beta never offers a buyer-controlled payout action.
- An administrator with both the transitional admin flag and the governed
  `admin` application role must prepare release or dispute resolution.
- Ordinary release requires a completed deal and no active dispute.
- Dispute refund or seller release requires the exact active dispute and a
  `disputed` deal.
- The database rechecks the deal, payment, participant, amount, currency,
  current seller account, provider references, and legal source state while
  holding row locks.

Before a provider call, the Edge Function fetches and compares the Stripe
PaymentIntent and Charge. Seller release also compares the current Stripe
Connect account. New payments require exact internal metadata, agreement,
fee version, transfer group, amount, currency, and Sandbox mode.

After Stripe returns, the transfer or refund object is compared to the approved
command. One final database transaction then updates payment state, dispute,
deal, command, and audit record. A provider-success/recording-uncertain result
is left for reconciliation; it is never marked failed and blindly retried.

## Failure behavior

- A provider failure before an external financial result records only a bounded
  generic code and moves the payment to a policy-defined safe retry state.
- A failed dispute refund restores `disputed`, not `release_failed`.
- A stale worker cannot finalize after a command is reclaimed.
- Amount, currency, account, identifier, metadata, and illegal-state mismatches
  fail before funds are moved.
- Provider-success uncertainty requires reconciliation before another attempt.

## Authorization and privacy

- Command tables are unavailable to `anon` and `authenticated`.
- Prepare, attach, finalize, and fail RPCs are executable only by
  `service_role`.
- Protected Edge Functions still require a valid active user session and exact
  approved browser origin.
- The webhook remains separately signature-authenticated.
- Card, bank, raw provider payload, and raw provider error data are excluded.

## Release evidence

Before PAY-003 is complete:

- rollback-only database tests must pass checkout reuse, concurrency fencing,
  stale-token rejection, exact-once audit, admin denial, safe retry, atomic
  dispute resolution, and amount/currency/account/state mismatch rejection;
- webhook tests must prove trusted amount, currency, transfer-group, and
  metadata validation before a state transition;
- Edge Functions must contain no direct protected-payment state mutation;
- repository verification, protected Preview, GitHub CI, database advisors,
  and exact-commit production release evidence must pass;
- real-money mode and the public custom domain must remain disabled.
