# Dealivra release-readiness snapshot

Status date: 2026-09-04

## Decision

**No-go for public or real-money launch.** The reviewed repository stack is
suitable for continued protected Preview evaluation. It is not evidence that
the hosted Staging database, operational response, legal terms, or payment
controls are ready for customers.

This decision is intentionally stricter than a successful build or visual
review. A release becomes eligible only when the environment-specific evidence
below is complete for the same immutable candidate commit and deployment.

## Current reviewed repository evidence

- The reviewed baseline `main` is `511f6b0d7077bb90d3d1e78a4029611f55125511` with
  a valid GitHub signature. Dependency maintenance was merged by PR `#282`,
  JavaScript budget headroom by PR `#285`, CSS budget headroom by PR `#286`,
  and the complete 14-route Preview smoke matrix by PR `#287`; no
  pre-existing pull request remained open at this audit boundary.
- The current repository gate passes catalog, dependency, SBOM,
  browser-storage, outbound-transport, API-origin, abuse-policy, brand,
  runtime-configuration, formatting, lint, TypeScript, 407 foundation tests,
  20 rendered-component tests, the incident drill, secret scan, production
  build, deterministic served-asset manifest, performance budgets, and Preview
  smoke.
- The reviewed unconfigured build contains 819,425 JavaScript bytes and
  285,346 CSS bytes. Initial application JavaScript is 134,125 bytes against
  the fixed 160,000-byte ceiling. The served-asset manifest contains 28 assets
  totaling 1,110,576 bytes.
- GitHub Actions runs `33838666629` and `33838666625` passed the required
  quality/security and CodeQL gates on the PR `#287` candidate before its
  signed squash merge. Automatic served-asset verification remains
  intentionally default-off until the protected bypass secret is configured
  and a successful manual run is retained.
- Vercel deployment `dpl_GgSXSytKkqkv8ruEFP56s1aY3v8P` for that baseline is
  `READY`, access-protected, and not assigned to public live operation. Runtime
  inspection reported no hosted errors. This does not replace retained
  exact-host served-asset evidence.
- The `served-asset-verification` GitHub environment now accepts protected
  branches only and contains the exact-host allowlist
  `dealsafe-dqx3xke41-nika13.vercel.app`. Manual run `33839430086` checked out
  exact `main` and failed closed when that protected host redirected to Vercel
  authentication. No bypass secret is configured, so the result proves the
  guard boundary but is not successful served-asset evidence.
- Local browser acceptance covered widths 320, 360, 390, 768, 1024, 1280, and
  1440 without horizontal overflow. The public route matrix, mobile Home
  navigation, account entry calls to action, and sample Deal path were also
  exercised. The repository Preview smoke now requests all 14 supported SPA
  routes rather than only the root, Terms, and sign-in paths.
- The protected GitHub `staging` environment contains distinct Staging and
  Production project-reference variables. Its required database URL, access
  token, and database-password secrets are not configured. Only secret names
  were inspected; no secret value was accessed or logged.

These results prove the reviewed repository and local responsive route stack
are clean. They do not prove the Staging schema can be rebuilt, hosted
cross-user authorization is correct, protected authenticated journeys pass, or
that a candidate is ready for external testers.

## Closed since the previous snapshot

- The former Draft release stack was consolidated, reviewed, and merged by
  PR `#233`; the previous instruction to open Draft PR `#232` is obsolete.
- All later review branches have been reconciled. There is no hidden or stale
  open pull request waiting to be promoted.
- Required repository checks and commit-signature enforcement remain intact;
  no security finding or branch-protection rule was dismissed or weakened.
- The JavaScript and CSS performance ceilings were retained rather than raised;
  both now have measurable release headroom.
- The protected served-asset environment and exact-host allowlist are now
  configured. Its first manual exact-commit exercise rejected the Vercel
  authentication redirect instead of following it or accepting unverifiable
  bytes.

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

The next permitted hosted actions are to add a scoped
`DEALIVRA_DEPLOYMENT_BYPASS_TOKEN` secret to the protected
`served-asset-verification` environment, retain one successful manual
exact-commit run, and only then consider enabling automatic execution. The
three missing database secrets must also be added to the protected `staging`
environment. Never place secret values in chat, repository content, logs,
screenshots, issues, or pull-request text. Until those externally owned
settings exist, repository work may continue, but FND-003, DAT-001, and
DAT-003 cannot be marked complete.

### Activation boundary

This snapshot is documentation only. It does not promote Production, restore
public access, apply staged SQL, change hosted configuration, touch live
Supabase resources or customer records, or enable real payments.
