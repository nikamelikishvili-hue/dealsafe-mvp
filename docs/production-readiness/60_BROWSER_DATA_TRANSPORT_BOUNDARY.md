# Browser data transport boundary

## Objective

Dealivra must reject an unexpectedly large, malformed, or wrong-media response
before the browser allocates an unbounded body or passes provider data to a
runtime schema. Browser requests must also stop within a reviewed deadline
instead of occupying customer resources indefinitely.

This boundary sits before the existing domain-specific runtime schemas. It
does not replace authorization, RLS, RPC contracts, or semantic response
validation.

## Response contract

All JSON responses read by the central browser data service now use one
streaming parser with these controls:

- declared `Content-Length` must be a non-negative base-10 safe integer;
- declared and actual response bytes may not exceed 1,048,576 bytes;
- the stream is cancelled as soon as actual bytes cross the limit;
- non-empty bodies must use a JSON-compatible application media type;
- bytes must be valid UTF-8 and contain valid JSON;
- a genuinely empty response becomes `null` for reviewed no-content
  operations;
- rejected bodies are represented only by a fixed error code and the message
  `Remote response was rejected`.

The one-megabyte ceiling accommodates the application's already-bounded
administrative and participant list projections. Endpoint-specific runtime
schemas and list limits remain the tighter semantic control.

The MFA-required marker uses the same streaming reader with a separate
16,384-byte ceiling and never records provider response text.

Signed evidence retrieval uses a separate exact-length streaming reader. The
server-authoritative signed record supplies the expected byte count, which is
already limited by the 10 MiB image and 50 MiB video policy. A missing,
shorter, longer, or inconsistently declared response is rejected; the stream
is cancelled as soon as it exceeds the expected size. SHA-256 and media-type
verification still run after exact-length validation.

## Request deadline

Every request owned by `supabaseRest.ts`, including same-origin Auth proxy
calls, public and authenticated Data API calls, Storage operations, signed
evidence retrieval, and the Supabase health check, uses a 30-second deadline.
An existing caller abort signal is combined with the deadline; either signal
can stop the request.

Catalog and VIN browser requests use the same byte/media/JSON reader with
their tighter pre-existing 4.5-second and 5.5-second deadlines. Catalog
failures retain the embedded reviewed fallback. VIN timeout and validation
failures retain the customer-safe manual-entry path.

## Failure behavior

- Oversized, malformed, wrong-media, invalid UTF-8, and unreadable responses
  fail closed before domain parsing.
- The boundary error never includes response text, identifiers, addresses,
  messages, payment information, or provider diagnostics.
- Existing customer-safe domain error handling remains responsible for the
  final interface message.
- Timeouts surface through the existing operation failure path and do not
  silently retry non-idempotent mutations.

## Verification

Automated tests prove:

- valid PostgREST and ordinary JSON media types are accepted;
- empty no-content responses remain compatible;
- declared invalid/oversized lengths fail;
- actual multi-byte UTF-8 content cannot bypass the byte ceiling;
- signed binary evidence rejects shorter, longer, or mismatched declared
  lengths before object-URL creation;
- wrong media types and malformed JSON fail with fixed codes;
- text reads and configuration values are independently bounded;
- the central browser data service contains no direct `.json()`,
  `clone().text()`, or unbounded native `fetch()` call;
- catalog and VIN clients contain no direct `.json()`, native `fetch()`, or
  timer/controller implementation outside the common deadline helper;
- the complete application type, test, secret, build, and Preview-smoke gates
  continue to pass.

## Monitoring and rollout

Before Production promotion, exercise successful, timeout, malformed,
wrong-media, and oversized synthetic responses in an access-protected Preview.
Monitor fixed-category client failures only; never attach raw response bodies
or full request URLs. An unexpected rise in boundary rejection is a release
stop and provider-contract investigation, not a reason to increase the limit.

## Rollback

Rollback is a reviewed redeployment of the previous known-good commit. Do not
restore direct body parsing or remove request deadlines as a compatibility
workaround. If a legitimate response exceeds the ceiling, reduce the server
projection or paginate it before reviewing any narrowly scoped limit change.

## Activation boundary

This implementation is local and review-only. It does not contact Supabase,
change a Supabase/Vercel setting, deploy an endpoint, mutate customer data,
activate public access, or enable payments.
