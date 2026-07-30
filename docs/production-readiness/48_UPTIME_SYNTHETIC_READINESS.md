# Uptime and protected synthetic readiness

## Decision

Dealivra has a minimal process-liveness contract and a read-only critical
journey probe for an access-protected Preview. The probe must detect a missing
deployment, broken application shell, broken canonical route, or unavailable
catalog without signing in, creating test accounts, mutating customer data, or
contacting payment flows.

The source is implemented for review. No monitor, schedule, Vercel variable,
protection bypass, alert, deployment, Preview, Production, Supabase resource,
customer data, public access, or payment behavior changed.

## Liveness endpoint

`GET /api/health` returns exactly:

```json
{"schema":"dealivra.health.v1","status":"alive"}
```

`HEAD` returns the same HTTP status without a body. Other methods are denied.
The response is uncached and does not reveal environment, release, hostname,
provider configuration, database state, account counts, or secrets.

This endpoint proves only that the deployed function can execute. It does not
claim that Supabase, Stripe, email, storage, or protected customer journeys are
ready. Those dependencies require separate non-mutating checks and controlled
end-to-end drills.

## Protected read-only journey

`npm run smoke:protected` requires an exact root
`DEALIVRA_SYNTHETIC_BASE_URL`. HTTPS Dealivra production hosts and
`*.vercel.app` are accepted; HTTP is limited to localhost. Credentials,
path, query, and fragment in the base URL are rejected.

When Preview Deployment Protection is enabled, the server/CI-only
`DEALIVRA_SYNTHETIC_BYPASS_SECRET` is sent in the reviewed Vercel protection
header. It must never have a `VITE_` prefix, appear in a URL, output, pull
request, screenshot, or browser bundle.

The probe performs only five GET requests:

1. process liveness;
2. public application shell;
3. canonical Terms route;
4. sign-in entry shell without credentials;
5. the public US phone catalog.

Redirects are rejected rather than followed, every request has an eight-second
timeout, responses are capped at 1 MB, and exact response contracts are
checked. Production hosts are denied by default and require the exact
`DEALIVRA_SYNTHETIC_PRODUCTION_MODE=read_only_confirmed` switch for an approved
read-only run.

## Activation gate

Protected Preview scheduling requires:

- an access-protected Preview built from the reviewed commit;
- the bypass secret stored only in the monitor's encrypted server scope;
- secret rotation and revocation owners;
- a five-minute or slower interval with bounded concurrency;
- alert ownership, acknowledgement target, and escalation route;
- one forced safe failure proving an alert is delivered;
- one recovery proving the alert closes;
- output inspection proving the secret and target URL are absent;
- a 30-day-or-shorter event retention policy.

Production read-only checks additionally require Security approval, a
low-volume source allowlist/Firewall rule, and seven days of clean Preview
evidence. Authenticated, payment, delivery, evidence, or support synthetics
require isolated synthetic tenants and a separate reviewed design.

## Rollback

Disable the schedule first, revoke the bypass secret, remove it from the
monitor environment, and preserve only non-secret alert evidence. Keep
Deployment Protection enabled. A failed synthetic must block promotion but
must never trigger automatic mutation, refund, payout, dispute, or public
access changes.
