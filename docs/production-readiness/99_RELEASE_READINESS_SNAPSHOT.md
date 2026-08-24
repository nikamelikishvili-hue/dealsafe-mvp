# Dealivra release-readiness snapshot

Status date: 2026-08-24

## Decision

**No-go for public or real-money launch.** The reviewed repository stack is
suitable for continued protected Preview evaluation. It is not evidence that
the hosted Staging database, operational response, legal terms, or payment
controls are ready for customers.

This decision is intentionally stricter than a successful build or visual
review. A release becomes eligible only when the environment-specific evidence
below is complete for the same immutable candidate commit and deployment.

## Current reviewed repository evidence

- Reviewed `main` is `35214dae98df003d9792e08b77a235deebca93c1` with
  a valid GitHub signature. The consolidated release candidate was merged by
  PR `#233`; subsequent reviewed account, routing, security, database-history,
  dependency, and interface changes are also on `main`.
- No pull request remains open. The two final dependency reviews, PR `#255`
  and PR `#256`, passed the protected `verify`, CodeQL, and Vercel checks
  before squash merge. TypeScript 7 and Vite 8.2.2 were deliberately excluded
  from PR `#256` after compatibility and bundle-budget review; only
  `@vitejs/plugin-react` 6.1.0 was accepted.
- The current repository gate passes catalog, dependency, SBOM,
  browser-storage, outbound-transport, API-origin, abuse-policy, brand,
  runtime-configuration, formatting, lint, TypeScript, 398 foundation tests,
  20 rendered-component tests, the incident drill, secret scan, production
  build, deterministic served-asset manifest, performance budgets, and Preview
  smoke.
- The reviewed unconfigured build contains 821,815 JavaScript bytes and
  289,973 CSS bytes. Initial application JavaScript is 133,941 bytes against
  the fixed 160,000-byte ceiling. The served-asset manifest contains 28 assets
  totaling 1,117,593 bytes.
- GitHub Actions run `32759970707` executed the current manual Staging baseline
  preflight on exact `main`. The target guard rejected incomplete protected
  configuration before Node setup, dependency installation, Supabase CLI
  installation, project linking, migration capture, or any database command.
- The protected GitHub `staging` environment contains distinct Staging and
  Production project-reference variables. Its required database URL, access
  token, and database-password secrets are not configured. Only secret names
  were inspected; no secret value was accessed or logged.

These results prove the repository review stack is clean and that an incomplete
Staging target fails closed. They do not prove the Staging schema can be rebuilt,
that hosted cross-user authorization is correct, or that a candidate is ready
for external testers.

## Closed since the previous snapshot

- The former Draft release stack was consolidated, reviewed, and merged by
  PR `#233`; the previous instruction to open Draft PR `#232` is obsolete.
- All later review branches have been reconciled. There is no hidden or stale
  open pull request waiting to be promoted.
- Required repository checks and commit-signature enforcement remain intact;
  no security finding or branch-protection rule was dismissed or weakened.

## External private-beta blockers

All items below must close against one isolated Staging release candidate:

1. Configure the protected GitHub `staging` environment with
   `DEALIVRA_STAGING_DATABASE_URL`,
   `DEALIVRA_STAGING_SUPABASE_ACCESS_TOKEN`, and
   `DEALIVRA_STAGING_SUPABASE_DB_PASSWORD`. Keep values out of source control,
   logs, screenshots, issues, and pull-request text.
2. Run the manual Staging baseline proof, review the CLI-generated data-free
   migration, rebuild an empty disposable local database, run advisors, retain
   the exact migration manifest, and prove local/Staging history alignment.
3. Run the database-wide authorization gate on the same candidate and retain
   the sorted 17-suite seller, buyer, outsider, support, administrator,
   evidence, dispute, payment-command, immutable-audit, and RLS results.
4. Run the hosted Data API and Storage matrix with short-lived synthetic
   seller, buyer, outsider, expired, and anonymous identities. Prove cleanup
   and cross-account denial without Production customer data.
5. Complete protected-Preview keyboard and mobile acceptance for account,
   Deal creation, public acceptance, payment-disabled, delivery, dispute,
   support, and recovery journeys, including the US address-provider fallback.
6. Activate a privacy-safe external monitoring drain and synthetic schedule;
   assign an alert owner, acknowledgement path, retention rule, and recovery
   drill. A green CI job without delivered alert evidence is insufficient.
7. Assign an independent security approver, resolve every required hosted
   finding, and retain the exact approval and exception record.
8. Publish counsel-approved beta Terms, Privacy, prohibited-items, retention,
   support, cancellation, and product-claim language at every collection and
   consent point.
9. Staff the support/escalation rota and prove urgent/normal routing, AAL2
   operator access, cross-account denial, audit history, and customer
   communication in Staging.
10. Approve the release owner, rollback owner, incident commander, go/no-go
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

### Immediate controlled action

The next permitted hosted action is to add the three missing secrets to the
protected `staging` environment and rerun the baseline proof. Do not place
those credentials in chat or repository content. Until that externally owned
configuration exists, repository work may continue, but DAT-001 and DAT-003
cannot be marked complete.

### Activation boundary

This snapshot is documentation only. It does not promote Production, restore
public access, apply staged SQL, change hosted configuration, touch live
Supabase resources or customer records, or enable real payments.
