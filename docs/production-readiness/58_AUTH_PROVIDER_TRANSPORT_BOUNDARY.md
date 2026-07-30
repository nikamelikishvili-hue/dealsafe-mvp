# Auth provider transport boundary

## Objective

Dealivra's server-side Auth proxy and privileged recovery RPCs must fail
quickly and safely when Supabase Auth or the Data API stalls, returns an
oversized response, or returns a response that is not valid JSON. Provider
response content must never be copied into logs or customer errors.

This boundary covers:

- signup, password login, refresh, recovery, password mutation, logout, and
  TOTP factor requests sent through `supabaseAuthRequest`;
- the current application-role RPC;
- privileged MFA recovery RPC responses;
- sensitive-change cooldown RPC error responses used by MFA, email, and payout
  controls.

It does not change Supabase project configuration, authentication policy,
session lifetime, MFA requirements, or live customer data.

## Transport contract

Every covered outbound request:

1. uses the already validated HTTPS Supabase project origin;
2. has a 10-second abort signal;
3. keeps the existing publishable-key, bearer-token, and optional trusted
   client-address boundaries;
4. accepts no more than 262,144 response bytes, measured incrementally from
   both a valid declared `Content-Length` and the actual UTF-8 byte stream,
   cancelling the reader before a larger response can be fully buffered;
5. requires `application/json` for non-empty responses;
6. rejects malformed JSON with one fixed internal boundary error;
7. permits an empty response only for an HTTP 204 logout response.

The shared transport parser accepts any bounded JSON value because Supabase
Auth returns objects while reviewed RPCs can return strings. Each caller still
enforces its own semantic shape:

- Auth handlers accept only a non-array object;
- the role lookup accepts only `member`, `support`, `compliance`, or `admin`;
- the MFA recovery policy selects the exact RPC and validates the request
  before transport.

## Failure behavior

- Timeout and network failures become a generic account-service unavailable
  response.
- Invalid or oversized provider responses become the same generic unavailable
  response.
- Provider error JSON is parsed only inside the byte boundary before existing
  rate-limit and customer-safe error mapping runs.
- No response body, token, email address, recovery case, factor identifier, or
  Supabase diagnostic text is logged.
- Local sign-out still clears the browser-only session material if provider
  revocation is unavailable; other/global revocation never reports success on
  provider failure.

## Verification

The release gate must prove:

- valid object and scalar JSON responses are accepted;
- HTTP 204 is the sole controlled empty-body exception;
- wrong media type, malformed JSON, empty non-204 body, invalid or excessive
  declared length, and excessive actual Unicode bytes are rejected;
- all three shared provider request paths use the governed timeout;
- direct unbounded `upstream.json()` and `Response.text()` calls are absent
  from the governed Auth and recovery/cooldown boundary;
- signup, login, refresh, recovery, password mutation, MFA, and logout
  regression tests pass;
- typecheck, secret scan, production build, budget checks, and Preview smoke
  tests pass.

## Activation evidence

Before a production promotion, capture:

- the exact reviewed commit and release-evidence manifest;
- a protected Preview login, refresh, recovery-request, MFA, and logout
  synthetic result without credentials or response bodies;
- fixed-category counts for provider timeout and invalid-provider-response
  failures;
- confirmation that no customer-facing response contains provider diagnostics.

## Monitoring and response

Alert when the fixed `provider_unavailable` Auth failure category rises above
the operational policy threshold. The operator must distinguish provider
availability from a Dealivra release regression using sanitized counts and
read-only synthetics. Do not collect raw provider bodies to diagnose an
incident.

Repeated timeouts or invalid responses freeze Auth-related promotion. If
active sessions cannot refresh or MFA cannot complete, use the incident
control procedure and publish only the reviewed customer-safe status
template.

## Rollback

Rollback is a reviewed redeployment of the last known-good application
commit. Do not remove the byte ceiling or restore unbounded response parsing
as an incident workaround. Provider timeout adjustments require a separate
review with latency evidence and must remain finite.

## Activation boundary

This change is local and review-only. It does not contact Supabase, change a
Supabase/Vercel setting, deploy an endpoint, mutate customer data, activate
public access, or enable payments.
