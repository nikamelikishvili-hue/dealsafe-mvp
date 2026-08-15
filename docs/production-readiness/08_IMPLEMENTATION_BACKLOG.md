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
| FND-001 | P0 | **Complete:** npm is the single package manager, lockfile v3 is enforced, every direct dependency is pinned, and dependency-policy/SBOM/audit gates verify the resolved graph | Clean reproducible install produces the same dependency graph |
| FND-002 | P0 | **Complete:** pinned Biome format/lint gates, strict type-checking, foundation/unit tests, SSR React component tests, and production build/smoke checks run through the protected `verify` job | CI fails on a deliberate violation and passes clean code |
| FND-003 | P0 | **In progress:** protected CI runs the full gate and Preview smoke, binds a clean exact commit to deterministic release and served-asset manifests, and provides exact-host byte-for-byte deployment verification; GitHub `main` requires the current branch, `verify`, CodeQL analysis, and Vercel through a signed, linear, conversation-resolved pull request with administrator enforcement; hosted verifier activation, restricted long-term archive, and named promotion approval remain | Required checks block main on failure |
| FND-004 | P0 | **In progress:** exact dependencies, license and install-script policy, high-severity audit, repository secret scan, deterministic CycloneDX SBOM, bounded provenance manifest, CodeQL SAST, scoped ownership, finding SLAs, CI retention, and enforced branch protection exist; independent security-approver assignment remains an external paid-beta gate | Findings are visible and have ownership/SLA |
| FND-005 | P0 | **Complete in the repository:** one machine-readable Local/Preview/Staging/Production contract validates application and Edge configuration, blocks an unsafe build with a value-free missing/invalid report, and keeps public health liveness-only; hosted provider-separation evidence remains a release gate | Startup fails safely with a clear missing-config report |
| FND-006 | P0 | **Complete in the repository:** ambiguous runtime defaults are removed and a fail-closed CI inventory allows only named, location-bound migration aliases for browser cleanup, database compatibility, Stripe history, fee migration, and Vercel aliases | Runtime keys, fee config, analytics, assets, and docs consistently use Dealivra or a migration alias |

## Epic 2 — Application architecture

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| ARC-001 | P0 | Build target-framework/session proof of concept | Auth, protected route, SSR/public route, CSP, and Preview work |
| ARC-002 | P0 | Introduce real routes and error boundaries | Refresh/deep link/back/forward and 404 behavior pass |
| ARC-003 | P0 | **Complete locally for review:** split `app.tsx` by auth, deal, agreement, payment, delivery, dispute, and admin; Deal Workspace composition and remaining Deal feature presentation are extracted into focused modules | No feature requires editing the central monolith for ordinary behavior |
| ARC-004 | P0 | **In progress locally:** create typed API/service boundary with runtime request/response schemas; primary Deal reads, Deal creation/draft/publication/edit/cancellation, public acceptance, media ownership/order, saved/public Deal reads, browser Auth/session/TOTP MFA success responses, every current browser Auth mutation request/error, protected-payment/Stripe success responses and browser request/errors, the read-only historical payment receipt, account-name mutation with compensating rollback, governed evidence/lifecycle, evidence and dispute mutation requests/errors, participant communication, offer/inquiry, safety-report, moderation, administrator finance/catalog, public seller trust, Digital Trust Passport, explainable Deal risk, delivery/meeting/handoff/inspection, account profile/session/rating/timeline/participant, canonical agreement/Deal Link/Watchlist, and staged support-case success/request/error contracts now fail closed; revoked pre-Stripe payment acknowledgement mutations are retired from the client and production RPC allowlist | Invalid server/client data fails safely and is monitored |
| ARC-005 | P1 | **In progress locally:** seller onboarding, checkout, payout release, refund, support intake, monitoring, recovery control, security notifications, and current-password change have exact fail-closed environment gates; environment activation proof and remaining critical capability inventory remain | Each critical capability can be disabled without redeploying unrelated features |

## Epic 3 — Design system and workflow UX

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| UX-001 | P0 | **In progress locally:** semantic brand, surface, border, status, focus, radius, shadow, and touch-target tokens are centralized; status contrast is release-tested; feature-owned literal colors and overrides remain for incremental migration | Governed screens use approved tokens and contrast tests pass |
| UX-002 | P0 | **In progress locally:** one accessible feedback primitive now governs account and recovery information/success/error announcements; loading, retry, field-error, and remaining workflow feedback primitives remain | Component tests cover keyboard, focus, names, errors, loading, touch targets |
| UX-003 | P0 | Rebuild Deal Workspace information hierarchy | One next action is visible and focusable at every state |
| UX-004 | P0 | **Repository complete; hosted acceptance pending:** standardized native US address autocomplete and manual fallback share one parser; meeting and shipping flows expose apartment/suite/unit, state, and ZIP/ZIP+4 fields; combobox status, loading, and fallback are announced accessibly | State and ZIP are required/validated; private fields never appear publicly; exact-origin Google provider and protected Preview keyboard/mobile acceptance remain |
| UX-005 | P0 | **In progress locally:** normalize responsive behavior across 320–1440 px; the private chat clears the mobile action dock, while media previews use dynamic viewport bounds, safe-area controls, trapped keyboard focus, scroll containment, and focus restoration | No overlap/horizontal page scroll; sticky or modal UI does not obscure focus; protected Preview viewport matrix remains |
| UX-006 | P1 | Add visual-regression stories for public, auth, creation, deal, payment, delivery, dispute, admin | Approved snapshots run in CI |
| UX-007 | P1 | Conduct moderated usability and accessibility sessions | Critical repeated confusion is resolved and documented |

## Epic 4 — Database, migrations, and authorization

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| DAT-001 | P0 | Convert setup SQL into timestamped migrations | Empty and previous-version databases migrate automatically |
| DAT-002 | P0 â€” in progress | Inventory every table/view/function/bucket/grant/policy | Machine-readable owner/exposure/steward inventory is wired after all 17 SQL suites; isolated Staging execution and owner review remain |
| DAT-003 | P0 â€” in progress | Add cross-user RLS/function/storage test harness | RPC role matrix is behind an exact Staging target guard; real-token HTTP and Storage cases remain |
| DAT-004 | P0 â€” repository complete | Harden `security definer` functions and grants | Fixed search path, validated inputs, explicit grants, and regression tests are present; Staging proof remains a launch gate |
| DAT-005 | P0 â€” repository complete | Implement immutable material audit events | Append-only events, correlation IDs, mutation denial, and rollback proof are present; Staging proof remains a launch gate |
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

SEC-006 now has a same-origin server boundary for signup, password login, and
password recovery. Provider throttling is preserved as a bounded `Retry-After`
response, recovery remains non-enumerating, and rejected-request telemetry
excludes user and credential data. The same-origin Auth proxy now has an
inactive, fail-closed boundary for forwarding only Vercel's exact client IP
with a separate server secret, avoiding accidental shared provider bucketing
after reviewed activation. Refresh and MFA throttles preserve the current
session. The proposed route/method firewall limits and Auth IP forwarding
remain inactive documentation/configuration; SEC-006 stays open until real
traffic is observed, Preview enforcement passes, Production alert/rollback
ownership is assigned, and measured abuse justifies any accessible CAPTCHA.
Password completion now also uses a same-origin server boundary. Recovery
remains available, while signed-in change fails closed until the provider's
current-password verification and the matching Preview switch are explicitly
enabled. Successful changes clear the local session and require fresh sign-in.

SEC-004 now has repository-level enforcement and regression coverage for CSP,
HSTS, frame, MIME, referrer, permissions, cross-domain-policy, and reporting
headers. Its bounded same-origin reporting endpoint removes query strings,
fragments, identifier-like path segments, samples, referrers, and original
policy text before logging. SEC-004 remains open until a protected Preview
proves the actual response headers and a synthetic sanitized event, alert and
retention ownership are recorded, and rollback is rehearsed.

SEC-003A now provides TOTP enrollment, enrolled-user login challenge, and
mandatory `aal2` enforcement for `support`, `compliance`, and `admin` across the
Data API, Storage, and protected Edge Functions. SEC-003 remains open for a
supported phishing-resistant privileged factor and final production activation
evidence. The protected checkpoint now records one ready privileged account,
zero blocked accounts, two verified TOTP factors, and successful primary and
backup login checks. The production enforcement migration remains staged and
intentionally unapplied until the password-only negative matrix passes across
every protected surface and a second authorized reviewer is assigned.

SEC-003B now stages a dual-control lost-factor recovery state machine. A recent
TOTP-backed `aal2` operator opens the case, an independent compliance/admin
reviewer decides it, and only a service workflow may complete it after session
and verified-factor revocation. Completion creates 72-hour payout, email, and
MFA-change holds, immutable audit events, and security-notification outbox jobs.
Direct access to the private recovery tables is revoked. The migration and its
rollback-only proof are not active in Production.

SEC-007 now has a repository-level notification/cooldown foundation through the
same recovery workflow. MFA enrollment/removal, Stripe payout onboarding,
ordinary seller release, and seller-favoring dispute release now call one
staged cooldown boundary; the current product exposes no email-change mutation.
SEC-007 remains open until the migration is applied in a non-production
environment and the switches are enforced. A private staged delivery worker now
resolves only a confirmed Auth email, renders fixed templates, uses provider
idempotency, records bounded delivery results, and exposes privacy-safe queue
health counts with an explicit dead-letter signal. Sender-domain verification,
Vault/Cron activation, bounce/complaint handling, external alert routing and
ownership, live hold/expiry tests, and a supervised rollback rehearsal remain
required.

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
| AGR-001 | P0 | Version agreement schema and canonical rendering — implemented locally with browser request/response integrity boundaries; activation proof pending | UI/PDF/hash represent the same immutable content |
| AGR-002 | P1 | Counsel approves clickwrap/e-sign evidence | Consent copy, notices, timestamps, identity evidence meet approved standard |
| AGR-003 | P1 | Produce professional accessible agreement PDF/receipt — document layout implemented locally; browser/archive/legal evidence pending | PDF is readable, branded, versioned, verifiable, and archived |
| POL-001 | P0 | Publish beta privacy, terms, prohibited-items, retention, support, and cancellation policies | Versions are linked at collection/action points |

## Epic 9 — Support, disputes, moderation, and fraud

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| OPS-001 | P0 | **In progress locally:** staged private support cases define member intake, urgent/normal SLA targets, minimal AAL2 operator queues, assignment, resolution, and a fail-closed browser gate; escalation ownership and monitored deployment evidence remain | Test cases route to a named role with deadlines |
| OPS-002 | P0 | **In progress locally:** support tables deny direct access, customers read only their cases, full operator detail requires explicit assignment plus AAL2, and material actions append audit events; deployed cross-account proof remains | Support cannot browse unrelated private records |
| OPS-003 | P1 | Build structured dispute/evidence review workspace | Complete case can be decided without off-platform files |
| OPS-004 | P1 | Add refund/release authority matrix and selected dual control | Unauthorized/one-person high-value actions fail |
| OPS-005 | P1 | Add explainable risk rules, velocity controls, and manual review | Limits and false-positive handling are measured |
| OPS-006 | P2 | Add appeals, quality review, and policy analytics | Decisions are sampled and inconsistent outcomes tracked |

## Epic 10 — Observability, performance, and recovery

| ID | Priority | Work | Acceptance |
|---|---|---|---|
| OBS-001 | P0 | **In progress locally:** runtime contract rejections, fixed-category browser failures, and URL-free Web Vital quality buckets use bounded default-off intakes; Auth/catalog/VIN failures use one fixed-category correlated server record; build budgets guard asset growth and the authenticated application/service boundary is split below a tightened chunk ceiling; protected activation, remaining Edge/provider surfaces, external alert routing, retention proof, browser trace, and synthetic evidence remain | Synthetic failure appears without leaking sensitive data |
| OBS-002 | P0 | **In progress locally:** minimal liveness and a bounded read-only protected-Preview probe cover the application shell, Terms/sign-in routes, and phone catalog; encrypted schedule, alert routing, acknowledgement/recovery drill, and isolated authenticated/provider journeys remain | Alert routing and acknowledgement drill pass |
| OBS-003 | P0 | **In progress locally:** a deterministic privacy-safe policy reduces reviewed application/Auth/CSP/payment/notification/performance/synthetic records to fixed counters and alerts; external drain aggregation, dashboard access, alert routing, admin-change coverage, deduplication, and acknowledgement drills remain | Replay, mismatch, auth abuse, admin change scenarios alert |
| OBS-004 | P1 | Load test API/database/storage/provider event paths | Approved capacity and degradation behavior pass |
| OBS-005 | P1 | **In progress locally:** fail-closed incident declaration/transition policy, release and payment-integrity freezes, reviewed status drafts, hash-only evidence manifests, and a no-network release drill are implemented; named on-call, paging/status integrations, restricted forensic storage, tabletop, and technical environment drill remain | Tabletop and technical drill pass |
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

