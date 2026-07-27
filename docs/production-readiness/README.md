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

## Authority and change control

- These documents define the intended production behavior. Existing demo behavior does not override them.
- Any change to payment release, identity verification, dispute resolution, public data, retention, or administrator access requires an architecture decision record and a security review.
- Legal statements are product requirements, not legal advice. US payments and privacy counsel must approve the final funds flow, customer terms, policies, and marketing claims.
- Real-money mode remains disabled until every paid-beta gate in [07_TEST_RELEASE_GATES.md](07_TEST_RELEASE_GATES.md) passes.

## Current phase

**Phase 1: foundation and production specification.**

Completion of this phase means the team has one agreed source of truth for what to build and how to prove it is safe. It does not by itself authorize a public or real-money launch.
