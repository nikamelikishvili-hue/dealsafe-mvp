# Ordered implementation backlog

This backlog turns the production specification into controlled delivery work. Priority is based on user/financial risk and dependency order, not visual visibility.

## Priority definitions

- **P0:** Required before any external private beta.
- **P1:** Required before paid software pilot or real-money beta as indicated.
- **P2:** Required before wider US release.
- **P3:** Later optimization or global preparation.

## Epic 1 — Repository and delivery foundation

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| FND-001 | P0 | Pin all direct dependencies; choose one package manager/lockfile | Clean reproducible install produces the same dependency graph |
| FND-002 | P0 | Add format, lint, strict type-check, unit, component, and build scripts | CI fails on a deliberate violation and passes clean code |
| FND-003 | P0 | Add protected CI workflow and Preview smoke test | Required checks block main on failure |
| FND-004 | P0 | Add dependency, secret, and static security scans | Findings are visible and have ownership/SLA |
| FND-005 | P0 | Document local/preview/staging/production config schema | Startup fails safely with a clear missing-config report |
| FND-006 | P0 | Remove ambiguous legacy DealSafe runtime/config identifiers | Runtime keys, fee config, analytics, assets, and docs consistently use Dealivra or a migration alias |

## Epic 2 — Application architecture

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| ARC-001 | P0 | Build target-framework/session proof of concept | Auth, protected route, SSR/public route, CSP, and Preview work |
| ARC-002 | P0 | Introduce real routes and error boundaries | Refresh/deep link/back/forward and 404 behavior pass |
| ARC-003 | P0 | Split `app.tsx` by auth, deal, agreement, payment, delivery, dispute, admin | No feature requires editing the central monolith for ordinary behavior |
| ARC-004 | P0 | Create typed API/service boundary with runtime request/response schemas | Invalid server/client data fails safely and is monitored |
| ARC-005 | P1 | Add feature flags and kill switches | Each critical capability can be disabled without redeploying unrelated features |

## Epic 3 — Design system and workflow UX

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| UX-001 | P0 | Consolidate semantic tokens and remove uncontrolled feature overrides | Governed screens use approved tokens and contrast tests pass |
| UX-002 | P0 | Build accessible core component primitives | Component tests cover keyboard, focus, names, errors, loading, touch targets |
| UX-003 | P0 | Rebuild Deal Workspace information hierarchy | One next action is visible and focusable at every state |
| UX-004 | P0 | Standardize US address and apartment/suite/unit workflow | State and ZIP are required/validated; private fields never appear publicly |
| UX-005 | P0 | Normalize responsive behavior across 320–1440 px | No overlap/horizontal page scroll; sticky UI does not obscure focus |
| UX-006 | P1 | Add visual-regression stories for public, auth, creation, deal, payment, delivery, dispute, admin | Approved snapshots run in CI |
| UX-007 | P1 | Conduct moderated usability and accessibility sessions | Critical repeated confusion is resolved and documented |

## Epic 4 — Database, migrations, and authorization

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| DAT-001 | P0 | Convert setup SQL into timestamped migrations | Empty and previous-version databases migrate automatically |
| DAT-002 | P0 | Inventory every table/view/function/bucket/grant/policy | Machine-readable inventory has an owner and expected roles |
| DAT-003 | P0 | Add cross-user RLS/function/storage test harness | Anonymous, unrelated, seller, buyer, support, and admin allow/deny matrix passes |
| DAT-004 | P0 | Harden `security definer` functions and grants | Fixed search path, validated inputs, explicit grants, tests |
| DAT-005 | P0 | Implement immutable material audit events | Ordinary roles cannot alter/delete events; transitions include correlation IDs |
| DAT-006 | P1 | Add PITR, storage backup, retention jobs, and restore drill | RPO/RTO evidence passes |
| DAT-007 | P1 | Implement privacy export, correction, deletion, and legal hold ledger | End-to-end privacy requests are auditable |

## Epic 5 — Authentication and account security

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| SEC-001 | P0 | Replace browser-readable long-lived session storage with approved secure session design | XSS cannot directly read the long-lived session secret |
| SEC-002 | P0 | Add session inventory, revocation, expiry, and logout-all | Revoked sessions lose access immediately |
| SEC-003 | P0 | Add user MFA and require phishing-resistant MFA for privileged roles where supported | Enrollment/recovery/step-up tests pass |
| SEC-004 | P0 | Add strict CSP, HSTS plan, frame, MIME, referrer, and permissions headers | Automated header tests pass per environment |
| SEC-005 | P0 | Restrict CORS and add CSRF/origin protection | Cross-origin abuse tests fail safely |
| SEC-006 | P0 | Add route/action rate limits, CAPTCHA, and abuse telemetry | Defined burst/velocity tests create alerts/blocks |
| SEC-007 | P1 | Add security notifications and sensitive-change cooldowns | Email/payout/MFA changes are recorded and alerted |

SEC-003A now provides TOTP enrollment, enrolled-user login challenge, and
mandatory `aal2` enforcement for `support`, `compliance`, and `admin` across the
Data API, Storage, and protected Edge Functions. SEC-003 remains open for a
supported phishing-resistant privileged factor, approved lost-factor recovery,
security notifications, and the protected two-device negative test matrix.
The production enforcement migration is staged but intentionally unapplied:
the current aggregate readiness check found one admin account with no verified
factor, so activation would cause an administrative lockout.

## Epic 6 — Evidence and private files

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| EVD-001 | P0 | Define file allowlist and category evidence requirements | Client/server/storage enforce the same policy |
| EVD-002 | P0 | Add byte-signature/type/size checks and malware scanning | Malicious, mismatched, and oversized fixtures are rejected |
| EVD-003 | P0 | Add private short-lived signed access with case/participant authorization | Cross-user and expired-link tests pass |
| EVD-004 | P1 | Add evidence integrity inventory and safe viewer | Hash/status visible; unsafe active content cannot execute |
| EVD-005 | P1 | Implement retention/deletion/legal hold for storage objects | Scheduled and requested deletion is verified |

## Epic 7 — Payments and provider events

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| PAY-001 | P0 | Finalize Stripe architecture with provider and counsel | Signed decision record documents liability, release, refunds, disputes, wording |
| PAY-002 | P0 | Make webhook claim/processing atomic and replay-safe | Concurrent duplicate/out-of-order tests produce one valid transition |
| PAY-003 | P0 | Enforce payment state transitions and trusted amount/account checks | Illegal transition and mismatch tests fail |
| PAY-004 | P0 | Normalize provider errors and add correlation/monitoring | Users see safe messages; operators see actionable detail |
| PAY-005 | P1 | Implement provider-hosted seller onboarding remediation | Requirement changes/restrictions are handled and tested |
| PAY-006 | P1 | Implement refunds, release failures, chargebacks, and account suspension | Sandbox scenario matrix passes |
| PAY-007 | P1 | Build daily reconciliation and exception queue | Every test transaction reconciles; discrepancy blocks release as designed |
| PAY-008 | P1 | Add finance/admin dual-control thresholds and audit | High-impact actions require correct roles/approvals |
| PAY-009 | P1 | Add environment kill switches and live-mode safeguards | Sandbox/live IDs and keys cannot mix |

## Epic 8 — KYC, agreements, and policy evidence

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| KYC-001 | P1 | Select and contract KYC provider | Coverage, privacy, false-positive, pricing, support, DPA reviewed |
| KYC-002 | P1 | Implement hosted onboarding/status/remediation webhooks | Required status and manual-review paths pass |
| AGR-001 | P0 | Version agreement schema and canonical rendering | UI/PDF/hash represent the same immutable content |
| AGR-002 | P1 | Counsel approves clickwrap/e-sign evidence | Consent copy, notices, timestamps, identity evidence meet approved standard |
| AGR-003 | P1 | Produce professional accessible agreement PDF/receipt | PDF is readable, branded, versioned, verifiable, and archived |
| POL-001 | P0 | Publish beta privacy, terms, prohibited-items, retention, support, and cancellation policies | Versions are linked at collection/action points |

## Epic 9 — Support, disputes, moderation, and fraud

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| OPS-001 | P0 | Define support roles, queues, SLAs, and escalation | Test cases route to a named role with deadlines |
| OPS-002 | P0 | Implement case-scoped access and operator audit | Support cannot browse unrelated private records |
| OPS-003 | P1 | Build structured dispute/evidence review workspace | Complete case can be decided without off-platform files |
| OPS-004 | P1 | Add refund/release authority matrix and selected dual control | Unauthorized/one-person high-value actions fail |
| OPS-005 | P1 | Add explainable risk rules, velocity controls, and manual review | Limits and false-positive handling are measured |
| OPS-006 | P2 | Add appeals, quality review, and policy analytics | Decisions are sampled and inconsistent outcomes tracked |

## Epic 10 — Observability, performance, and recovery

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| OBS-001 | P0 | Add client/server error and performance monitoring with redaction | Synthetic failure appears without leaking sensitive data |
| OBS-002 | P0 | Add uptime/synthetic checks for critical journeys | Alert routing and acknowledgement drill pass |
| OBS-003 | P0 | Add payment/security dashboards and alerts | Replay, mismatch, auth abuse, admin change scenarios alert |
| OBS-004 | P1 | Load test API/database/storage/provider event paths | Approved capacity and degradation behavior pass |
| OBS-005 | P1 | Define incident response, status communication, and evidence preservation | Tabletop and technical drill pass |
| OBS-006 | P1 | Run backup restore and provider event replay drill | RPO/RTO targets are met and documented |

## Epic 11 — Smart Catalog and structured listing data

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| CAT-001 | P1 | Establish versioned category IDs, labels, required attributes, and fallback rules | Catalog updates do not invalidate existing deals and every category has an accessible manual fallback |
| CAT-002 | P1 | Add guided Phone and Vehicle creation fields | Brand/model/storage and year/make/model generate an editable title without blocking not-listed items |
| CAT-003 | P1 | Add a cached server-side NHTSA vPIC integration for VIN and vehicle reference data | Browser never depends directly on the provider; timeout, rate limit, invalid VIN, and provider outage fail safely |
| CAT-004 | P2 | Persist category and structured attribute IDs through a reviewed migration | Existing deals backfill safely; public/private field boundaries and cross-user authorization tests pass |
| CAT-005 | P2 | Add category-aware search facets and URL state | Filters are keyboard accessible, shareable, indexable where appropriate, and use structured values rather than title parsing |
| CAT-006 | P2 | Add catalog governance, update cadence, analytics, and rollback | Every dataset version has a source, owner, release evidence, adoption metrics, and rollback path |

## Recommended delivery sequence

### Batch 1 — Measurable foundation

FND-001 through FND-006, ARC-001, DAT-001/002, and CI skeleton.

### Batch 2 — Secure modular core

ARC-002 through ARC-005, SEC-001 through SEC-006, DAT-003 through DAT-005.

### Batch 3 — Governed UX and evidence

UX-001 through UX-006 and EVD-001 through EVD-004.

### Batch 4 — Product/policy beta

AGR-001, POL-001, OPS-001/002, OBS-001/002/005, privacy and recovery foundations.

### Batch 5 — Payment/KYC production track

PAY, KYC, reconciliation, finance controls, independent review, and real-money Gate D.

## First engineering batch acceptance

The next coding batch should not add a new customer feature. It should:

- Pin dependencies and choose one lockfile.
- Add lint/format/test tooling and CI.
- Add the initial component/unit/E2E test harness.
- Add automated security-header tests and a safe initial header policy.
- Add a migration/RLS test harness plan without applying unreviewed production database changes.
- Produce the framework/session proof of concept behind a branch/Preview.

This creates the foundation on which later product work can be safely reviewed and released.

