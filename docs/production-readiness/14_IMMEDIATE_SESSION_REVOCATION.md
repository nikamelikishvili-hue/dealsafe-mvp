# Immediate session revocation

## Purpose

Supabase Auth revokes refresh sessions immediately, but an access JWT already
issued to that session can otherwise remain usable until its short expiry.
Dealivra therefore validates the JWT's `sub` and `session_id` against
`auth.sessions` before allowing signed-in data, private file, or protected
payment operations.

This control is fail-closed for authenticated users and deliberately leaves
anonymous public Deal Link reads and trusted service operations unchanged.

## Enforcement map

| Request path | Enforcement |
|---|---|
| Data API (`/rest/v1`) | PostgREST `pgrst.db_pre_request` calls `public.enforce_active_auth_session()` |
| Storage (`/storage/v1`) | One restrictive `storage.objects` policy requires `public.is_current_auth_session_active()` in addition to the existing permissive policy |
| Protected Stripe Edge Functions | `requireUser()` validates the JWT with Auth and then calls the service-role-only active-session RPC |
| Stripe webhook | No user session is involved; Stripe signature verification remains the authentication boundary |
| Public Deal Link RPCs and public item media | Anonymous behavior remains unchanged |
| Realtime | Not used by the current application |

The shared lookup requires an exact session ID and user ID match and rejects a
session whose optional `not_after` limit has passed. The function exposes no
session metadata and can only be called with arbitrary IDs by `service_role`.

## Deployment order

1. Apply `active_session_validation.sql`.
2. Prove positive and negative lookups without returning user or session IDs.
3. Deploy the four JWT-protected Stripe functions with the updated shared
   validator.
4. Apply `active_session_enforcement.sql`.
5. Prove anonymous public RPC access still works, invalid sessions return 401,
   the restrictive Storage policy is present, and the role setting points to
   the expected pre-request function.
6. Keep production and Preview access protection enabled.

## Emergency rollback

Run `active_session_enforcement_rollback.sql`. It resets only the PostgREST
pre-request setting and removes the restrictive Storage policy, then reloads
PostgREST configuration. The validation helpers remain installed so the
already-deployed protected Edge Functions do not break.

Rollback is an incident response, not a silent release shortcut. Record the
reason, timestamp, operator, affected requests, and follow-up correction before
reenabling enforcement.

## Verification boundaries

Database simulation can prove:

- one currently active real session maps to `true` without exposing its IDs;
- a random session ID for a real user maps to `false`;
- malformed, missing, anonymous, and mismatched claims do not pass the
  authenticated helper;
- the service RPC is not executable by `anon` or `authenticated`;
- the Storage control is restrictive rather than a replacement for ownership
  and participant policies.

A release remains incomplete until a two-device end-to-end test proves that
revoking device B from device A blocks B's Data API, private Storage, and
protected Edge Function actions before B's original JWT expiry.

