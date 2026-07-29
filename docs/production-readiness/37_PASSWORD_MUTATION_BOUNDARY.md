# Password mutation boundary

Password reset completion and signed-in password changes are materially
different security operations. Dealivra routes both through one same-origin
server endpoint but applies separate authorization and activation rules.

## Implemented boundary

### Recovery completion

- The browser sends the recovery access token only as a bearer credential to
  `POST /api/auth/password`.
- The new password is validated by the same server rule used for account
  creation before Supabase is contacted.
- The server sends only the reviewed password attribute to the fixed Supabase
  Auth `user` endpoint.
- A successful change clears any Dealivra refresh cookie and browser-stored
  short-lived session before the user signs in with the new password.
- Invalid or expired recovery sessions receive a bounded, customer-safe error.
  Raw provider messages, credentials, tokens, and account details are not
  returned or logged.

### Signed-in change

- The form requires current password, new password, and confirmation.
- The server sends `current_password` and the new password directly to
  Supabase Auth over the authenticated server boundary.
- Signed-in changes default to fail-closed `staged` mode.
- `DEALIVRA_CURRENT_PASSWORD_MODE=enforced` is accepted only after the matching
  Supabase project's **Require current password** control is enabled and
  verified.
- Success clears the refresh cookie and browser session, then sends the user to
  a fresh sign-in. This avoids continuing with a session whose provider
  lifetime may have changed after a security-sensitive action.
- Provider throttling remains HTTP 429 with bounded retry guidance.

Passwords are never written to Dealivra database tables, analytics, audit
events, support references, URLs, local storage, session storage, or logs.

## Activation gate

Signed-in password change is **not active**. Recovery completion remains
available.

Preview activation requires:

1. Enable **Require current password when changing password** in the dedicated
   non-production Supabase Auth project.
2. Reopen the setting and record only its enabled state, never a password or
   credential.
3. Set `DEALIVRA_CURRENT_PASSWORD_MODE=enforced` only in the matching protected
   Vercel Preview environment.
4. Redeploy a reviewed commit.
5. Verify correct current password, incorrect current password, missing current
   password, weak new password, same-as-current password, expired access token,
   provider 429, and provider 5xx behavior.
6. Verify successful change clears the current Dealivra browser session and
   requires fresh sign-in with the new password.
7. Verify old credentials fail and no password appears in browser storage,
   Vercel logs, Supabase logs inspected through approved tooling, analytics,
   screenshots, or release evidence.
8. Verify recovery with valid, expired, reused, and newly requested links.
9. Confirm password-change and recovery security notifications have an owner
   before public launch.

Production requires a separate change window and the same matrix against the
Production project. Preview and Production credentials, data, and evidence
must not be mixed.

## Rollback

1. Set `DEALIVRA_CURRENT_PASSWORD_MODE=staged`.
2. Redeploy the last reviewed commit.
3. Confirm signed-in change fails safely while password recovery still works.
4. Keep the provider's current-password control enabled unless a reviewed
   incident decision explicitly requires otherwise.

Rollback must never restore the previous direct browser password-mutation path.

## Source references

- Supabase password-based Auth:
  <https://supabase.com/docs/guides/auth/passwords>
- Supabase password security and current-password verification:
  <https://supabase.com/docs/guides/auth/password-security>
- Supabase user update:
  <https://supabase.com/docs/reference/javascript/auth-updateuser>
- Supabase sessions:
  <https://supabase.com/docs/guides/auth/sessions>

