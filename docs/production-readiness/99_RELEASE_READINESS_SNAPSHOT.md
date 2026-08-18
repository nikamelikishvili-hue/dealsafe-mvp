# Dealivra release-readiness snapshot

Status date: 2026-08-15

## Decision

**No-go for public or real-money launch.** The current review stack is suitable
for continued protected Preview evaluation. It is not evidence that the hosted
database, operational response, legal terms, or payment controls are ready for
customers.

This decision is intentionally stricter than a successful build or visual
review. A release becomes eligible only when the environment-specific evidence
below is complete for the exact candidate commit.

## Review-stack evidence available

- The stack through Draft PR `#181` passes dependency and catalog governance,
  formatting, lint, TypeScript, 354 foundation tests, 13 component tests, the
  incident drill, secret scanning, production build, performance budgets, and
  Preview smoke.
- The stack-head Vercel Preview reached `READY`; GitHub verification and Vercel
  checks passed, and the pull request is cleanly mergeable.
- A 390 by 844 unauthenticated browser review found no horizontal overflow,
  duplicate IDs, missing image alternatives, or console warnings and errors.
  Mobile navigation and the exact Home action reached their intended targets.
- The hosted build measured 834,703 JavaScript bytes against the fixed
  835,000-byte ceiling. Only 297 bytes of hosted headroom remain, so another
  customer-facing JavaScript change requires a measured offset or approved
  chunking improvement.
- Browser/server Supabase public configuration aligned in Preview and the
  optional Google Maps integration was configured. No secret value was read or
  recorded during verification.

These results prove the reviewed source and Preview artifact behave as tested.
They do not replace Staging authorization, operational, legal, or financial
approval.

## External private-beta blockers

All items below must be closed against one isolated Staging release candidate:

1. Merge the documented stacked pull requests in order, rerunning required
   checks after each base changes, then bind the final commit to deterministic
   release and served-asset manifests.
2. Run the database-wide authorization and hosted HTTP/Storage matrices with
   short-lived synthetic seller, buyer, outsider, support, and administrator
   identities. Record cross-account denial and rollback evidence without using
   Production customer data.
3. Complete protected-Preview keyboard and mobile acceptance for account,
   Deal creation, public acceptance, payment-disabled, delivery, dispute,
   support, and recovery journeys, including the US address provider fallback.
4. Activate a privacy-safe external monitoring drain, synthetic schedule,
   named alert owner, acknowledgement path, retention rule, and one recovery
   drill. A green CI job without alert delivery is insufficient.
5. Assign an independent security approver, resolve required CodeQL/security
   findings, and retain the exact approval and exception record.
6. Publish counsel-approved beta Terms, Privacy, prohibited-items, retention,
   support, cancellation, and product-claim language at every relevant
   collection and consent point.
7. Staff the support/escalation rota and prove urgent/normal case routing,
   AAL2 operator access, cross-account denial, audit history, and customer
   communication in Staging.
8. Approve the release owner, rollback owner, incident commander, go/no-go
   record, and recovery procedure for the exact candidate commit.

## Additional real-money blockers

Real-money mode remains disabled after private-beta readiness until all of the
following are independently approved and proven in provider Sandbox/Staging:

- signed Stripe architecture and counsel decision covering funds flow,
  liability, release, refunds, disputes, and customer wording;
- atomic, replay-safe webhook processing and trusted amount/account/state
  transitions under duplicate and out-of-order events;
- seller onboarding remediation, refund/release failure, chargeback,
  suspension, reconciliation, and exception-queue scenario matrices;
- finance authority thresholds, dual control, immutable audit evidence, and
  environment kill switches that prevent Sandbox/live credential mixing;
- selected KYC provider, privacy/DPA review, hosted onboarding, remediation,
  webhook verification, and manual-review ownership;
- counsel-approved canonical agreement/clickwrap evidence and verified
  archival of the professional accessible agreement PDF.

## Exact-candidate release rule

A candidate is eligible for promotion only when every required check and
environment proof references the same immutable commit and deployment. Any
code, configuration, migration, provider, policy, or ownership change after
approval invalidates the affected evidence and requires the relevant gates to
run again.

### Activation boundary

This snapshot is documentation only. It does not merge the Draft stack, promote
Production, restore public access, apply staged SQL, change hosted
configuration, touch live Supabase resources or customer records, or enable
real payments.
