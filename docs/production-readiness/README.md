# Dealivra production-readiness program

This directory is the operating specification for turning the current Dealivra prototype into a controlled, revenue-capable US product and, later, a country-by-country global platform.

The documents are intentionally stricter than a normal MVP checklist. Dealivra handles agreements, identity status, transaction evidence, disputes, delivery records, and eventually payment events. A visually complete screen is not considered complete until its authorization, failure, recovery, accessibility, monitoring, and support paths are verified.

## Document map

| Document | Purpose |
|---|---|
| [00_MASTER_PLAN.md](00_MASTER_PLAN.md) | Program objective, current assessment, milestones, ownership, risks, and decision rules |
| [01_US_MVP_SCOPE.md](01_US_MVP_SCOPE.md) | Exact US launch customer, category, product promise, monetization boundary, and exclusions |
| [02_SYSTEM_ARCHITECTURE.md](02_SYSTEM_ARCHITECTURE.md) | Target application, data, provider, environment, and trust-boundary architecture |
| [03_SECURITY_THREAT_MODEL.md](03_SECURITY_THREAT_MODEL.md) | Assets, likely attackers, threat scenarios, controls, and security acceptance criteria |
| [04_DATA_ACCESS_RETENTION.md](04_DATA_ACCESS_RETENTION.md) | Data classification, access matrix, RLS expectations, retention, deletion, and recovery |
| [05_PAYMENTS_KYC_DISPUTES.md](05_PAYMENTS_KYC_DISPUTES.md) | Provider responsibilities, protected-payment state machine, release, refund, and dispute operations |
| [06_DESIGN_SYSTEM_UX_STANDARD.md](06_DESIGN_SYSTEM_UX_STANDARD.md) | Product design language, interaction rules, responsive behavior, content, and accessibility |
| [07_TEST_RELEASE_GATES.md](07_TEST_RELEASE_GATES.md) | Required automated/manual tests and non-negotiable release evidence |
| [08_IMPLEMENTATION_BACKLOG.md](08_IMPLEMENTATION_BACKLOG.md) | Ordered engineering and operations backlog with acceptance criteria |
| [09_PROGRESS_LOG.md](09_PROGRESS_LOG.md) | Completed batches, verification evidence, partial items, and next work |
| [10_ENVIRONMENT_CONFIGURATION.md](10_ENVIRONMENT_CONFIGURATION.md) | Required variables, environment isolation, safe failure, validation, and change control |
| [11_LEGACY_IDENTIFIER_REGISTER.md](11_LEGACY_IDENTIFIER_REGISTER.md) | Approved migration aliases and the rule that all new runtime identifiers use Dealivra |
| [12_CATALOG_GOVERNANCE.md](12_CATALOG_GOVERNANCE.md) | Catalog ownership, release evidence, update cadence, privacy-safe adoption metrics, and rollback |
| [13_SESSION_SECURITY.md](13_SESSION_SECURITY.md) | Session visibility, scoped revocation, privacy boundaries, verification evidence, and remaining immediate-revocation work |
| [14_IMMEDIATE_SESSION_REVOCATION.md](14_IMMEDIATE_SESSION_REVOCATION.md) | Immediate active-session checks across the Data API, Storage, and protected Edge Functions, including safe rollback |
| [15_EDGE_ORIGIN_SECURITY.md](15_EDGE_ORIGIN_SECURITY.md) | Exact production/Preview origin enforcement for browser-invoked payment functions and webhook separation |
| [16_STRIPE_WEBHOOK_REPLAY_SAFETY.md](16_STRIPE_WEBHOOK_REPLAY_SAFETY.md) | Atomic Stripe event claiming, fencing, legal ordering, replay recovery, and service-only authorization |
| [17_TRUSTED_PAYMENT_COMMANDS.md](17_TRUSTED_PAYMENT_COMMANDS.md) | Immutable Checkout snapshots, fenced release/refund commands, provider verification, and manual-beta authority |
| [18_PAYMENT_PROVIDER_OBSERVABILITY.md](18_PAYMENT_PROVIDER_OBSERVABILITY.md) | Safe provider-error normalization, customer support references, sanitized structured logs, and a service-only payment exception queue |
| [19_SECURITY_DEFINER_GOVERNANCE.md](19_SECURITY_DEFINER_GOVERNANCE.md) | Reviewed elevated-function allowlists, public projection exceptions, active-session hook boundary, and advisor interpretation |
| [20_AUTH_PASSWORD_SECURITY.md](20_AUTH_PASSWORD_SECURITY.md) | Application/provider password rules, verified managed configuration, plan-limited compromised-password screening, and remaining launch gates |
| [21_AUTHENTICATED_RPC_MATRIX.md](21_AUTHENTICATED_RPC_MATRIX.md) | Exact signed-in elevated-function inventory, ordinary-member/participant/admin authorization matrix, and rollback-only production proof |
| [22_RLS_POLICY_PERFORMANCE.md](22_RLS_POLICY_PERFORMANCE.md) | Statement-level Auth evaluation for protected RLS policies with production seller/buyer/outsider allow-deny proof |
| [23_FOREIGN_KEY_INDEX_GOVERNANCE.md](23_FOREIGN_KEY_INDEX_GOVERNANCE.md) | Measured foreign-key index selection, exact query-plan evidence, deferred notices, and write-cost governance |
| [24_IMMUTABLE_AUDIT_EVENTS.md](24_IMMUTABLE_AUDIT_EVENTS.md) | Append-only material audit history, database-generated correlation IDs, mutation denial, and rollback proof |
| [25_EVIDENCE_FILE_SECURITY.md](25_EVIDENCE_FILE_SECURITY.md) | Quarantine, shared file policy, byte validation, fail-closed malware scanning, clean-only promotion, and short-lived case/participant access |
| [26_EVIDENCE_INTEGRITY_VIEWER.md](26_EVIDENCE_INTEGRITY_VIEWER.md) | Open-time byte/hash verification, append-only integrity inventory, and the non-active private evidence viewer |
| [27_EVIDENCE_LIFECYCLE_GOVERNANCE.md](27_EVIDENCE_LIFECYCLE_GOVERNANCE.md) | Retention classification, Legal Hold, scheduled integrity/quarantine work, operator-reviewed verified deletion, and alert ownership |
| [28_MFA_AND_PRIVILEGED_STEP_UP.md](28_MFA_AND_PRIVILEGED_STEP_UP.md) | TOTP enrollment and login challenge, AAL2 enforcement across every protected boundary, privileged-role rollout, recovery limits, and rollback |

## Authority and change control

- These documents define the intended production behavior. Existing demo behavior does not override them.
- Any change to payment release, identity verification, dispute resolution, public data, retention, or administrator access requires an architecture decision record and a security review.
- Legal statements are product requirements, not legal advice. US payments and privacy counsel must approve the final funds flow, customer terms, policies, and marketing claims.
- Real-money mode remains disabled until every paid-beta gate in [07_TEST_RELEASE_GATES.md](07_TEST_RELEASE_GATES.md) passes.

## Current phase

**Phase 1: foundation and production specification.**

Completion of this phase means the team has one agreed source of truth for what to build and how to prove it is safe. It does not by itself authorize a public or real-money launch.
