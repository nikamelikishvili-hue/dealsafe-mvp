# Security threat model

## 1. Security objective

Protect users from account takeover, private-record disclosure, fraudulent state changes, malicious files, payment manipulation, administrator abuse, and loss of evidence while preserving a usable transaction flow.

The target is OWASP ASVS 5.0 Level 2 across the product, with selected Level 3 controls for:

- Authentication recovery and administrator access.
- Payment, refund, dispute, and release actions.
- Identity-verification state.
- Evidence integrity and access.
- Audit and security logging.

No document may describe the system as “unbreakable” or “the strongest security.” Dealivra will publish factual controls and independent assessment results.

## 2. Protected assets

| Asset | Sensitivity | Primary harm |
|---|---|---|
| User account and session | High | Account takeover and fraudulent actions |
| Private deal terms and participant identity | High | Privacy harm, stalking, fraud |
| Delivery address and meeting details | Restricted | Physical safety risk |
| Evidence photos/videos/documents | Restricted | Privacy harm, manipulation, legal/support impact |
| Agreement version and acceptance | High integrity | Repudiation and dispute failure |
| Payment/refund/release state | Critical integrity | Direct financial loss |
| Stripe/KYC provider references | Restricted | Account correlation and fraud |
| Secrets and service-role credentials | Critical | Full platform compromise |
| Admin/support access | Critical | Mass disclosure or financial action |
| Audit/security logs | High integrity | Lost accountability and detection |

## 3. Likely threat actors

- Opportunistic attackers using credential stuffing, phishing, or automated abuse.
- Fraudulent buyer or seller manipulating deal/evidence/payment state.
- A participant attempting to access another deal.
- Malicious file uploader.
- Abusive or compromised support/administrator account.
- Supply-chain attacker through a package, CI secret, or provider.
- Bot creating accounts, links, spam, or verification costs.
- External attacker exploiting XSS, injection, authorization, webhook, or storage mistakes.

## 4. Priority threat scenarios

| ID | Scenario | Required prevention/detection |
|---|---|---|
| T01 | Stolen/replayed session changes delivery or payment flow | Secure session design, rotation, revocation, step-up auth, device/session view, alerts |
| T02 | User changes an ID and reads another participant’s data | RLS, relationship checks in every server command, UUID alone never authorizes |
| T03 | Anonymous Deal Link leaks buyer/address/evidence data | Dedicated public projection/RPC with allowlisted fields and regression tests |
| T04 | XSS steals a browser bearer token | Server-managed cookie target, strict CSP, no unsafe HTML, dependency review, output encoding |
| T05 | Duplicate/out-of-order webhook releases or records funds incorrectly | Atomic event claim, constrained transitions, idempotency, provider re-fetch, reconciliation |
| T06 | Client forges `funds_secured`, `verified`, or `released` | Provider event is authoritative; no authenticated client write grant |
| T07 | Seller changes terms after buyer acceptance | Immutable agreement version, content hash, acceptance bound to exact version |
| T08 | Malicious upload exploits reviewer or leaks metadata | Type/size checks, malware scan, private signed URL, safe renderer, EXIF policy |
| T09 | Brute force guesses buyer access code | Strong random code, hashed storage, rate limit, expiry, invalidation, non-enumerating response |
| T10 | Admin refunds/releases/reads records without valid need | Separate admin identity, step-up MFA, least privilege, reason, immutable log, selected dual control |
| T11 | Password reset or email change takes over account | Re-authentication, verified notifications, cooldown for high-risk actions |
| T12 | Logs expose tokens, addresses, or identity details | Structured redaction, log schema, restricted access, short raw-log retention |
| T13 | Dependency or CI compromise injects malicious code | Exact versions, lockfile, protected branches, scans, minimal CI permissions, artifact provenance |
| T14 | Database/storage loss destroys dispute evidence | PITR, storage backup, integrity inventory, restore drills |
| T15 | Bot/fraud volume causes provider cost or support exhaustion | CAPTCHA, velocity limits, quotas, risk thresholds, manual review, kill switches |

## 5. Required security controls

### Identity and authentication

- Email verification before sensitive participant actions.
- MFA available to users and mandatory for privileged roles.
- Phishing-resistant MFA for production administrators where providers support it.
- Session inventory, logout-all, revocation, inactivity and absolute expiry.
- Re-authentication for email, payout destination, release, refund, and role changes.
- Recovery responses that do not reveal whether an account exists.
- Security notification for password, email, MFA, payout, and new-device changes.

### Authorization

- Deny-by-default RLS on every exposed table.
- Explicit grants for tables, views, functions, sequences, and storage buckets.
- `security definer` functions use fixed `search_path`, validated inputs, and explicit execute grants.
- Public deal data comes from a purpose-built allowlisted projection, never the base deal row.
- Cross-user tests prove seller A, buyer A, anonymous, support, and seller B boundaries.
- Service-role credentials exist only in server environments.

### Application and API

- Runtime input schemas for every API request and provider event.
- Parameterized database access.
- Output encoding and no uncontrolled HTML injection.
- CSRF control appropriate to cookie-based sessions.
- Origin validation and narrow production CORS.
- Per-route limits for auth, creation, acceptance, messages, uploads, reports, Checkout, and admin actions.
- Consistent user-safe errors; internal detail only in restricted logs.
- Request and correlation IDs across web, server, provider, and audit records.

### Payments and provider events

- Raw-body signature verification using the provider-supported library where available.
- Atomic unique event insert/claim before side effects, with retry-safe processing state.
- Legal state-transition table enforced server-side/database-side.
- Amount, currency, deal, participant, account, and environment revalidated from trusted records.
- Daily automated reconciliation and an operations exception queue.
- Payment release/refund/dispute actions require current provider state, role, reason, and idempotency key.
- Live and Sandbox objects can never mix.

### Data and files

- TLS in transit and provider-managed encryption at rest.
- Application-level encryption for exceptionally sensitive values only with managed key rotation.
- Private storage by default.
- Short-lived signed downloads, authorization at issuance, and access logging.
- Upload allowlist, byte-signature inspection, safe filenames, size/resolution/duration limits, malware scanning.
- Never store raw card, bank credential, ID document, or biometric capture in the main app database.

### Platform and supply chain

- Protected main branch and required CI checks.
- Exact dependency versions and reviewed automated upgrades.
- Secret scanning, dependency scanning, SAST, and infrastructure/configuration checks.
- Separate production accounts and least-privilege team roles.
- Hardware-backed MFA for GitHub, Vercel, Supabase, Stripe, domain registrar, email, and monitoring administrators.
- Quarterly access review and immediate offboarding checklist.

## 6. Detection and response

### Alert immediately

- Service-role or production-secret use from an unexpected source.
- Repeated cross-deal authorization failures.
- Payment state conflict or reconciliation difference.
- Webhook signature failures above the normal baseline.
- New administrator, MFA removal, or production role change.
- Unusual evidence downloads or mass record access.
- Multiple payout/account changes or high-velocity deal creation.

### Incident severity

| Severity | Example | Initial response target |
|---|---|---|
| SEV-1 | Active data disclosure, secret compromise, incorrect release/refund | 15 minutes |
| SEV-2 | Major auth/payment degradation without confirmed loss | 30 minutes |
| SEV-3 | Limited feature degradation or contained abuse | 4 hours |
| SEV-4 | Low-risk defect or monitoring issue | Next business day |

Every SEV-1/2 produces a timeline, containment record, customer/legal notification decision, root-cause analysis, and tracked corrective actions.

## 7. Security verification

- Threat model review at every payment/identity/data-boundary change.
- Automated ASVS-mapped checks in CI where possible.
- Independent penetration test before real-money beta.
- Retest of all critical/high findings and zero open critical/high issues at release.
- Annual external assessment and additional testing after material architecture changes.
- A responsible disclosure program before broad public release; bug bounty after triage capacity exists.

## 8. Immediate findings to enter the backlog

- Replace browser-readable long-lived session storage with the approved session architecture.
- Restrict production CORS instead of wildcard origins.
- Add security headers to the Vercel/server configuration.
- Make Stripe webhook event claiming atomic and prove concurrent replay behavior.
- Normalize server errors so provider/internal messages are not exposed.
- Consolidate SQL into migrations and build RLS/storage/function negative tests.
- Replace `latest` dependency ranges with exact reviewed versions.
- Remove remaining legacy `dealsafe` runtime identifiers where they create configuration ambiguity.

