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

## Privileged enrollment runbook

The activation migration contains a database guard that refuses to run while
any `support`, `compliance`, or `admin` account has fewer than two verified TOTP
factors. The guard returns aggregate counts only and never returns an account
identifier.

Before enrollment:

1. Keep Vercel Authentication enabled and custom domains detached.
2. Confirm that the operator is using the intended privileged account and a
   clean, fully updated browser.
3. Prepare two independently recoverable authenticator stores. Do not place
   both factors only in the same unsynchronized device or password-manager
   vault.
4. Assign a second authorized reviewer and an internal case reference.
5. Do not copy a QR code, TOTP secret, current code, refresh token, or factor ID
   into a ticket, chat, screenshot, log, or this runbook.

For each privileged account:

1. Sign in through the protected Dealivra deployment and open
   **Profile → Authenticator protection**.
2. Enroll the primary authenticator with a device-specific friendly label.
   Scan the QR code directly into the intended authenticator and submit one
   fresh six-digit code.
3. Confirm that the factor is shown as verified and the current session has
   reached `aal2`.
4. Enroll the independently recoverable secondary authenticator and verify it
   with a fresh code.
5. Sign out. Complete a password-plus-primary-factor login in one protected
   browser session.
6. Sign out again. Complete a password-plus-secondary-factor login from the
   second approved device or isolated browser profile.
7. Confirm the factor inventory reports at least two verified TOTP factors.
   Record only the non-secret results defined below.

The reviewer records:

| Field | Allowed value |
|---|---|
| Internal case reference | Non-secret ticket/reference number |
| Application role | `support`, `compliance`, or `admin` |
| Verified factor count | Aggregate integer; minimum `2` |
| Primary login | Pass/fail and UTC timestamp |
| Secondary login | Pass/fail and UTC timestamp |
| Password-only protected request | Must fail with the governed MFA response |
| Data API / Storage / protected Function matrix | Pass/fail only |
| Operator and reviewer | Approved internal identities |
| Secret material | Never recorded |

Run `supabase/mfa_privileged_enrollment_readiness.sql` after every privileged
account completes the matrix. Activation is permitted only when
`rollout_blocked_accounts = 0` and `activation_state = 'ready'`. The migration
repeats this check atomically and aborts if the state changes.

## Privileged lost-factor matrix

| Situation | Allowed response | Prohibited shortcut |
|---|---|---|
| One verified factor remains | Authenticate at `aal2`, revoke the lost factor, enroll and verify a replacement, revoke other sessions, and rerun both-device checks | Removing the remaining factor first |
| No verified factor remains | Freeze privileged use, open an immutable recovery case, repeat approved identity proofing, require a second reviewer, revoke all sessions/factors through an approved administrative procedure, notify verified channels, apply the cooldown, then bind two new factors | Email-only reset, support-agent override, or temporary MFA disablement |
| Suspected factor theft | Revoke sessions, freeze sensitive changes and financial actions, preserve evidence, notify the account owner, and follow incident response | Continuing to use the affected session |
| Reviewer unavailable | Keep the account blocked and escalate to the named security owner | One-person privileged recovery |
| Notification or audit unavailable | Stop recovery and treat the outage as a launch blocker | Completing an unrecorded recovery |

Dealivra currently has no approved self-service all-factors-lost recovery and no
recovery-code claim. The no-factor path therefore remains deliberately blocked
until immutable case handling, notification delivery, cooldown enforcement, and
the privileged administrative recovery command are implemented and rehearsed.

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
- The activation migration aborts with
  `DEALIVRA_PRIVILEGED_MFA_ENROLLMENT_INCOMPLETE` unless every privileged
  account has at least two verified TOTP factors.
- The read-only readiness query returns only aggregate ready/blocked counts and
  no user, email, factor, or secret value.

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
