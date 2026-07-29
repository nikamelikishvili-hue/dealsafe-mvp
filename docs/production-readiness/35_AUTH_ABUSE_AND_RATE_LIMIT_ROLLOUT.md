# Authentication abuse and rate-limit rollout

## Current application boundary

Dealivra routes account creation, password sign-in, and password-reset requests
through same-origin server endpoints. Password recovery no longer calls the Auth
provider directly from browser code.

The server:

- validates a bounded request before contacting the provider;
- derives the recovery redirect from the already verified request origin;
- returns the same accepted recovery message whether or not an account exists;
- preserves provider throttling as HTTP `429` with a bounded `Retry-After`
  value between 1 and 300 seconds;
- records only a fixed schema, operation, HTTP status, and bounded provider
  code for rejected Auth requests;
- never logs an email, password, token, cookie, IP address, request body, or
  provider response message.

Provider limits remain a required second layer. An application response must
not imply that Dealivra can override a Supabase Auth sending or request limit.

## Proposed Vercel Firewall observation rules

The first live firewall stage is **log-only**. Limits are intentionally five to
ten times above expected legitimate private-beta behavior:

| Route and method | Observation window | Generous threshold | Count key |
|---|---:|---:|---|
| `POST /api/auth/signup` | 10 minutes | 50 | IP |
| `POST /api/auth/recover` | 10 minutes | 50 | IP |
| `POST /api/auth/login` | 10 minutes | 200 | IP |
| `POST /api/auth/mfa` | 10 minutes | 200 | IP |
| `POST /api/security/mfa-recovery` | 10 minutes | 40 | IP |
| `POST /api/vehicles/vin` | 10 minutes | 200 | IP |
| `POST /api/security/csp-report` | 1 minute | 300 | IP |

Vercel rate counters are regional. These thresholds are therefore observation
controls, not proof of a globally exact request count.

No rule is created or published by this repository stage. Before enforcement,
an operator must create each rule with action `log`, publish that draft, and
review at least seven days of traffic for shared-network, accessibility-tool,
mobile-browser, monitoring, and legitimate retry patterns.

## Required staged rollout

1. **Production log only:** confirm that the proposed route and method match
   only the intended API traffic.
2. **Preview enforcement:** change the reviewed rule to `rate_limit` only in
   Preview and run the positive, burst, reset-window, and shared-IP matrix.
3. **Production log recheck:** retain log mode in Production after any
   threshold or route change.
4. **Production enforcement:** publish only after a named security owner
   approves the observed false-positive rate and rollback.
5. **First-day monitoring:** watch 429 rate, account creation, login success,
   reset completion, support contacts, and provider throttling.

Rollback changes the rule action back to `log` or disables that one rule. It
must not use a broad bypass, disable platform DDoS mitigation, or weaken
same-origin validation.

## CAPTCHA decision gate

CAPTCHA is not enabled solely because a route is public. A challenge may be
added only after log evidence shows automation that the generous rate limits
cannot contain. The selected challenge must:

- support keyboard and screen-reader use;
- avoid blocking password managers and legitimate shared networks;
- collect the minimum provider data under an approved privacy/DPA review;
- fail safely without silently locking every user out;
- have a non-CAPTCHA support recovery path;
- be verified in Preview before any Production enforcement.

## Remaining SEC-006 gates

- Observe real protected traffic before choosing enforcement thresholds.
- Assign the firewall alert and rollback owner.
- Add provider-side Auth metrics for 429 and mail-send suppression.
- Verify reset, login, MFA, and signup burst/velocity matrices in Preview.
- Decide whether a challenge provider is necessary based on measured abuse.
- Extend the same layered policy to deal creation, messaging, evidence intake,
  Checkout creation, payment release, public access codes, and admin actions.

## Current references

- Vercel Firewall and WAF:
  `https://vercel.com/docs/vercel-firewall`
- Vercel Firewall CLI:
  `https://vercel.com/docs/cli/firewall`
- Supabase Auth rate limits:
  `https://supabase.com/docs/guides/auth/rate-limits`

