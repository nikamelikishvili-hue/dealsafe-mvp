# Protected Edge Function origin security

## Scope

This control applies to every authenticated Edge mutation invoked by the
Dealivra browser:

- `evidence-files`
- `evidence-maintenance` (interactive administrator path only)
- `stripe-connect`
- `stripe-create-checkout`
- `stripe-release-payment`
- `stripe-resolve-dispute`

The Stripe webhook is intentionally excluded. The security-notification
dispatcher is also excluded. These server-to-server routes are authenticated
respectively by a Stripe signature/timestamp and a separate constant-time
worker credential. The scheduled evidence-maintenance path likewise uses its
dedicated maintenance credential before the browser boundary is considered.

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
- every non-`POST` browser request other than a valid `OPTIONS` preflight.

Allowed responses echo the exact approved origin, include `Vary: Origin`, and
never return `Access-Control-Allow-Origin: *`. Responses use `no-store`.
Preflight responses expire after ten minutes.
Method rejection is centralized before a feature handler runs and returns
`405` with `Allow: POST, OPTIONS`, so a new browser Edge mutation cannot
accidentally execute on `GET`, `PUT`, `PATCH`, or `DELETE` merely because its
feature handler omitted a local method check.

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
| Approved origin with a non-POST actual method | `405`, `Allow: POST, OPTIONS` |
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
