# Provider response stream boundary

## Objective

Dealivra must not allocate an unbounded Stripe or malware-scanner response
when a provider omits or lies about `Content-Length`. Declared and actual
response bytes must be enforced while the stream is being consumed.

## Shared streaming boundary

The Edge Function response reader:

- accepts a reviewed maximum from 1 byte through 1 MiB;
- validates `Content-Length` as a base-10 safe integer when present;
- cancels the reader immediately when actual bytes exceed the maximum;
- rejects network/read failures and invalid UTF-8 with fixed codes;
- never includes response text in its error.

Stripe retains its 262,144-byte maximum. Malware scanner verdicts retain their
16,384-byte maximum.

## Semantic boundaries

The stream reader is intentionally transport-only:

- Stripe still requires JSON media, a non-empty JSON object, endpoint-specific
  identifiers, `livemode=false`, and the trusted financial-command contract.
- The scanner now requires JSON media and a non-array object before validating
  `clean|malicious`, SHA-256 equality, engine, and scan reference.
- Both providers retain their existing timeouts and customer-safe unavailable
  behavior.

## Verification

Automated coverage proves declared and actual overflow, multi-byte Unicode,
media type, malformed JSON, object shape, fixed safe errors, and removal of
direct `Response.text()`/`Response.arrayBuffer()` parsing. Existing hash,
Sandbox, authorization, financial fencing, scan, quarantine, and incident
tests remain mandatory.

## Monitoring and rollback

Protected Preview synthetics must exercise valid, oversized, malformed,
wrong-media, and timeout responses without retaining provider bodies. A rise
in fixed provider-response rejection is a release stop. Rollback uses the
prior known-good commit; do not restore direct whole-body parsing or increase
limits to accommodate an unexplained provider change.

## Activation boundary

This implementation is local and review-only. It does not contact Stripe or a
scanner, invoke an Edge Function, apply a migration, change evidence, payment,
customer, Supabase, Vercel, Preview, Production, or public-access state, or
enable real money.
