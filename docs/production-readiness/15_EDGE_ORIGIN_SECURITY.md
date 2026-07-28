# Protected Edge Function origin security

## Scope

This control applies to the four authenticated payment functions invoked by
the Dealivra browser:

- `stripe-connect`
- `stripe-create-checkout`
- `stripe-release-payment`
- `stripe-resolve-dispute`

The Stripe webhook is intentionally excluded. Stripe calls it server to server,
and the function authenticates the raw request body with the configured Stripe
webhook signature and timestamp tolerance.

## Deny-by-default behavior

The shared Edge Function boundary requires a browser `Origin` before any
session, database, or Stripe operation runs. It allows:

1. The canonical `SITE_URL` HTTPS origin.
2. `https://dealivra.com` and `https://www.dealivra.com`.
3. Additional exact HTTPS origins explicitly listed in
   `DEALIVRA_ALLOWED_ORIGINS`.
4. HTTPS Vercel Preview hosts that match both the configured Dealivra project
   prefix and team suffix.

It rejects:

- a missing or opaque (`null`) origin;
- malformed origins or origins containing credentials;
- HTTP and unexpected ports;
- foreign domains;
- broad `*.vercel.app` hosts;
- Preview hosts for another project or team;
- preflight methods other than `POST`;
- preflight headers outside the reviewed allowlist.

Allowed responses echo the exact approved origin, include `Vary: Origin`, and
never return `Access-Control-Allow-Origin: *`. Responses use `no-store`.
Preflight responses expire after ten minutes.

## Layering

CORS/origin validation is a supplemental browser boundary, not authorization.
Every protected function must still:

- require a platform-verified user JWT;
- resolve the user through Supabase Auth;
- require the exact Auth session to remain active;
- enforce deal participant or administrator authorization;
- validate trusted deal, payment, currency, account, and state data;
- use Stripe Sandbox until paid-release approval.

Non-browser clients must not bypass the browser functions by omitting
`Origin`. A future mobile or server integration requires a separately reviewed
authentication path and cannot silently weaken this boundary.

## Verification matrix

| Request | Expected result |
|---|---|
| Approved production origin, valid preflight | `204`, exact origin echoed |
| Approved owned Preview origin, valid preflight | `204`, exact origin echoed |
| Foreign origin | `403`, no permissive CORS header |
| Another Vercel team/project | `403`, no permissive CORS header |
| Missing or `null` origin | `403`, no permissive CORS header |
| Disallowed requested method/header | `403`, no permissive CORS header |
| Approved origin without JWT | Gateway/function authentication failure |
| Approved origin with revoked session | `401` |
| Stripe webhook with valid signature | Continues on the signature-only server path |

## Change control

- Changes to the exact origins or Preview project/team values require a
  reviewed configuration change and a new allow/deny verification record.
- Production and Preview should use separate Supabase projects before public
  release; sharing the current project is temporary and remains a release
  blocker.
- If an origin is unexpectedly denied, add only the exact reviewed origin or
  correct the project/team configuration. Never restore wildcard CORS.

This control completes the browser CORS/origin portion of SEC-005. Full CSRF
closure remains tied to the future SEC-001 server-managed session architecture.
