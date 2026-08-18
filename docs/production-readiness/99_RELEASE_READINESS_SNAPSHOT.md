# Dealivra release-readiness snapshot

Status date: 2026-08-18

## Decision

**No-go for public or real-money launch.** The current review stack is suitable
for continued protected Preview evaluation. It is not evidence that the hosted
database, operational response, legal terms, or payment controls are ready for
customers.

This decision is intentionally stricter than a successful build or visual
review. A release becomes eligible only when the environment-specific evidence
below is complete for the exact candidate commit.

## Review-candidate evidence available

- Merged `main` remains `2621fcd55cdbe6381f58fedf1164b1acf997f3c8`.
  Nothing in this review changed `main`, Production, public access, hosted
  Supabase resources, customer records, or payment configuration.
- Draft PR `#232` at signed commit
  `d46bb1541c4c3923cce62476ec59013273248e2d` is cleanly mergeable. Its required
  verification, CodeQL analysis, Vercel deployment, and Vercel review checks
  passed; served-asset verification is correctly skipped for the protected
  Preview deployment event.
- The consolidated branch `agent/p0-reviewed-release-candidate` combines the
  canonical customer routes, single Deal Workspace action, shared accessible
  validation summaries, SEC-002 takeover response, and Node 24 artifact action.
  Its signed integration head before this documentation-only snapshot is
  `a9a384db5032eaf6533e1abb3634a2b418296207`.
- The consolidated branch passes catalog, dependency, SBOM, browser-storage,
  outbound-transport, API-origin, brand, runtime-configuration, formatting,
  lint, TypeScript, 385 foundation, and 17 component checks plus the incident
  drill, secret scan, production build, deterministic served-asset manifest,
  performance budgets, and Preview smoke.
- The integrated production build contains 820,555 JavaScript bytes against the
  fixed 821,000-byte ceiling, 285,554 CSS bytes, and 28 served assets totaling
  1,112,006 bytes. The initial application JavaScript is 133,804 bytes.
- Local browser acceptance covered Home plus canonical sign-in, sign-up,
  password recovery, create, public Deal, and Trust Passport routes. Hosted
  protected-Preview role/state, keyboard, mobile, and provider acceptance is
  still required against the final exact PR head.

These results prove the consolidated repository candidate passes the local
release gate and that PR `#232` passed its hosted review. They do not yet prove
that the consolidated candidate's exact hosted artifact, Staging authorization,
operational response, legal terms, or financial controls are ready.

## External private-beta blockers

All items below must be closed against one isolated Staging release candidate:

1. Open the consolidated review branch as one Draft pull request, require every
   protected GitHub and Vercel check on its exact signed head, resolve review
   findings, and bind the final approved commit to deterministic release and
   served-asset manifests before merge.
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

This snapshot is documentation only. It does not create or merge the Draft pull
request, promote Production, restore public access, apply staged SQL, change
hosted configuration, touch live Supabase resources or customer records, or
enable real payments.
