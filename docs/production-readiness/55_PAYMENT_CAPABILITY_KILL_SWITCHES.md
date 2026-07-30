# Payment capability kill switches

Status: implemented locally and default-off; no environment activation has
been authorized.

## Objective

Dealivra must be able to stop one class of new Stripe mutation without
redeploying or disabling reconciliation for actions already accepted by the
provider.

## Capability matrix

| Capability | Environment gate | Provider mutation |
|---|---|---|
| Seller onboarding | `DEALIVRA_SELLER_ONBOARDING_MODE` | Connect account and onboarding-link creation |
| Buyer checkout | `DEALIVRA_CHECKOUT_MODE` | Checkout Session creation |
| Seller payout | `DEALIVRA_PAYOUT_RELEASE_MODE` | Transfer creation, including seller-favoring dispute resolution |
| Buyer refund | `DEALIVRA_REFUND_MODE` | Refund creation |

Every gate defaults to `disabled`. Only exact `sandbox`, after surrounding
whitespace is removed, permits the named mutation. Mixed-case and every other
value fail closed as misconfiguration. Production/live mode is not a supported
value.

## Layered authorization

A permitted capability still requires every existing control:

- exact browser origin and request schema;
- active authenticated session and required AAL2;
- participant or administrator authority;
- recovery cooldown approval where applicable;
- immutable agreement/payment snapshot and fenced financial command;
- Stripe `sk_test_` secret;
- exact test-mode account/payment/charge/transfer/refund identifiers and
  values; and
- provider confirmation with `livemode=false`.

The switch grants no role, data access, financial authority, or production
authorization.

## Ordering and reconciliation

Checkout/onboarding gates run before provider creation. Payout/refund gates run
before the financial command is prepared or claimed. This avoids a disabled
request leaving a leased command whose provider outcome is unknown.

The signature-authenticated webhook intentionally remains available when new
mutations are disabled. It must continue to record and reconcile events for
Sandbox objects already created. An incident requiring a complete payment
freeze follows the incident procedure and provider-side controls; it must not
discard signed events.

## Activation evidence

For each environment and capability, record:

1. named owner and independent reviewer;
2. exact reviewed commit and Edge Function deployment;
3. disabled and invalid-mode negative tests proving no database command or
   provider request occurs;
4. Sandbox positive test with expected authorization;
5. live-key, live-object, cross-origin, cross-user, password-only privileged,
   and illegal-state denials;
6. webhook reconciliation while all mutation gates are disabled;
7. alert and correlation evidence without customer/provider contents; and
8. rollback to `disabled` with an in-flight-operation reconciliation review.

Environment evidence records the mode name and outcome, never secret values,
Stripe payloads, tokens, email addresses, or participant identifiers.

## Incident operation

The incident commander may turn off only the affected mutation class. Payout
and refund controls are independent so buyer remediation does not silently
enable seller release, or vice versa. Any provider-success/recording-uncertain
operation remains frozen for operations review; a gate must never be toggled
to force a blind retry.

## Activation boundary

This source change does not set an environment value, deploy an Edge Function,
contact Stripe, process a webhook, claim a command, or authorize real money.
All four provider mutation classes remain disabled until separately reviewed
Sandbox activation.
