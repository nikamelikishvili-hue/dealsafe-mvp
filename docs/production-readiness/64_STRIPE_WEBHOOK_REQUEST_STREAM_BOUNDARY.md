# Stripe webhook request stream boundary

## Objective

Stripe signature verification requires the original raw request text, but
that requirement must not permit an omitted or dishonest `Content-Length` to
cause unbounded memory allocation. Dealivra must reject an excessive payload
before using a webhook secret, parsing JSON, or performing database work.

## Reviewed contract

- Only `POST` is accepted.
- The shared stream reader validates any declared length and stops actual
  bytes at 262,144.
- The reader cancels on actual overflow and rejects unreadable or invalid
  UTF-8 streams without including body content in an error.
- The exact bounded text is used for the existing timestamped HMAC check.
- Signature verification precedes JSON parsing, event validation, event
  claiming, and every payment mutation.
- Excess size returns HTTP 413. Other body-boundary failures return one
  content-free HTTP 400 response.

The five-minute timestamp tolerance, bounded signature header, constant-time
comparison, live-mode rejection, random fencing token, atomic event claim,
legal payment transition, replay handling, and generic provider failure
messages remain unchanged.

## Verification

Release evidence must prove:

- direct `Request.text()` is absent from the webhook;
- the webhook invokes the shared reader with `maxWebhookBytes`;
- a chunked body stops when actual bytes cross the limit;
- malformed declared length, unreadable bytes, and invalid UTF-8 fail before
  signature or database work;
- oversized and invalid-body status mappings remain distinct;
- signature, replay, ordering, financial-field, Sandbox, and customer-safe
  error regression tests pass;
- the complete type, secret, build-budget, and Preview smoke gates pass.

## Monitoring and rollback

Monitor fixed `request_too_large`, `invalid_request_body`, and
`invalid_signature` counts only. Never log webhook bodies, signature headers,
secrets, payment identifiers, or arbitrary provider diagnostics. A regression
freezes payment promotion and rolls back to the last verified commit; never
restore an unbounded body read or relax signature validation.

## Activation boundary

This work is local and review-only. It accepts no webhook, contacts no Stripe
or database service, deploys no Edge Function, applies no migration, changes
no environment setting, and mutates no customer, payment, Supabase, Vercel,
Preview, Production, public-access, payout, refund, dispute, or real-money
state.
