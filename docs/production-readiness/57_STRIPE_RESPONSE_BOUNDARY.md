# Stripe response boundary

Status: implemented locally; Sandbox latency and malformed-provider fault
injection evidence remain required.

## Objective

Stripe is a trusted payment provider, not a trusted source of unbounded bytes.
Every provider response must terminate promptly and pass transport validation
before Dealivra performs endpoint-specific object checks or database updates.

## Transport contract

Response bytes are consumed through the shared streaming provider reader. The
reader cancels immediately above the Stripe ceiling and therefore does not
allocate an unbounded `Response.text()` value when a provider omits or lies
about `Content-Length`.

The shared Stripe client enforces:

- a 10-second request/body abort signal;
- no more than 262,144 declared or actual UTF-8 response bytes;
- an `application/json` media type;
- non-empty valid JSON; and
- one non-null JSON object rather than an array or scalar.

A successful HTTP response that violates the contract becomes one safe
`provider_response_invalid` error. Abort/timeout/network failure remains a
retryable provider network error. A bounded Stripe error response continues
through the reviewed HTTP status, request-ID, and provider-code normalizer.

No response body, provider message, card/bank data, customer email, URL, token,
secret, or submitted request field is returned or logged.

## Semantic validation

Passing the transport contract does not make a Stripe object authoritative.
Each caller must still validate exact object type/ID, amount, currency,
connected account, payment intent, charge, transfer group, metadata,
idempotency/fencing relationship, and `livemode=false` as applicable.

## Release evidence

Protected Sandbox verification must prove:

1. normal Connect, Checkout, verification, payout, and refund responses pass;
2. delayed headers and delayed bodies stop at the timeout;
3. oversized declared and streamed bodies are rejected;
4. HTML, empty, malformed JSON, arrays, scalars, and null are rejected;
5. bounded 4xx/429/5xx responses preserve safe retry/configuration behavior;
6. no invalid successful response reaches a database finalization call;
7. correlation logs contain fixed fields only; and
8. a provider-success/recording-uncertain state still freezes blind retry.

## Rollback and incidents

Rollback restores the previously reviewed shared Stripe client and all
dependent Edge Functions together. Do not increase the timeout/byte limit or
accept non-JSON as an incident workaround. Sustained timeout or invalid
response alerts freeze the affected capability, preserve webhook
reconciliation, and escalate to payment operations.

## Activation boundary

This source change does not deploy an Edge Function, contact Stripe, mutate a
database, or authorize public/real-money operation.
