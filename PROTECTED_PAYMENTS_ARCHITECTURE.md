# DealSafe protected payments — US launch architecture

## Product decision

DealSafe is electronic-payment only. Physical cash is not offered.

- Card and eligible digital wallets for ordinary transactions.
- ACH bank payment for larger transactions and lower processing cost.
- A licensed payment provider stores payment credentials and moves money.
- DealSafe never stores card numbers, bank account numbers, or security codes.
- The customer-facing name is **Protected Payment**, not **Escrow**. Stripe states that delayed payouts are not legal escrow services.

## Recommended provider

Use Stripe Connect for the first US beta:

- Stripe-hosted or embedded Connect onboarding for seller identity and payout details.
- Stripe Checkout for buyer card, Link, and eligible US bank payments.
- Separate charges and transfers so a successful buyer charge is not transferred to the seller immediately.
- Verified Stripe webhooks as the only authority for payment state changes.
- A transfer to the seller's connected account only after the release conditions are met.

Official references:

- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/connect/manual-payouts
- https://docs.stripe.com/connect/account-capabilities

## Customer flow

1. Seller completes Stripe Connect onboarding.
2. Buyer accepts the current DealSafe agreement.
3. Buyer chooses card/Link or ACH and completes Stripe-hosted Checkout.
4. A verified webhook changes the deal to `funds_secured`.
5. The seller ships the item or both parties attend the confirmed meeting.
6. The buyer records inspection and confirms receipt.
7. DealSafe requests release to the seller.
8. A verified Stripe webhook changes the payment to `released`.

The seller must never ship when the status is only `processing`. Shipping becomes available only after `funds_secured`.

## Release and dispute rules

- In-person: release after buyer inspection, both arrivals, and the handoff PIN.
- Shipping: release after tracked delivery plus buyer inspection confirmation.
- Buyer may report a problem before release; this changes the payment to `disputed` and blocks transfer.
- No automatic release in the first private beta. Add a clearly disclosed time-based release only after legal review and support operations exist.
- Refunds and transfer reversals are server-side administrative actions with an audit record.

## Payment states

`seller_onboarding_required` → `checkout_ready` → `processing` → `funds_secured` → `release_pending` → `released`

Exceptional states: `failed`, `cancelled`, `refund_pending`, `refunded`, `disputed`, `release_failed`.

## Security boundary

- Publishable Stripe keys may appear in the browser; secret keys must not.
- Stripe secret keys and webhook signing secrets belong in Supabase project secrets.
- Checkout creation, Connect onboarding, refunds, and transfers run only in Supabase Edge Functions.
- The browser cannot mark funds as secured or released.
- Every webhook is signature-verified and processed idempotently.
- Store provider IDs, amounts, currency, status, and timestamps; do not store payment credentials.

## Risk limits for the private beta

- USD only.
- US sellers and buyers only.
- Card/Link for lower-value transactions.
- Prefer ACH for high-value transactions; set a conservative card limit after Stripe risk review.
- One seller and one buyer per deal.
- No split payouts, partial releases, international transfers, cash, crypto, gift cards, or peer-to-peer payment apps.
- Require verified seller onboarding before checkout can start.

## Production gates

Real-money mode stays disabled until all of these are complete:

1. Stripe approves the platform's marketplace use case.
2. US payments counsel reviews the funds flow, terms, refunds, disputes, and the use of the word “protected.”
3. Privacy policy, seller agreement, prohibited-items policy, refund policy, and support process are published.
4. Webhook replay, duplicate events, refunds, chargebacks, failed ACH, failed transfers, and account suspension are tested.
5. Monitoring and an administrator reconciliation screen are live.

For true regulated escrow or selected high-value categories, add a separate Escrow.com integration later. Do not label Stripe delayed payouts as escrow.
