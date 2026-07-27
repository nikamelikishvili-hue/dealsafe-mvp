# Test strategy and release gates

## 1. Definition of done

A feature is complete only when:

- Product acceptance criteria pass.
- Authorization and abuse cases pass.
- Loading, empty, error, retry, offline, and recovery behavior is defined.
- Keyboard, screen-reader, zoom, responsive, and contrast checks pass.
- Telemetry and support visibility exist.
- Documentation and customer copy match actual behavior.
- No critical/high security issue remains.

A successful local build alone is not a completion signal.

## 2. Required test layers

| Layer | Scope | Required examples |
|---|---|---|
| Static | Type, lint, format, dependency, secret, SAST | TypeScript strictness, unsafe patterns, vulnerable packages |
| Unit | Pure rules and components | Fee math, state transitions, validation, content/hash generation |
| Component | UI behavior/accessibility | Forms, action dock, stepper, dialog, errors, keyboard |
| Database | Schema/functions/RLS | Cross-user allow/deny, public projection, immutable records |
| Integration | Server + provider adapters | Auth, upload, Stripe/KYC webhook, notification |
| E2E | Real browser critical journeys | Seller create, buyer accept/pay, delivery, dispute, admin review |
| Visual | Governed pages/components | Mobile/tablet/desktop snapshots |
| Performance | Page/API/database/load | Core Web Vitals, slow queries, concurrent provider events |
| Security | ASVS/manual/penetration | AuthZ, session, XSS, CSRF, injection, upload, secrets |
| Recovery | Backup/event replay/provider failure | Restore, webhook replay, notification/provider outage |

## 3. CI pipeline

Every pull request must run:

1. Exact reproducible install.
2. Format and lint.
3. Type check.
4. Unit/component tests.
5. Production build.
6. Dependency, license, secret, and static security scans.
7. Ephemeral database migration and RLS/function tests.
8. E2E smoke tests against Preview.
9. Accessibility scan.
10. Visual-regression comparison for governed screens.

Main requires review and all checks. Production deploys a tested commit; it is not rebuilt from an untracked local state.

## 4. Critical E2E matrix

### Authentication

- Sign-up, email confirmation, sign-in, sign-out.
- Password recovery, expired/used link, session revocation.
- MFA enroll/challenge/recovery for required roles.
- New-device and sensitive-change notifications.

### Deal and agreement

- Guest draft recovery and authenticated ownership.
- Seller create/edit/publish.
- Anonymous public view contains only allowed data.
- Intended buyer claim and access-code rate limit.
- Material edit creates a version and invalidates old pending acceptance.
- Acceptance remains bound to the exact version.

### Payment

- Seller onboarding incomplete/complete/restricted.
- Buyer Checkout create/reuse/expire/fail/succeed.
- Duplicate and out-of-order webhooks.
- Concurrent webhook delivery.
- Payment amount/currency/account mismatch.
- Dispute, refund, transfer release/failure, and account suspension.
- Daily reconciliation exception and resolution.

### Delivery and evidence

- Separate street, apartment, city, state, ZIP and privacy behavior.
- Pre-shipment evidence gate.
- Invalid/duplicate tracking.
- Delivery confirmation and buyer inspection.
- Malicious/oversize/unsupported file rejection.
- Signed evidence URL expiration and cross-user denial.

### Support/admin

- Case-scoped evidence access.
- Unauthorized admin route/function denial.
- Reasoned moderation/refund/release with audit.
- Dual-control action where configured.
- Role removal immediately removes access.

## 5. Release gates

### Gate A — Foundation complete

- This specification is mapped to owned backlog items.
- Target architecture proof of concept is accepted.
- CI skeleton, coding standards, and dependency policy exist.
- Environments and secrets are inventoried.

### Gate B — Private non-money beta

- Core journeys pass E2E on supported devices.
- RLS/storage/function authorization suite is complete.
- Security headers, rate limits, error monitoring, backups, and restore test pass.
- Privacy, terms, prohibited-items, and support policies are approved for the beta.
- No open critical/high security issue.

### Gate C — Paid software pilot without holding item funds

- Billing model and claims are approved by counsel/provider.
- Subscription/record-fee billing reconciles.
- Cancellation/refund and support operations are tested.
- Invited-user analytics and privacy notices are live.
- Product usability thresholds hold.

### Gate D — Real-money protected-payment beta

- Stripe approves the platform use case and live capabilities.
- Payments counsel signs off on funds flow and customer wording.
- KYC/provider contracts and data-processing terms are complete.
- All payment event, replay, race, failure, refund, chargeback, and payout tests pass.
- Reconciliation and support case queues are live.
- Independent penetration test has zero open critical/high findings.
- Incident, provider outage, payment kill-switch, and restore drills pass.
- A named operations team covers the beta volume.

### Gate E — Wider US release

- Controlled beta volume has statistically useful fraud, chargeback, support, conversion, and reliability results.
- Financial reconciliation has no unexplained transaction.
- Dispute SLA and staffing targets hold.
- Accessibility specialist review is complete.
- Load and recovery targets pass at projected launch capacity.
- Executive, technical, security, legal, finance, and operations owners sign the release record.

### Gate F — New country

- Country-specific payments, identity, privacy, tax, consumer, e-sign, prohibited-item, language, address, retention, support, and dispute assessment is approved.
- Local provider/live-mode tests pass.
- Country-specific policies and agreement versions are published.
- A limited local beta passes before general availability.

## 6. Required release evidence

Each release record links to:

- Commit and deployment.
- Migration and rollback/forward-fix plan.
- CI test output.
- Authorization/RLS report.
- Security scan and finding disposition.
- Accessibility report.
- Performance/load report where required.
- Usability findings.
- Policy/copy version.
- Monitoring dashboard and alert test.
- Backup/restore evidence when required.
- Named approvers and time.

## 7. Rollback and kill-switch rules

- UI/backend deployment must be reversible without losing committed transactions.
- Database rollback is not assumed; prefer forward-compatible expand/migrate/contract changes.
- Kill switches separately disable new accounts, new deals, uploads, Checkout creation, payment release, and public sharing.
- Incorrect payment or authorization behavior triggers immediate containment, not a wait for the next planned release.

