# MFA and privileged step-up

## Decision

Dealivra uses Supabase Auth TOTP as the first production MFA factor.

- Ordinary members may enroll voluntarily. Once a verified factor exists, an
  `aal1` session is denied across the Data API, Storage, and protected Edge
  Functions.
- `support`, `compliance`, and `admin` roles require `aal2` even before a factor
  is enrolled. This makes enrollment a prerequisite for privileged use.
- A password login for an enrolled account returns only a short-lived pending
  access token. It does not create the Dealivra refresh cookie or enter the
  application until the TOTP challenge succeeds.
- The long-lived refresh token remains in the
  `__Host-dealivra-refresh` HttpOnly, Secure, SameSite=Strict cookie and is never
  returned to browser JavaScript.

TOTP is not phishing-resistant. It materially improves account-takeover
resistance, but it does not close the backlog requirement for phishing-resistant
privileged authentication. A documented, supported WebAuthn/passkey path and
recovery operating procedure are required before SEC-003 can be marked fully
complete.

## Browser and server flow

### Sign-in

1. The password is exchanged by the same-origin Vercel Auth Function.
2. If no verified factor exists, the normal short-lived access token and
   server-only refresh cookie are issued.
3. If a verified TOTP factor exists, the refresh secret is discarded and the
   browser receives a pending `aal1` access token plus safe factor labels.
   If Supabase reports a verified factor type that the current Dealivra client
   cannot challenge, sign-in fails closed without issuing a refresh cookie.
4. The browser sends the selected factor and six-digit code to the same-origin
   MFA function.
5. The function creates a fresh challenge and verifies it directly with
   Supabase Auth.
6. Only an `aal2` response is accepted. The rotated refresh secret is written
   to the HttpOnly cookie and only then is the application session stored.

### Enrollment

1. A signed-in user chooses a device label in the account security center.
2. The same-origin function creates an unverified TOTP factor.
3. The QR SVG is encoded as an image URL. It is never inserted as HTML.
4. The setup secret exists only in component memory and is not persisted or
   logged.
5. A fresh challenge and six-digit code activate the factor.
6. Supabase invalidates other sessions and the current browser receives a new
   `aal2` session.

### Removal

- Supabase requires an `aal2` session to remove a verified factor.
- Dealivra asks for explicit confirmation.
- After removal, the server refreshes the session so the JWT reflects the
  current factor state.
- Users are prompted to keep a second enrolled authenticator before replacing
  their primary device.

## Defense in depth

| Boundary | Enforcement |
|---|---|
| Application entry | Enrolled accounts receive the step-two screen before the application |
| Data API | Pre-request hook returns `DEALIVRA_MFA_REQUIRED` with HTTP 403 |
| Storage | Restrictive all-command policy checks the same assurance helper |
| Protected Edge Functions | Verified factor or privileged role requires JWT `aal2` |
| Refresh | An enrolled account cannot refresh into an `aal1` application session |
| Privileged roles | `support`, `compliance`, and `admin` always require `aal2` |

The database helper is in the non-exposed `dealsafe_private` schema, uses a
fixed empty search path, and has exact execution grants. Role authorization
comes from the server-controlled `profiles.app_role`; it never trusts editable
user metadata.

## Recovery boundary

Dealivra does not generate or claim support for recovery codes in this stage.
Losing every enrolled authenticator must not be solved by disabling MFA after
an email-only request.

Before external beta, the operating procedure must require:

1. a support case with immutable audit history;
2. identity re-proofing at least as strong as the original enrollment risk;
3. a second authorized reviewer for privileged accounts;
4. revocation of all sessions and factors;
5. a security notification to the verified account channels;
6. a cooldown before payout, email, or MFA changes become effective.

Until that procedure and notification channel are active, account recovery is
a manual launch blocker rather than a bypass.

## Verification

- Unit tests cover pending password login, challenge/verify, input rejection,
  AAL2-only session acceptance, unsupported-factor fail-closed behavior, and
  refresh-secret confidentiality.
- Repository tests require the shared Data API, Storage, Edge Function, client,
  and UI enforcement paths.
- The rollback-only SQL proof checks the private helper boundary, exact role and
  factor logic, fail-closed 403 response, and restrictive Storage policy.
- The emergency rollback removes the Storage policy and restores the prior
  active-session-only pre-request hook.
- The complete release gate passes catalog validation, TypeScript, 72 automated
  tests, repository secret scanning, production build, and Preview smoke.
- Browser verification passes at 1280px and 390px without error overlays,
  console warnings, or horizontal overflow. The step-two button remains
  disabled until exactly six digits are present.

## Release boundary

This stage does not authorize public launch, external private beta,
real-money processing, automatic payout, scanner activation, or removal of
Vercel protection.

Before the migration is activated in production:

- every existing privileged account must enroll and verify at least two TOTP
  factors in a protected Preview;
- password + TOTP sign-in must pass on a second device;
- password-only Data API, Storage, and Edge Function requests must fail;
- lost-factor recovery must be approved and rehearsed;
- phishing-resistant privileged authentication must receive a separate
  supported implementation decision.

The 2026-07-28 read-only production readiness query found one `admin` account
and zero verified factors. The migration therefore remains deliberately
unapplied; enabling it now would lock that account out of privileged access.
