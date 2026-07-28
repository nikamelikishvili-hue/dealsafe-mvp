# Environment configuration standard

Dealivra must use separate configuration for Local, Preview, Staging, and Production. A value copied into one environment is not automatically approved for another. Secrets and privileged credentials must never be placed in a browser-prefixed variable.

## Configuration inventory

| Variable | Exposure | Required | Purpose | Safe failure |
|---|---|---:|---|---|
| `VITE_SUPABASE_URL` | Browser | Yes | Supabase project origin used by the web client | Account and live Deal Link operations show an unavailable message |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Yes | Browser-safe Supabase publishable or legacy anon key | Account and live Deal Link operations remain disabled |
| `SUPABASE_URL` | Server | Yes outside local static demo | Supabase project origin used by same-origin Auth Functions | Auth Function returns a generic `503` and logs a safe diagnostic |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Yes outside local static demo | Browser-safe publishable key used by Auth Functions | Auth Function returns a generic `503` and logs a safe diagnostic |
| `VITE_GOOGLE_MAPS_API_KEY` | Browser | No | Address autocomplete restricted to approved web origins | Structured manual US address fields remain available |
| `SITE_URL` | Supabase Edge Function | Yes for payment flows | Canonical HTTPS origin used for Stripe redirects and the protected-function origin allowlist | Defaults to `https://dealivra.com`; nonmatching browser calls are denied |
| `DEALIVRA_ALLOWED_ORIGINS` | Supabase Edge Function | No | Comma-separated additional exact HTTPS origins for an approved environment | Invalid entries are ignored and cannot broaden access |
| `DEALIVRA_VERCEL_PROJECT_SLUG` | Supabase Edge Function | No | Expected Vercel project prefix for protected Preview deployments | Defaults to the current `dealsafe` project slug |
| `DEALIVRA_VERCEL_TEAM_SLUG` | Supabase Edge Function | No | Expected Vercel team suffix for protected Preview deployments | Defaults to the current `nika13` team slug |

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
- Protected payment Edge Functions require an exact allowed browser `Origin`.
  Missing, opaque, malformed, HTTP, foreign, or unexpected Vercel origins are
  denied before user/session and payment logic runs.
- Preview matching is limited to the configured project and team slugs. A
  wildcard such as `*.vercel.app` or `*` is prohibited.
- Auth endpoints return generic user-facing errors and must never return configuration values.
- Server diagnostics may name the failing configuration category but must not log URLs, keys, tokens, cookies, passwords, or submitted identity data.
- Address autocomplete is optional. State, ZIP code, apartment/suite/unit, and the remaining address fields must continue to work without Google Maps.
- NHTSA vPIC is optional at runtime. VIN decoding failure must not block manual vehicle entry or publishing.

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
