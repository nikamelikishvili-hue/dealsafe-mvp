# Security notification response boundary

## Decision

The private security-notification worker must not trust or fully buffer a
provider response before its transport boundary is approved. A Resend response
is usable only when all of these conditions hold:

- the request completed within the existing 10-second provider deadline;
- the response declares `application/json`, with an optional charset;
- any declared content length is a valid non-negative integer no larger than
  16 KiB;
- the streamed body remains at or below 16 KiB and is cancelled immediately
  after an actual-byte overflow;
- the bytes form valid UTF-8 and valid JSON;
- the JSON root is a non-array object;
- the existing delivery contract accepts the provider ID as a UUID.

The shared response-stream reader owns declared-length, stream-read,
actual-byte, cancellation, and fatal UTF-8 behavior. The notification-specific
adapter owns JSON media, JSON syntax, and object-shape behavior. It returns
`null` for an untrusted provider payload so the worker records only the
existing bounded `provider_rejected` or `provider_unavailable` code.

## Security properties

- No provider body is read through `Response.json()`, `Response.text()`, or
  `Response.arrayBuffer()`.
- Provider text, JSON, IDs, recipient data, and message content are not logged.
- Authentication, verified-recipient lookup, fixed templates, deterministic
  idempotency keys, staged activation, retry limits, and dead-letter behavior
  are unchanged.
- A transport failure never marks an outbox record delivered.

## Verification

Automated coverage must prove:

1. a bounded JSON object is accepted;
2. wrong media types and array roots are rejected;
3. an excessive declared length is rejected before body consumption;
4. the worker uses the shared adapter and contains no duplicate stream reader;
5. the adapter contains no direct whole-body response parser;
6. the complete release verification remains green.

Before activation, Preview evidence must additionally show success,
wrong-media, malformed JSON, declared overflow, streamed overflow, provider
timeout, retry, and dead-letter behavior without sensitive logging.

## Rollout and rollback

This boundary ships with the notification worker still in `staged` mode.
Activation continues to require the domain, sender, Vault, schedule, alert,
privacy, and incident-response approvals in
[34_SECURITY_NOTIFICATION_DELIVERY.md](34_SECURITY_NOTIFICATION_DELIVERY.md).

If provider compatibility fails, keep delivery staged and revert the adapter
and worker wiring together. Do not raise the ceiling or accept non-JSON
responses without a documented provider-contract review and new regression
evidence.

No Resend request, Supabase function, schedule, domain, environment, Preview,
Production, public-access, customer, payment, or real-money state is changed
by this repository-only control.
