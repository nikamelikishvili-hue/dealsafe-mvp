# Privileged MFA recovery control

## Decision

Dealivra does not allow email-only or one-person recovery when a privileged
account loses every authenticator.

The recovery foundation uses a dual-control state machine:

1. an AAL2 `support`, `compliance`, or `admin` operator opens a case;
2. an authorized operator records approved identity re-proofing;
3. a different AAL2 `compliance` or `admin` reviewer approves or rejects it;
4. a service-only workflow revokes every Auth session and verified factor;
5. the database verifies that both inventories are empty before completion;
6. completion starts a 72-hour hold on payout, email, and MFA changes;
7. every material transition creates an immutable audit event and a
   verified-channel notification job.

The target account can never open, attest, review, or complete its own
privileged recovery.

## Implemented foundation

`supabase/privileged_mfa_recovery_control.sql` adds three RLS-enabled tables in
the non-exposed `dealsafe_private` schema:

- `privileged_mfa_recovery_cases` stores the controlled state transition;
- `sensitive_change_holds` stores payout, email, and MFA cooldowns;
- `security_notification_outbox` stores template keys and target user IDs, not
  recipient addresses or authentication secrets.

Direct table access is denied to `anon`, `authenticated`, and `service_role`.
The only entry points are exact RPC grants.

Authenticated recovery RPCs require an `aal2` JWT containing a TOTP
authentication method no older than ten minutes. Opening and identity-proof
actions allow `support`, `compliance`, or `admin`. Review requires
`compliance` or `admin`, and the database rejects the requester as reviewer.

Service-only RPCs can:

- finalize an approved case after verifying that `auth.sessions` and verified
  `auth.mfa_factors` are empty;
- test whether a payout, email, or MFA change is still held;
- claim and complete bounded notification-delivery jobs.

The service completion RPC records external revocation references, but it does
not itself delete Auth records. This separation prevents a browser or ordinary
Data API request from becoming a hidden MFA bypass.

## Immutable history

Every state transition appends a material event to `public.audit_events`.
`immutable_material_audit_events.sql` rejects update, delete, and truncate for
every application role. Recovery metadata contains only case IDs, non-secret
internal references, target user IDs, decisions, and cooldown timestamps.

No password, TOTP code, QR value, authenticator secret, access token, refresh
token, email address, identity document, or identity-document image may be
stored in the case, event metadata, or notification payload.

## Security notifications

The outbox separates the security decision from email delivery:

- a worker receives a target user ID, template key, and bounded payload;
- the worker resolves the verified channel in a trusted server context;
- delivery attempts are leased with `FOR UPDATE SKIP LOCKED`;
- a delivery reference or bounded failure code closes each attempt.

Supabase also supports project-level security notification templates for
password, email, phone, identity, and MFA enrollment/removal events. Those
native notifications should be enabled and verified separately; the custom
outbox covers Dealivra's recovery-case events.

## Cooldown enforcement contract

The completion step creates three holds:

| Scope | Minimum hold |
|---|---:|
| Payout setup, destination, enablement, or seller-fund release | 72 hours |
| Account email change | 72 hours |
| MFA enrollment or removal | 72 hours |

`assert_my_sensitive_change_allowed(scope)` is the authenticated boundary for
same-user mutations. `is_sensitive_change_allowed_for_service(user, scope)` is
the service boundary for Stripe, email, and administrative workflows.

The migration establishes the contract but is deliberately not active in
production yet. The repository now calls the boundary from MFA enrollment,
MFA enrollment verification, MFA removal, seller payout onboarding, ordinary
seller-fund release, and seller-favoring dispute release. Buyer refunds remain
available because they return funds rather than paying the recovered account.
Email changes have no runtime mutation path in the current product.

## Verification

- `server/mfaRecoveryPolicy.mjs` rejects malformed UUIDs, unapproved reason,
  proof, decision, and scope values, and references that appear to contain
  passwords, codes, tokens, email addresses, or secrets.
- `api/security/mfa-recovery.mjs` requires same-origin POST, a bearer session,
  fresh TOTP AAL2 for operator actions, and a privileged application role.
- `supabase/tests/privileged_mfa_recovery_control_rollback.sql` verifies RLS,
  zero direct table access, exact RPC grants, fixed search paths, dual-control
  state transitions, provider-side session/factor checks, the 72-hour hold,
  and the immutable-audit dependency.
- Repository tests verify request validation and that no recovery secret is
  returned or logged.
- The 2026-07-29 read-only Production dependency check confirmed that
  `public.profiles`, `public.audit_events`, the immutable audit trigger,
  `public.current_user_app_role()`, `authenticated`, and `service_role` exist.
  The check returned booleans only and did not create recovery state.

## Release boundary

This stage does not authorize:

- applying the recovery migration to production;
- deleting a factor or session;
- enabling mandatory MFA enforcement;
- public access;
- real-money processing or payout;
- treating the notification outbox as delivered email.

Production activation remains blocked until a second authorized reviewer
exists, the notification worker is connected to a verified channel, every
sensitive mutation path enforces its scope, the recovery procedure is
rehearsed, and the password-only negative matrix passes.

## Current references

- Supabase MFA and AAL guidance:
  `https://supabase.com/docs/guides/auth/auth-mfa`
- Supabase session revocation behavior:
  `https://supabase.com/docs/guides/auth/sessions`
- Supabase security notification templates:
  `https://supabase.com/docs/guides/auth/auth-email-templates`
- Supabase Auth changelog:
  `https://supabase.com/changelog?tags=auth`
