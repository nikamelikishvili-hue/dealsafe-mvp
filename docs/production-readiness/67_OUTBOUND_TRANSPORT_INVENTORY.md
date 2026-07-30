# Outbound transport inventory

## Purpose

Every new direct network call changes Dealivra's trust boundary. A reviewer
must be able to see that change in the same pull request and prove that it has
a deadline, an appropriate response-size boundary, and a privacy-safe failure
contract.

The release gate therefore treats direct `fetch` call sites as an exact,
deny-by-default inventory rather than an open-ended implementation detail.

## Reviewed inventory

| Transport | Direct calls | Required boundary |
|---|---:|---|
| Node Supabase Auth and protected RPC proxy | 3 | Exact route/method/request allowlist, 10-second deadline, bounded JSON response |
| Browser request wrapper | 1 | Validated deadline, composed caller cancellation, bounded readers at every consumer |
| Shared browser diagnostic transport | 1 | Three fixed same-origin endpoints, endpoint-specific byte limits, 5-second deadline, no credentials/referrer, keepalive, no response consumption |
| Stripe provider | 1 | Sandbox key, 10-second deadline, bounded JSON response |
| Malware scanner | 1 | Validated HTTPS destination, 30-second deadline, bounded JSON response |
| Security notification provider | 1 | Fixed HTTPS destination, 10-second deadline, bounded JSON response |
| NHTSA VIN provider injection seam | 1 indirect site | Fixed HTTPS destination, abort deadline, bounded response stream |

The three diagnostic reporters delegate to the one direct transport and
deliberately do not inspect a response. Their payloads are fixed-schema,
endpoint-size-limited, rate-limited, non-identifying, and best-effort;
monitoring must never delay, retry, or interrupt customer work.

## Automated enforcement

`npm run security:transport` recursively scans production JavaScript and
TypeScript under `api`, `server`, `src`, and `supabase/functions`.

It fails when:

- a direct fetch appears outside the exact reviewed file inventory;
- the count changes at an existing site;
- a required timeout, request control, bounded reader, or diagnostic privacy
  option disappears;
- the injected VIN provider loses its abort/cleanup/response boundary;
- any governed provider file reintroduces direct `Response.json()`,
  `Response.text()`, or `Response.arrayBuffer()` consumption.

The command runs inside `npm run verify`; a transport change cannot pass the
normal local or CI release gate until its implementation, inventory,
regression evidence, and operating document are updated together.

## Change procedure

For a new or changed transport:

1. identify the data classification, destination owner, authentication, and
   whether redirects are acceptable;
2. define exact routes, methods, headers, request size, response media, actual
   byte ceiling, deadline, retry/idempotency, and customer-safe error behavior;
3. add runtime validation before semantic use;
4. add adversarial tests for timeout, malformed length/media/UTF-8/JSON,
   streamed overflow, and sensitive-log exclusion as applicable;
5. update this inventory and the executable manifest in the same review;
6. verify Preview behavior without enabling Production or real-money state.

Raising a ceiling, accepting a new destination, or weakening a timeout is a
security review, not a mechanical manifest edit.

## Rollout and rollback

This policy is local and CI-only. It creates no request and changes no runtime
provider configuration. If it rejects a legitimate change, keep the change
unreleased until the boundary and evidence are reviewed; do not bypass or
remove the gate.

Rollback reverts the implementation and its inventory entry together. No
provider, Supabase, Vercel, Preview, Production, public-access, customer,
payment, payout, refund, dispute, or real-money state is changed by this
repository-only control.
