# Environment configuration standard

Dealivra must use separate configuration for Local, Preview, Staging, and Production. A value copied into one environment is not automatically approved for another. Secrets and privileged credentials must never be placed in a browser-prefixed variable.

## Configuration inventory

| Variable | Exposure | Required | Purpose | Safe failure |
|---|---|---:|---|---|
| `VITE_SUPABASE_URL` | Browser | Yes | Supabase project origin used by the web client | Account and live Deal Link operations show an unavailable message |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Yes | Browser-safe Supabase publishable or legacy anon key | Account and live Deal Link operations remain disabled |
| `SUPABASE_URL` | Server | Yes outside local static demo | Supabase project origin used by same-origin Auth Functions | Auth Function returns a generic `503` and logs a safe diagnostic |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Yes outside local static demo | Browser-safe publishable key used by Auth Functions | Auth Function returns a generic `503` and logs a safe diagnostic |
| `DEALIVRA_AUTH_IP_FORWARDING_MODE` | Vercel Auth Function | Required before trusted IP forwarding | Exact `disabled` or `enforced` switch for Supabase Auth proxy client-IP forwarding | Missing defaults to `disabled`; an invalid value or incomplete enforced configuration fails Auth closed |
| `SUPABASE_AUTH_SECRET_KEY` | Vercel Auth Function | Required only when trusted IP forwarding is enforced | Server-only new-format `sb_secret_` key used exclusively as the Auth request `apikey` with `Sb-Forwarded-For` | Missing, malformed, or browser-exposed key blocks enforced Auth proxy requests |
| `DEALIVRA_CURRENT_PASSWORD_MODE` | Vercel Auth Function | Required before signed-in password changes | Exact `staged` or `enforced` switch paired with the Supabase **Require current password** Auth setting | Missing defaults to `staged`; signed-in change fails closed while recovery remains available |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function | Platform-provided | Server-only database and private Storage boundary after explicit user authorization | Protected function fails without exposing the key or bypassing the operation |
| `DEALIVRA_RECOVERY_CONTROL_MODE` | Vercel Auth Function and Supabase Edge Function | Required before recovery activation | Exact `staged` or `enforced` switch for the 72-hour MFA/email/payout cooldown boundary | Missing defaults to `staged` during integration; an invalid value blocks the sensitive mutation |
| `DEALIVRA_SECURITY_NOTIFICATION_MODE` | Supabase Edge Function | Required before notification activation | Exact `staged` or `enforced` switch for custom privileged-recovery notifications | Missing remains `staged`; invalid or staged mode sends nothing |
| `DEALIVRA_SECURITY_NOTIFICATION_WORKER_SECRET` | Supabase Edge Function and scheduler Vault | Required before notification activation | High-entropy bearer secret authenticating the private worker invocation | Missing, short, or mismatched credentials deny the worker before a job is claimed |
| `DEALIVRA_SECURITY_NOTIFICATION_FROM` | Supabase Edge Function | Required before notification activation | Verified sender such as `Dealivra Security <security@notify.dealivra.com>` | Invalid sender blocks delivery without exposing recipient data |
| `RESEND_API_KEY` | Supabase Edge Function | Required before notification activation | Server-only Resend transactional-email credential | Missing or invalid credential blocks delivery and is never returned or logged |
| `DEALIVRA_SELLER_ONBOARDING_MODE` | Supabase Edge Function | Required before seller onboarding | Exact `disabled` or `sandbox` kill switch for Stripe Connect account/link creation | Missing, empty, disabled, or invalid values block provider mutation |
| `DEALIVRA_CHECKOUT_MODE` | Supabase Edge Function | Required before checkout | Exact `disabled` or `sandbox` kill switch for Stripe Checkout creation | Missing, empty, disabled, or invalid values block provider mutation |
| `DEALIVRA_PAYOUT_RELEASE_MODE` | Supabase Edge Function | Required before payout/release | Exact `disabled` or `sandbox` kill switch for seller-favoring transfers | Missing, empty, disabled, or invalid values block provider mutation before a financial command is claimed |
| `DEALIVRA_REFUND_MODE` | Supabase Edge Function | Required before refunds | Exact `disabled` or `sandbox` kill switch for buyer-favoring refunds | Missing, empty, disabled, or invalid values block provider mutation before a financial command is claimed |
| `VITE_GOOGLE_MAPS_API_KEY` | Browser | No | Address autocomplete restricted to approved web origins | Structured manual US address fields remain available |
| `VITE_SUPPORT_CASES_ENABLED` | Browser | No | Exact `enabled` gate for the staged private support-case center | Missing, empty, or any other value keeps support cases hidden and makes no support RPC calls |
| `DEALIVRA_RUNTIME_REJECTION_MODE` | Vercel Function | Required before rejection monitoring activation | Exact `staged` or `enforced` switch for the privacy-safe runtime rejection intake | Missing defaults to `staged` and records nothing; an invalid value returns `503` without accepting a report |
| `DEALIVRA_CLIENT_FAILURE_MODE` | Vercel Function | Required before client-failure monitoring activation | Exact `staged` or `enforced` switch for fixed-category browser failure intake | Missing defaults to `staged` and records nothing; an invalid value returns `503` without accepting a report |
| `SITE_URL` | Supabase Edge Function | Yes for payment flows | Canonical HTTPS origin used for Stripe redirects and the protected-function origin allowlist | Defaults to `https://dealivra.com`; nonmatching browser calls are denied |
| `DEALIVRA_ALLOWED_ORIGINS` | Supabase Edge Function | No | Comma-separated additional exact HTTPS origins for an approved environment | Invalid entries are ignored and cannot broaden access |
| `DEALIVRA_VERCEL_PROJECT_SLUG` | Supabase Edge Function | No | Expected Vercel project prefix for protected Preview deployments | Defaults to the current `dealsafe` project slug |
| `DEALIVRA_VERCEL_TEAM_SLUG` | Supabase Edge Function | No | Expected Vercel team suffix for protected Preview deployments | Defaults to the current `nika13` team slug |
| `DEALIVRA_MALWARE_SCANNER_URL` | Supabase Edge Function | Yes before evidence uploads are enabled | Separate reviewed HTTPS malware-scanner gateway | Quarantined file is rejected; nothing enters the final evidence vault |
| `DEALIVRA_MALWARE_SCANNER_TOKEN` | Supabase Edge Function | Yes before evidence uploads are enabled | Secret bearer credential for the scanner gateway | Scanner remains fail-closed and returns a safe unavailable message |

`VITE_` values are public by design and are included in the browser build. They must never contain a Supabase `service_role` JWT, an `sb_secret_` key, a Stripe secret, an email-provider key, or any other privileged credential.

## Fixed external reference services

The Smart Catalog VIN decoder uses the public NHTSA vPIC HTTPS API from a
Dealivra server route. It requires no API key and must not be configured as a
browser URL or called directly from browser code. The server fixes the provider
origin, validates the VIN and optional model year, limits response size, applies
a short timeout and bounded memory cache with a hashed key, and returns only
reviewed vehicle fields. Provider failure must leave manual year/make/model
entry available.

## Environment matrix

| Environment | Data/provider boundary | Access | Required behavior |
|---|---|---|---|
| Local | Local or dedicated developer Supabase project | Developer machine | Demo may run without providers; real sign-in uses `vercel dev` and complete client/server variables |
| Preview | Dedicated non-production project | Deployment protection and approved reviewers | Production-like Auth Functions, no real money, disposable test records |
| Staging | Dedicated staging project | Named internal testers | Release-candidate migrations, cross-user authorization tests, provider sandbox only |
| Production | Dedicated production project | Public only after release approval | Production provider accounts, monitored configuration, controlled changes, no sandbox/live mixing |

Preview, Staging, and Production must not share a Supabase project, Stripe account mode, storage bucket, webhook secret, or privileged API credential.

## Validation rules

- Supabase URLs must be an HTTPS origin without credentials, query parameters, fragments, or an extra path. Plain HTTP is accepted only for `localhost` or `127.0.0.1`.
- Browser and Auth Function configuration rejects keys beginning with `sb_secret_`.
- The one reviewed exception is `SUPABASE_AUTH_SECRET_KEY`, which is available
  only to server-side Vercel Auth Functions and is never used by browser code,
  the Data API, or as a user bearer token.
- Auth client-IP forwarding remains disabled unless the mode is exactly
  `enforced`, the secret key is valid, and one exact IPv4/IPv6 address is
  present in Vercel's `x-vercel-forwarded-for` system header. Arbitrary
  `x-forwarded-for` chains are not trusted.
- Signed-in password changes remain unavailable unless
  `DEALIVRA_CURRENT_PASSWORD_MODE` is exactly `enforced`. Enforced mode is
  permitted only after the matching Supabase project verifies the current
  password server-side. Recovery-token password completion does not use this
  switch.
- Protected payment Edge Functions require an exact allowed browser `Origin`.
  Missing, opaque, malformed, HTTP, foreign, or unexpected Vercel origins are
  denied before user/session and payment logic runs.
- Stripe provider mutations require the exact capability switch value
  `sandbox`. Missing, empty, `disabled`, unrecognized, or mixed-case values
  fail closed. A switch is not authorization: active-session, AAL2, participant
  or administrator role, recovery cooldown, trusted-command, Stripe test-key,
  provider-object, and `livemode=false` checks remain mandatory.
- Disabling new mutations does not disable the signed Stripe webhook. Provider
  events for already-created Sandbox objects must continue to reconcile and
  alert; operational shutdown uses the incident/financial freeze procedure.
- Preview matching is limited to the configured project and team slugs. A
  wildcard such as `*.vercel.app` or `*` is prohibited.
- Auth endpoints return generic user-facing errors and must never return configuration values.
- Server diagnostics may name the failing configuration category but must not log URLs, keys, tokens, cookies, passwords, or submitted identity data.
- Address autocomplete is optional. State, ZIP code, apartment/suite/unit, and the remaining address fields must continue to work without Google Maps.
- Support cases may be enabled only with the exact browser value `enabled`
  after the reviewed migration and rollback proof pass, the operator queue has
  a named owner, and alert/SLA coverage is active. Any other value must fail
  closed. This browser-visible switch is not authorization; database grants,
  assignment, role checks, and AAL2 remain authoritative.
- Runtime rejection monitoring may move from `staged` to `enforced` only after
  the environment has an approved log drain, 30-day-or-shorter raw retention,
  named alert ownership, a same-origin endpoint Firewall threshold, and a
  synthetic event/rollback rehearsal. The intake may record only the reviewed
  event schema, boundary, issue, count, environment, release, event ID, and
  receipt time. URLs, headers, IP addresses, identifiers, rejected values, and
  provider content are prohibited.
- Client-failure monitoring follows the same drain, 30-day-or-shorter raw
  retention, named ownership, Firewall, protected synthetic proof, and
  rollback gates. It may record only a fixed render/bootstrap/runtime category,
  bounded count, environment, release, random event ID, and receipt time.
  Error objects/messages, stacks, component stacks, URLs, browser state,
  customer identifiers, and provider content are prohibited.
- Web Vital monitoring may move from `staged` to `enforced` only after the
  approved drain, 30-day-or-shorter retention, named alert owner, same-origin
  endpoint Firewall threshold, protected synthetic proof, and rollback
  rehearsal pass. It may record only a fixed metric, rating, bucket, count,
  environment, release, random event ID, and receipt time. Exact values, URLs,
  routes, referrers, headers, IPs, devices, and customer/session identifiers
  are prohibited.
- NHTSA vPIC is optional at runtime. VIN decoding failure must not block manual vehicle entry or publishing.
- Recovery controls may move from `staged` to `enforced` only after the
  reviewed recovery migration and rollback proof pass in that environment.
  The value must be identical in Vercel and Supabase Edge Functions. Recovery
  completion is prohibited while either runtime remains `staged`.
- Security notification delivery may move to `enforced` only after the sender
  subdomain is verified, the worker secret is stored in Supabase Vault, the
  retry/dead-letter alert has an owner, and controlled delivery/bounce tests
  pass. These secrets must never use a `VITE_` prefix.
- Auth client-IP forwarding may move to `enforced` only after the matching
  Supabase project setting is explicitly enabled, the environment-specific
  secret key is stored in Vercel, Preview journey/rate-limit tests pass, and
  raw IP/key absence is verified in browser bundles and logs.
- Signed-in password changes may move to `enforced` only after the provider's
  current-password control is enabled, the protected Preview negative matrix
  passes, and successful changes force a fresh sign-in. Password values must
  not appear in any release evidence.

## Change procedure

1. Select the intended environment and confirm it does not point to another environment's data or provider account.
2. Add or rotate values in the hosting provider's encrypted environment store.
3. Redeploy from a reviewed commit; do not expose values in a build log, screenshot, issue, or pull-request body.
4. Verify the safe health behavior, sign-up, sign-in, refresh, logout, and one authorized/unauthorized Deal Link scenario.
5. Record the change owner, time, environment, and verification result without recording the value itself.
6. Roll back immediately if the deployment mixes environments or exposes a privileged credential.

## Release evidence

Before a public or paid release, the release record must prove:

- required variables exist in the intended environment;
- no browser variable contains a privileged key;
- Preview/Staging and Production provider identifiers differ;
- authentication fails safely when a required value is removed in a controlled test;
- the final deployment passed automated verification and a protected Preview smoke test.
