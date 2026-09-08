# Dealivra release-readiness snapshot

Status date: 2026-09-07

## Decision

**No-go for public or real-money launch.** The reviewed repository stack is
suitable for continued protected Preview evaluation. It is not evidence that
the hosted Staging database, operational response, legal terms, or payment
controls are ready for customers.

This decision is intentionally stricter than a successful build or visual
review. A release becomes eligible only when the environment-specific evidence
below is complete for the same immutable candidate commit and deployment.

## Current reviewed repository evidence

- The reviewed baseline `main` is `076be82bfa339ffee2ad9f0a7730cc081a85bd5b`
  with a valid GitHub signature. The trusted protected-deployment verifier was
  corrected by PR `#292`; production dependency maintenance was merged by PR
  `#293`; and the safe Biome and React DOM type patches were narrowed, reviewed,
  and merged by PR `#295`. No pull request remains open at this audit boundary.
- The current repository gate passes catalog, dependency, SBOM,
  browser-storage, outbound-transport, API-origin, abuse-policy, brand,
  runtime-configuration, formatting, lint, TypeScript, 415 foundation tests,
  21 rendered-component tests, the incident drill, secret scan, production
  build, deterministic served-asset manifest, performance budgets, and Preview
  smoke.
- The reviewed unconfigured build contains 820,401 JavaScript bytes and
  287,540 CSS bytes. Initial application JavaScript is 133,643 bytes against
  the fixed 160,000-byte ceiling. The served-asset manifest contains 29 assets
  totaling 1,113,746 bytes.
- GitHub Actions runs `34177050869` and `34177050841` passed the required
  quality/security and CodeQL gates for the signed `#295` merge. The retained
  release-evidence artifact is `10037615080`; its manifest SHA-256 is
  `8d78fa605ab6203aa0b92b7e0964c059ce27bf5ed10083e54d49da177cb33e50`.
- Vercel deployment record `6318925288` for the current baseline completed at
  `dealsafe-9b9028nkn-nika13.vercel.app`. The generated host remains
  access-protected and redirects an unauthenticated request to Vercel. It has
  not received the protected bypass token and is not current exact-host
  served-asset evidence.
- The protected `served-asset-verification` environment retained successful
  manual run `34136690776` for source commit
  `f0d0f3e3b8b7b56c5f2b9cae676741eda0d9a4e7` at the exact approved host
  `dealsafe-r3mn6u0au-nika13.vercel.app`. It verified 29 assets totaling
  1,116,568 bytes, all 14 SPA routes, browser headers, and the Preview route
  contract while masking the bypass token. Later signed dependency merges
  invalidate that result for the current `main`, so a current exact-candidate
  rerun remains required.
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

- The protected verifier's HEAD-response bug was fixed without weakening its
  redirect, host, header, size, or hash boundaries, and the first successful
  protected exact-host exercise is retained in GitHub Actions.
- Safe dependency maintenance was merged without raising the JavaScript
  ceiling. The grouped Vite `8.2.1` update was closed after exceeding that
  ceiling, while the compatible patches were delivered separately by `#295`.
- All review branches have been reconciled. There is no hidden or stale open
  pull request waiting to be promoted.
- Required repository checks and commit-signature enforcement remain intact;
  no security finding or branch-protection rule was dismissed or weakened.
- The JavaScript and CSS performance ceilings were retained rather than raised;
  both now have measurable release headroom.
- The protected served-asset environment, scoped bypass secret, exact-host
  allowlist, and one successful activation exercise now exist. Automatic
  verification remains default-off, and the current candidate still requires
  its own exact-host run, restricted archive, and named promotion approval.

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

Provision `DEALIVRA_STAGING_DATABASE_URL`,
`DEALIVRA_STAGING_SUPABASE_ACCESS_TOKEN`, and
`DEALIVRA_STAGING_SUPABASE_DB_PASSWORD` in the protected `staging`
environment, then run the baseline and authorization gates against one
isolated Staging candidate. Separately, approve the current exact generated
Preview host before sending it the protected
`DEALIVRA_DEPLOYMENT_BYPASS_TOKEN` and rerun the
served-asset verifier for the same immutable commit. Retain that result in the
restricted archive and record named technical/security approval. Never place
secret values in chat, repository content, logs, screenshots, issues, or
pull-request text. Until those externally owned settings and evidence exist,
FND-003, DAT-001, and DAT-003 cannot be marked complete.

### Activation boundary

This snapshot is documentation only. It does not promote Production, restore
public access, apply staged SQL, change hosted configuration, touch live
Supabase resources or customer records, or enable real payments.
