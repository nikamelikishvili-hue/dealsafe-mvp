# Suspected account takeover response

## Purpose

This runbook defines the minimum safe response when a Dealivra customer reports
an unknown sign-in, unauthorized account change, suspicious Deal activity, or a
lost authenticator. It supplies the support and recovery evidence required by
SEC-002 without authorizing Production activation, real payments, or access to
identity documents outside the approved verification system.

The primary objective is containment. Support must not trade immediate account
safety for a faster password reset or rely on email access alone as proof of
identity.

## Severity and ownership

| Condition | Severity | Initial owner | Response target |
|---|---|---|---:|
| Unknown session with no material action | SEV-2 | Support + Security | 30 minutes |
| Unauthorized profile, MFA, Deal, or delivery change | SEV-1 | Security incident lead | 15 minutes |
| Payout, release, refund, identity, or evidence impact | SEV-1 | Security + Finance/Compliance | 15 minutes |
| Privileged operator account suspected | SEV-1 | Independent security approver | 15 minutes |

The operator handling identity evidence cannot be the sole approver for a
privileged recovery. The affected user cannot approve their own recovery.

## Intake boundary

Create one internal case reference and record only:

- the authenticated or verified-channel reporter identity;
- the bounded reason category and affected account ID;
- the time the customer first noticed the event;
- the relevant Deal/public identifiers and non-secret audit references;
- whether money, identity data, evidence, delivery, or a privileged role may be
  affected;
- every containment and recovery decision with operator and correlation IDs.

Never request or store a password, access token, refresh token, TOTP code,
recovery code, QR seed, full payment credential, or identity-document image in
chat, email, support notes, logs, or audit metadata. Do not use knowledge of a
home address, transaction amount, or public Deal details as identity proof.

## Containment sequence

Perform these steps in order and stop on any failed prerequisite:

1. Mark the case as suspected takeover and assign the required incident owner.
2. Place a temporary hold on seller-favoring payout/release and sensitive email
   or MFA changes. Buyer-protective refunds remain separately reviewable.
3. Revoke **all** provider sessions. Do not report success until the provider
   confirms global revocation.
4. Verify that the active-session inventory is empty. A password change alone
   is not session containment.
5. For privileged or factor-compromise cases, use the dual-control recovery
   workflow; revoke verified factors only through its service boundary.
6. Preserve immutable audit events and evidence references. Never modify the
   original Deal, agreement, delivery, payment, or dispute record to “clean up”
   attacker activity.
7. Send a bounded security notification through a verified channel when the
   notification worker is enabled. The message contains the case reference,
   action, time, and support path but no secret or sensitive Deal content.

If global revocation, the hold, or audit recording cannot be proven, escalate
the incident and keep the account restricted. A partial response must never be
presented as completed containment.

## Identity re-proofing

Recovery requires the approved identity-verification provider or the existing
dual-control privileged recovery workflow. The operator records only the
provider reference and outcome, not the underlying document or biometric.

Email access alone, possession of a previous password, public profile facts,
Deal amounts, and screenshots supplied through an unverified channel are not
sufficient. A conflicting identity result, ownership dispute, sanctions/KYC
hold, or unavailable independent reviewer pauses recovery and routes the case
to Compliance.

## Restoration sequence

After containment and successful re-proofing:

1. require a new unique password through the governed password boundary;
2. enroll a fresh authenticator and reach AAL2 before privileged access;
3. keep payout, email, and MFA changes under the configured 72-hour hold;
4. restore only the minimum previous role after an independent role review;
5. require a fresh sign-in and confirm the new session appears in the private
   inventory;
6. review material Deal, delivery, evidence, dispute, and payment events with
   the customer and specialist owners;
7. close the case only after notification delivery, audit completeness, and
   customer-visible recovery are recorded.

Recovery does not automatically reverse a payment or decide a dispute. Finance,
Compliance, and dispute workflows retain their independent approval rules.

## Required rehearsal evidence

Before SEC-002 can close, an isolated Staging exercise must prove:

- device A and device B start with distinct valid sessions;
- “sign out other devices” preserves A and revokes B;
- B receives denial from the Data API, Storage, and a protected Edge Function
  before its original access-token expiry;
- “sign out everywhere” then denies A through the same boundaries;
- failures do not clear the current browser or claim successful revocation;
- the immutable case/audit timeline contains no credential or identity secret;
- the security notification reaches the verified test channel once and can be
  correlated to the case;
- the 72-hour sensitive-change hold blocks payout, email, and MFA mutations;
- rollback and escalation owners acknowledge the result.

Use synthetic accounts and non-sensitive fixtures only. Record status codes,
correlation IDs, timestamps, and redacted provider references; never capture
bearer tokens or cookies in the evidence bundle.

## Release boundary

This repository runbook does not prove hosted revocation or notification
delivery. SEC-002 remains open until the two-device Staging matrix and verified
notification evidence pass. Production access protection and real-money
disablement remain in force.
