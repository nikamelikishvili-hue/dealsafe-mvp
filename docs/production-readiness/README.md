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
| [29_CSP_REPORTING_AND_BROWSER_HEADERS.md](29_CSP_REPORTING_AND_BROWSER_HEADERS.md) | Enforced browser headers, privacy-safe CSP violation reporting, monitoring, environment proof, and rollback |
| [30_PRIVILEGED_MFA_ROLLOUT_EVIDENCE.md](30_PRIVILEGED_MFA_ROLLOUT_EVIDENCE.md) | Non-secret privileged MFA enrollment, two-device login, aggregate readiness, and outstanding activation evidence |
| [31_PRIVILEGED_MFA_RECOVERY_CONTROL.md](31_PRIVILEGED_MFA_RECOVERY_CONTROL.md) | Dual-control lost-factor recovery, immutable evidence, service-only completion, notification outbox, and 72-hour sensitive-change holds |
| [32_MFA_PASSWORD_ONLY_NEGATIVE_MATRIX.md](32_MFA_PASSWORD_ONLY_NEGATIVE_MATRIX.md) | Password-only denial and same-account AAL2 control tests for the Data API, protected Storage, and protected Edge Functions |
| [33_SENSITIVE_CHANGE_ENFORCEMENT.md](33_SENSITIVE_CHANGE_ENFORCEMENT.md) | Staged fail-closed wiring for post-recovery MFA, payout onboarding, seller release, and buyer-refund availability |
| [34_SECURITY_NOTIFICATION_DELIVERY.md](34_SECURITY_NOTIFICATION_DELIVERY.md) | Private staged recovery-notification worker, fixed templates, idempotent delivery, domain requirements, and activation gates |
| [35_AUTH_ABUSE_AND_RATE_LIMIT_ROLLOUT.md](35_AUTH_ABUSE_AND_RATE_LIMIT_ROLLOUT.md) | Same-origin password recovery, privacy-safe Auth rejection telemetry, bounded retry guidance, and staged Vercel Firewall thresholds |
| [36_AUTH_PROXY_CLIENT_IP_BOUNDARY.md](36_AUTH_PROXY_CLIENT_IP_BOUNDARY.md) | Staged, fail-closed Supabase Auth client-IP forwarding through the trusted Vercel proxy boundary |
| [37_PASSWORD_MUTATION_BOUNDARY.md](37_PASSWORD_MUTATION_BOUNDARY.md) | Same-origin recovery completion and fail-closed current-password verification for signed-in changes |
| [38_CANONICAL_AGREEMENT_RECORD.md](38_CANONICAL_AGREEMENT_RECORD.md) | Immutable server-owned agreement payloads, canonical hashes, legacy compatibility, and PDF failure behavior |
| [39_ACCESSIBLE_AGREEMENT_PDF.md](39_ACCESSIBLE_AGREEMENT_PDF.md) | Professional accessible agreement layout, print safeguards, verification evidence, and remaining archival/legal gates |
| [40_BROWSER_ROUTING_AND_RECOVERY.md](40_BROWSER_ROUTING_AND_RECOVERY.md) | Canonical browser routes, deep-link/history recovery, customer-safe 404 and render-failure behavior, and remaining server-route gate |
| [41_APPLICATION_DECOMPOSITION.md](41_APPLICATION_DECOMPOSITION.md) | ARC-003 incremental extraction boundaries, preserved behavior, regression controls, and remaining feature slices |
| [42_RUNTIME_SERVICE_VALIDATION.md](42_RUNTIME_SERVICE_VALIDATION.md) | ARC-004 runtime response validation, privacy-safe rejection telemetry, authorization boundary, and remaining service schemas |
| [43_SUPPORT_CASE_FOUNDATION.md](43_SUPPORT_CASE_FOUNDATION.md) | OPS-001/002 private support intake, SLA, assignment, AAL2, audit, feature-gate, rollout, and rollback controls |
| [44_RUNTIME_REJECTION_MONITORING.md](44_RUNTIME_REJECTION_MONITORING.md) | Default-off privacy-safe runtime rejection transport, bounded log contract, activation, alerts, retention, synthetic proof, and rollback |
| [45_CLIENT_FAILURE_MONITORING.md](45_CLIENT_FAILURE_MONITORING.md) | Fixed-category React/bootstrap/browser failure recovery and default-off privacy-safe monitoring |
| [46_SERVER_FAILURE_MONITORING.md](46_SERVER_FAILURE_MONITORING.md) | Fixed-category correlated Auth/catalog/VIN server failure records, redaction, alerts, retention, and rollout evidence |
| [47_PRIVACY_SAFE_PERFORMANCE_MONITORING.md](47_PRIVACY_SAFE_PERFORMANCE_MONITORING.md) | URL-free Core Web Vitals quality buckets, default-off intake, build budgets, activation, and rollback |
| [48_UPTIME_SYNTHETIC_READINESS.md](48_UPTIME_SYNTHETIC_READINESS.md) | Minimal liveness, protected read-only critical-journey probes, alert gates, secret handling, and rollback |
| [49_OPERATIONAL_ALERT_POLICY.md](49_OPERATIONAL_ALERT_POLICY.md) | Sanitized fixed-counter alert policy for application, Auth, CSP, payment, notification, performance, and synthetic signals |
| [50_INCIDENT_CONTROL_AND_RELEASE_FREEZE.md](50_INCIDENT_CONTROL_AND_RELEASE_FREEZE.md) | Fail-closed incident state machine, release/financial freeze, safe status drafts, hashed evidence, and local drill |
| [51_APPLICATION_BUNDLE_SPLITTING.md](51_APPLICATION_BUNDLE_SPLITTING.md) | Authenticated application/service code splitting, tightened chunk budgets, release evidence, and rollback |
| [52_DETERMINISTIC_RELEASE_EVIDENCE.md](52_DETERMINISTIC_RELEASE_EVIDENCE.md) | Exact-commit clean-tree provenance, bounded SHA-256 asset manifest, CI artifact retention, and promotion gates |
| [53_DEPENDENCY_SUPPLY_CHAIN_POLICY.md](53_DEPENDENCY_SUPPLY_CHAIN_POLICY.md) | Offline registry/integrity/license/install-script lockfile gate and reviewed exceptions |
| [54_BROWSER_CACHE_SAFETY.md](54_BROWSER_CACHE_SAFETY.md) | Network-only private/navigation behavior, immutable asset caching, legacy cache retirement, and release proof |
| [55_PAYMENT_CAPABILITY_KILL_SWITCHES.md](55_PAYMENT_CAPABILITY_KILL_SWITCHES.md) | Independent default-off Sandbox gates for onboarding, checkout, payout release, and refund mutations |
| [56_PAYMENT_REQUEST_BOUNDARY.md](56_PAYMENT_REQUEST_BOUNDARY.md) | Authenticated JSON media/byte/exact-key validation before payment database or provider work |
| [57_STRIPE_RESPONSE_BOUNDARY.md](57_STRIPE_RESPONSE_BOUNDARY.md) | Timeout and bounded JSON validation for Stripe responses before trusted-object checks |
| [58_AUTH_PROVIDER_TRANSPORT_BOUNDARY.md](58_AUTH_PROVIDER_TRANSPORT_BOUNDARY.md) | Timeout and bounded JSON validation for Supabase Auth and protected recovery RPC responses |
| [59_AUTH_PROVIDER_REQUEST_ALLOWLIST.md](59_AUTH_PROVIDER_REQUEST_ALLOWLIST.md) | Exact Supabase Auth route/method/header allowlist and bounded outbound JSON |
| [60_BROWSER_DATA_TRANSPORT_BOUNDARY.md](60_BROWSER_DATA_TRANSPORT_BOUNDARY.md) | Streaming byte/media/JSON limits and deadlines for browser-owned Auth, Data API, Storage, evidence, catalog, and VIN requests |
| [61_EVIDENCE_REQUEST_BOUNDARY.md](61_EVIDENCE_REQUEST_BOUNDARY.md) | Streaming byte limits and exact action-key allowlists for evidence, lifecycle, legal-hold, and scheduled requests |
| [62_PROVIDER_RESPONSE_STREAM_BOUNDARY.md](62_PROVIDER_RESPONSE_STREAM_BOUNDARY.md) | Incremental byte ceilings for Stripe and malware-scanner responses before JSON and trusted-contract validation |
| [63_NODE_PROVIDER_RESPONSE_STREAM_BOUNDARY.md](63_NODE_PROVIDER_RESPONSE_STREAM_BOUNDARY.md) | Incremental byte ceilings for Node Auth and NHTSA VIN responses before JSON and domain validation |
| [64_STRIPE_WEBHOOK_REQUEST_STREAM_BOUNDARY.md](64_STRIPE_WEBHOOK_REQUEST_STREAM_BOUNDARY.md) | Incremental raw-body ceiling before Stripe signature verification, JSON parsing, or database work |
| [65_EVIDENCE_STORAGE_STREAM_BOUNDARY.md](65_EVIDENCE_STORAGE_STREAM_BOUNDARY.md) | Exact-length, capped Storage download streams before evidence scanning, viewing, hashing, or maintenance |
| [66_SECURITY_NOTIFICATION_RESPONSE_BOUNDARY.md](66_SECURITY_NOTIFICATION_RESPONSE_BOUNDARY.md) | JSON media, streamed byte, UTF-8, and object-shape limits for security-notification provider responses |
| [67_OUTBOUND_TRANSPORT_INVENTORY.md](67_OUTBOUND_TRANSPORT_INVENTORY.md) | Deny-by-default inventory and release gate for every direct application network call |
| [68_BROWSER_EVIDENCE_FILE_STREAM_BOUNDARY.md](68_BROWSER_EVIDENCE_FILE_STREAM_BOUNDARY.md) | Exact-size streamed browser evidence validation before upload intake and quarantine |
| [69_BROWSER_DIAGNOSTIC_TRANSPORT.md](69_BROWSER_DIAGNOSTIC_TRANSPORT.md) | One allowlisted, byte-limited, deadline-bound transport for privacy-safe browser diagnostics |
| [70_GUEST_DRAFT_STORAGE_BOUNDARY.md](70_GUEST_DRAFT_STORAGE_BOUNDARY.md) | Short-lived, byte-bounded, sensitive-field-free guest Deal draft recovery |
| [71_BROWSER_STORAGE_INVENTORY.md](71_BROWSER_STORAGE_INVENTORY.md) | Deny-by-default release inventory for persistent and tab-scoped browser storage |
| [72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md](72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md) | CodeQL SAST, deterministic CycloneDX inventory, scoped ownership, finding SLAs, exceptions, and release evidence |

## Authority and change control

- These documents define the intended production behavior. Existing demo behavior does not override them.
- Any change to payment release, identity verification, dispute resolution, public data, retention, or administrator access requires an architecture decision record and a security review.
- Legal statements are product requirements, not legal advice. US payments and privacy counsel must approve the final funds flow, customer terms, policies, and marketing claims.
- Real-money mode remains disabled until every paid-beta gate in [07_TEST_RELEASE_GATES.md](07_TEST_RELEASE_GATES.md) passes.

## Current phase

**Phase 1: foundation and production specification.**

Completion of this phase means the team has one agreed source of truth for what to build and how to prove it is safe. It does not by itself authorize a public or real-money launch.
