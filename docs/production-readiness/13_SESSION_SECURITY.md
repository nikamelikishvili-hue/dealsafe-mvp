# Session security

## Purpose

Dealivra users need to understand where their account is signed in and end
unwanted sessions without accidentally signing out every device. Session
controls must not expose precise location, IP addresses, refresh tokens, or
another user's activity.

This control supports SEC-002. Immediate active-session enforcement is defined
in [14_IMMEDIATE_SESSION_REVOCATION.md](14_IMMEDIATE_SESSION_REVOCATION.md).
SEC-002 remains open until the required two-device negative authorization test,
security notification, and account-takeover recovery evidence are complete.

## User-facing behavior

| Action | Auth provider scope | Current browser cookie | Expected result |
|---|---|---|---|
| Header **Sign out** | `local` | Cleared | Signs out only this device |
| **Sign out other devices** | `others` | Preserved | Revokes every refresh session except this device |
| **Sign out everywhere** | `global` | Cleared only after provider success | Revokes all refresh sessions and returns this app to the signed-out state |

Global sign-out requires a second explicit confirmation. If remote revocation
fails, Dealivra keeps the current session and shows an error rather than claiming
success. Ordinary local sign-out still removes the browser-held session when the
provider is temporarily unavailable.

## Private session inventory

`public.get_my_account_sessions()` is a `SECURITY DEFINER`, `STABLE` function
with an empty `search_path`. It:

- requires a non-null `auth.uid()`;
- reads only `auth.sessions` rows whose `user_id` equals `auth.uid()`;
- returns at most 20 recent sessions;
- identifies the current row with the signed JWT's `session_id`;
- exposes only session ID, creation time, last activity time, optional expiry,
  bounded user-agent text, and current-session status;
- never returns IP, refresh-token, HMAC, factor, OAuth-client, or other-user
  data;
- denies `PUBLIC` and `anon` execution and grants only `authenticated`.

The UI converts the bounded user-agent string into a simple browser/device label.
Raw location and IP information are intentionally absent.

## Failure and accessibility behavior

- Remote session actions are disabled while a request is active.
- Provider failures use an inline alert and do not remove the current cookie.
- Loading and success states are announced through status regions.
- The destructive global action is visually distinct and requires a second
  action.
- The session list and actions collapse to one column below 720 px.
- Reduced-motion users do not receive the refresh spinner animation.
- The interface has no horizontal overflow at the reviewed 390 px mobile
  viewport.

## Verification evidence

- Endpoint tests prove the exact `local`, `others`, and `global` provider scopes.
- Negative tests reject unsupported scopes before contacting the provider.
- Failure tests prove that an unsuccessful `others` request does not clear the
  current refresh cookie or report success.
- Database inspection confirms empty `search_path`, owner filtering,
  `anon = false`, `authenticated = true`, and an IP/refresh-secret-free result
  shape.
- Desktop and 390 px browser fixtures render two sessions, one current badge,
  both scoped actions, and the global confirmation state without overflow or
  console errors.

## Remaining SEC-002 work

Before SEC-002 can be marked complete:

1. Add cross-device end-to-end tests proving a revoked device cannot perform a
   sensitive action before its original JWT expiry.
2. Add a security notification when other or all devices are signed out.
3. Define support evidence and recovery steps for suspected account takeover.

Production access protection and real-money disablement remain in force while
these release gates are open.
