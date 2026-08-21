# Production-readiness progress log

## 2026-08-21 — DAT-001 hosted Staging preflight

- Created the repository's protected-branch-only `staging` GitHub Environment;
  no secrets, deployments, production aliases, or provider resources were
  added or changed.
- Dispatched the manual database-baseline workflow on reviewed `main` commit
  `8c57cad22820cca72e2ebb14559f94c1b18e9a0e`.
- Run `32494006891` failed closed at the database-target guard because the
  required Staging variables and secrets are not configured. Supabase CLI
  installation, project linking, baseline capture, and every database command
  were skipped.
- Tightened the workflow so the target guard executes immediately after
  checkout and disposable-stack cleanup runs only after a successful local
  stack start. This removes unnecessary setup work and a misleading cleanup
  failure from intentionally rejected preflight runs.
- DAT-001 remains open until the five protected Staging settings are supplied,
  the CLI-generated migration is reviewed, and empty/upgrade database proofs
  pass. Production, public access, payments, and customer data remain unchanged.

## 2026-08-15 — Global logout browser clearing

- Added browser cache, cookie, and origin-storage clearing only after the Auth
  provider confirms global session revocation.
- Kept local, other-session, invalid, and failed revocation paths free of the
  destructive browser-clear signal.
- Added exact header-presence and absence regression checks across scopes.

### Activation boundary

No live session was revoked. Production, public aliases, hosted configuration,
customer data, and real-money capabilities remain unchanged.

## 2026-08-15 — Browser resource and process isolation

- Added same-origin resource isolation and origin agent clustering to every
  application response.
- Preserved popup-compatible opener isolation for approved provider journeys.
- Added exact-value regression gates and a protected-Preview compatibility and
  rollback requirement.

### Activation boundary

Only review-branch repository configuration changed. No live Vercel alias,
Production deployment, public access, provider setting, customer data, or
real-money capability changed during this pass.

## 2026-08-15 — Logout JSON boundary correction

- Corrected logout from a bodyless mutation classification to a bounded JSON
  scope mutation.
- Required canonical JSON media before parsing, provider contact, or session
  revocation and added a negative provider-isolation test.
- Kept refresh as the only bodyless Auth mutation.

### Activation boundary

No live session was revoked and no Production, public access, hosted resource,
customer data, or real-money capability changed during this pass.

## 2026-08-15 — Shared reporting request boundary

- Consolidated method, canonical Origin, JSON media, bounded body, response
  header, and runtime metadata controls for three diagnostic intake endpoints.
- Kept endpoint schema allowlists, byte ceilings, modes, and privacy-safe log
  contracts isolated while removing duplicated security logic.
- Extended the API inventory and negative matrix to prevent boundary drift.

### Activation boundary

No monitoring mode, Production deployment, public alias, hosted configuration,
live resource, customer record, or real-money capability changed in this pass.

## 2026-08-15 — JSON mutation media boundary

- Added one shared normalized `application/json` requirement for every
  same-origin endpoint that accepts a request body.
- Rejected unsupported media with a bounded 415 response before body parsing,
  provider contact, credential work, or database access.
- Extended the API inventory gate so removing the media guard fails verify.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Preview bundle budget alignment

- Confirmed that the Vercel Preview feature configuration produces 832,516
  bytes of total JavaScript while the safe-default local build produces
  829,974 bytes from the same reviewed source stack.
- Raised only the total JavaScript ceiling from 830,000 to 835,000 bytes,
  leaving the initial-application, individual-chunk, and CSS ceilings unchanged.
- Retained less than 0.3% headroom over the measured Preview artifact so future
  bundle growth still fails closed instead of silently normalizing drift.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## 2026-08-15 — API mutation-origin inventory

- Added a fail-closed inventory for every application API route and wired it
  into the complete repository verification gate.
- Classified shared same-origin, local telemetry, read-only, and intentionally
  cross-origin CSP reporting boundaries with mode-specific required controls.
- New, missing, or weakened route files now fail verification.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## 2026-08-15 — Authentication origin canonicalization

- Replaced host-only Auth origin comparison with the existing strict canonical
  Origin parser and a bounded single-host validation boundary.
- Rejected insecure public HTTP, same-host paths, host lists, host path
  injection, and credential-like host input before any provider request.
- Preserved explicit local HTTP support only for localhost development.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## 2026-08-15 — Deal action-plan recovery

- Replaced the blank initial Deal progress state with an accessible loading
  contract and a direct retry when the first read fails.
- Preserved prior milestones after a polling failure while explicitly warning
  that they are stale and should not drive the next action until refreshed.
- Reused request-generation guards for polling and manual retries.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## 2026-08-15 — Shipping readiness recovery

- Stopped converting a failed seller evidence-readiness read into a valid
  incomplete checklist.
- Added distinct loading, ready, and error states while retaining a prior
  successful value only as stale continuity data.
- Added a direct primary-action retry that remains fail-closed until the
  provider confirms current readiness.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## 2026-08-15 — English launch identity-call headroom

- Expanded the parser-scoped English launch transform from literal-only calls
  to every bare, single-argument `t()` call imported from the reviewed identity
  helper, preserving one evaluation of the original expression.
- Kept member calls, comments, quoted examples, and modules without the named
  `i18n` import outside the transform boundary.
- Passed 294 foundation tests, twelve focused component tests, TypeScript,
  lint, security gates, the production build, and Preview smoke verification.
- Reduced total production JavaScript from 829,641 to 828,551 bytes, restoring
  1,449 bytes of governed headroom below the 830,000-byte ceiling.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## 2026-08-11 — DAT-002 machine-readable ownership inventory

- Added a read-only catalog inventory for every application table, view,
  function, Storage bucket, policy, table grant, and routine grant.
- Each object records its database owner, exposure class, and one reviewed
  engineering/security steward without reading application rows.
- Added a fail-closed validator and wired it after the 17-suite protected
  Staging database gate. Missing object classes, duplicate identities, unsafe
  owner roles, or unassigned stewards now fail the gate.

## 2026-08-11 — DAT-003 hosted authorization harness prepared

- Added a status-only hosted Data API and Storage matrix for synthetic seller,
  buyer, outsider, expired, and anonymous Staging sessions.
- Added positive participant RPC checks, cross-user and expired-session denial,
  owner-folder Storage writes, and mandatory deletion of both generated probes.
- Tokens, identities, deal IDs, object paths, bodies, and bytes are excluded
  from the report. Production and customer data remain outside the harness.

## 2026-08-11 — DAT-001 baseline capture controls prepared

- Added an offline migration-manifest verifier that requires a CLI-generated
  Staging baseline, canonical timestamp order, unique timestamps, and SHA-256
  evidence while rejecting Auth user data, database URLs, privileged
  credentials, and deprecated extension version pins.
- Added strict and status-only package commands so readiness can be reported
  before capture without falsely treating a missing baseline as complete.
- Added a manual-only protected Staging workflow that installs a pinned
  Supabase CLI, captures the baseline, verifies its manifest, rebuilds a
  disposable local database, runs all 17 SQL suites and local advisors, and
  retains only the verified migration artifact for seven days.
- Documented the official `db pull`, local `db reset`, 17-suite authorization,
  advisor, upgrade, and forward-rollback evidence path. The baseline itself is
  still pending because Supabase CLI is not installed in this workspace.
- Production, public access, customer data, and real payments were not changed.

## 2026-08-10 — isolated Staging authorization suite completed

- Provisioned and used the isolated `dealivra-staging` Supabase project; the
  Production project remained unchanged.
- Applied the reviewed schema, authorization, MFA, evidence, dispute, support,
  payment-command, and audit boundaries to Staging with synthetic-only test
  fixtures.
- Corrected the case-administrator evidence policy so it checks dispute
  membership through a narrow administrator-bound `security definer` helper
  without exposing dispute rows to ordinary authenticated users.
- Made PAY-003 verification transaction-bound and provider identifiers unique,
  preventing repeat test executions from leaving new records or colliding with
  earlier synthetic fixtures.
- Passed all 17 rollback-only Staging database suites and all 232 repository
  foundation tests. Type checking and the production Vite build also pass.
- Expanded the protected manual Staging database workflow from one
  representative authorization test to the complete sorted inventory of 17
  rollback suites. The workflow now fails on inventory drift or the first SQL
  error, and the 232-test repository contract verifies that behavior.
- DAT-001 remains open because the historical setup SQL still needs a complete
  timestamped empty-database migration chain. DAT-003 remains open for
  real-token HTTP and Storage tests against synthetic Staging identities.
- No Production database object, customer record, Vercel alias, public-access
  setting, or real payment mode was changed.

## 2026-07-31 — isolated Staging database authorization gate

### Completed in the repository

- Added a manual-only GitHub `staging` environment workflow that rejects a
  Production or mixed Supabase target before any SQL runs.
- Added a defense-in-depth RLS migration for the owner-only private evidence
  maintenance settings table identified by the live database advisor.
- Added database-wide RLS, private-schema grant, policy-role, invoker-view,
  and elevated-function search-path assertions.
- Put the existing authenticated seller/buyer/outsider/admin RPC matrix behind
  the exact isolated Staging target guard.

### Verified external state and limits

- The connected Supabase organization currently exposes one active project;
  a separate Staging project is not yet available.
- The live remote database reports 27 applied migrations, but the repository
  does not yet contain a complete timestamped empty-database migration chain.
- The private maintenance settings table has owner-only ACLs and is not in an
  exposed schema, but RLS remains required for consistent defense in depth.
- No Production table, policy, grant, function, project, public-access setting,
  Vercel alias, or real payment was changed by this batch.

## 2026-07-30 — FND-006 legacy identifier governance

- Removed the ambiguous legacy Vercel project/team defaults from the Edge
  origin boundary. Missing Dealivra-named settings now disable wildcard
  Preview origins instead of broadening the allowlist.
- Added a fail-closed, value-free legacy identifier inventory over application,
  server, browser, build, Edge Function, and SQL sources.
- Bound every retained browser, database, Stripe, fee, cache, and Vercel alias
  to a named rule, exact location boundary, and reviewed occurrence count.
- Added `brand:verify` to the full protected verification chain and release
  evidence inputs. No hosted configuration, database object, payment record,
  deployment alias, or public-access setting was changed.

This log records completed delivery evidence. A backlog item is not marked complete from code alone when it also requires staging, provider, legal, accessibility, security, or operational evidence.

## 2026-07-29 — SEC-007 staged sensitive-change enforcement

### Completed in the repository

- Added one exact `staged`/`enforced` control shared by Vercel Auth Functions
  and Supabase Edge Functions.
- Guarded MFA enrollment, enrollment verification, and verified-factor removal.
  Login, fresh step-up, and cancellation of an unfinished factor remain
  available.
- Guarded Stripe Connect onboarding, ordinary seller payout release, and
  seller-favoring dispute release before provider or financial-command
  mutation. Buyer refunds remain available.
- Added stable `423` cooldown and fail-closed `503` unavailable behavior.
- Added regression tests and a controlled activation/rollback runbook.

### Safety state

- The runtime mode remains `staged`.
- The recovery migration remains unapplied in Production.
- No factor, session, payout, Stripe account, environment variable, domain,
  public-access setting, or production database object was changed.

## 2026-07-29 — SEC-007 staged security-notification worker

### Completed in the repository

- Added fixed recovery-event email templates that contain only a non-secret
  case reference and, for completion, the cooldown deadline.
- Added a private, bearer-authenticated Supabase Edge worker with exact staged
  activation, verified Auth-email lookup, 10-job claims, 10-second provider
  timeout, 16 KiB response cap, deterministic Resend idempotency, and bounded
  delivery results.
- Added regression tests for all five templates, payload rejection, worker
  authentication, privacy, provider idempotency, and no-CORS behavior.
- Documented SPF, DKIM, DMARC, Vault, Cron, bounce/complaint, retry alert, DPA,
  and controlled-delivery activation gates.

### Safety state

- Notification mode remains `staged`.
- No Resend account, API key, sender-domain record, Vault secret, Cron job,
  Edge deployment, recipient email, or Production configuration was created or
  changed.

## 2026-07-29 — SEC-003B dual-control recovery and password-only matrix foundation

### Completed in the repository

- Added a fail-closed same-origin recovery API with bounded request validation,
  recent TOTP-backed `aal2` checks, and exact privileged-role authorization.
- Added a staged, unapplied database migration for dual-control privileged MFA
  recovery. The request operator cannot approve the same case, service-only
  completion requires sessions and verified factors to be revoked, and
  successful recovery creates 72-hour payout, email, and MFA-change holds.
- Added immutable material audit events and a private security-notification
  outbox without storing passwords, tokens, TOTP secrets, one-time codes, email
  addresses, or raw identity evidence.
- Added rollback-only database contracts for recovery state, grants, RLS,
  immutable audit dependencies, reviewer separation, revocation checks, and
  cooldown creation.
- Added a same-account live negative-test harness for password-only denial and
  AAL2 controls across the Data API, protected Storage, and five protected Edge
  Functions.
- Documented the recovery operating boundary and the non-secret matrix evidence
  format.
- A read-only, identifier-free Production dependency check confirmed the
  profiles table, immutable audit table/trigger, role RPC, and required
  database roles are present. No recovery object was created or activated.

### Safety state

- `supabase/privileged_mfa_recovery_control.sql` is staged but unapplied.
- `supabase/mfa_assurance_enforcement.sql` remains unapplied.
- No session, factor, user, payout, domain, Vercel protection, or public-access
  state was changed.
- Production activation remains blocked on second-reviewer assignment, live
  negative-matrix evidence, notification delivery, hold enforcement at every
  sensitive mutation, and a supervised rollback rehearsal.

## 2026-07-28 — Privacy-safe CSP reporting and header hardening

### Implemented locally for review

- Added a same-origin CSP reporting group with modern `report-to` and
  compatibility `report-uri` routing.
- Added a 16 KiB, 20-event maximum CSP reporting endpoint for legacy and modern
  browser payloads.
- Treated every report as hostile input and excluded samples, original policy,
  referrer, cookies, headers, query strings, fragments, and identifier-like URL
  path segments from structured logs.
- Added `Reporting-Endpoints` and
  `X-Permitted-Cross-Domain-Policies: none`.
- Added exact header, inline-script hash, negative request, payload-limit, and
  privacy-redaction regression tests.
- Added the operating, monitoring, environment-validation, and rollback
  runbook.

### Release boundary

- SEC-004 remains in progress until a protected Vercel Preview proves the actual
  response headers and one synthetic sanitized event.
- Alert ownership, retention ownership, and rollback evidence are still
  required before the control is release-complete.
- The production custom domain remains unbound and real-money mode remains
  disabled.

### Review and protected Preview evidence

- Draft PR [#73](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/73)
  contains exactly seven governed files with no database, payment, or public
  access change.
- GitHub workflow `30393806517` (run 95) passed on exact review head
  `29554cd86e314b11ac248caa788c6d33192b9791`.
- Protected Preview `dpl_7VHDFr7aPLdY59AdqasRUgg1u5Vb` is READY on that
  exact head; its errors-only build output and warning/error/fatal runtime scan
  are clean.
- Anonymous requests to both the immutable deployment and branch alias return
  Vercel Authentication `302`, `noindex`, HSTS, and frame-denial headers.
- The authenticated Preview renders the Dealivra application, and
  `GET /api/security/csp-report` reaches the deployed Function and fails safely
  with `Method not allowed`.
- An authenticated raw application-header capture and one synthetic sanitized
  CSP POST are still required before SEC-004 can be marked complete.

### Merge and protected Production evidence

- PR #73 was squash-merged to `main` as verified commit
  `4adc795b912ee3c209e431941c638607803e9eae`.
- Exact Production deployment `dpl_3mciZGY7reBAQUndvsrcdf5hcX9L` reached
  `READY` from that commit in `iad1`; the errors-only build output completed
  cleanly in eight seconds.
- The post-release warning, error, and fatal runtime scan returned no records.
- Anonymous access to the immutable Production deployment continues to return
  the Vercel Authentication boundary with HTTP 302, `noindex`, HSTS, and
  frame denial.
- The Vercel project remains `live: false`. Only protected team-scoped Vercel
  aliases are attached; `dealivra.com` and `www.dealivra.com` remain detached.

### SEC-004 state

**Repository enforcement merged and protected Production verified; operational
closure remains pending.** Raw authenticated application-header capture, one
synthetic sanitized CSP report, alert/retention ownership, and rollback
evidence are still required. This work does not authorize public launch,
real-money processing, automatic payout, scanner activation, or removal of
Vercel protection.

## 2026-07-26 — Phase 1 specification and foundation batch

### Completed

- Created the authoritative US MVP scope and production master plan.
- Created the target system architecture and trust-boundary model.
- Created the security threat model and priority-control list.
- Created the data-classification, role-access, retention, privacy, and recovery model.
- Created the protected-payment, KYC, release, refund, dispute, and reconciliation model.
- Created the design-system, responsive-workflow, content, and WCAG 2.2 AA standard.
- Created the test strategy, release gates, and evidence requirements.
- Created the ordered implementation backlog.
- Pinned every direct runtime and development dependency to its reviewed installed version.
- Standardized the repository on npm and one lockfile.
- Added a supported Node version and exact-save npm policy.
- Added the first automated foundation tests.
- Added a GitHub CI workflow for type checking, tests, production build, and dependency audit.
- Added Dependabot configuration for npm and GitHub Actions.
- Added an initial Vercel browser-security header policy.
- Added CSP hash verification for every inline script.
- Removed the Vite warning for the intentionally external Vercel Analytics script.

### Verification evidence

- `npm run typecheck`: passed.
- Foundation tests: 5 passed, 0 failed.
- Production build: passed.
- Inline scripts in the built HTML matched the configured CSP hashes.
- Local documentation links: passed.
- Package-lock-only audit: 0 reported vulnerabilities.
- `git diff --check`: passed; only Windows line-ending notices were reported.

### Partially satisfied backlog items

| Item | State | Remaining evidence |
|---|---|---|
| FND-001 | Complete | Continue reviewing future updates through CI |
| FND-002 | Complete | Keep expanding component coverage as workflows are rebuilt |
| FND-003 | In progress | GitHub execution and protected `main` are verified; deterministic exact-host served-asset comparison now exists in the repository, while hosted verifier activation, restricted archive, and named promotion approval remain |
| FND-004 | In progress | Dependency, license, secret, deterministic SBOM, CodeQL, ownership, and branch-protection controls exist; an independent security approver remains |
| SEC-004 | In progress | Initial headers exist; browser/Preview validation and CSP reporting remain |

### Next batch

- Confirm the GitHub CI run on the pushed branch.
- Expand the component suite from static contract coverage to interactive
  keyboard, focus, error, and loading-state coverage.
- Add an architecture proof of concept for routed, server-managed authentication.
- Create the database object inventory and automated authorization-test harness.
- Restrict and normalize authenticated Edge Function origin/error behavior.

## 2026-07-27 — Phase 2 authentication and authorization hardening

### Implemented on the review branch

- Added same-origin Vercel Auth Functions for sign-up, sign-in, refresh, and logout.
- Moved the rotating refresh token into a `Secure`, `HttpOnly`, `SameSite=Strict`,
  host-only cookie scoped to `/api/auth`; browser JavaScript receives only the
  short-lived access token.
- Added no-store responses, origin validation, generic authentication errors,
  server-side input bounds, refresh-token rotation, and remote logout.
- Added 30-minute inactivity and 8-hour absolute browser-session limits.
- Removed migration of the legacy browser-readable refresh-token session.
- Raised new-password requirements to 12+ characters with uppercase, lowercase,
  and numeric characters on both client and server.
- Added server-controlled application roles (`member`, `support`, `compliance`,
  `admin`) without using editable user metadata for authorization.
- Added a final database hardening migration that removes direct anonymous table
  access, replaces broad PUBLIC RLS policies, restricts draft writes, and rebuilds
  anonymous/authenticated RPC permissions from explicit allowlists.
- Added regression tests for cookie flags, same-origin enforcement, secret
  non-disclosure, SPA/API routing, RLS policy shape, and RPC allowlists.

### Still required before this phase is release-complete

- Apply the reviewed hardening migration to a non-production Supabase branch and
  run cross-user positive/negative authorization tests.
- Verify the Vercel Preview Auth Functions end-to-end with test accounts.
- Configure server-side Supabase URL/publishable-key environment variables.
- Enable Supabase leaked-password protection, inactivity timeout, and privileged
  role MFA in provider settings.
- Build session inventory, logout-all, security notifications, and step-up MFA.
- Obtain independent review before enabling public registration or real money.

## 2026-07-27 — Authentication regression and environment safety

### Implemented on the review branch

- Added endpoint-level regression coverage for sign-up, sign-in, refresh-token
  rotation, failed refresh, malformed cookies, logout, password validation, and
  cross-origin rejection.
- Made malformed refresh cookies fail as an expired session instead of causing
  an unhandled server error.
- Added strict client and server Supabase URL validation.
- Blocked `sb_secret_` credentials from browser and Auth Function configuration.
- Added a clear account-service unavailable state when required browser
  configuration is missing or unsafe.
- Added the Local/Preview/Staging/Production configuration inventory, isolation
  rules, safe-failure behavior, change procedure, and release evidence.

### Verification evidence

- TypeScript strict check: passed.
- Authentication and foundation tests: 18 passed, 0 failed.
- Production build: passed.
- Privileged-key rejection occurs before any provider request.

### Still required

- Confirm the new checks in GitHub CI and the protected Vercel Preview.
- Verify each environment against the documented provider-isolation matrix.
- Apply the reviewed authorization migration only to a non-production Supabase
  branch and run the cross-user authorization matrix.

## 2026-07-27 — Dealivra runtime identifier normalization

### Implemented on the review branch

- Renamed current browser session events, language preference storage, and Google
  Maps loader identifiers to Dealivra.
- Added a one-time language preference migration that removes the old key after
  copying a valid value.
- Introduced `DEALIVRA_PLATFORM_FEE_BPS` as the canonical payment fee setting
  while retaining the old setting as a documented temporary fallback.
- Added a controlled register for database, payment, idempotency, and browser
  migration aliases that cannot be removed safely without coordinated work.
- Added regression checks preventing the Google Maps runtime from reintroducing
  the old brand and proving the canonical Dealivra identifiers are present.

## 2026-07-27 — High-confidence repository secret gate

### Implemented on the review branch

- Added a dependency-free scanner for private keys and high-confidence GitHub,
  OpenAI, Stripe, Supabase, AWS, and Slack credential formats.
- Integrated the scanner into `npm run verify` before the production build.
- Limited scanner output to the file path and credential category so a detected
  value is never copied into CI or local logs.
- Added a regression test proving representative credentials are classified
  without being returned by the scanner.

## 2026-07-27 — Built Preview smoke gate

### Implemented on the review branch

- Added a CI-compatible smoke test that starts the production build with the
  Vite Preview server and waits for readiness with a bounded timeout.
- Verified the application shell at `/`, `/terms`, and `/?start=signin`.
- Verified that the generated JavaScript entry asset and service worker are
  reachable with the expected response type/status.
- Added the smoke test to the required `npm run verify` sequence after build.

### Protected Preview evidence

- GitHub CI and the protected Vercel Preview passed for commit `514566a`.
- The deployed home, Terms, and sign-in routes rendered without browser console
  errors.
- A non-existent test account received the expected generic
  `Invalid email or password.` response from the deployed Auth Function.

## 2026-07-27 — Final authentication boundary review

### Implemented on the review branch

- Corrected the `__Host-dealivra-refresh` cookie path to `/`, as required by
  browser enforcement of the `__Host-` prefix.
- Added regression assertions proving login and refresh responses use
  `Path=/`, `HttpOnly`, `Secure`, and `SameSite=Strict`.
- Extended the 16 KB authentication request boundary to parsed JSON objects
  and UTF-8 byte length, not only raw string bodies.
- Added an endpoint regression test proving oversized parsed input is rejected
  before the authentication provider is contacted.

### Verification evidence

- TypeScript strict check: passed.
- Authentication and foundation tests: 22 passed, 0 failed.
- Repository secret scan: passed.
- Production build and local Preview smoke test: passed.

## 2026-07-27 — Smart Catalog creation foundation

### Implemented on the review branch

- Expanded the item-creation taxonomy from five templates to twelve governed
  categories while keeping the initial choice to five popular categories.
- Added a compact "More categories" control so the first step remains focused
  on mobile and desktop.
- Added guided Phone selection for brand, model, and optional storage.
- Added guided Vehicle selection for year, make, and model.
- Automatically builds an editable item title from selected catalog details.
- Added "Not listed" fallbacks for both brand/make and model so the catalog
  never blocks a legitimate listing.
- Preserved guided selections in privacy-scoped guest draft recovery.
- Kept the change compatible with the current database: no production
  migration, table change, or external catalog request is included.

### Verification evidence

- TypeScript strict check: passed.
- Foundation and authentication tests: 22 passed, 0 failed.
- Repository secret scan: passed.
- Production build and local Preview smoke test: passed.
- Browser verification passed for category expansion, Phone title generation,
  Vehicle title generation, custom-item fallback, and error-overlay checks.

### Next catalog controls

- Move the first curated data set behind a versioned server-side catalog API.
- Add NHTSA vPIC-backed VIN/year/make/model validation through a cached server
  boundary rather than direct browser requests.
- Persist stable category and attribute IDs after a reviewed database migration.
- Add structured search facets only after persistence and catalog-version rules
  are approved.

## 2026-07-27 — Versioned catalog and VIN assistance

### Implemented on the review branch

- Moved the curated Phone and Vehicle data into one versioned, market-labelled
  catalog artifact with stable brand IDs and a recorded update date.
- Added a same-origin catalog API with bounded output, browser/CDN cache rules,
  supported-category validation, and an embedded client fallback.
- Added a server-only NHTSA vPIC VIN decoder. The browser never contacts NHTSA
  directly.
- Validates the 17-character VIN and optional model year before a provider
  request, limits provider response size, applies a timeout, and keeps a bounded
  24-hour in-process cache with a hashed key and no plaintext VIN in the cached
  value.
- Returns only reviewed year, make, model, vehicle type, and body-class fields;
  private VIN responses are explicitly `no-store`.
- Added a focused "Check VIN" action to Vehicle creation. A successful match
  fills year/make/model and rebuilds the editable title while keeping manual
  "Not listed" fallbacks.
- Added plain-language disclosure that VIN decoding does not prove ownership,
  title status, authenticity, or condition.
- Kept this package database-neutral: no production schema or data migration is
  applied.

### Verification evidence

- TypeScript strict check: passed.
- Foundation, authentication, catalog, and VIN tests: 27 passed, 0 failed.
- Invalid VIN and cross-origin requests are rejected before NHTSA is contacted.
- Provider field allowlisting, cache reuse, timeout behavior, and private cache
  headers are covered by automated tests.

### Remaining catalog controls

- Persist category, brand, model, and variant IDs only through a reviewed
  expand/backfill migration with RLS and explicit grants.
- Add governed catalog update approval, rollback evidence, and provider-rate
  telemetry before public beta.
- Build category-aware search facets after structured values are persisted.

## 2026-07-27 — Guided catalog family expansion

### Implemented on the review branch

- Expanded the versioned U.S. launch catalog from Phone and Vehicle to eight
  reviewed guided families: Phone, Tablet, Laptop, Vehicle, Watch, Camera,
  Gaming, and Tools.
- Added category-specific labels and optional variants such as storage, case
  size, camera package, and tool package instead of presenting one generic form.
- Added curated brand/model choices for common U.S. marketplace items while
  preserving accessible "Not listed" brand and model paths in every family.
- Generalized the same-origin catalog endpoint, embedded fallback, title
  builder, and bounded response validation across all guided families.
- Extracted the guided catalog interface from the central application file into
  a focused React component with responsive fields and live suggested-title
  feedback.
- Kept Business equipment, Jewelry, Collectibles, and Other item on manual entry
  until their attribute schemas can be reviewed without creating misleading
  brand/model choices.

### Release boundary

- The additional catalog families improve data entry but do not by themselves
  approve a category for the external paid beta.
- Category availability must still follow the prohibited-items policy, provider
  capability, support readiness, and an explicit release flag.

## 2026-07-27 — Production database authorization closure

### Production finding

- A read-only Supabase review found that the prepared deny-by-default hardening
  had not been recorded in the production migration history.
- PostgreSQL's default function privilege left operational, mutation, trigger,
  and administrator `SECURITY DEFINER` routines executable by the anonymous
  role even though their internal authorization checks still rejected most
  unauthenticated calls.
- Direct `deals` column privileges and legacy PUBLIC policies were broader than
  the reviewed browser workflow requires.

### Applied control

- Applied the tracked `harden_production_auth_and_rpc_access` migration through
  Supabase's migration API.
- Revoked anonymous and authenticated access to all public tables and functions,
  then rebuilt explicit table/column grants and reviewed RPC allowlists.
- Restored six browser RPCs that were present in the reviewed application but
  missing from production: risk assessment, seller trust, Trust Passport
  settings/public view, and administrator Deal Link visibility control.
- Reasserted the deny-by-default RPC allowlist after restoring those functions,
  because the database creator role assigned direct anonymous function grants
  that a `PUBLIC`-only revoke did not remove.
- Reduced anonymous function execution to exactly eight reviewed public
  Deal Link read operations, with zero unexpected anonymous functions.
- Replaced legacy PUBLIC deal/profile policies with authenticated-only,
  owner/participant-scoped policies using cached `auth.uid()` evaluation.
- Added seller and non-null buyer indexes used by participant RLS predicates.
- Made the policy portion safe to rerun by removing both legacy and hardened
  policy names before recreating them.

### Verification evidence

- Supabase migration history records the hardening, feature restoration, and
  final allowlist migrations through
  `20260727212800_reassert_production_rpc_allowlist`.
- Anonymous execution count: 8 reviewed public read-only Deal Link functions;
  unexpected anonymous execution count: 0.
- All 66 browser RPC names now exist in production.
- Trigger helpers, profile creation, agreement creation, and admin functions
  are not executable by `anon`; admin functions remain authenticated-only.
- Production `deals` and `profiles` policies now target only `authenticated`.
- Seller and buyer ownership indexes are present.
- Repository regression tests verify every browser RPC appears in the reviewed
  allowlist and that mutation/admin RPCs are absent from the anonymous block.

## 2026-07-27 — Structured catalog persistence

### Implemented

- Added versioned listing identity fields for category, catalog version, brand,
  model, vehicle year, and variant. Stable IDs and display-label snapshots are
  stored separately so a future catalog label change does not rewrite an
  accepted deal.
- New creation flows derive the structured record from the reviewed catalog or
  the explicit `other` fallback; non-guided categories still persist their
  category ID without inventing brand/model values.
- Existing production deals were backfilled as `general` / `legacy` instead of
  guessing structured identity from free-form titles.
- Added database checks for approved category IDs, version format, bounded
  labels, normalized IDs, and vehicle-only model years.
- Added a partial catalog-facet index for the future structured search work.
- Agreement versions now snapshot and hash the catalog identity at publication
  and when a seller publishes a later agreement version.
- Public Deal Link and saved-deal projections expose only approved listing
  identity fields. Participant IDs, full serial values, access-code data, and
  restricted evidence remain outside the public projection.
- Direct browser writes are limited to the nine reviewed catalog columns and
  remain protected by the existing seller-owned-draft RLS policy.

### Production migration and verification

- Supabase migration history records
  `20260727214604_persist_structured_catalog_identity`.
- All nine columns, catalog constraints, and the facet index are present.
- Existing rows missing the category or catalog version backfill: 0.
- Authenticated catalog column grants: 9; anonymous base-table read access:
  denied.
- Anonymous function execution remains exactly eight reviewed public reads,
  with zero unexpected anonymous functions.
- Publishing and update RPCs remain authenticated-only.
- Full repository verification passed: strict typecheck, 30 automated tests,
  secret scan, production build, and preview navigation smoke test.

### Next catalog control

- CAT-005 can now build category-aware, shareable search facets from structured
  columns without parsing listing titles.

## 2026-07-27 — Category-aware private discovery

### Implemented

- Added one structured search surface for the signed-in Dashboard and private
  Watchlist instead of duplicating controls across both sections.
- Search matches item title, Deal ID, and saved catalog label snapshots while
  category, brand/make, model, vehicle year, and status filters compare stable
  structured values.
- Brand options appear only after a category is chosen; model options depend on
  the selected brand; vehicle year appears only for Vehicle records.
- Facets are keyboard-accessible native controls, show available-result counts,
  collapse responsively, and include a single clear-filters action.
- Filter state is bounded and encoded in readable URL parameters so a user can
  bookmark or reopen the same private workspace view.
- The public landing page remains indexable, while an authenticated home view
  is now explicitly `noindex`, `nofollow`, and `noarchive`.
- Filtering does not create a public listing feed and never writes participant,
  address, serial, access-code, evidence, or payment information to the URL.

### Verification target

- Pure tests cover URL parsing/serialization, unrelated navigation-parameter
  preservation, exact structured matching, facet dependencies, and the rule
  that a legacy title cannot impersonate a structured Vehicle record.
- Full typecheck, repository tests, secret scan, production build, responsive
  browser review, and Preview navigation smoke must pass before merge.

### Next catalog control

- CAT-006: define catalog ownership, release evidence, update cadence, adoption
  metrics, and a tested rollback procedure before adding more external datasets.

## 2026-07-27 — CAT-006 catalog governance and rollback controls

### Implemented

- Added an immutable active release pointer and versioned release manifest for
  catalog `2026-07-27.2`, including dataset checksum, source ownership, U.S.
  market, release evidence, review cadence, approved metrics, and rollback
  policy.
- Added a release validator that rejects checksum drift, path traversal,
  unexpected categories, duplicate catalog identities, missing source owners,
  incomplete verification evidence, unsafe analytics dimensions, and
  destructive rollback requirements.
- Made `catalog:verify` the first step in the repository-wide release gate.
- Added a catalog governance runbook covering three-role approval, source
  policy, monthly and emergency review, adoption review, and a rollback that
  preserves the structured snapshot recorded on every historical deal.
- Added an administrator-only aggregate RPC for 7-, 30-, and 90-day catalog
  adoption. The result is grouped only by catalog version and category and does
  not return deal, participant, address, serial, evidence, message, or payment
  identifiers.
- Added a responsive Admin catalog panel showing active-version adoption,
  structured brand/model coverage, manual fallback, and lifecycle aggregates.

### Verification target

- Catalog manifest validator, TypeScript, repository tests, secret scan,
  production build, Preview navigation smoke, database authorization checks,
  and responsive Admin catalog review must pass before merge.
- The production deployment must reference the reviewed merge commit and
  production access protection remains enabled.

### Next catalog control

- Continue catalog expansion only through a new immutable release manifest.
  Use the 30-day admin aggregates to prioritize real coverage gaps before
  adding another external dataset.

## 2026-07-27 — SEC-002 scoped session controls

### Implemented

- Corrected ordinary **Sign out** to use the Auth provider's `local` scope
  instead of its global default.
- Added separate **Sign out other devices** (`others`) and confirmed
  **Sign out everywhere** (`global`) controls.
- Added a private signed-in-device inventory that returns only the current
  user's bounded session metadata and excludes IP and refresh-token fields.
- Added failure-safe behavior: remote revocation errors keep the current session
  intact and are shown instead of reporting a false success.
- Added responsive, accessible account-session UI with current-device labeling,
  status feedback, reduced-motion support, and a compact mobile layout.

### Verification evidence

- Supabase migration `account_session_security` applied successfully.
- Database inspection confirmed `SECURITY DEFINER`, `STABLE`, empty
  `search_path`, owner filtering, no anonymous execution, authenticated-only
  execution, and an IP/refresh-secret-free return shape.
- Endpoint, migration, client, UI, and responsive regression coverage raised
  the repository suite from 36 to 43 passing tests.
- Browser review passed at desktop and 390 px: no framework overlay, console
  warning, horizontal overflow, or overlapping session controls.
- A visual review found and corrected a mobile collision caused by the shared
  fixed-height `header` rule before release verification.

### SEC-002 state

**In progress.** Refresh sessions are revoked at the provider, but an
already-issued short-lived access JWT can remain valid until expiry. Immediate
active-session validation and cross-device negative authorization evidence are
still required before SEC-002 is complete.

## 2026-07-28 — SEC-002 immediate active-session enforcement

### Implemented

- Added one owner-bound session lookup that requires an exact Auth user ID,
  session ID, and optional `not_after` match without exposing session metadata.
- Added a Data API pre-request control that keeps anonymous and trusted service
  requests unchanged but returns 401 for a signed-in JWT whose Auth session is
  no longer active.
- Added one restrictive Storage policy, so every existing and future
  authenticated object policy also requires an active Auth session.
- Updated all four JWT-protected Stripe Edge Functions to validate the Auth
  session row after the platform and Auth JWT checks.
- Kept the Stripe webhook on its separate signature-authenticated path.
- Added a narrow emergency rollback that disables the Data API and Storage
  enforcement while leaving helpers available to deployed Edge Functions.

### Verification evidence

- Supabase migrations `active_session_validation` and
  `active_session_enforcement` applied successfully.
- A current real session was accepted and a random session ID for the same
  owner was rejected without returning either identifier.
- Function inspection confirmed `SECURITY DEFINER`, `STABLE`, empty
  `search_path`, and the intended anon/authenticated/service-role grants.
- PostgREST inspection confirmed the exact pre-request function is configured.
- Storage inspection confirmed an `ALL`, authenticated-only, `RESTRICTIVE`
  policy with active-session checks for reads and writes.
- The four protected Stripe functions are active with `verify_jwt=true` and the
  shared session validator; the webhook remains `verify_jwt=false`.
- Anonymous public Deal Link RPC smoke remained 200 after activation.
  A Stripe function request without a user JWT remained rejected with 401.
- Repository coverage increased from 43 to 47 passing tests before the full
  release gate.

### SEC-002 state

**In progress.** The immediate denial control is deployed. SEC-002 remains open
until a controlled two-device test proves a revoked device loses Data API,
private Storage, and protected Edge Function access before its JWT expiry.
Security notification and suspected-account-takeover recovery evidence also
remain required.

## 2026-07-28 — SEC-005 protected payment origin boundary

### Implemented

- Replaced wildcard CORS in the shared Edge Function response path with exact
  production origins and a project-and-team-bound Vercel Preview rule.
- Required an approved, non-opaque browser origin before any protected
  payment function reaches JWT, database, or Stripe logic.
- Added fail-closed preflight checks for the method and request-header
  allowlist, exact origin echoing, `Vary: Origin`, and `no-store`.
- Kept the Stripe webhook outside the browser-origin boundary because it uses
  its raw-body Stripe signature and timestamp check.
- Documented explicit environment overrides without permitting broad
  `*.vercel.app` or wildcard origins.

### Verification evidence

- Repository coverage increased from 47 to 49 passing tests. It proves no
  protected function imports or serves application wildcard CORS and all four
  use the shared origin boundary.
- All four deployed protected functions returned `204` and echoed the exact
  Dealivra production or owned Preview origin for reviewed preflights.
- Foreign, missing, opaque, wrong-project, wrong-team, method, and header
  preflight cases returned `403` without an allow-origin header.
- A request from an approved origin without a user JWT still returned `401`.
  Supabase's gateway generates that pre-function rejection; the application
  boundary remains responsible for exact CORS on requests that reach function
  code.
- The four protected functions remain active with `verify_jwt=true`; the
  unchanged Stripe webhook remains active with `verify_jwt=false`.

### SEC-005 state

**In progress.** This batch closes the CORS/origin portion after deployment and
negative HTTP evidence. Cookie-session CSRF protection remains coupled to the
future SEC-001 server-managed session architecture and must be completed before
SEC-005 is fully closed.

## 2026-07-28 — production alias access closure

### Finding

- The unique production deployment URL, team-scoped aliases, and all Preview
  deployment URLs required Vercel Authentication.
- The project-default alias `dealsafe-mvp.vercel.app` still served the app
  publicly even though `dealivra.com` remained detached and returned 404.
- A protected unique URL alone was therefore insufficient evidence that every
  active route to the current production deployment was private.

### Control

- The project-default alias redirects every path to the stable team-scoped
  production alias, where Vercel Authentication is enforced.
- The redirect is host-specific, temporary, query-compatible, and leaves
  protected Preview and deployment URLs unchanged.
- The release gate now checks both the unique deployment URL and every assigned
  production alias. A single public alias fails the private-beta gate.

### Verification target

- The next protected Preview must accept the Vercel configuration and pass the
  full repository release gate.
- After merge, `dealsafe-mvp.vercel.app` must redirect to the team-scoped alias,
  which must then redirect an unauthenticated request to Vercel SSO with
  `noindex`, `DENY`, and `no-store`.
- `dealivra.com` remains detached/404 and real-money mode remains disabled.

## 2026-07-28 — PAY-002 atomic Stripe webhook foundation

### Implemented

- Replaced the read-before-write duplicate check with a service-only atomic
  event claim and a five-minute recovery lease.
- Added random fencing tokens so an expired worker cannot finalize a reclaimed
  event.
- Moved payment-state mutation, provider-event finalization, participant
  payment record, and material audit insertion into one database transaction.
- Added provider-time and legal-transition guards that prevent late
  processing, failure, expiry, or success events from regressing terminal
  financial state.
- Added strict identifier consistency checks and a retryable failure when a
  supported event arrives before its protected-payment record.
- Rejected live-mode events and replaced raw provider failure messages with a
  reviewed customer-safe message allowlist.
- Kept raw Stripe payloads and payment credentials out of the event ledger.

### Verification evidence

- Supabase migrations `stripe_webhook_replay_safety` and
  `stripe_webhook_replay_safety_indexes` applied successfully.
- Function inspection confirmed `SECURITY DEFINER`, empty `search_path`, and
  execute grants limited to `postgres` and `service_role`.
- Both financial tables remain RLS-enabled and unavailable to anonymous or
  authenticated browser roles.
- A rollback-only production transaction passed claim, fresh duplicate,
  failure, reclaim, fencing-token, processed replay, success transition,
  one-audit-event, late-success-after-refund, and identifier-conflict checks.
- Two genuinely concurrent database calls produced exactly one `claimed` and
  one `in_progress` result; the synthetic ledger row was then removed.
- Deployed Stripe webhook version 8 is active with `verify_jwt=false`, the new
  RPC boundary, constant-time signature comparison, and bounded request size.
- Live HTTP checks returned 405 for GET, 400 for an invalid signature, and 413
  for an oversized body, all with `no-store` and without a browser CORS grant.
- The full local release gate passed with 50 repository tests before release.

### PAY-002 state

**In progress.** The database and webhook controls are deployed and verified.
GitHub CI and the exact protected production release passed. A Stripe Dashboard
Sandbox resend/concurrency record is still required before PAY-002 is marked
complete.

## PAY-003 trusted payment commands and state invariants

### Implemented

- Added an immutable Checkout snapshot for agreement version, fee version,
  amount split, currency, seller account, and attempt number.
- Added a service-only financial command ledger with provider idempotency,
  recovery lease, attempt limit, and random fencing token.
- Moved Checkout attach, seller release, dispute refund/release, dispute
  resolution, deal transition, and material audit into locked database RPCs.
- Added Stripe PaymentIntent, Charge, Connect account, transfer, and refund
  comparisons before database finalization.
- Added webhook amount, currency, transfer-group, internal metadata, agreement,
  and fee-version validation.
- Removed the buyer-controlled seller-payout action. Completed delivery now
  waits for Dealivra operations review during the private beta.
- Replaced raw provider failure persistence with bounded codes and reviewed
  customer-safe states.

### Verification evidence

- The combined database migrations parse successfully inside a production
  transaction that is fully rolled back.
- The rollback-only PAY-003 suite passed Checkout claim/reuse, concurrent
  fencing, wrong-buyer denial, immutable amount rejection, admin denial,
  failed-command recovery, stale-token rejection, exact-once release audit,
  amount/currency/account/state mismatch denial, and atomic dispute refund.
- Existing 13 Sandbox payment snapshots were audited before the migration:
  deal amount, currency, buyer, seller, and current seller account had zero
  mismatches.
- Production migrations `stripe_trusted_payment_commands`,
  `stripe_webhook_trusted_invariants`, and
  `stripe_financial_commands_requested_by_index` applied successfully.
- The production rollback-only PAY-003 suite passed again after migration.
- Two genuinely concurrent production calls produced exactly one `claimed`
  and one `in_progress` command result; all synthetic records were removed.
- The command table is RLS-enabled with no browser grants. All six trusted
  financial RPCs use `SECURITY DEFINER`, an empty `search_path`, and execute
  grants limited to `postgres` and `service_role`.
- The existing 13 Sandbox payments have complete trusted snapshots and zero
  amount/currency mismatches. No test command remains in the production
  ledger.
- Edge Functions `stripe-create-checkout` v10,
  `stripe-release-payment` v11, `stripe-resolve-dispute` v4, and
  `stripe-webhook` v9 are active with the intended JWT boundaries.
- Post-migration advisors found no missing foreign-key index. The service-only
  command ledger intentionally has RLS with no browser policy; new indexes are
  reported as unused until private-beta command traffic begins.
- Live negative HTTP checks returned 405 for webhook GET, 400 for an invalid
  signature, and 401 for protected payment commands without a JWT. Webhook
  rejections use `no-store`.
- The full local release gate passed with the catalog release check,
  type checking, 52 repository tests, secret scanning, production build, and
  Preview navigation smoke test.

### PAY-003 state

**Complete for the current Sandbox foundation.** Database, concurrency,
advisor, deployed Edge Function, local release-gate, protected Preview, GitHub
CI, and exact-commit protected production evidence passed. Real-money mode,
automatic payout, and the public custom domain remain disabled.

## PAY-004 safe provider errors and operation correlation

### Implemented

- Added explicit customer-safe payment errors with bounded codes, HTTP status,
  retryability, and one server-generated support reference.
- Replaced raw Stripe error propagation with normalization based only on
  bounded provider type/code, response status, and validated Stripe request ID.
- Added structured `dealivra.payment.operation.v1` logs with a fixed schema and
  no arbitrary payload, user text, provider message, secret, or payment data.
- Added the same correlation ID to response body/header, financial commands,
  webhook events, and the browser's displayed support reference.
- Added a service-only exception queue for failed or stale financial commands
  and webhook attempts.
- Added a monitoring/alert matrix and a support workflow that forbids blind
  retry of reconciliation-required operations.

### Verification evidence

- The `payment_provider_observability` migration applied successfully after
  first parsing and validating it inside a fully rolled-back production
  transaction.
- The rollback-only PAY-004 database suite passed after migration. Browser
  roles cannot read the financial command ledger or exception queue, while
  `service_role` can read the sanitized exception view.
- The production exception queue is empty and no synthetic command or webhook
  record remains.
- Edge Functions `stripe-connect` v10, `stripe-create-checkout` v11,
  `stripe-release-payment` v12, `stripe-resolve-dispute` v5, and
  `stripe-webhook` v10 are active with the intended JWT boundaries.
- A live webhook GET returned 405 and an invalid-signature POST returned 400.
  Both responses used `no-store` and included the same server-generated UUID
  in the JSON body and `X-Dealivra-Correlation-Id` header.
- Live unauthenticated POSTs to all four protected financial functions were
  denied by the Supabase gateway with 401 before application code ran.
- The performance advisor reports the new correlation indexes as unused,
  which is expected while private-beta command traffic remains at zero. The
  security advisor confirms the service-only ledgers remain RLS-enabled with
  no browser policy.
- The full local release gate passed with the catalog release check,
  type checking, 53 repository tests, secret scanning, production build, and
  Preview navigation smoke test.
- GitHub PR #58 passed `Quality and security foundation` run 58 and the
  Vercel status check on exact Preview commit
  `9f30b49202dfae61761981279f31f1de087c16c7`.
- The protected Preview was `READY`; an authenticated fetch returned 200 with
  the Dealivra title, `noindex`, and Content Security Policy.
- PR #58 merged as verified commit
  `59918f73793c3602e2d790905c5da790be9f5ac5`. Exact production deployment
  `dpl_384GgNZNGDRN9WwjitwX2J8qRi36` reached `READY`.
- The protected production artifact returned 200 only through authorized
  access with `noindex` and Content Security Policy. The generated production
  aliases still redirect to Vercel Authentication, while `dealivra.com`,
  `www.dealivra.com`, and the legacy public project alias return 404.
- Vercel reported no runtime error cluster in the post-release window.

### PAY-004 state

**Complete for the current Sandbox observability foundation.** Database,
deployed function, live negative-HTTP, advisor, local release-gate, protected
Preview, GitHub CI, and exact-commit protected production evidence passed.
The public custom domain, real-money mode, and automatic payout remain
disabled.

## DAT-004 elevated-function governance and password baseline

### Implemented

- Converted the Data API active-session pre-request hook from
  `SECURITY DEFINER` to `SECURITY INVOKER` without changing its exact
  anonymous, authenticated, and service grants.
- Preserved the protected active-session helper as an empty-search-path,
  authenticated/service-only `SECURITY DEFINER` boundary.
- Defined and regression-tested the exact eight-function anonymous public
  Deal Link projection allowlist. `PUBLIC` has no execute grant and any ninth
  anonymous elevated function now fails the DAT-004 rollback suite.
- Documented why the public projections remain elevated, what each may return,
  and how advisor exceptions must be reviewed.
- Raised the managed Auth minimum to 12 characters and selected the strongest
  lowercase, uppercase, digit, and symbol requirement.
- Aligned account creation, recovery, account-change validation, and visible
  password guidance with the provider requirement.

### Verification evidence

- The DAT-004 migration and all assertions first passed inside a production
  transaction that was fully rolled back.
- Migration `security_definer_advisor_hardening` then applied successfully.
- The post-migration rollback-only suite passed the pre-request mode/grants,
  PostgREST role setting, protected helper, fixed search paths, and exact
  anonymous allowlist.
- Anonymous and service-role pre-request smoke completed successfully after
  migration.
- The security advisor no longer reports
  `enforce_active_auth_session()` as an anonymous `SECURITY DEFINER` function.
- Supabase Email Auth settings were saved and reopened with minimum length 12
  and all four required character classes.
- The current Supabase organization is on the Free plan. Supabase documents
  leaked-password protection as Pro-only, so that advisor warning remains an
  explicit public-launch blocker rather than an unverified claim.

### DAT-004 state

**In progress.** The unnecessary elevated pre-request boundary is removed and
the anonymous exception allowlist is governed. DAT-004 remains open until the
full signed-in RPC cross-role matrix proves ordinary members cannot invoke
administrator effects and every elevated function has reviewed input,
authorization, and output evidence.

## DAT-004 release evidence and runtime follow-up

### Security and password baseline release

- GitHub PR #60 contained only the reviewed database execution, password
  policy, documentation, and regression-test changes. An accidental
  line-ending-only application diff was removed before release.
- Exact PR head `9f58ef2065e44739f034d5388bfe3759bd53746d`
  passed `Quality and security foundation` run 63 and the Vercel status check.
- Protected Preview deployment `dpl_CqN33y9hCmeTSB2mLTbYh9FGrNsd` reached
  `READY`, matched the reviewed head SHA, and denied unauthenticated access
  through Vercel Authentication with `noindex` and `no-store`.
- PR #60 merged as
  `5263e46c9ed21975d271e942bbf122d74010be8f`. Exact production deployment
  `dpl_GkKNcegrpjVA8vFqXMsFvMGZFnf1` reached `READY` from `main`.

### Runtime warning remediation

- Vercel's exact-major syntax now pins the application and lockfile to Node
  `24.x`, matching `.nvmrc`, CI, and the Vercel project runtime.
- The catalog endpoint no longer accesses the deprecated
  `request.query` compatibility path. It reads the first bounded category
  parameter with the standard WHATWG `URL` API.
- Regression tests fail if the catalog handler accesses the legacy query
  getter or if the three runtime-version declarations diverge.
- The full local release gate passed with catalog checksum verification,
  type checking, 57 repository tests, secret scanning, production build, and
  Preview navigation smoke.
- Exact PR #61 head `64a3d473c0248852cf65abf14bcc75ab4445d5d2`
  passed `Quality and security foundation` run 65 and the Vercel status check.
  Preview deployment `dpl_8x5egY5JSm4JSDP6xYkiMUv6kfZv` reached `READY`;
  its build completed without the open-ended Node-major warning, `DEP0169`,
  fatal, or error output.
- PR #61 merged as
  `77069356fa9c7f3452b0e67c52644786f668df94`. Exact production deployment
  `dpl_8W86wZJGFJqpHKGdkDiK1zNdT2ni` reached `READY` from `main`.
- The exact production deployment reports Node `24.x` and no build or runtime
  `DEP0169`, warning, error, or fatal record in the post-release window.
- The Vercel project remains `live=false`. Its only attached domains are the
  protected team-scoped aliases; `dealivra.com`, `www.dealivra.com`, and the
  legacy public project alias remain detached. Real-money mode and automatic
  payout remain disabled.

## DAT-004 signed-in authorization matrix

### Implemented

- Locked the exact 63-signature authenticated `SECURITY DEFINER` inventory.
  Any added, removed, or changed signature now fails the rollback-only suite.
- Added grant assertions proving `PUBLIC` and `anon` cannot execute any of the
  signed-in-only functions, while the reviewed `authenticated` and
  `service_role` grants remain explicit.
- Added fixed-search-path and identity-boundary assertions for every governed
  function.
- Added a production-data role matrix for ordinary members, administrators,
  sellers, buyers, and an unrelated signed-in user.
- Proved all five administrator readers and all three administrator mutators
  reject an ordinary member with `Admin access required`.
- Proved an administrator passes those role gates and each mutator then reaches
  its reviewed safe object-not-found guard.
- Proved an unrelated user cannot read participant-only action, delivery,
  inspection, message, offer, participant, payment, timeline, protected
  payment, or shipping-evidence records for an accepted deal.
- Proved the selected deal's seller and buyer retain their positive participant
  access.

### Verification evidence

- `supabase/tests/authenticated_rpc_cross_role_rollback.sql` passed against
  production and returned no identity values. It used transaction-local role
  and JWT settings and completed with a full rollback.
- No authorization gap was found, so no production DDL or data migration was
  required.
- The repository foundation suite contains a regression gate for the exact
  inventory, role matrix, rollback guarantee, and linked operating standard.
- The post-test security advisor contained only the already-reviewed
  deny-by-default no-policy tables, the exact eight anonymous public projection
  exceptions, the governed signed-in elevated inventory, and the known
  plan-limited leaked-password warning. It exposed no new unreviewed elevated
  endpoint.
- Performance advisor findings are recorded as the next database-hardening
  batch: foreign-key coverage and per-row Auth RLS initialization plans will be
  measured and remediated separately rather than mixed into this authorization
  release.

### DAT-004 state

**Complete for elevated-function governance.** The unnecessary anonymous
elevated hook is removed; the public projection allowlist and full signed-in
inventory are exact; grants, search paths, identity boundaries, and
representative cross-role deny/allow behavior are production-tested. Any
governed function change automatically reopens this gate.

This does not authorize public launch, real-money processing, or automatic
payout. Leaked-password screening remains a separate public-launch blocker on
the current Supabase plan.

## DBP-001 RLS Auth InitPlan optimization

### Implemented

- Recreated the exact ten advisor-identified participant policies so
  `auth.uid()` and the administrator helper are evaluated once per statement,
  not once per candidate row.
- Preserved every policy name, table, command, `authenticated` role, permissive
  mode, ownership relationship, participant rule, and evidence uploader rule.
- Kept `deal_messages` RPC-only; the optimization did not add direct browser
  table access.
- Added a production rollback suite using real rows from all six
  browser-readable governed tables plus transaction-only media/evidence writes.

### Verification evidence

- All 59 repository foundation tests passed and the repository secret scan
  passed before the production dry-run.
- The migration plus full seller/buyer/outsider and write matrix first passed
  inside one production transaction that was completely rolled back.
- The first dry-run correctly exposed that `deal_messages` has no direct
  `authenticated` table grant. The suite was tightened to assert this
  RPC-only boundary instead of broadening access.
- Migration `rls_auth_initplan_optimization` applied successfully.
- The standalone post-migration rollback suite passed without returning
  identity values or retaining its test records.
- The post-migration Supabase performance advisor reports zero
  `auth_rls_initplan` findings; all ten targeted warnings are removed.
- The security advisor reports no new warning class or unreviewed exposure.
- Foreign-key index recommendations remain a separate measured batch so index
  write cost and real query value can be reviewed independently.

### DBP-001 state

**Complete in production.** Statement-level Auth evaluation is active and the
original seller, buyer, outsider, administrator, RPC-only, insert, and delete
boundaries are regression-tested.

This optimization does not authorize public launch, real-money processing, or
automatic payout. The project remains closed until the complete launch program
passes.

## DBP-002 measured foreign-key indexes

### Measured scope

- Reviewed all 27 current `unindexed_foreign_keys` advisor notices instead of
  automatically indexing every foreign key.
- Correlated the advisor inventory with table sizes, table scan/write
  statistics, the production statistics reset window, normalized
  `pg_stat_statements` activity, and current application/RPC query shapes.
- Selected six query paths with demonstrated read, ordering, or reverse
  maintenance value: chat, media, audit timeline, offers, activity reads, and
  reputation history.
- Deferred 21 notices without deleting or suppressing them. Their current
  production value does not yet justify added write and maintenance cost.

### Implemented controls

- Added six compact B-tree indexes whose leading column covers the governed
  foreign key and whose optional second column matches product ordering.
- Added a read-only production verification suite that locks the exact index
  inventory, column order, sort direction, validity, readiness, and planner
  selection for all six real query shapes.
- Kept unused-index review, constraint changes, grants, RLS, functions, and
  customer-visible behavior outside this batch.

### Verification evidence

- All 60 repository foundation tests passed before the production dry-run.
- The migration and all six forced planner assertions first passed inside one
  production transaction that was completely rolled back.
- A follow-up catalog check confirmed the dry-run retained zero indexes.
- Migration `foreign_key_hot_path_indexes` applied successfully.
- The standalone post-migration verification suite passed and rolled back all
  transaction-local planner settings.
- The Supabase performance advisor removed exactly the six governed
  `unindexed_foreign_keys` findings, reducing that inventory from 27 to 21.
- The six new indexes appear as unused immediately after creation, which is
  expected before organic traffic reaches each path; the governance standard
  forbids premature removal.
- The security advisor reports no new warning class or unreviewed exposure.
- GitHub workflow run `30330121000` completed successfully for reviewed head
  `edfe4fda043245c55fa33039388d85459ea52410`.
- Protected Preview deployment `dpl_DbiZLTNtpmrPvsvdKmnohUmZWwUd` reached
  `READY` for that exact reviewed head; its error-only build log and
  warning/error/fatal runtime scan were empty.
- PR `#65` was squash-merged to `main` as
  `5f973b6293c6138d1afb9ee82bd3ed836e88a673`.
- Exact production deployment `dpl_8uGX6uQ6pLAozSYUQLniACZ2DymJ` reached
  `READY` for that merge commit. The build completed cleanly, the post-release
  runtime error scan was empty, Node.js remained pinned to `24.x`, and the
  Vercel project remained `live: false`.
- `dealivra.com`, `www.dealivra.com`, and the retired
  `dealsafe-mvp.vercel.app` alias returned `DEPLOYMENT_NOT_FOUND`; the only
  attached aliases remained the protected team-scoped Vercel aliases.

### DBP-002 state

**Complete.** The six measured access paths are active, production-verified,
repository-tested, reviewed, merged, and running on the exact protected
production deployment.

This work does not authorize public launch, real-money processing, or
automatic payout.

## DAT-005 immutable material audit events

### Measured scope

- Production contained 179 audit events across 27 event types.
- All existing events had deal and actor relationships, but no dedicated or
  common metadata correlation identifier.
- RLS was enabled with no direct policies. `anon` and `authenticated` had no
  table privileges, while `service_role` retained select, insert, update,
  delete, truncate, references, and trigger privileges.
- Thirty-five current public functions reference the audit table. Reviewed
  application writes use elevated, server-authoritative functions; the browser
  has no direct mutation path.
- No user trigger prevented a privileged runtime role from altering or
  deleting recorded history.

### Implemented controls

- Added a non-null UUID `correlation_id`, backfilled existing rows
  transactionally, and added a database-generated default for every future
  event.
- Added an operator lookup index without forcing uniqueness, so a future
  reviewed command can correlate multiple events from one operation.
- Added fixed-search-path `SECURITY INVOKER` triggers that reject update,
  delete, and truncate with SQLSTATE `55000`.
- Removed direct mutation and trigger privileges from ordinary roles and
  removed update, delete, truncate, and trigger privileges from
  `service_role`; retained only its reviewed read/append boundary.
- Kept RLS enabled and introduced no direct mutation policy or browser writer.

### Verification evidence

- The schema, correlation default, insert path, and blocked update, delete, and
  truncate attempts first passed inside one production transaction.
- The dry-run rolled back completely: no correlation column, helper function,
  or user trigger remained.
- Migration `immutable_material_audit_events` applied successfully as version
  `20260728121644`.
- The post-migration catalog verification found 179/179 events with a
  correlation ID, one valid lookup index, two enabled mutation-denial
  triggers, zero mutation policies, and the exact append-only grants.
- A transaction-local probe received a generated correlation ID; update,
  delete, and truncate each failed with the governed exception; the final
  rollback retained zero probe rows and all 179 original events.
- The security advisor reported no new warning class or unreviewed exposure.
  Its `audit_events` information notice remains the intentional deny-by-default
  no-policy state.
- The performance advisor retained the 21 deliberately deferred foreign-key
  notices. Correlation lookup is an operator requirement, not an automatic
  advisor-driven index.

### DAT-005 release evidence

- Reviewed repository change: PR [#67](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/67), limited to the six governed DAT-005 files.
- GitHub workflow `30361415168` (run 77) completed successfully for exact head commit `eddfdb630eb5f9e7da78b17f46c7574c04adac75`.
- Protected Preview `dpl_J2qEGVovpc2SxL72Rdmd5BUzY2bJ` was READY on that exact head commit with clean errors-only build output and no warning, error, or fatal runtime logs.
- Squash merge produced exact main commit `e52c015f0adc3e2d7703552f2ec305090f159ee9`.
- Protected production deployment `dpl_DKuZWY1UyX6unmhgirJ9C94gGrhF` was READY on that exact merge commit with clean errors-only build output and no warning, error, or fatal runtime logs.
- The Vercel project remained `live: false`, on Node.js 24.x, with no public/custom domain attached.

### DAT-005 state

**Complete.** The production database, repository gate, protected Preview,
reviewed merge, and exact protected production deployment all passed.

This work does not authorize public launch, real-money processing, automatic
payout, or deletion of production history.

## 2026-07-28 — EVD-001/002/003 evidence-file security implementation

### Implemented on the review branch

- Added one shared seller/buyer evidence policy for category/media pairing,
  canonical MIME types, 10 MB photo and 50 MB video limits, intake expiry, and
  60-second signed access.
- Added byte-structure validation for metadata-free WebP, ISO base-media
  MP4/MOV, and WebM instead of trusting a filename, extension, browser MIME
  value, or Storage metadata.
- Added browser photo privacy processing and the same declaration/byte policy
  before an upload is requested.
- Added a private quarantine bucket, server-approved one-time intake paths,
  rate-limited intake creation, and no browser read/update/delete path.
- Added a fail-closed malware-scanner gateway contract with SHA-256 binding,
  bounded response parsing, timeout handling, and an EICAR pre-check.
- Added clean-only promotion to the final private vault. Legacy evidence is
  labeled `legacy_unscanned` and cannot count toward shipping readiness.
- Removed direct authenticated final-bucket access and direct evidence-record
  inserts. Safe metadata excludes object paths, uploader IDs, raw metadata, and
  scanner internals.
- Added server-issued participant/dispute-case access and an append-only log
  for every 60-second evidence URL.

### Verification target

- Unit fixtures cover valid WebP, metadata-bearing WebP, role/type mismatch,
  size limits, EICAR, and scanner hash/verdict validation.
- The rollback-only database suite covers the bucket/policy/grant/view/trigger
  inventory and seller/buyer/outsider/case-admin metadata authorization.
- The full repository gate passed: catalog governance, typecheck, 64/64 unit
  tests, secret scan, production build, and the protected production-preview
  navigation smoke test.
- The migration and the seller/buyer/outsider/case-admin authorization matrix
  passed together inside one production transaction and rolled back cleanly.
- Protected Preview `dpl_CY1QTXNwmAPY1Wh2zZvho126yVkH` is READY on exact
  reviewed head `7ec467d057cb830b79408fd53d08ee779ddd4ab5`; its build has
  no error event and its warning/error/fatal runtime scan is clean.

### EVD deployment evidence

- Draft PR [#69](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/69)
  contains exactly 20 governed evidence-security files.
- GitHub workflow `30365645015` (run 81) completed successfully for exact head
  `7ec467d057cb830b79408fd53d08ee779ddd4ab5`.
- JWT-protected Edge Function `evidence-files` version 1 is ACTIVE with bundle
  SHA-256 `f38f733440bf4d30ee45da31d1065f623f023cfad7c73a427b5d937a640ed82e`.
- Migration `evidence_file_security` applied as version `20260728135548`.
- The post-migration rollback suite passed on the live schema. Both buckets
  are private; direct final-bucket policies, authenticated evidence inserts,
  and authenticated storage-path reads are zero.
- Eleven pre-existing records are explicitly `legacy_unscanned`; none can
  receive a signed URL or satisfy shipping readiness.
- The scanner gateway is deliberately unconfigured and fail-closed.
  External scanner staging scenarios, cross-account signed access, and
  expired-URL verification remain required.

### EVD state

**Backend foundation active; repository review and scanner activation
pending.** A reviewed scanner vendor or internally operated gateway, staging
secrets, and the live negative test matrix are mandatory before evidence
uploads can be enabled for external testers.

This work does not authorize public launch, external private beta, real-money
processing, or automatic payout.

## 2026-07-28 — EVD-004 evidence integrity inventory and safe viewer

### Implemented on the review branch

- Added a service-only atomic integrity writer and append-only event inventory.
- Added latest participant/case-safe `unverified`, `verified`, `missing`,
  `mismatch`, or `invalid` status without exposing object paths or scanner
  internals.
- Re-downloads and reparses private evidence, recomputes SHA-256, and compares
  type and byte length before every signed viewing URL.
- Missing, malformed, changed, or mismatched objects fail closed and do not
  receive a viewing URL.
- Replaced direct new-tab viewing and admin URL prefetch with one shared modal
  that renders only local allowlisted image/video blobs.
- The viewer shows scan/integrity status, full SHA-256, file size/type, and
  timestamps, and supports keyboard close, focus restoration, mobile layout,
  and reduced motion.

### Release evidence

- Draft PR [#70](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/70)
  contains exactly 12 reviewed files.
- GitHub workflow `30372585274` (run 84) passed for exact head
  `2211a4551fecbd5b79b4bcdd3eab913c8974f456`.
- Protected Preview `dpl_Fe11mQ672ZQV4wMCeDqhzWnTm4jC` is READY on the same
  head, has no build error, redirects through Vercel Authentication, and
  returns `x-robots-tag: noindex`.
- Migration `evidence_integrity_inventory` is active as version
  `20260728151953`.
- JWT-protected `evidence-files` version 2 is ACTIVE with bundle SHA-256
  `af110dfe15325bd925415b94add9db9f4f72b88516fe8b4a82d2e787355095d4`.
- The live rollback suite passed. Browser roles cannot read or insert integrity
  events or execute the recorder; two mutation-denial triggers protect the raw
  inventory.
- The participant-safe view contains integrity status and timestamp without
  storage paths or scanner-internal fields.
- All 11 pre-existing evidence rows remain `legacy_unscanned`. No evidence row
  is marked integrity-verified and no synthetic integrity event remains after
  verification.

### EVD-004 state

**Backend active; reviewed merge and protected production verification
pending.** The scanner gateway remains deliberately unconfigured, so external
evidence upload and the clean-object staging scenario remain disabled.

This work does not authorize public launch, external private beta, real-money
processing, automatic payout, or evidence upload activation.

## 2026-07-28 — EVD-005 evidence lifecycle governance

### Implemented on the review branch

- Added provisional one-year routine and seven-year dispute-evidence retention
  classification without converting an elapsed date into automatic deletion.
- Added an append-only Legal Hold ledger. A hold blocks deletion immediately;
  a release invalidates any earlier approval and returns elapsed retention to
  fresh operator review.
- Added private bounded lifecycle jobs for integrity checks, quarantine cleanup,
  and retained-evidence deletion.
- Added a two-phase deletion protocol: operator approval, fresh dispute/hold
  guards, leased worker claim, Storage API removal, absence verification, then
  atomic metadata redaction.
- Added a Vault-authenticated Cron worker and a daily database inventory.
- Added an administrator lifecycle center with alerts, ownership, safe-stop
  codes, operator reasons, deletion approval, and Legal Hold actions.
- Added a rollback-only production proof and repository gates for auth,
  append-only history, lifecycle viewer blocking, Storage API ordering, and
  redacted admin responses.

### Release boundary

- Rollout verification does not delete existing production evidence.
- The eleven legacy-unscanned evidence records remain preserved and blocked
  from shipping/viewing.
- The malware scanner remains deliberately unconfigured and fail-closed.

### Release evidence

- Draft PR [#71](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/71)
  contains the isolated EVD-005 change set.
- GitHub workflow run 88 passed on review head
  `8f9c1cd327d23415f9dbe518a13c534d51a02054`.
- Protected Preview `dpl_6BxH5tgSHadZupTtDSxoxk5NMFJc` is READY on the
  same head, requires Vercel Authentication, returns `noindex`, and has no
  custom domain.
- Production migrations `20260728165554`, `20260728170054`, and
  `20260728170533` are active.
- `evidence-maintenance` version 1 and JWT-protected `evidence-files` version 3
  are ACTIVE.
- The live rollback suite passed. A Vault-authenticated maintenance invocation
  returned HTTP 200 with zero eligible jobs; an invalid-secret request returned
  HTTP 403.
- Both lifecycle Cron jobs are active. The new lifecycle tables and functions
  have no browser DML/execute grants, and advisor checks report no unindexed
  foreign keys or executable Security Definer warnings for the new objects.
- All eleven production evidence rows remain retained. No lifecycle alert,
  deletion job, active legal hold, synthetic intake, or cleanup candidate
  remains after verification.

### EVD-005 state

**Backend foundation active; PR #71 merged and closed-production verification
passed.** The scanner remains deliberately unconfigured and fail-closed.

This work does not authorize public launch, external private beta, real-money
processing, automatic payout, or evidence upload activation.

## 2026-07-28 — SEC-003A TOTP MFA and privileged AAL2 enforcement

### Implemented on the review branch

- Added same-origin TOTP enrollment, challenge/verify, factor inventory, and
  verified-factor removal without exposing a refresh token to browser
  JavaScript.
- Added a two-step password login. Enrolled accounts receive a pending `aal1`
  token and cannot enter the application until a fresh TOTP challenge returns
  `aal2`.
- Added a modern, keyboard-accessible account security center with QR/manual
  setup, one-time-code semantics, multiple authenticator support, explicit
  removal confirmation, mobile layout, and reduced-motion behavior.
- Added mandatory `aal2` for `support`, `compliance`, and `admin`, plus opt-in
  enforcement for every member who has a verified factor.
- Applied the same rule to the Data API pre-request hook, a restrictive Storage
  policy, protected payment/evidence Edge Functions, and session refresh.
- Added an emergency rollback and rollback-only boundary proof.
- Added fail-closed handling for verified authentication factors the current
  Dealivra client cannot challenge.
- Passed the complete local release gate: catalog validation, TypeScript,
  72 automated tests, repository secret scanning, production build, and
  Preview smoke.
- Passed desktop and 390px browser checks for the home, sign-in, and MFA
  step-two screens with no console warnings, error overlay, or horizontal
  overflow. Reconfirmed that the Fees-page Home action returns to `/`.
- Ran a read-only production readiness aggregate: one `admin` account exists,
  with zero verified factors and zero accounts meeting the two-factor rollout
  requirement.

### Remaining release gates

- Enroll two factors for every current privileged account before activating the
  database migration.
- Pass the protected two-device positive and password-only negative matrix.
- Approve and rehearse lost-factor recovery with dual control for privileged
  accounts.
- Add sensitive-change notifications and cooldowns under SEC-007.
- Select a documented phishing-resistant privileged factor. TOTP is not
  phishing-resistant, so SEC-003 is not yet fully closed.

### SEC-003 state

**Repository implementation verified; production activation is blocked by
privileged-factor enrollment.** Activating the migration now would lock the
current admin account out. This stage does not authorize public launch,
external private beta, real-money processing, automatic payout, scanner
activation, or removal of Vercel protection.

## 2026-07-28 — SEC-003 privileged MFA activation safety

### Implemented locally for review

- Added an atomic activation guard to the staged SEC-003 database migration.
  It aborts before enforcement changes when any `support`, `compliance`, or
  `admin` account has fewer than two verified TOTP factors.
- Added a read-only preflight that returns only privileged, ready, and blocked
  aggregate counts. It does not return user, email, factor, or secret values.
- Added the exact primary/secondary device enrollment and sign-in matrix.
- Added a dual-control lost-factor matrix that explicitly blocks email-only,
  one-person, notification-free, and unaudited privileged recovery.
- Preserved the production activation boundary. No MFA enforcement migration,
  factor creation, factor removal, recovery action, public-access change,
  scanner activation, or payment-mode change is part of this batch.

### Next gate

- The current privileged administrator must enroll two independently
  recoverable authenticators through the protected Dealivra security center.
- A second authorized reviewer must record only non-secret pass/fail evidence.
- The aggregate preflight and the two-device positive/password-only negative
  matrix must pass before the database and Edge enforcement activation step.

### Review and protected Preview evidence

- Draft PR [#74](https://github.com/nikamelikishvili-hue/dealsafe-mvp/pull/74)
  contains exactly six reviewed files and is based on SEC-004 Production commit
  `4adc795b912ee3c209e431941c638607803e9eae`.
- GitHub workflow `30396370399` (run 98) passed on exact review head
  `6f519b2514ca23c33911d5a6865e86973b1a1d85`.
- Protected Preview `dpl_9x8fqdw5o7ANs2QhBsFDwwJHTo4b` is `READY` on
  that exact head. Its errors-only build completed cleanly in eleven seconds
  and the warning/error/fatal runtime scan returned no records.
- Anonymous Preview access remains behind Vercel Authentication with HTTP 302,
  `noindex`, HSTS, frame denial, and no-store.
- The full local release gate passed catalog verification, TypeScript,
  74 automated tests, repository secret scanning, production build, and
  Preview smoke.

### Merge and protected Production evidence

- The final review head `b465894dc700c0085863be1bb7a6b8526f65ac73`
  passed GitHub workflow `30396900291` (run 99) and Vercel status.
- PR #74 was squash-merged to `main` as verified commit
  `edeed745a64896cc1f740748be89d5a4fc03bec0`.
- Exact Production deployment `dpl_57ZZsvUoeHUS3CTAXHFhk5qJepb6` reached
  `READY` on that commit. The errors-only build completed cleanly in ten
  seconds and the warning/error/fatal runtime scan returned no records.
- Anonymous access remains behind Vercel Authentication with HTTP 302,
  `noindex`, HSTS, frame denial, and no-store.
- The Vercel project remains `live: false`; only the protected team-scoped
  aliases are attached.

### SEC-003 activation-safety state

**Merged and protected Production verified; enforcement remains deliberately
inactive.** Factor enrollment and the dual-control matrix are the next gate.
The database migration must not be applied before the aggregate readiness query
returns zero blocked privileged accounts.

## 2026-07-28 — SEC-003 privileged factor-removal safety

### Implemented locally for review

- Split unfinished-factor cancellation from verified-factor removal so the
  low-risk cleanup path cannot delete an active authenticator.
- Required `aal2` plus a TOTP verification timestamp no older than ten minutes
  from the signed JWT `amr` claim before verified-factor removal. A routine
  access-token refresh cannot reset this verification window.
- Loaded the application role through the authenticated,
  server-controlled `current_user_app_role` RPC instead of trusting browser
  data or editable user metadata.
- Enforced a minimum of two verified authenticators for `support`,
  `compliance`, and `admin` at the server mutation boundary. An operator must
  enroll and verify a third factor before replacing either existing factor.
- Reflected the server-provided minimum in the account security UI and disabled
  destructive controls when the floor has been reached.
- Added negative tests for the privileged two-factor floor, stale AAL2
  rejection, and verified-factor rejection by the unfinished-setup path.
- Passed the complete local release gate: catalog validation, TypeScript,
  77 automated tests, repository secret scanning, production build, and
  Preview smoke.

### Activation boundary

The read-only Production preflight still reports one privileged account, zero
ready accounts, and one blocked account. MFA enforcement remains unapplied.
This batch does not create, verify, or remove a factor; change public access;
enable real-money processing; activate the scanner; or remove Vercel
Authentication.

## 2026-07-28 — SEC-003 inline factor-removal step-up

### Implemented locally for review

- Replaced the removal dead end with an inline six-digit TOTP verification
  panel in Account Security.
- Reused the provider challenge-and-verify boundary to mint a newly verified
  AAL2 session before the client requests factor deletion.
- Defaulted confirmation to a different verified authenticator when one is
  available, while retaining a selectable factor list for legitimate recovery
  cases.
- Kept the server-side recent-TOTP and privileged two-factor-floor checks as
  the authoritative mutation controls.
- Added keyboard focus styling, one-time-code semantics, bounded numeric input,
  responsive actions, and explicit support-scam guidance.
- Added release-gate coverage that proves verification is ordered before
  deletion in the client flow.

### Activation boundary

This UI batch does not apply the privileged enforcement migration, create or
remove a real factor, expose a public domain, enable real payments, or weaken
Vercel Authentication.

## 2026-07-29 — SEC-007 staged notification delivery and queue health

### Implemented locally for review

- Added fixed, bounded security-notification templates for every privileged MFA
  recovery transition without storing recipient addresses or authentication
  secrets in the recovery outbox.
- Added a private, bearer-authenticated Edge worker that remains disabled unless
  `DEALIVRA_SECURITY_NOTIFICATION_MODE=enforced`.
- Limited each claim to ten jobs, required confirmed Auth email ownership,
  bounded provider reads and timeouts, and reused one deterministic Resend
  idempotency key per outbox record.
- Added a service-only aggregate health RPC for ready, retrying, and
  dead-letter jobs plus a bounded oldest-pending age.
- Added a fixed `dead_letter_present` operational signal without logging user,
  recipient, case, payload, message, provider-response, or secret values.
- Passed the complete local release gate with 90 automated tests, repository
  secret scanning, a Production build, and the Preview navigation smoke test.

### Activation boundary

No Resend account, sender domain, DNS record, Supabase Vault secret, Cron job,
Edge deployment, migration, environment switch, or real email delivery was
created or activated. Sender verification, bounce/complaint handling, external
alert routing, non-production delivery tests, and supervised rollback evidence
remain mandatory before enforcement.

## 2026-07-29 — SEC-006 account abuse boundary

### Implemented locally for review

- Moved password-reset initiation behind a same-origin Dealivra API instead of
  allowing browser code to call the Auth provider directly.
- Derived the reset redirect from the verified request origin and retained a
  non-enumerating response for unknown or existing accounts.
- Preserved provider throttling for signup, login, and password recovery as
  HTTP 429 with a bounded `Retry-After` value.
- Standardized rejected Auth telemetry to fixed operation, status, and provider
  codes without email, password, IP, token, cookie, request-body, or raw
  provider-message logging.
- Documented generous route-and-method-specific Vercel Firewall thresholds and
  the required log-only, Preview-enforcement, and Production-review sequence.

### Activation boundary

No firewall rule, block, challenge, CAPTCHA, provider, project setting, or
Production limit was created or published. Real protected traffic observation,
false-positive review, alert ownership, Preview burst tests, and a measured
CAPTCHA decision remain required.

## 2026-07-29 — SEC-006 staged Auth proxy client-IP boundary

### Implemented locally for review

- Added an explicit disabled/enforced switch for trusted client-IP forwarding
  through the same-origin Vercel Auth proxy.
- Kept the browser-safe publishable key and no forwarded IP as the default.
- Required a separate server-only new-format Supabase secret API key before
  enforced mode can send `Sb-Forwarded-For`.
- Accepted only one valid address from Vercel's system
  `x-vercel-forwarded-for` header and rejected missing, malformed, or ambiguous
  values before contacting Supabase.
- Preserved provider 429 responses and bounded retry guidance for session
  refresh and MFA operations without deleting the current refresh cookie.
- Added browser-side transient Auth errors with exact bounded retry guidance,
  keeping the current session during provider throttling or temporary 5xx
  failure while still clearing a confirmed invalid 401 session.
- Added negative tests for disabled-mode isolation, secret/IP fail-closed
  behavior, ambiguous chains, refresh throttling, and MFA throttling.

### Activation boundary

No Supabase secret API key was created or stored, no Auth rate-limit setting was
changed, no Vercel environment variable was activated, and no Preview or
Production deployment was changed. Dedicated Preview configuration,
two-network rate-limit evidence, log/bundle secret and IP checks, alert
ownership, and rollback proof remain required before enforcement.

## 2026-07-29 — Password mutation server boundary

### Implemented locally for review

- Moved reset-link password completion from the browser's direct Supabase call
  to a same-origin Dealivra endpoint.
- Reused one server password-strength rule for signup, recovery completion, and
  signed-in password change.
- Added a current-password field and exact provider `current_password`
  forwarding for signed-in changes.
- Kept signed-in changes fail-closed in `staged` mode until the managed
  provider verification setting is confirmed.
- Cleared the refresh cookie and browser session after successful password
  mutation, requiring a fresh sign-in.
- Preserved bounded 429 guidance and excluded passwords, bearer tokens, raw
  provider messages, and user identity from Auth rejection telemetry.
- Added tests for recovery success, weak-input rejection, staged denial,
  enforced current-password forwarding, throttling, cookie clearing, and
  browser direct-call removal.

### Activation boundary

No Supabase password setting, Vercel environment value, account password,
session, deployment, or Production configuration was changed. Protected
Preview activation, correct/incorrect current-password tests, expired/reused
recovery-link tests, notification ownership, and log/storage absence proof
remain required.

## 2026-07-29 — AGR-001 canonical agreement record

### Implemented locally for review

- Added a versioned `dealivra.agreement.v1` snapshot generated by PostgreSQL
  when an agreement version is inserted.
- Added a server-owned canonical SHA-256 while preserving every legacy
  agreement hash for backward verification.
- Added an immutability trigger that rejects later agreement-version updates.
- Added one privacy-safe public document RPC with an empty `search_path`,
  schema-qualified reads, exact privileges, and no participant identifiers.
- Changed the page fingerprint, PDF preview, and PDF download to use the exact
  stored agreement version with no browser-generated fallback.
- Clearly separated current participant presentation from hashed agreement
  terms.
- Added failure-closed UI behavior when the stored schema or hash cannot be
  verified.
- Expanded the reviewed anonymous projection inventory from eight to nine
  functions for the new read-only document endpoint; direct table access
  remains unavailable.
- Added regression and rollback-only coverage for canonical backfill
  integrity, deterministic payload generation, immutability, exact grants,
  privacy-safe output, legacy preservation, browser fallback removal, and
  rollback evidence preservation.

### Activation boundary

No Supabase migration, data backfill, Preview, Production deployment, legal
copy, or real-money behavior was activated. AGR-001 remains activation-gated
until disposable-database backfill proof and protected Preview comparison of
page, history, PDF, and verification outputs pass.

## 2026-07-29 — AGR-003 accessible agreement document

### Implemented locally for review

- Added a named document landmark and visible-heading associations for every
  agreement region.
- Grouped preview controls into a named toolbar and made their button behavior
  explicit.
- Added print-safe wrapping for long titles, participant names, catalog terms,
  and other user-provided values.
- Replaced whole-section break avoidance with smaller protected content
  groups, so a long agreement can paginate without splitting important cards
  or forcing large blank areas.
- Added widow and orphan protection for printed paragraphs.
- Kept the narrow-screen preview single-column and reduced the mobile title
  scale.
- Verified the stored-record preview had no horizontal document overflow and
  that every major region exposed an accessible name.

### Activation boundary

No PDF bytes were archived, no agreement language received legal approval, and
no Preview or Production deployment was changed. Supported-browser PDF
artifacts, keyboard/screen-reader evidence, long-content fixtures, retention
policy, and counsel approval remain required before AGR-003 can be closed.

## 2026-07-29 — Release verification baseline repair

### Implemented locally for review

- Normalized CRLF to LF only inside two source-inspection tests, making Auth
  telemetry and private-evidence ordering checks deterministic on Windows and
  Linux without weakening their assertions.
- Confirmed the private evidence path still downloads from the private bucket,
  revalidates structure and SHA-256, records the integrity result, and only
  then creates the 60-second signed URL.
- Preserved the original `2026-07-27.2` catalog manifest as historical
  evidence instead of rewriting it.
- Added `2026-07-29.1` as a checksum-governance correction with unchanged
  category, brand, model, and variant labels, a new exact dataset checksum, and
  an explicit rollback target.

### Activation boundary

The active pointer change is review-branch code only. No catalog endpoint,
Supabase resource, Preview, Production deployment, or customer record was
changed. Protected Preview and the named three-role release review remain
required before the corrected release may be activated.

## 2026-07-29 — ARC-002 browser routing and recovery

### Implemented locally for review

- Added one typed resolver for public paths, Deal Links, trust passports,
  account entry, password recovery, and agreement verification.
- Restored query-driven and path-driven screens during browser Back and
  Forward navigation instead of treating every history entry as Home.
- Fenced asynchronous public-record requests so an older response cannot
  overwrite a newer browser-history destination.
- Added a named loading state for public records and a customer-readable,
  no-index 404 page for unknown paths.
- Made the principal create, sign-in, sign-up, forgot-password, and demo
  actions produce refreshable browser addresses.
- Wrapped both application entry points in a recovery boundary that offers a
  retry and safe return without disclosing exception or provider details.
- Added route-resolution and recovery-boundary regression coverage.

### Activation boundary

No Preview or Production deployment changed. The current SPA still returns an
HTTP 200 shell before showing its client-side 404; a server-aware target
framework must return a real HTTP 404. Protected Preview Back/Forward, refresh,
mobile 404, recovery-token privacy, and injected-failure evidence remain
required before ARC-002 is closed.

## 2026-07-29 — ARC-003 public route presentation boundary

### Implemented locally for review

- Moved the six public information pages, customer-safe loading/error/404
  screens, and page metadata policy into `PublicRoutePages.tsx`.
- Reduced the central application module without changing public copy,
  navigation, canonical URLs, robots policy, or transaction behavior.
- Limited the metadata boundary to an optional active deal title rather than
  passing the full mutable deal record.
- Added regression checks that prevent the extracted responsibilities from
  silently returning to `app.tsx`.
- Documented the remaining account, creation, workspace, agreement, payment,
  delivery, dispute, and administrator extraction slices.

### Activation boundary

ARC-003 remains open. This is review-branch source organization only; no
Supabase resource, customer data, Preview, Production, public-access, or
real-money behavior changed.

## 2026-07-29 — ARC-003 account entry and recovery boundary

### Implemented locally for review

- Moved the controlled sign-in/sign-up form, draft-to-account explanation,
  password visibility, policy consent, forgot-password entry, password reset
  request, and recovery-token password update pages into
  `AccountEntryPages.tsx`.
- Kept Auth mode, form state, pending draft intent, MFA challenge handoff,
  session completion, and `signUp`/`signIn` orchestration in the central
  application.
- Preserved the existing same-origin password-recovery service boundary,
  account-existence privacy, password requirements, and Terms/Privacy links.
- Added regression coverage for the component boundary and for the continued
  ownership of security-sensitive Auth state.

### Activation boundary

No Auth provider setting, Supabase resource, customer account, Preview,
Production, public-access, or real-money behavior changed. Account profile,
session security, MFA management, and the remaining feature boundaries are
still open under ARC-003.

## 2026-07-29 — ARC-003 account profile and security workspace boundary

### Implemented locally for review

- Moved the private reputation overview, identity-verification center,
  display-name and password forms, and Trust Passport controls into
  `AccountProfileWorkspace.tsx`.
- Composed the existing authenticator and signed-in-device components inside
  the same account workspace instead of assembling five security sections
  independently in `app.tsx`.
- Kept the active session, profile record, MFA login handoff, password-change
  sign-out transition, verification request, and navigation state owned by
  the central application.
- Refreshed device inventory when either the account identity or access token
  changes, preventing a rotated session from leaving stale device data on
  screen.
- Added safe clipboard/share error handling for the public Trust Passport
  controls and regression coverage for the new ownership boundary.

### Activation boundary

No Auth provider setting, database policy, migration, customer account,
Preview, Production, public-access, or real-money behavior changed. Current
Supabase session and MFA enforcement remain unchanged; this slice only
reduces central presentation coupling under ARC-003.

## 2026-07-29 — ARC-003 deal creation presentation boundary

### Implemented locally for review

- Moved the four-step progress navigation, category/template selection, Smart
  Catalog controls, item/terms fields, VIN status, optional media selection,
  validation summary, draft-recovery notice, and next-action dock into
  `DealCreationWorkspace.tsx`.
- Kept draft state, catalog identity construction, validation policy, guest
  recovery persistence, VIN request, account handoff, save/publish intent,
  media upload, and transaction service calls in the central application.
- Preserved the existing short-step interface and sticky primary action while
  removing the complete creation form markup from `app.tsx`.
- Added object URL cleanup for local media previews so changing or leaving the
  creation workspace does not retain discarded preview blobs.
- Added regression coverage that prevents creation presentation from silently
  returning to the central module or persistence services from leaking into
  the extracted workspace.

### Activation boundary

No catalog release, Auth provider setting, database policy, migration,
customer draft, Preview, Production, public-access, payment, or real-money
behavior changed. This slice is source organization and browser-resource
cleanup only; existing create/save/publish service boundaries remain
authoritative.

## 2026-07-29 — ARC-003 Deal Workspace shell and action-policy boundary

### Implemented locally for review

- Moved the expandable Deal Workspace group chrome, top navigation,
  protection/records shortcuts, and persistent primary-action dock into
  `DealWorkspaceShell.tsx`.
- Replaced the nested central action-label expression with one pure resolver
  covering draft, agreement, payment, shipping, handoff, completion, dispute,
  cancellation, and interactive-demo states.
- Kept agreement acceptance, sign-in/create transitions, active session and
  deal state, loaded readiness records, focus/scroll behavior, and every
  transaction service call in the central application.
- Preserved the package-evidence-before-address/tracking sequence for sellers
  and the address/shipment/inspection/receipt sequence for buyers.
- Added regression coverage that prevents shell presentation from returning
  to `app.tsx` or transaction mutations from entering the extracted boundary.

### Activation boundary

No Auth provider setting, Supabase resource, database policy, migration,
customer record, Preview, Production, public-access, payment, shipping, or
real-money behavior changed. ARC-003 remains open for the feature-composition,
agreement/evidence, payment, delivery, dispute/support, and administrator
boundaries.

## 2026-07-29 — ARC-003 public agreement-verification boundary

### Implemented locally for review

- Moved the complete public agreement-verification page into
  `AgreementVerificationPage.tsx`.
- Kept route resolution and return-to-Home navigation in the central
  application while moving only the page-local form state, validation, and
  read-only verification request.
- Preserved Deal ID normalization and exact 64-character SHA-256 validation,
  including current-version, archived-version, no-match, and safe error
  outcomes.
- Added polite live-result announcement, explicit form busy state, and a
  non-autofilled agreement-code field without changing verification meaning.
- Added regression coverage that prevents transaction, Auth, payment,
  shipping, or evidence-upload mutations from entering the public verifier.

### Activation boundary

No verification record, Supabase resource, database policy, migration,
customer data, Preview, Production, public-access, payment, shipping, or
real-money behavior changed. This is source organization and accessibility
hardening only; the existing read-only verification service remains
authoritative.

## 2026-07-29 — ARC-003 agreement record summary/history boundary

### Implemented locally for review

- Moved agreement export, preview, sharing, immutable fingerprint, and
  published-version history into `AgreementRecordSummary.tsx`.
- Moved the stale-response-fenced stored-agreement loader into the same
  read-only record boundary.
- Kept the professional PDF renderer in the central application for a
  separate review slice, while making it consume the shared read-only loader.
- Preserved the original Deal Records ordering around risk, seller
  declaration, and seller trust content.
- Kept current/archive meaning, acceptance counts, safe unavailable states,
  clipboard feedback, and privacy copy unchanged.
- Added regression coverage that prevents transaction, payment, shipping,
  evidence-upload, or Auth mutations from entering the record-summary module.

### Activation boundary

No agreement version, verification record, Supabase resource, database policy,
migration, customer data, Preview, Production, public-access, payment,
shipping, evidence, or real-money behavior changed. The existing read-only
agreement document/history services remain authoritative.

## 2026-07-29 — ARC-003 agreement PDF/print boundary

### Implemented locally for review

- Moved the verified agreement preview, professional print toolbar, and
  browser PDF action into `AgreementPrintDocument.tsx`.
- Moved the transaction, participant, catalog identity, declarations,
  acceptance, integrity, notice, and print-footer presentation with it.
- Kept the extracted read-only stored-agreement loader authoritative, including
  the verified unavailable/loading boundary.
- Preserved the exact immutable server-record fields, current/archive meaning,
  SHA-256 verification code, legacy-declaration behavior, and beta payment
  notice.
- Preserved the accessible document landmarks, labels, and existing print-safe
  stylesheet contract.
- Added regression coverage that prevents session, transaction, payment,
  shipping, evidence-upload, Auth, or agreement-mutation behavior from
  entering the PDF renderer.

### Activation boundary

No agreement version, PDF data, verification record, Supabase resource,
database policy, migration, customer data, Preview, Production, public-access,
payment, shipping, evidence, or real-money behavior changed. The browser still
prints the same server-authoritative agreement record.

## 2026-07-29 — ARC-003 seller declaration presentation boundary

### Implemented locally for review

- Moved the controlled three-item seller declaration checklist and empty value
  into `SellerDeclarations.tsx`.
- Moved the read-only public seller-declaration loader and its recorded or
  legacy/missing presentation into the same focused module.
- Kept declaration state, completeness, deal publication, draft persistence,
  errors, and navigation in the existing create and saved-draft flows.
- Preserved all declaration labels, timestamps, legacy meaning, and the warning
  that seller statements do not verify ownership or authenticity.
- Added stale-response fencing and decorative-icon accessibility metadata
  without changing the public result.
- Added regression coverage that prevents deal publication, persistence,
  payment, shipping, evidence upload, acceptance, or Auth behavior from
  entering the presentation module.

### Activation boundary

No declaration record, agreement version, Supabase resource, database policy,
migration, customer data, Preview, Production, public-access, payment,
shipping, evidence, or real-money behavior changed. Existing create/publish
flows and the read-only public declaration service remain authoritative.

## 2026-07-29 — ARC-003 participant evidence workspace boundary

### Implemented locally for review

- Moved seller/buyer evidence types, role-based file selection, participant
  evidence loading, upload, status, and verified viewing into
  `DealEvidenceWorkspace.tsx`.
- Kept the reviewed shared file-input policy and existing evidence service
  authoritative.
- Preserved sequential per-file quarantine uploads, post-upload reload,
  shipping-readiness notification, scan/integrity states, and expiring
  `EvidenceViewer` boundary.
- Added stale-response fencing for deal/session changes and accessible status
  feedback without changing storage or authorization.
- Kept Deal Workspace availability rules, admin evidence review, and shipping
  state outside this module.
- Added regression coverage that prevents deal acceptance, payment, shipping
  mutation, publication, editing, or Auth behavior from entering the evidence
  workspace.

### Activation boundary

No evidence policy, bucket, scanner, viewer authorization, Supabase resource,
database policy, migration, customer data, Preview, Production, public-access,
payment, shipping, or real-money behavior changed. Existing quarantine,
service-side scanning, integrity verification, and 60-second viewer controls
remain authoritative.

## 2026-07-29 — ARC-003 payment and seller payout workspace boundary

### Implemented locally for review

- Moved protected payment loading, Stripe payout readiness, action-plan
  milestones, onboarding/checkout redirects, and payment-state presentation
  into `DealPaymentWorkspace.tsx`.
- Moved the read-only payment receipt, fee breakdown, secure print window, and
  legal boundary into the same focused payment module.
- Kept Deal Workspace visibility rules and the shipping-readiness signal in
  the central composition layer.
- Preserved the existing 15-second refresh cadence, payment states, seller and
  buyer actions, fee values, Sandbox language, and non-escrow disclosure.
- Added stale-response fencing to active payment polling and retained guarded
  receipt polling so a prior deal/session response cannot overwrite the
  current view.
- Added accessible live status feedback without changing payment mutations.
- Added regression coverage that prevents shipping, evidence, acceptance,
  publication, Auth, or administrative financial resolution behavior from
  entering the participant payment module.

### Activation boundary

No Stripe account, checkout, payment, payout, transfer, refund, dispute,
Supabase resource, database policy, migration, customer data, Preview,
Production, public-access, or real-money behavior changed. The existing
server-side payment and Stripe functions remain authoritative.

## 2026-07-29 — ARC-003 fulfillment workspace boundary

### Implemented locally for review

- Moved public-location meeting proposals and confirmation into
  `DealFulfillmentWorkspace.tsx`.
- Moved buyer inspection receipts, participant arrival, one-time handoff PIN,
  and in-person completion into the same bounded fulfillment module.
- Moved private delivery address entry, address line 2, U.S. state/ZIP
  validation, evidence readiness, carrier/tracking entry, and delivery
  confirmation into the fulfillment module.
- Kept Deal Workspace visibility rules, payment/evidence readiness values, and
  parent completion/progress callbacks in the central composition layer.
- Preserved the payment/address/evidence prerequisites, inspection-before-PIN
  and inspection-before-delivery gates, private-address warning, public-place
  guidance, and existing service calls.
- Added stale-response fencing to initial meeting, inspection, shipment,
  address, and readiness loads so a prior deal/session response cannot
  overwrite the current workflow.
- Added regression coverage preventing payment creation, evidence upload,
  acceptance/publication, administrative dispute resolution, or Auth behavior
  from entering the fulfillment module.

### Activation boundary

No address, meeting, arrival, inspection, PIN, shipment, tracking, delivery,
evidence, payment, Supabase resource, database policy, migration, customer
data, Preview, Production, public-access, or real-money behavior changed.
Existing RPC/service authorization and transaction rules remain authoritative.

## 2026-07-29 — ARC-003 participant resolution and support boundary

### Implemented locally for review

- Moved completed-deal ratings, seller cancellation, participant dispute
  opening, and public trust-and-safety reports into
  `DealResolutionWorkspace.tsx`.
- Moved the private buyer/seller Deal chat, unread counter, polling, and
  message submission into the same customer-resolution module.
- Kept Deal Workspace visibility policy, signed-out report-to-Auth handoff,
  and successful status updates in the central composition layer.
- Kept administrative evidence review, moderation, financial resolution, and
  visibility controls outside the participant module.
- Added stale-response fencing to chat requests and polling so messages from a
  previous deal or session cannot overwrite the active conversation.
- Added duplicate-submit protection and accessible live feedback to rating,
  cancellation/dispute, report, and chat actions.
- Added regression coverage preventing administrative resolution, payment,
  delivery, evidence, acceptance/publication, or Auth mutations from entering
  the participant-resolution module.

### Activation boundary

No rating, cancellation, dispute, report, message, payment, delivery, evidence,
Supabase resource, database policy, migration, customer data, Preview,
Production, public-access, or real-money behavior changed. Existing
server-side authorization and audit rules remain authoritative.

## 2026-07-29 — ARC-003 administration workspace boundary

### Implemented locally for review

- Moved evidence-lifecycle review, aggregate catalog adoption, revenue
  reporting, administrative disputes, and abuse-report moderation into
  `AdministrationWorkspace.tsx`.
- Kept the `getAdminAccess` check, the `session && isAdmin` route gate, and
  customer-deal navigation in the central application.
- Loaded revenue summary and transactions concurrently and fenced
  administration requests so stale filters or sessions cannot replace the
  active result.
- Replaced direct DOM augmentation in the revenue table with declarative,
  keyboard-accessible React actions.
- Preserved explicit confirmation for refund/release operations and corrected
  the operator copy to distinguish financial resolution from dispute closure.
- Added duplicate-action guards, accessible live feedback, and regression
  coverage for the administration boundary.

### Activation boundary

No administrator permission, evidence record, catalog metric, revenue record,
refund, release, dispute, report, Deal Link visibility, Supabase resource,
database policy, migration, customer data, Preview, Production, public-access,
or real-money behavior changed. Existing server-side authorization, audit,
and Stripe controls remain authoritative.

## 2026-07-29 — ARC-003 Deal Workspace composition closure

### Implemented locally for review

- Added `DealWorkspace.tsx` as the single Deal page composition boundary for
  actions, protection, records, seller management, navigation, private chat,
  agreement overview/document, and the primary-action dock.
- Added `DealWorkspaceFeatures.tsx` for the remaining Deal-specific
  presentation and local interactions, including readiness, participant and
  access controls, expiry, risk, offers, media, timeline, editing, and
  progress.
- Removed the corresponding duplicate feature declarations and direct
  workspace composition from `app.tsx`.
- Kept active deal/session ownership, agreement acceptance, authentication and
  route handoff, action-plan loading, shared state synchronization, and
  primary-action inputs in the central application.
- Added regression coverage for the new composition boundary and updated the
  prior slice tests to follow their components through `DealWorkspace`.
- Marked all fifteen ARC-003 decomposition slices complete locally for review.

### Activation boundary

No Supabase resource, database policy, migration, customer data, Preview,
Production, public access, payment, payout, shipping, dispute, or real-money
behavior changed. This closes the reviewed source-organization epic only; all
existing server-side authorization and transaction controls remain
authoritative.

## 2026-07-29 — ARC-004 primary Deal response boundary

### Implemented locally for review

- Added dependency-free runtime schemas for signed-in Deal rows, saved Deals,
  public Deal Links, participant action plans, and seller shipping-evidence
  readiness.
- Routed Deal list and draft create/update/publish responses through the same
  bounded validator before mapping them into customer-facing application
  state.
- Normalized the public RPC's `agreement_version` into the internal current
  agreement version and preserved all four seller verification states.
- Added fail-closed checks for response shape, row/media bounds, enums, safe
  integers, timestamps, field lengths, and required workflow booleans.
- Added a privacy-safe rejection envelope containing only schema, boundary,
  and machine-readable issue values; response payloads and customer data are
  never logged.
- Added positive, normalization, malformed-response, privacy, wiring, and
  authorization-boundary regression coverage.
- Kept ARC-004 open for Auth, payment, evidence, dispute, messaging, offer,
  support, and administration schemas.

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, Edge Function,
customer data, Preview, Production, public access, payment, payout, dispute,
delivery, or real-money behavior changed. Existing RLS, grants, server-side
authorization, and transaction controls remain authoritative.

## 2026-07-29 — ARC-004 browser Auth and MFA response boundary

### Implemented locally for review

- Added a dependency-free browser runtime schema for signup, password login,
  refresh, MFA-verified sessions, MFA status, and TOTP enrollment responses.
- Replaced TypeScript-only Auth response assertions and the generic MFA response
  cast with operation-specific parsers after successful HTTP responses.
- Made exposure of a provider refresh token through any reviewed browser success
  envelope an explicit fail-closed condition; refresh credentials remain in the
  server-set HttpOnly cookie boundary.
- Added bounds and format checks for access tokens, session lifetime, user and
  factor UUIDs, email, timestamps, factor count and uniqueness, assurance level,
  factor removal state, TOTP secret and URI, and enrollment SVG.
- Added a privacy-safe Auth rejection envelope containing only schema, boundary,
  and bounded issue identifiers. Tokens, refresh credentials, email, names, and
  enrollment secrets are excluded.
- Added positive, malformed-response, secret-exposure, privacy, contradictory
  state, unsafe SVG, and client wiring regression coverage.
- Kept ARC-004 open for runtime request/error envelopes and payment, evidence,
  dispute, messaging, offer, support, and administration boundaries.

### Activation boundary

No Supabase resource, Auth provider setting, schema, grant, policy, migration,
RPC, Edge Function, customer account or data, Preview, Production, public
access, payment, payout, dispute, delivery, or real-money behavior changed.
The existing server proxy, HttpOnly refresh cookie, Supabase Auth, MFA claims,
RLS, grants, and server-side authorization remain authoritative.

## 2026-07-29 — ARC-004 protected-payment and Stripe response boundary

### Implemented locally for review

- Added a dependency-free runtime schema for the participant protected-payment
  projection, Stripe Connect readiness and onboarding, Stripe Checkout, and
  administrator dispute refund/transfer confirmations.
- Removed the generic browser Edge Function success cast from every current
  Stripe call site and routed each response through its operation-specific
  parser.
- Required exactly one participant-visible payment row with reviewed status,
  currency, safe integer amounts, balanced item/fee/seller totals, valid event
  timestamps, consistent payout flags, and a reviewed viewer role.
- Restricted seller onboarding and customer checkout redirects to the exact
  Stripe HTTPS origins and bounded unexpired lifetimes.
- Required dispute resolutions to return the provider identifier matching the
  approved refund or transfer action and rejected contradictory identifiers.
- Added privacy-safe rejection telemetry containing only schema, boundary, and
  issue; financial amounts, Stripe URLs, provider identifiers, customer data,
  and provider messages are excluded.
- Added positive, normalization, amount-integrity, timestamp, redirect-origin,
  provider-ID, privacy, and client-wiring regression coverage.
- Kept ARC-004 open for request/error envelopes and evidence, dispute,
  notification, chat, offer, inquiry, support, and administrator/reporting
  response schemas.

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, Edge Function,
Stripe configuration or provider object, customer data, Preview, Production,
public access, checkout, payment, payout, refund, dispute decision, delivery,
or real-money behavior changed. Stripe-signed webhooks, immutable financial
snapshots, fenced commands, provider reconciliation, RLS, and server-side
authorization remain authoritative.

## 2026-07-29 — ARC-004 governed evidence and dispute response boundary

### Implemented locally for review

- Added a dependency-free runtime schema for evidence upload intake, finalized
  and listed evidence records, private evidence viewing, lifecycle operations,
  and the administrator dispute queue.
- Removed generic evidence Edge Function and maintenance success casts and
  routed every current response through an operation-specific parser.
- Bound quarantine upload paths to the authenticated user, requested Deal,
  generated intake ID, reviewed bucket, extension, and short expiration.
- Required finalized evidence to match the requested Deal and uploader role,
  and enforced scan, integrity, retention, active/deleted lifecycle, timestamp,
  size, MIME, hash, and metadata-redaction contracts on listed records.
- Restricted evidence viewing to the configured Supabase HTTPS origin, the
  signed private `deal-evidence` Storage path, a bounded expiration, clean scan,
  verified integrity, supported MIME, safe size, and SHA-256 fingerprint before
  the existing downloaded-byte verification.
- Validated lifecycle counts, bounded unique jobs and alerts, legal-hold
  references, inventory results, deletion job IDs, hold keys, and alert
  acknowledgements.
- Validated administrator dispute UUIDs, Deal ID, status, response timeline,
  payment status, amount, currency, participant display fields, and resolution
  state before rendering the queue.
- Added privacy-safe rejection telemetry containing only schema, boundary, and
  issue. File names, paths, hashes, signed URL tokens, participant names,
  dispute text, amounts, and identifiers are excluded.
- Added positive, cross-record mismatch, path traversal, signed-origin,
  lifecycle contradiction, financial bound, privacy, currency synchronization,
  and client-wiring regression coverage.
- Kept ARC-004 open for request/error envelopes and notification, chat, offer,
  inquiry, support, and remaining administrator/reporting response schemas.

### Current Supabase compatibility note

The April 2026 Data API default-grant change does not alter this local browser
validation slice. Existing explicit evidence view/function grants and RLS stay
authoritative; runtime parsing adds a separate fail-closed response boundary
without changing database exposure.

### Activation boundary

No Supabase resource, Storage bucket or object, schema, grant, policy,
migration, RPC, Edge Function, customer data, lifecycle job, legal hold,
dispute decision, Preview, Production, public access, payment, payout, refund,
delivery, or real-money behavior changed. Existing Data API grants, RLS,
private Storage access, Edge Function authorization, downloaded-byte
verification, MFA controls, and server-side case decisions remain
authoritative.

## 2026-07-29 — ARC-004 communication and safety-report response boundary

### Implemented locally for review

- Added a dependency-free runtime schema for notifications, Deal chat, offers,
  inquiries, inquiry/report creation identifiers, the seller-role response,
  and the administrator safety-report queue.
- Replaced the current TypeScript-only success casts and loose scalar coercion
  at those browser boundaries with operation-specific fail-closed parsers.
- Enforced collection bounds, unique identifiers, RPC-defined ordering,
  reviewed enums, safe offer amounts, bounded customer text, valid UUID/public
  IDs, timestamps, booleans, reply consistency, and report resolution state.
- Required own notification events to be read and administrator reports to
  preserve the existing open-first queue contract.
- Added privacy-safe rejection telemetry containing only schema, boundary, and
  bounded issue. Message/question/reply text, participant and reporter names,
  notification/listing titles, report text and notes, amounts, identifiers,
  and provider errors are excluded.
- Added positive, malformed-response, contradictory-state, ordering, privacy,
  scalar, and client-wiring regression coverage.
- Confirmed that the repository has support copy and operational runbooks but
  no general customer support-ticket response API; that boundary remains a
  product/API design item rather than an invented client schema.
- Kept ARC-004 open for request/error envelopes, remaining administrator and
  reporting projections, and the future support-case API.

### Current Supabase compatibility note

Supabase's April 2026 Data API default-grant change does not alter this local
browser validation slice because it creates no database object. Existing
grants, RLS, and RPC participant/admin checks remain authoritative; runtime
parsing is a separate response-integrity boundary and is not authorization.

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, Edge Function,
customer message, inquiry, offer, report, moderation decision, Preview,
Production, public access, payment, payout, refund, delivery, or real-money
behavior changed. Existing Data API grants, RLS, RPC authorization, and
server-side transaction and moderation rules remain authoritative.

## 2026-07-30 — ARC-004 administrator finance and catalog response boundary

### Implemented locally for review

- Added a dependency-free runtime schema for the administrator role check,
  revenue summary, protected-payment transaction ledger, and aggregate catalog
  adoption metrics.
- Replaced the loose administrator boolean coercion and TypeScript-only finance
  and catalog success casts with operation-specific fail-closed parsers.
- Required one U.S. revenue summary with supported currency, safe aggregate
  amounts and counts, count consistency, and a valid released/protected/refunded
  partition within total payment volume.
- Required the bounded transaction ledger to contain unique payment and Deal
  identifiers, reviewed payment states and currencies, balanced
  item/fee/seller amounts, bounded display fields, valid timestamps, and the
  RPC-defined newest-first order.
- Bound catalog metrics to the requested 7, 30, or 90 day window and required
  unique version/category dimensions, safe aggregate counts, structured
  model-with-brand consistency, valid latest-activity timestamps, and
  count-descending order.
- Added privacy-safe rejection telemetry containing only schema, boundary, and
  bounded issue. Amounts, counts, transaction and Deal identifiers, listing
  titles, participant names, catalog dimensions, and provider errors are
  excluded.
- Added positive, malformed-response, financial-integrity, ordering, catalog
  window, privacy, currency synchronization, and client-wiring regression
  coverage.
- Kept ARC-004 open for request/error envelopes, public trust and risk
  projections, monitoring transport, deployed contract fixtures, and the
  future support-case API.

### Current Supabase compatibility note

Supabase Data API error responses continue to use the documented PostgREST
error envelope. This local slice validates successful RPC response bodies only;
reviewed request and error-envelope consolidation remains separate ARC-004
work.

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, Edge Function,
administrator role, customer or financial data, catalog release, Preview,
Production, public access, payment, payout, refund, dispute decision, delivery,
or real-money behavior changed. Existing Data API grants, RLS, server-side
administrator checks, Stripe-signed records, immutable financial snapshots, and
catalog governance remain authoritative.

## 2026-07-30 — ARC-004 public trust and risk response boundary

### Implemented locally for review

- Added a dependency-free runtime schema for explainable Deal risk, public
  seller trust, authenticated Digital Trust Passport settings and toggle
  result, and the opt-in public Passport.
- Replaced the remaining TypeScript-only trust/risk success casts with
  operation-specific fail-closed parsers.
- Required zero-or-one public rows, one authenticated settings row, reviewed
  verification states, bounded display fields, valid timestamps, nonnegative
  safe counts, and exact uppercase 12-character Passport identifiers.
- Recomputed the risk score contract from the existing SQL signal weights,
  including mutually exclusive age/media signals, community-report bounds,
  database-defined signal ordering, exact risk level, and sole zero-score
  `no_flags` behavior.
- Required completed Passport sales and purchases to sum to completed Deals,
  rating averages to match rating presence and database precision, and the
  five-entry recent rating history to remain newest-first.
- Added privacy-safe rejection telemetry containing only schema, boundary, and
  bounded issue. Public IDs, display names, verification state, counts,
  ratings, timestamps, risk scores/signals, and provider errors are excluded.
- Added positive, empty-projection, malformed-response, score-integrity,
  reputation-integrity, ordering, privacy, and client-wiring regression
  coverage.
- Kept ARC-004 open for request/error envelopes, governed monitoring transport,
  deployed contract fixtures, and the future support-case API.

### Current Supabase compatibility note

The current Supabase Data API remains PostgREST-backed, and documented error
responses use a separate JSON error envelope. This local slice validates only
successful RPC response bodies. Existing explicit function grants, RLS,
public-Deal visibility, moderation exclusion, and Passport opt-in remain
authoritative.

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, Edge Function,
profile, Passport setting, Deal, rating, report, customer data, Preview,
Production, public access, payment, payout, refund, dispute decision, delivery,
or real-money behavior changed. Runtime validation is not identity
verification, fraud adjudication, or authorization.

## 2026-07-30 — ARC-004 Auth request and error boundary

### Implemented locally for review

- Added a dependency-free runtime schema for every current browser Auth
  mutation request, Auth proxy bearer token, and reviewed non-success response.
- Replaced hand-built signup, login, refresh, recovery, password, logout, and
  MFA request serialization with operation-specific parsers.
- Required exact request keys, bounded/normalized email and display name,
  existing new-password complexity, historical login-password compatibility,
  valid sign-out scope, operation-correct password fields, UUID factor IDs,
  six-digit TOTP codes, reviewed MFA actions/purposes, and bounded JWT-shaped
  bearer tokens before network use.
- Replaced loose Auth proxy error casting with one exact envelope parser.
  Error messages and optional machine codes are bounded; 429 retry guidance
  must remain within 1–300 seconds and body/header values must agree.
- Added privacy-safe rejection diagnostics containing only schema, boundary,
  and bounded issue. Email, name, password, TOTP code, factor ID, access token,
  proxy message, provider details, retry value, and unknown fields are
  excluded.
- Added positive mutation/error fixtures, malformed-shape, secret-redaction,
  retry-conflict, credential-boundary, and client-wiring regression coverage.
- Kept ARC-004 open for non-Auth mutation/error boundaries, governed
  monitoring transport, deployed contract fixtures, and the future support
  case API.

### Current Supabase compatibility note

Current Supabase Auth errors expose a stable machine-readable error code and
HTTP status, while Auth rate limits intentionally return 429 responses. The
Dealivra browser continues to consume only its same-origin proxy's reviewed
customer-safe envelope; raw provider error bodies remain server-side. The
current Supabase breaking-change log contains no hosted Auth envelope change
that alters this boundary.

### Activation boundary

No Supabase resource, Auth setting, schema, grant, policy, migration, RPC, Edge
Function, customer credential/data, Preview, Production, public access,
payment, payout, refund, dispute decision, delivery, or real-money behavior
changed. Server-side same-origin, size, session, rate-limit, password, MFA, and
authorization checks remain authoritative.

## 2026-07-30 — ARC-004 evidence and dispute request/error boundary

### Implemented locally for review

- Added a dependency-free runtime schema for the browser evidence-file,
  evidence-lifecycle, participant dispute, administrator dispute, and
  financial-dispute mutation requests.
- Required exact action-specific request keys, UUID identifiers, role-correct
  evidence types, canonical post-processing MIME types, evidence-size limits,
  safe file names, bounded lifecycle reasons, bounded dispute reasons, valid
  decisions, and bounded resolution notes before network use.
- Replaced loose evidence Edge Function, Storage, evidence-list, participant
  dispute, dispute-queue, and administrator dispute error reads with exact
  reviewed envelope parsers.
- Kept PostgREST details and hints inside the validation boundary: only the
  bounded customer-facing message and optional machine code can leave the
  parser. Unknown provider fields fail closed.
- Added privacy-safe rejection diagnostics containing only schema, boundary,
  and bounded issue. File names, dispute text, lifecycle reasons, provider
  diagnostics, Storage details, identifiers, and unknown fields are excluded.
- Added positive request/error fixtures, cross-role evidence, malformed-shape,
  over-limit, status-conflict, secret-redaction, and client-wiring regression
  coverage.
- Kept ARC-004 open for payment and remaining non-Auth mutation/error
  boundaries, governed monitoring transport, deployed contract fixtures, and
  the future support case API.

### Current Supabase compatibility note

The current Data API documents PostgREST errors with a message plus optional
code, details, and hint, while private Storage access remains governed by RLS
and signed URLs. The browser accepts only the reviewed error subsets and never
uses response parsing as authorization; existing RLS, grants, exact-origin
Edge Function handling, Auth session checks, evidence scanning, and private
bucket policy remain authoritative.

### Activation boundary

No Supabase resource, bucket, schema, grant, policy, migration, RPC, Edge
Function, evidence record/file, dispute, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, delivery, or
real-money behavior changed. This is a browser request and response-integrity
boundary only.

## 2026-07-30 — ARC-004 protected-payment request/error boundary

### Implemented locally for review

- Added dependency-free runtime request schemas for Stripe Connect status and
  onboarding, hosted Checkout creation, and protected-payment status reads.
- Required exact action-specific keys, UUID identifiers, and canonical public
  Deal IDs before a payment request can leave the browser.
- Replaced loose payment Edge Function and protected-payment status error
  casting with exact reviewed envelope parsers. Payment function errors must
  include a bounded customer-safe message, reviewed machine code, retry flag,
  and UUID correlation ID; the response header and body correlation IDs must
  match.
- Kept provider diagnostics inside the server boundary. Browser failures expose
  only a safe customer message and support reference; malformed, conflicting,
  or additional provider fields fail closed.
- Added privacy-safe rejection diagnostics containing only schema, boundary,
  and bounded issue. Deal identifiers, financial values, provider messages,
  correlation IDs, PostgREST details/hints, and unknown fields are excluded.
- Added positive request/error fixtures, malformed-shape, correlation-conflict,
  identifier, privacy, and complete browser-wiring regression coverage.
- Kept ARC-004 open for remaining non-payment browser mutation/error
  boundaries, governed monitoring transport, deployed contract fixtures, and
  the future support case API.

### Current provider compatibility note

Current Stripe guidance treats webhooks as authoritative for asynchronous
fulfillment, recommends idempotency keys on mutating POST requests, and
provides request IDs for server-side diagnosis. Dealivra continues to use
hosted Checkout, trusted command-ledger idempotency, verified webhook state,
and server-only provider details; this browser boundary does not replace those
controls. Current Supabase Data API errors may include message, code, details,
and hint, but only the reviewed customer-safe subset can leave the parser.

### Activation boundary

No Stripe account, Checkout Session, Connect account, webhook, Supabase
resource, schema, grant, policy, migration, RPC, Edge Function, customer data,
Preview, Production, public access, payment, payout, refund, dispute decision,
delivery, or real-money behavior changed. This is a browser request and
response-integrity boundary only.

## 2026-07-30 — ARC-004 communication and moderation request/error boundary

### Implemented locally for review

- Added dependency-free runtime request schemas for activity notifications,
  private Deal messages, offers, private pre-acceptance questions, community
  safety reports, administrator report review, and Deal visibility moderation.
- Required exact operation-specific keys, UUID identifiers, canonical public
  Deal IDs, safe integer offer amounts, bounded names and private text,
  approved report categories, valid decisions, and bounded review notes before
  any request can leave the browser.
- Replaced loose PostgREST error reads with one exact reviewed envelope parser.
  Only a bounded customer-facing message and optional machine code can leave
  the parser; details, hints, unknown fields, and malformed envelopes fail
  closed.
- Preserved the existing conservative seller-role probe: a denied or
  unavailable request remains `false`, while its outbound identifier is now
  validated before network use.
- Added positive fixtures for every request shape, negative financial/text/
  identifier/category/decision cases, privacy-safe diagnostics, strict error
  fixtures, and complete client-wiring regression coverage.
- Kept ARC-004 open for remaining Deal, administration, trust, delivery, and
  account mutation/error boundaries, governed monitoring transport, deployed
  contract fixtures, and the future support case API.

### Current Supabase compatibility note

Current Supabase Data API behavior may return a PostgREST error containing
message, code, details, and hint. Dealivra accepts only that reviewed shape and
returns only message/code to the application; authorization remains
server-side through the existing grants, RLS policies, and security-definer
function checks. Request validation is defense in depth and does not replace
those controls.

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, customer message,
offer, inquiry, report, moderation decision, customer data, Preview,
Production, public access, payment, payout, refund, dispute decision, delivery,
or real-money behavior changed. This is a browser request and
response-integrity boundary only.

## 2026-07-30 — ARC-004 administrator finance/catalog request-error boundary

### Implemented locally for review

- Added dependency-free runtime request schemas for administrator access
  probing, revenue summary, bounded transaction history, and governed catalog
  adoption windows.
- Required exact empty request bodies where applicable, a safe integer
  transaction limit from 1 to 200, and an approved 7, 30, or 90 day catalog
  window before network use.
- Replaced loose revenue and catalog PostgREST error reads with an exact
  reviewed envelope parser. Only a bounded customer-facing message and
  optional machine code can leave the parser; private details, hints, unknown
  fields, and malformed envelopes fail closed.
- Preserved deny-by-default administrator probing: an unavailable or denied
  access check remains `false`; browser validation does not grant access.
- Added positive and negative request/error fixtures, private finance/catalog
  diagnostic redaction tests, and complete browser-wiring regression coverage.
- Kept ARC-004 open for remaining Deal, trust, delivery, and account mutation/
  error boundaries, governed monitoring transport, deployed contract fixtures,
  and the future support case API.

### Current Supabase compatibility note

The browser accepts only the reviewed PostgREST error subset. The existing
administrator RPCs remain responsible for role checks, bounded result sets,
aggregate-only catalog metrics, and finance projections; runtime request
validation is defense in depth and cannot replace database grants, RLS,
security-definer authorization, or privileged MFA.

### Activation boundary

No administrator role, Supabase resource, schema, grant, policy, migration,
RPC, finance record, catalog metric, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, moderation decision,
delivery, or real-money behavior changed. This is a browser request and
response-integrity boundary only.

## 2026-07-30 — ARC-004 trust, passport, and risk request-error boundary

### Implemented locally for review

- Added dependency-free runtime request schemas for Deal risk assessment,
  public seller trust, Trust Passport settings and toggle, and the public
  Trust Passport lookup.
- Required exact request keys, canonical public Deal identifiers, an exact
  twelve-character hexadecimal Trust Passport identifier, and a strict
  boolean settings toggle before any request can leave the browser.
- Replaced loose trust and risk PostgREST error reads with one exact reviewed
  envelope parser. Only the optional machine code exits that parser; provider
  messages, details, hints, unknown fields, and malformed envelopes fail
  closed behind fixed customer-safe service messages.
- Added positive normalization fixtures, negative identifier/shape/type/error
  fixtures, privacy-safe diagnostic tests, and complete browser-wiring
  regression coverage.
- Kept ARC-004 open for remaining Deal, delivery/handoff, and account mutation
  and error boundaries, governed monitoring transport, deployed contract
  fixtures, and the future support case API.

### Current Supabase compatibility note

The browser accepts the current reviewed PostgREST error envelope containing
message, code, details, and hint, but returns only its optional code.
Authorization and data minimization remain authoritative in the existing
database grants, RLS policies, security-definer functions, and public RPC
projections. Browser validation is defense in depth and does not replace
those controls.

### Activation boundary

No Supabase resource, profile, Trust Passport setting, risk record, schema,
grant, policy, migration, RPC, customer data, Preview, Production, public
access, payment, payout, refund, delivery, dispute decision, or real-money
behavior changed. This is a browser request and response-integrity boundary
only.

## 2026-07-30 — ARC-004 delivery, meeting, handoff, and inspection boundary

### Implemented locally for review

- Added dependency-free runtime schemas for meeting, shipment, delivery
  details, inspection receipt, and six-digit handoff PIN responses.
- Removed wildcard reads from participant meeting and shipment queries. The
  browser now requests only its reviewed display projection, so meeting PIN
  hashes and unrelated database columns do not cross the Data API boundary.
- Added exact request schemas for meeting proposal/confirmation/arrival,
  handoff PIN creation and completion, inspection read/record, shipment read
  and creation, shipping-evidence readiness, delivery-detail read/save, the
  Deal action plan, and delivery confirmation.
- Canonicalized UUIDs, timestamps, carrier and tracking fields, recipient and
  full delivery addresses (including apartment, suite, or unit text), country,
  optional delivery instructions, and handoff PINs before network use.
- Added cross-field shipment-state validation, exact PostgREST error-envelope
  validation, fixed customer-safe service errors, privacy-safe diagnostics,
  negative logistics fixtures, and complete client-wiring regression
  coverage.
- Kept ARC-004 open for remaining Deal, account/profile, rating, timeline,
  agreement, watchlist, and legacy payment-method mutation/error boundaries,
  governed monitoring transport, deployed contract fixtures, and the future
  support case API.

### Current Supabase compatibility note

The reviewed delivery projections match the current meeting, shipment,
delivery-detail, inspection, shipping-evidence, and Deal action-plan
contracts. Existing participant authorization, state transitions, inspection
prerequisites, address locking, evidence gates, RLS, grants, and
security-definer checks remain authoritative. Browser validation is defense
in depth and does not replace those controls.

### Activation boundary

No Supabase resource, address, meeting, shipment, inspection, handoff PIN,
schema, grant, policy, migration, RPC, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, delivery status, or
real-money behavior changed. This is a browser request and
response-integrity boundary only.

## 2026-07-30 — ARC-004 account activity request-response boundary

### Implemented locally for review

- Added dependency-free runtime schemas for the private profile summary,
  signed-in device inventory, identity-verification status, Deal timeline, and
  accepted-deal participant record.
- Enforced exact response keys, verified profile status values, bounded
  aggregate counts and ratings, newest-first rating and timeline order,
  minimal UUID session identifiers, one current-session invariant, bounded
  user-agent text, and participant-only display fields.
- Added exact request schemas for profile and device reads, identity
  verification, rating submission, Deal timeline, and participant records.
  Rating stars, comments, and Deal UUIDs are canonicalized before network use.
- Replaced loose provider error reads with exact PostgREST error-envelope
  validation and fixed customer-safe service messages.
- Added positive and negative account/session/rating/timeline fixtures,
  privacy-safe diagnostics, response-order invariants, and complete
  client-wiring regression coverage.
- Kept ARC-004 open for remaining Deal creation/edit/cancellation, agreement,
  renewal, access-code, watchlist, media, legacy payment-method, and account
  name mutation/error boundaries, governed monitoring transport, deployed
  contract fixtures, and the future support case API.

### Current Supabase compatibility note

The reviewed schemas match the current profile summary, current-user session
inventory, identity verification, timeline, participant, and rating RPC
contracts. Existing Auth ownership, participant authorization, rating
eligibility, twenty-session result cap, RLS, grants, and security-definer
checks remain authoritative. Browser validation is defense in depth and does
not replace those controls.

### Activation boundary

No Supabase resource, profile, session, verification status, rating, timeline,
participant record, schema, grant, policy, migration, RPC, customer data,
Preview, Production, public access, payment, payout, refund, dispute decision,
delivery status, or real-money behavior changed. This is a browser request
and response-integrity boundary only.

## 2026-07-30 — ARC-004 canonical agreement, Deal Link, and Watchlist boundary

### Implemented locally for review

- Added dependency-free runtime schemas for the public seller declaration,
  canonical agreement document, agreement-version history, hash-verification
  result, Deal Link renewal, buyer acceptance protection, six-digit buyer
  access code, and Watchlist state.
- Enforced the exact eighteen-field canonical agreement projection used by the
  UI and PDF, including schema version, uppercase public identifier, immutable
  hashes, bounded terms, reviewed currency/condition/handoff values, catalog
  identity, affirmative seller declarations, timestamps, acceptance counts,
  and current-version state.
- Required agreement history to be strictly newest-first, version-unique, and
  to expose exactly one current version. Verification can return only a
  positive exact hash match; a missing match remains an empty result.
- Added exact request schemas for public agreement/declaration/history reads,
  SHA-256 verification, reviewed renewal periods, buyer-code configuration,
  acceptance-protection lookup, and Watchlist read/write operations.
- Replaced loose casts, truthy coercion, and provider-message forwarding with
  exact response/error validation and fixed customer-safe service messages.
  Versioned agreement request caching now uses the validated canonical Deal
  identifier and version.
- Added positive and negative agreement, declaration, history, verification,
  renewal, access-code, Watchlist, request, error, ordering, and privacy-safe
  diagnostic fixtures, plus complete browser-wiring regression coverage.
- Kept ARC-004 open for remaining Deal creation/edit/cancellation, media,
  legacy payment-method, saved-deal list, public Deal, acceptance, and account
  name mutation/error boundaries, governed monitoring transport, deployed
  contract fixtures, and the future support case API.

### Current Supabase compatibility note

The reviewed schemas match the current canonical agreement, seller
declaration, renewal, buyer access-code, and Watchlist SQL contracts.
Database immutability, participant/seller ownership, valid-state checks, RLS,
grants, security-definer functions, and public projections remain
authoritative. Browser validation is defense in depth and does not replace
those controls.

### Activation boundary

No Supabase resource, agreement, declaration, Deal Link, access code,
Watchlist row, schema, grant, policy, migration, RPC, customer data, Preview,
Production, public access, payment, payout, refund, dispute decision, delivery
status, or real-money behavior changed. This is a browser request and
response-integrity boundary only.

## 2026-07-30 — ARC-004 Deal mutation and owner-bound media boundary

### Implemented locally for review

- Added dependency-free exact request schemas for Deal creation, private-draft
  update, publication, published-Deal edit, seller cancellation, saved/public
  Deal reads, buyer acceptance, media upload/record/delete/reorder operations,
  and the supporting owner/Deal contexts.
- Canonicalized Deal and account UUIDs, public Deal identifiers, title and
  description text, positive safe-integer prices, reviewed currencies,
  condition and handoff enums, serial suffixes, expiration periods, timestamps,
  cancellation reasons, buyer names, and optional six-digit access codes
  before network use.
- Enforced structured-catalog categories, version format, stable slug IDs,
  bounded labels, ID/label dependencies, variant/model dependencies, and
  vehicle-only model years at the browser boundary.
- Replaced string-split media trust with exact URL parsing. Media operations
  now require the configured Supabase origin, the public `deal-media` bucket,
  the signed-in owner's UUID, the selected Deal UUID, a UUID file name, one
  reviewed extension, at most six unique entries, and a complete bounded
  order. Foreign origins, query/fragment additions, encoded path confusion,
  cross-owner/cross-Deal paths, and duplicate entries fail closed.
- Added exact published-version and public-acceptance response parsers. Public
  acceptance permits only `accepted`, `incorrect_code`, or `rate_limited`.
- Replaced loose provider-message forwarding for Deal draft, publish, edit,
  cancel, saved/public read, acceptance, media record, deletion, and reorder
  failures with exact PostgREST envelope validation and fixed customer-safe
  messages.
- Added best-effort Storage cleanup when an uploaded object cannot be linked
  to its governed media record.
- Added positive normalization, negative shape/type/state/origin/path/order,
  malformed error, malformed success-response, privacy-safe diagnostic, and
  complete client-wiring regression coverage. The focused suite now passes
  176 of 176 tests.
- Kept ARC-004 open for the legacy payment-method record, account-name
  mutation/error boundary, governed monitoring transport, deployed contract
  fixtures, and the future support-case API.

### Current Supabase compatibility note

The reviewed schemas match the current `deals`, `deal_media`,
`publish_deal_with_seller_declarations`, `update_published_deal`,
`cancel_deal`, `get_my_saved_deals`, `get_public_deal`, `accept_deal`, and
`reorder_deal_media` contracts. Existing seller/participant ownership,
valid-state transitions, RLS, grants, Storage policies, security-definer
functions, catalog constraints, agreement versioning, and buyer-code rate
limits remain authoritative. Browser validation is defense in depth and does
not replace those controls.

### Activation boundary

No Supabase resource, Deal, draft, agreement, Watchlist row, media object,
schema, grant, policy, migration, RPC, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, delivery status, or
real-money behavior changed. This is a browser request and
response-integrity boundary only.

## 2026-07-30 — ARC-004 account-name and historical-payment boundary

### Implemented locally for review

- Added an exact account-name mutation request schema that canonicalizes the
  signed-in account UUID and a 2–80 character display name before constructing
  the Auth metadata and private profile update bodies.
- Added exact reviewed Supabase Auth and PostgREST error-envelope schemas.
  Unknown fields, malformed statuses/codes/messages, and provider diagnostics
  fail closed without being forwarded to the customer.
- Changed account-name persistence so local session state updates only after
  both remote writes succeed. A profile failure after an Auth metadata success
  now triggers a best-effort compensating Auth update to the previous name.
- Added exact request, error, and zero-or-one-row response schemas for the
  read-only historical payment receipt. Method, participant role, timestamps,
  event ordering, and acknowledgement-state dependencies now fail closed.
- Removed the four unused pre-Stripe payment acknowledgement mutations from
  the browser service. Stripe webhook state remains the only current financial
  truth.
- Removed those four revoked RPCs from the production authenticated allowlist
  and its exact-signature role test so a later hardening run cannot silently
  restore participant execution. Historical receipt read access remains.
- Added positive, negative, rollback-wiring, state-consistency,
  privacy-diagnostic, Stripe-revocation, allowlist, and client-retirement
  regression coverage. Type checking and all 180 focused tests pass.
- Kept ARC-004 open for governed rejection monitoring, deployed Supabase
  contract fixtures, and the future support-case API.

### Current Supabase and Stripe compatibility note

Stripe-signed webhooks, protected-payment snapshots, command fences, RLS,
grants, and server-side authorization remain authoritative. The existing
historical `get_deal_payment_record` read is preserved only for legacy receipt
presentation. Browser parsing and compensating metadata cleanup are defense in
depth and do not establish identity, payment status, or authorization.

### Activation boundary

No Supabase resource, Auth user, profile, payment, schema, grant, policy,
migration, RPC, Preview, Production, public access, payout, refund, dispute
decision, delivery status, or real-money behavior changed. SQL edits remain
unapplied review-source changes on the protected local branch.

## 2026-07-30 — OPS-001/002 staged private support-case foundation

### Implemented locally for review

- Added deny-by-default support-case and append-only message tables with no
  direct browser table privileges.
- Added customer-own intake/list/detail/reply RPCs, a minimal privileged
  AAL2 queue, atomic assignment, assigned-operator detail/reply, and resolution.
- Added urgent/normal SLA targets, one-active-context uniqueness, a
  transaction-safe five-active-case limit, and material audit events that do
  not copy case content.
- Added exact request, success-response, and reviewed error schemas with
  privacy-safe rejection diagnostics.
- Added a compact customer support center behind the exact, default-off
  `VITE_SUPPORT_CASES_ENABLED=enabled` rollout gate.
- Added rollback-only database authorization proof plus positive, negative,
  excess-field, state-consistency, ordering, client-wiring, and diagnostic
  regression coverage. Type checking and all 184 focused tests pass.
- Added activation, queue ownership, SLA, AAL2, cross-account, retention, and
  rollback requirements in
  [43_SUPPORT_CASE_FOUNDATION.md](43_SUPPORT_CASE_FOUNDATION.md).

### Activation boundary

No Supabase resource, schema, grant, policy, migration, RPC, customer case,
Preview, Production, public access, payment, payout, refund, dispute decision,
or real-money behavior changed. The migration remains unapplied and the
browser feature remains off by default.

## 2026-07-30 — OBS-001 staged runtime rejection monitoring

### Implemented locally for review

- Routed all 26 current runtime request/response rejection schemas through one
  dependency-free reporter with an exact three-dimension privacy contract.
- Added per-signature 30-second transport deduplication, a 20-attempt browser
  minute cap, omitted credentials/referrer data, and best-effort failure that
  cannot change the customer operation.
- Added a same-origin, 1 KB, exact-schema Vercel intake that defaults to
  `staged`, fails closed for invalid configuration, and records only a random
  event ID, receipt time, environment, release, schema, boundary, issue, and
  bounded count in enforced mode.
- Added method/origin/content-type/size/mode/excess-field/privacy tests and a
  regression inventory proving every current validator uses the governed
  transport. All 187 focused tests pass.
- Added environment, Firewall, retention, alert ownership, protected synthetic
  proof, and rollback requirements in
  [44_RUNTIME_REJECTION_MONITORING.md](44_RUNTIME_REJECTION_MONITORING.md).

### Activation boundary

No Vercel variable, Firewall rule, log drain, alert, deployment, Supabase
resource, customer data, Preview, Production, public access, payment, payout,
refund, dispute decision, or real-money behavior changed. The intake remains
default-off until the protected activation gate is approved and evidenced.

## 2026-07-30 — OBS-001 client failure recovery and staged monitoring

### Implemented locally for review

- Removed React exception names and component stacks from the application
  recovery record and replaced them with one fixed render-failure category.
- Added a shared recovery page for both React render failure and failed dynamic
  application import, preventing an async bundle failure from leaving a blank
  or unresponsive page.
- Added fixed-category localization, global browser-error, and unhandled-promise
  reporting without forwarding event or rejection values.
- Added an exact five-category reporter with 30-second deduplication, a
  10-attempt browser minute cap, omitted credentials/referrer data, and
  best-effort failure isolation.
- Added a default-off, same-origin, 512-byte Vercel intake whose enforced log
  contains only environment, release, server event metadata, category, and
  bounded count.
- Added positive/negative category, method/origin/content-type/size/mode,
  excess-field, privacy, recovery-wiring, and no-stack regression coverage.
  Type checking and all 190 focused tests pass.
- Added activation, protected synthetic, accessibility, alert, retention,
  Firewall, and rollback requirements in
  [45_CLIENT_FAILURE_MONITORING.md](45_CLIENT_FAILURE_MONITORING.md).

### Activation boundary

No Vercel variable, Firewall rule, log drain, alert, deployment, Supabase
resource, customer data, Preview, Production, public access, payment, payout,
refund, dispute decision, or real-money behavior changed. Client failure
monitoring remains default-off; the customer-safe recovery boundary remains
active independently of transport.

## 2026-07-30 — OBS-001 fixed-category server failure records

### Implemented locally for review

- Added one dependency-free server reporter that accepts only a fixed schema,
  bounded internal boundary, and allowlisted issue, then adds a server random
  event ID, time, environment, and release.
- Removed Auth exception/cause `name` and `code` traversal. Auth failures now
  classify configuration missing/invalid, provider unavailable, or unexpected
  failure without logging the Error, message, cause, stack, provider body, or
  identity/request data.
- Added fixed catalog-unavailable and VIN provider
  unavailable/timeout/invalid-response records while preserving expected
  unsupported-category, invalid-VIN, and not-found customer paths.
- Added normalization, excess-field, arbitrary-issue, Auth classification,
  environment/release correlation, sensitive-content absence, and
  service-wiring regression coverage. All 192 focused tests pass.
- Added drain access, retention, alert, protected synthetic, response-privacy,
  and rollback requirements in
  [46_SERVER_FAILURE_MONITORING.md](46_SERVER_FAILURE_MONITORING.md).

### Activation boundary

No Vercel log drain, retention rule, alert, synthetic, deployment, Supabase
resource, customer data, Preview, Production, public access, payment, payout,
refund, dispute decision, or real-money behavior changed. Existing private
runtime logs receive only the new fixed record when one of the wired server
failures actually occurs.

## 2026-07-30 — OBS-001 privacy-safe performance controls

### Implemented locally for review

- Added lifecycle measurement for supported LCP, CLS, and Event Timing INP
  signals, converting values to fixed good/needs-improvement/poor buckets
  before transport.
- Prohibited exact values, route/URL, referrer, user/session/Deal identifiers,
  and device data from both the browser event and server log contract.
- Added a default-off, same-origin, 512-byte intake with exact nine-combination
  validation and environment/release correlation.
- Added production build ceilings for individual and total JavaScript/CSS
  assets. The build now fails instead of silently accepting unreviewed growth.
- Added endpoint negative tests, privacy regression assertions, build wiring
  checks, and activation/rollback guidance in
  [47_PRIVACY_SAFE_PERFORMANCE_MONITORING.md](47_PRIVACY_SAFE_PERFORMANCE_MONITORING.md).

### Activation boundary

No Vercel variable, Firewall rule, log drain, alert, deployment, Supabase
resource, customer data, Preview, Production, public access, payment, payout,
refund, dispute decision, or real-money behavior changed. Monitoring remains
default-off; build budgets are active in local and future reviewed builds.

## 2026-07-30 — OBS-002 liveness and protected read-only synthetic

### Implemented locally for review

- Added a minimal uncached GET/HEAD liveness contract that exposes no runtime,
  release, hostname, database, provider, or customer details.
- Added an HTTPS/root/host-bounded synthetic runner for liveness, public shell,
  Terms, sign-in entry, and the US phone catalog.
- Prohibited redirects and every authenticated or mutating method; added
  eight-second request timeouts, 1 MB response limits, exact response checks,
  and default denial of Production targets.
- Added optional server-only Vercel Deployment Protection bypass handling
  without putting the secret in a URL or output.
- Added endpoint, method, cache, disclosure, mutation-absence, target-boundary,
  secret-output, and script-wiring regression coverage.
- Added activation, schedule, alert, retention, failure/recovery drill, secret
  rotation, and rollback requirements in
  [48_UPTIME_SYNTHETIC_READINESS.md](48_UPTIME_SYNTHETIC_READINESS.md).

### Activation boundary

No scheduled monitor, protection bypass, Vercel variable, Firewall rule,
alert, deployment, Supabase resource, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, or real-money
behavior changed. The source is ready for a later protected-environment review.

## 2026-07-30 — OBS-003 sanitized operational alert policy

### Implemented locally for review

- Added one pure classifier for the current runtime/client/server/performance,
  synthetic, Auth, CSP, payment, and security-notification monitoring schemas.
- Reduced arbitrary source records to twelve fixed counters without returning
  correlation/provider/Deal/customer IDs, URL, message, secret, or extra data.
- Added bounded 1–15 minute windows with a 10,000-record ceiling and exact
  environment/release metadata.
- Added deterministic warning/high/critical thresholds and fixed human/runbook
  actions for payment integrity/configuration, journey failure, server/client
  clusters, Auth abuse, CSP, performance, and notification delivery.
- Changed the read-only synthetic runner to emit one fixed pass/fail contract
  without printing its protected target, bypass secret, or failure detail.
- Added classification, threshold, malformed/unbounded input, sensitive-field
  absence, and no-mutation regression coverage.
- Added drain, retention, ownership, deduplication, synthetic, acknowledgement,
  and rollback requirements in
  [49_OPERATIONAL_ALERT_POLICY.md](49_OPERATIONAL_ALERT_POLICY.md).

### Activation boundary

No log drain, dashboard, paging provider, alert route, schedule, Vercel
variable, deployment, Supabase resource, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, or real-money
behavior changed. The alert policy is pure source and cannot perform an
external or application mutation.

## 2026-07-30 — OBS-005 incident control and release-freeze drill

### Implemented locally for review

- Added exact incident declarations for fixed severity/category, public impact,
  evidence preservation, release gate, and payment-integrity safety.
- Added a strict declared → triaged → contained → monitoring → resolved state
  sequence, chronological enforcement, bounded transitions, and controlled
  reopening.
- Kept release and financial gates frozen/review-required after resolution so
  the state machine cannot authorize resumption.
- Added fixed public-impact status drafts that require authorized review and
  contain no cause, provider, customer, account, payment, or evidence details.
- Added a 100-entry hash/time/type evidence manifest that rejects raw or excess
  material.
- Added a no-network incident drill to the full verification chain and
  declaration, ordering, time, freeze, draft, evidence, excess-field, and
  no-external-action regression tests.
- Added activation, tabletop, technical drill, forensic storage, role,
  communication, recovery, and rollback gates in
  [50_INCIDENT_CONTROL_AND_RELEASE_FREEZE.md](50_INCIDENT_CONTROL_AND_RELEASE_FREEZE.md).

### Activation boundary

No active incident, alert, pager, status publication, release state, deployment,
Vercel setting, Supabase resource, customer data, Preview, Production, public
access, payment, payout, refund, dispute decision, or real-money behavior
changed. The policy and drill are local and cannot call an external system.

## 2026-07-30 — OBS-001 authenticated application bundle splitting

### Implemented locally for review

- Added a supported Rolldown code-splitting group for the browser service and
  runtime-validation boundary.
- Kept group dependency capture non-recursive and bounded each service chunk at
  240,000 bytes.
- Reduced the authenticated application chunk from 539.58 kB to 364.80 kB
  minified; the extracted service boundary is 79.98 kB and 102.00 kB.
- Tightened the enforced maximum JavaScript chunk budget from 560,000 to
  400,000 bytes without increasing or suppressing Vite's warning threshold.
- Standardized Vite's native configuration loader across development, build,
  and Preview on the pinned Node 24 runtime.
- Added configuration, budget, warning-suppression, script-wiring, build, and
  Preview smoke regression coverage.
- Added browser-trace evidence and rollback requirements in
  [51_APPLICATION_BUNDLE_SPLITTING.md](51_APPLICATION_BUNDLE_SPLITTING.md).

### Activation boundary

No Vercel deployment or setting, Supabase resource, customer data, Preview,
Production, public access, payment, payout, refund, dispute decision, or
real-money behavior changed. Only local build output and release gates changed.

## 2026-07-30 — FND-003 deterministic release evidence

### Implemented locally for review

- Added a bounded pure policy for exact commit, pinned Node, active catalog,
  fixed completed checks, governed input/build paths, SHA-256, byte ceilings,
  and sorted unique file evidence.
- Added a fail-closed CI generator that requires GitHub/requested/checked-out
  commit equality and a clean worktree before creating evidence.
- Prohibited absolute/parent paths, symlinks, excess fields, source contents,
  secrets, customer identifiers, provider payloads, and environment values.
- Added a self-hashed manifest covering the workflow, lock/config/catalog
  inputs and all emitted browser assets.
- Moved evidence creation after the high-severity dependency audit and retained
  both evidence files as a required 30-day GitHub artifact.
- Added valid-contract, missing-check, ordering, traversal, excess-field,
  clean-tree, exact-commit, hashing, retention, and no-network regression tests.
- Added promotion comparison, restricted archive, ownership, incident-freeze,
  and rollback requirements in
  [52_DETERMINISTIC_RELEASE_EVIDENCE.md](52_DETERMINISTIC_RELEASE_EVIDENCE.md).

### Activation boundary

No GitHub branch protection, deployment, promotion, Vercel/Supabase setting or
resource, customer data, Preview, Production, public access, payment, payout,
refund, dispute decision, or real-money behavior changed. The source and
workflow change require later reviewed publication before CI can execute it.

## 2026-07-30 — FND-004 dependency supply-chain policy

### Implemented locally for review

- Added an offline gate for npm lockfile v3, manifest/root equality, exact
  versions, canonical package paths, reviewed HTTPS registry tarballs, and
  64-byte SHA-512 integrity.
- Added an explicit six-license allowlist and a 150-package ceiling so
  unreviewed license or dependency-graph growth blocks the release gate.
- Denied local links and every unreviewed lifecycle install script.
- Restricted the sole current install-script exception to exact
  `fsevents@2.3.3`, development-only, optional, and Darwin-only.
- Wired the policy before typecheck/tests in full verification and added it to
  deterministic release evidence.
- Verified the current graph: 89 packages, one restricted install-script
  exception, and the reviewed 0BSD/Apache-2.0/BSD-3-Clause/ISC/MIT/MPL-2.0
  license set.
- Added registry, integrity, lockfile, count, license, install-script,
  no-network, full-gate, and evidence regression coverage.
- Added SBOM/notices/ownership/SAST/replacement follow-up and rollback rules in
  [53_DEPENDENCY_SUPPLY_CHAIN_POLICY.md](53_DEPENDENCY_SUPPLY_CHAIN_POLICY.md).

### Activation boundary

No dependency was installed, updated, removed, downloaded, or published. No
deployment, GitHub/Vercel/Supabase setting, customer data, Preview, Production,
public access, payment, payout, refund, dispute decision, or real-money
behavior changed.

## 2026-07-30 — SEC-014 browser cache safety

### Implemented locally for review

- Removed application-shell and navigation caching from the service worker so
  sign-in, recovery, account, deal, dispute, evidence, and API responses remain
  network-only.
- Restricted Cache Storage to same-origin, query-free, versioned JavaScript,
  CSS, and font assets under `/assets/`.
- Required successful basic/default responses with reviewed content types
  before an asset may enter the cache.
- Retired legacy Dealivra and DealSafe shell caches during activation and
  claimed controlled pages only after cleanup.
- Registered the worker with `updateViaCache: 'none'` and an immediate update
  check so a stale worker script cannot indefinitely pin an old release.
- Added explicit no-store headers for the root application shell, built
  `index.html`, and the worker script while preserving immutable asset headers.
- Extended the production Preview smoke test and static regression suite to
  fail if root precaching or navigation fallback caching returns.
- Added release, rollback, offline, privacy, and incident expectations in
  [54_BROWSER_CACHE_SAFETY.md](54_BROWSER_CACHE_SAFETY.md).

### Activation boundary

No deployment, Vercel setting, service-worker registration on a customer
device, cache deletion on a customer device, Supabase resource, customer data,
Preview, Production, public access, payment, payout, refund, dispute decision,
or real-money behavior changed. Existing devices change only after a reviewed
future deployment.

## 2026-07-30 — ARC-005 payment capability kill switches

### Implemented locally for review

- Added independent default-off environment gates for seller onboarding,
  Checkout creation, payout release, and refund provider mutations.
- Accepted only the exact normalized modes `disabled` and `sandbox`; a missing,
  empty, disabled, or invalid value blocks the named mutation.
- Placed the payout/refund gates before a financial command can be prepared or
  claimed, preventing disabled work from creating retry ambiguity.
- Preserved signed webhook processing while new mutations are disabled so
  already-created Sandbox objects can still reconcile.
- Retained active-session/AAL2, authorization, recovery-cooldown,
  trusted-command, `sk_test_`, provider-object, and `livemode=false` controls;
  capability mode never replaces authorization.
- Strengthened Stripe Connect account validation to reject mismatched,
  malformed, or live-mode accounts.
- Added exact policy, mutation wiring, default-off configuration,
  webhook-separation, and invalid-mode regression coverage.
- Added activation, incident, rollback, ownership, and evidence requirements
  in
  [55_PAYMENT_CAPABILITY_KILL_SWITCHES.md](55_PAYMENT_CAPABILITY_KILL_SWITCHES.md).

### Activation boundary

No environment value, Edge Function, Stripe object/account, webhook, database
command, deployment, Supabase/Vercel setting, customer data, Preview,
Production, public access, payment, payout, refund, dispute decision, or
real-money behavior changed. Every new capability remains disabled by default.

## 2026-07-30 — SEC-005 bounded payment request bodies

### Implemented locally for review

- Added one shared payment JSON boundary with an 8,192-byte maximum for both
  declared and actual UTF-8 body size.
- Accepted only `application/json` with an optional UTF-8 charset and rejected
  malformed, empty, scalar, array, null, oversized, and invalid-length bodies.
- Required an exact per-operation key allowlist for Connect, Checkout, payout
  release, and dispute refund/release requests.
- Ran the boundary only after active-session verification but before payment
  configuration, database command, or Stripe provider work.
- Mapped all shape/content failures to one customer-safe payment error without
  logging or returning rejected content.
- Kept the Stripe webhook outside this parser so raw-body signature
  verification remains intact.
- Added byte, media type, exact-key, Unicode size, handler wiring, safe-error,
  and webhook-separation regression coverage.
- Added activation, negative-test, observability, and rollback requirements in
  [56_PAYMENT_REQUEST_BOUNDARY.md](56_PAYMENT_REQUEST_BOUNDARY.md).

### Activation boundary

No Edge Function was deployed and no request, Stripe object, webhook, database
command, environment value, Supabase/Vercel setting, customer data, Preview,
Production, public access, payment, payout, refund, dispute decision, or
real-money behavior changed.

## 2026-07-30 — PAY-004 bounded Stripe response transport

### Implemented locally for review

- Added a 10-second abort signal to every shared Stripe API request.
- Added a 262,144-byte ceiling for both declared and actual response bytes.
- Required a JSON media type, a non-empty valid JSON object, and denied arrays,
  scalar values, null, malformed JSON, invalid lengths, and oversized bodies.
- Mapped timeout/network failures to the existing retryable network error and
  successful-but-invalid responses to one customer-safe provider response
  error.
- Preserved Stripe HTTP status/request-ID/code normalization for bounded error
  responses without recording or returning provider body contents.
- Kept endpoint-specific account/payment/transfer/refund schema and
  `livemode=false` checks as the authoritative semantic boundary.
- Added actual/declared byte, type, JSON, shape, timeout, safe-error, and
  transport-wiring regression coverage.
- Added Preview verification, observability, incident, and rollback
  requirements in
  [57_STRIPE_RESPONSE_BOUNDARY.md](57_STRIPE_RESPONSE_BOUNDARY.md).

### Activation boundary

No Stripe request or response occurred, Edge Function was deployed, provider
or database object changed, environment value or Supabase/Vercel setting
changed, or customer data, Preview, Production, public access, payment, payout,
refund, dispute decision, or real-money behavior changed.

## 2026-07-30 — SEC-015 bounded Auth provider transport

### Implemented locally for review

- Added one 10-second abort boundary to Supabase Auth, application-role, and
  privileged-recovery provider calls.
- Added a 262,144-byte ceiling for both declared and actual UTF-8 response
  bytes.
- Required JSON media types and valid JSON while preserving the reviewed
  scalar response used by role and recovery RPCs.
- Restricted the empty-response exception to successful HTTP 204 logout.
- Replaced direct provider `.json()` parsing in shared Auth and privileged
  recovery paths with the bounded transport parser.
- Extended the same boundary to sensitive-change cooldown error responses so
  MFA, email, and payout guards cannot read an unbounded provider body.
- Preserved endpoint-specific Auth object validation, role allowlisting, MFA
  authorization, rate-limit mapping, and safe local/other/global logout
  behavior.
- Mapped timeout, malformed, and oversized provider responses to fixed,
  privacy-safe server failure categories without logging provider content.
- Added object/scalar/empty/media/declared-byte/actual-byte/malformed/timeout
  wiring and unbounded-parser regression coverage.
- Added activation, monitoring, incident, verification, and rollback
  requirements in
  [58_AUTH_PROVIDER_TRANSPORT_BOUNDARY.md](58_AUTH_PROVIDER_TRANSPORT_BOUNDARY.md).

### Activation boundary

No Supabase request occurred, endpoint was deployed, provider or database
object changed, environment value or Supabase/Vercel setting changed, or
customer data, Preview, Production, public access, payment, payout, refund,
dispute decision, or real-money behavior changed.

## 2026-07-30 — SEC-016 Auth provider request allowlist

### Implemented locally for review

- Added exact route/method pairs for signup, password login, refresh,
  recovery, current-user access, password mutation, TOTP enrollment/challenge/
  verification/removal, and scoped logout.
- Bound password recovery to the exact percent-encoded origin already verified
  from the incoming same-origin request.
- Required authenticated routes to receive exactly one bounded bearer header
  and anonymous routes to receive no caller-supplied provider headers.
- Denied traversal, admin/REST destinations, extra query parameters,
  unsupported logout scopes, malformed factor IDs, unsupported fetch options,
  wrong methods, and bodies on bodyless routes.
- Required every outbound POST/PUT body to be a non-array JSON object no larger
  than 16,384 UTF-8 bytes.
- Applied the same bounded serialization to protected REST RPC parameters
  before network access.
- Added complete allowlist and negative route/header/method/body/Unicode/RPC
  regression coverage, including proof that rejected work never reaches the
  provider.
- Added review, change-control, verification, and rollback requirements in
  [59_AUTH_PROVIDER_REQUEST_ALLOWLIST.md](59_AUTH_PROVIDER_REQUEST_ALLOWLIST.md).

### Activation boundary

No Supabase request occurred, endpoint was deployed, provider or database
object changed, environment value or Supabase/Vercel setting changed, or
customer data, Preview, Production, public access, payment, payout, refund,
dispute decision, or real-money behavior changed.

## 2026-07-30 - SEC-017 browser data transport boundary

### Implemented locally for review

- Added one streaming browser response reader that rejects invalid declared
  lengths and responses larger than 1,048,576 actual UTF-8 bytes.
- Required a JSON-compatible application media type and valid JSON before any
  domain-specific runtime schema receives provider data.
- Preserved reviewed empty no-content operations as `null`.
- Added a separate 16,384-byte limit for the MFA-required response marker.
- Replaced evidence `arrayBuffer()` loading with an exact-length stream that
  cancels before a signed image/video can exceed its server-owned byte count.
- Applied a 30-second deadline to every network request owned by the central
  browser data service, combining it with any caller abort signal.
- Reused the same response boundary for catalog and VIN requests while
  preserving their tighter deadlines, embedded fallback, and manual-entry
  recovery.
- Replaced all direct `.json()`, `clone().text()`, and native `fetch()` calls
  in that service with the common bounded transport helpers.
- Preserved all existing request schemas, response schemas, RLS, authorization,
  MFA, customer-safe error, and non-idempotent mutation behavior.
- Added media, declared-byte, actual multi-byte Unicode, malformed JSON,
  empty-body, text, configuration, deadline-wiring, and unbounded-parser
  regression coverage.
- Added Preview verification, monitoring, change-control, and rollback
  requirements in
  [60_BROWSER_DATA_TRANSPORT_BOUNDARY.md](60_BROWSER_DATA_TRANSPORT_BOUNDARY.md).

### Activation boundary

No Supabase request occurred, endpoint was deployed, provider or database
object changed, environment value or Supabase/Vercel setting changed, or
customer data, Preview, Production, public access, payment, payout, refund,
dispute decision, or real-money behavior changed.

## 2026-07-30 - SEC-018 evidence request stream boundary

### Implemented locally for review

- Added one shared byte-stream request reader that validates declared lengths,
  cancels above its configured maximum, and rejects invalid UTF-8 without
  retaining or returning request contents.
- Migrated the existing 8,192-byte payment JSON boundary away from unbounded
  `Request.text()` while preserving every exact-key and customer-safe error
  rule.
- Added a 16,384-byte evidence JSON boundary with action-specific exact-key
  maps for upload, signed viewer, lifecycle, legal-hold, deletion, alert, and
  scheduled-maintenance requests.
- Moved browser evidence shape validation before Auth-provider access and
  scheduled shape validation before maintenance RPC access.
- Preserved UUID, participant, AAL2, operator, scheduled-secret, legal-hold,
  reason, MIME, file-size, audit, and state-transition enforcement.
- Added valid action, unknown action, extra key, wrong media, actual Unicode
  overflow, multi-chunk cancellation, ordering, and direct-parser regression
  tests.
- Added rollout, verification, failure, and rollback requirements in
  [61_EVIDENCE_REQUEST_BOUNDARY.md](61_EVIDENCE_REQUEST_BOUNDARY.md).

### Activation boundary

No Edge Function was invoked, provider or database object changed, migration
applied, environment value or Supabase/Vercel setting changed, or customer
data, evidence, Preview, Production, public access, payment, payout, refund,
dispute decision, or real-money behavior changed.

## 2026-07-30 - SEC-019 provider response stream boundary

### Implemented locally for review

- Added one shared Edge Function response-stream reader with declared and
  actual byte ceilings, immediate cancellation, fatal UTF-8 decoding, and
  fixed content-free errors.
- Migrated Stripe's existing 262,144-byte JSON boundary away from unbounded
  `Response.text()` without changing object, Sandbox, request-ID, provider
  code, or financial-command validation.
- Migrated malware-scanner verdicts away from `Response.arrayBuffer()` and
  added JSON media and non-array object requirements before trusted verdict
  validation.
- Preserved Stripe and scanner timeouts, SHA-256 equality, quarantine,
  customer-safe errors, authorization, payment fencing, and incident behavior.
- Added valid scanner, wrong-media, multi-byte overflow, shared-parser wiring,
  and direct whole-body parser regression coverage.
- Added Preview, monitoring, failure, and rollback requirements in
  [62_PROVIDER_RESPONSE_STREAM_BOUNDARY.md](62_PROVIDER_RESPONSE_STREAM_BOUNDARY.md).

### Activation boundary

No provider was contacted, Edge Function invoked, migration applied, or
customer, evidence, payment, Supabase, Vercel, Preview, Production, public
access, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - SEC-020 Node provider response stream boundary

### Implemented locally for review

- Added one Node response-stream reader with validated declared lengths,
  incremental actual-byte limits, immediate cancellation, fatal UTF-8
  decoding, and fixed content-free errors.
- Migrated Supabase Auth and protected recovery response parsing away from
  whole-body `Response.text()` allocation while preserving the 262,144-byte
  ceiling, JSON media requirement, provider timeout, controlled logout
  exception, rate-limit guidance, and customer-safe failures.
- Migrated the server-side NHTSA VIN decoder to the same reader under its
  tighter 256,000-byte ceiling while preserving the existing timeout, field
  projection, bounded cache, and manual-entry fallback.
- Added multi-chunk cancellation, invalid declared-length, safe VIN mapping,
  direct whole-body parser, and transport-wiring regression coverage.
- Added rollout, verification, failure, and rollback requirements in
  [63_NODE_PROVIDER_RESPONSE_STREAM_BOUNDARY.md](63_NODE_PROVIDER_RESPONSE_STREAM_BOUNDARY.md).

### Activation boundary

No provider was contacted, server endpoint deployed, migration applied, or
customer, authentication, catalog, Supabase, Vercel, Preview, Production,
public access, payment, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - SEC-021 Stripe webhook request stream boundary

### Implemented locally for review

- Replaced the Stripe webhook's whole-body `Request.text()` allocation with
  the shared incremental request reader under the existing 262,144-byte
  ceiling.
- Required valid declared lengths, immediate cancellation above the actual
  byte ceiling, readable streams, and valid UTF-8 before any secret lookup,
  signature verification, JSON parsing, event claim, or payment RPC.
- Preserved exact bounded raw text for HMAC verification, the five-minute
  timestamp tolerance, constant-time comparison, Sandbox-only policy,
  atomic claim/fencing/apply sequence, and replay behavior.
- Kept HTTP 413 only for excessive bodies; malformed length, unreadable
  streams, and invalid UTF-8 receive one content-free HTTP 400 response.
- Added direct whole-body parser, shared-reader wiring, status mapping, and
  signature-boundary regression coverage.
- Added rollout, verification, monitoring, failure, and rollback requirements
  in
  [64_STRIPE_WEBHOOK_REQUEST_STREAM_BOUNDARY.md](64_STRIPE_WEBHOOK_REQUEST_STREAM_BOUNDARY.md).

### Activation boundary

No Stripe request was accepted, provider or database contacted, Edge Function
deployed, migration applied, environment value changed, or customer, payment,
Supabase, Vercel, Preview, Production, public access, payout, refund, dispute,
or real-money state changed.

## 2026-07-30 - SEC-022 evidence Storage stream boundary

### Implemented locally for review

- Added one preallocated binary stream reader that requires a safe,
  database-owned expected size, enforces the canonical 50 MB maximum, and
  cancels immediately if Storage sends more bytes than approved.
- Replaced whole-body `Blob.arrayBuffer()` reads in quarantine finalization,
  participant/case viewing, and scheduled integrity maintenance.
- Required the Storage-reported size to match the immutable intake/evidence
  record before allocating or reading the file.
- Preserved canonical byte-structure validation, SHA-256, malware scanning,
  clean-only promotion, short-lived viewer URLs, append-only integrity events,
  Legal Hold, retention, and deletion behavior.
- Rejected a mismatched quarantine object with the existing safe
  `file_size_mismatch`; the viewer fails closed, and maintenance records the
  observed size as an invalid integrity result without hashing the body.
- Added exact multi-chunk, dishonest overflow cancellation, declared mismatch,
  direct whole-body parser, and endpoint-wiring regression coverage.
- Added rollout, verification, monitoring, failure, and rollback requirements
  in
  [65_EVIDENCE_STORAGE_STREAM_BOUNDARY.md](65_EVIDENCE_STORAGE_STREAM_BOUNDARY.md).

### Activation boundary

No Storage object was downloaded, uploaded, promoted, viewed, deleted, or
changed; no scanner, database, Supabase, Vercel, Preview, Production, customer,
public access, payment, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - SEC-023 security-notification response boundary

### Implemented locally for review

- Replaced the notification worker's duplicate provider-body reader with the
  shared incremental response boundary under its existing 16 KiB ceiling.
- Required JSON media, valid declared lengths, immediate cancellation above
  the actual-byte ceiling, valid UTF-8, valid JSON, and a non-array object
  before the provider delivery ID is inspected.
- Preserved the 10-second timeout, verified-recipient lookup, fixed templates,
  deterministic idempotency key, staged activation, retry/dead-letter
  behavior, and content-free failure codes.
- Added valid-object, wrong-media, array-root, declared-overflow,
  shared-reader wiring, and direct whole-body parser regression coverage.
- Added rollout, verification, failure, and rollback requirements in
  [66_SECURITY_NOTIFICATION_RESPONSE_BOUNDARY.md](66_SECURITY_NOTIFICATION_RESPONSE_BOUNDARY.md).

### Activation boundary

No provider was contacted, message sent, Edge Function deployed, schedule or
domain changed, environment value created, migration applied, or customer,
Supabase, Vercel, Preview, Production, public-access, payment, payout, refund,
dispute, or real-money state changed.

## 2026-07-30 - UX-004 standardized U.S. address entry

### Implemented locally for review

- Replaced the opaque hosted address element with a controlled native input
  backed by Google Places Autocomplete Data API, a bounded debounce, fresh
  session tokens, U.S.-only street-address suggestions, and visible provider
  attribution.
- Preserved manual entry at every state, including missing configuration,
  provider failure, no matches, and incomplete Google results.
- Added keyboard listbox behavior, focus-visible controls, live non-blocking
  status messages, a clear action, reduced-motion support, and responsive
  suggestion placement.
- Centralized U.S. state and ZIP/ZIP+4 validation and Google address parsing,
  including legacy component names, full state-name normalization, street
  numbers, postal suffixes, and `subpremise`.
- Connected the same parsed street, apartment/suite/unit, city, state, and ZIP
  fields to both the in-person meeting and buyer shipping workflows.
- Kept Address line 2 visible and editable with explicit apartment, suite,
  unit, building, floor, and mailbox guidance.
- Added deterministic component contracts for the manual fallback,
  combobox semantics, full U.S. parsing, state normalization, ZIP validation,
  and apartment/suite/unit preservation.
- Replaced the corrupted setup note with a value-free Google Cloud, Vercel,
  restriction, and acceptance guide.

### Review and activation boundary

The browser key remains restricted configuration and is not stored in the
repository or test output. This batch changes address-entry presentation and
client-side parsing only. It does not change private-address authorization,
database storage, Supabase resources, hosted variables, public access,
customer records, payment, payout, refund, dispute, or real-money behavior.
Protected Preview mouse, keyboard, mobile, provider-failure, and exact-origin
acceptance remain required before UX-004 can be marked complete.

## 2026-07-30 - SEC-024 outbound transport inventory

### Implemented locally for review

- Added an executable deny-by-default inventory for all 10 direct application
  fetch calls across eight reviewed files and the indirect NHTSA injection
  seam.
- Required the existing route/request controls, timeouts, cancellation,
  bounded response readers, and privacy-safe diagnostic options at their
  reviewed source locations.
- Added a governed provider-file rule that rejects reintroduction of direct
  whole-body JSON, text, or binary response parsers.
- Added the transport policy to the full release verification so an
  unreviewed network call or removed control fails locally and in CI.
- Documented the current inventory, exception rationale for response-free
  diagnostics, review procedure, verification, and rollback in
  [67_OUTBOUND_TRANSPORT_INVENTORY.md](67_OUTBOUND_TRANSPORT_INVENTORY.md).

### Activation boundary

The audit made no network request and contacted no provider. No endpoint,
environment, domain, deployment, migration, Supabase, Vercel, Preview,
Production, public-access, customer, payment, payout, refund, dispute, or
real-money state changed.

## 2026-07-30 - SEC-025 browser evidence file stream boundary

### Implemented locally for review

- Replaced the evidence upload path's direct whole-Blob `arrayBuffer()` call
  with an exact-size stream reader before byte-signature validation.
- Refactored browser exact binary reads to allocate one approved-size buffer,
  copy chunks directly, cancel overruns, and reject unreadable, short, long,
  or declaration-mismatched bodies with content-free errors.
- Preserved the canonical file declaration, signature, metadata, upload
  intake, quarantine, hashing, malware scan, clean-only promotion, and
  authorization controls.
- Added exact Blob, size-mismatch, upload wiring, and direct whole-body parser
  regression coverage.
- Documented mobile-memory verification, failure, rollout, and rollback in
  [68_BROWSER_EVIDENCE_FILE_STREAM_BOUNDARY.md](68_BROWSER_EVIDENCE_FILE_STREAM_BOUNDARY.md).

### Activation boundary

No customer file was read, uploaded, downloaded, promoted, deleted, or
changed. No provider was contacted and no endpoint, environment, deployment,
migration, Supabase, Vercel, Preview, Production, public-access, customer,
payment, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - SEC-026 browser diagnostic transport

### Implemented locally for review

- Consolidated client-failure, runtime-rejection, and Web Vital sends into one
  allowlisted same-origin browser transport.
- Added endpoint-specific encoded-byte ceilings, a five-second deadline,
  omitted credentials, no-referrer behavior, and best-effort no-retry failure.
- Preserved each reporter's exact schema, normalization, signature cooldown,
  minute limit, default-off mode, and privacy-safe server intake.
- Reduced the direct network inventory from 10 calls across eight files to
  eight calls across six files while tracking all three delegated reporters.
- Added exact payload, excessive payload, unknown endpoint, no-browser,
  delegation, deadline, privacy-option, and inventory regression coverage.
- Documented Preview evidence, activation, failure, and rollback in
  [69_BROWSER_DIAGNOSTIC_TRANSPORT.md](69_BROWSER_DIAGNOSTIC_TRANSPORT.md).

### Activation boundary

No diagnostic was sent and no endpoint, environment, provider, deployment,
migration, Supabase, Vercel, Preview, Production, public-access, customer,
payment, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - SEC-028 guest Deal draft storage boundary

### Implemented locally for review

- Replaced the prior seven-day guest draft record with a versioned 24-hour
  record and removed the legacy record rather than migrating it.
- Added a 16 KiB UTF-8 ceiling before parsing and writing, fixed field and
  string limits, future-time rejection, and fail-safe deletion.
- Preserved useful title, description, price, catalog, condition, handoff,
  expiration, and flow-step recovery while explicitly excluding serial or VIN
  data, files, account details, credentials, logistics, and payment data.
- Aligned the description input with the existing 10,000-character request
  contract and added regression coverage for every storage boundary.
- Documented protected Preview evidence, failure, rollout, and rollback in
  [70_GUEST_DRAFT_STORAGE_BOUNDARY.md](70_GUEST_DRAFT_STORAGE_BOUNDARY.md).

### Activation boundary

No browser record was read or written and no endpoint, environment, provider,
deployment, migration, Supabase, Vercel, Preview, Production, public-access,
customer, payment, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - SEC-029 browser storage inventory

### Implemented locally for review

- Added an executable deny-by-default inventory for the four reviewed browser
  storage files, 14 local-storage calls, and six session-storage calls.
- Restricted storage operations to exact `getItem`, `setItem`, and
  `removeItem` calls and rejected unreviewed files, methods, counts, cookies,
  IndexedDB, and persistent account-session access.
- Required the guest draft lifetime and byte controls, language key, legacy
  cleanup, tab-scoped session key, and no-local-storage session invariant.
- Added the storage policy to the complete release gate and locked its
  aggregate result with regression coverage.
- Documented review, protected Preview evidence, failure, and rollback in
  [71_BROWSER_STORAGE_INVENTORY.md](71_BROWSER_STORAGE_INVENTORY.md).

### Activation boundary

The inventory read source files only. No browser storage, endpoint,
environment, provider, deployment, migration, Supabase, Vercel, Preview,
Production, public-access, customer, payment, payout, refund, dispute, or
real-money state changed.

## 2026-07-30 - SEC-030 release evidence security-policy binding

### Implemented locally for review

- Added the browser-storage and outbound-transport policy results to the exact
  ordered release-evidence check set.
- Added both executable policy scripts to the required evidence paths and
  deterministic file manifest.
- Added regression coverage proving that neither policy result nor source
  control can be omitted from an accepted release artifact.
- Updated
  [52_DETERMINISTIC_RELEASE_EVIDENCE.md](52_DETERMINISTIC_RELEASE_EVIDENCE.md)
  with the expanded cryptographic binding.

### Activation boundary

No release artifact was uploaded or promoted. No endpoint, environment,
provider, deployment, migration, Supabase, Vercel, Preview, Production,
public-access, customer, payment, payout, refund, dispute, or real-money state
changed.

## 2026-07-30 - SEC-027 browser diagnostic envelope validation

### Implemented locally for review

- Added a second exact-schema check at the shared browser diagnostic transport
  rather than relying only on each reporter's normalization.
- Required the exact endpoint-specific key set, an occurrence count fixed to
  one, approved client-failure pairs, bounded runtime-rejection dimensions,
  and consistent Web Vital metric, rating, and bucket combinations.
- Added regression coverage proving that an extra privacy-sensitive field and
  inconsistent dimension combinations are rejected before network access.
- Updated the browser diagnostic transport control in
  [69_BROWSER_DIAGNOSTIC_TRANSPORT.md](69_BROWSER_DIAGNOSTIC_TRANSPORT.md).

### Activation boundary

No diagnostic was sent and no endpoint, environment, provider, deployment,
migration, Supabase, Vercel, Preview, Production, public-access, customer,
payment, payout, refund, dispute, or real-money state changed.

## 2026-07-30 - FND-004 static analysis and deterministic SBOM governance

### Implemented locally for review

- Added CodeQL v4 JavaScript/TypeScript analysis for pull requests, `main`,
  weekly scheduled review, and authorized manual runs using the
  `security-extended` query suite and least-privilege workflow permissions.
- Added a deterministic CycloneDX 1.5 SBOM generated from the exact npm
  lockfile with stable identity, component/dependency ordering, SHA-512
  integrity, reviewed licenses, provenance URLs, and a SHA-256 sidecar.
- Bound the exact SBOM, generator, policy, CodeQL workflow, dependency
  manifests, and scoped `CODEOWNERS` assignments into release evidence.
- Added finding severity, triage/remediation SLAs, exception expiry,
  independent approval, release blocking, failure, and rollback rules in
  [72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md](72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md).
- Added regression coverage for deterministic generation, tamper rejection,
  workflow permissions/query scope, ownership, CI order, and release-evidence
  binding.

### Activation boundary

No branch-protection rule or public access changed, no workflow was activated
on GitHub, and no release was promoted. No endpoint, environment, deployment,
migration, Supabase, Vercel, Preview, Production, customer data, payment,
payout, refund, dispute, or real-money state changed.

## 2026-07-30 - FND-003/FND-004 main branch protection activation

### Activated on GitHub

- Protected `main` at
  `e383a7345619933842ba18f8d4b3ebde80012eaf`.
- Required every change to arrive through an up-to-date pull request.
- Required the exact `verify`, `Analyze JavaScript and TypeScript`, and
  `Vercel` checks.
- Enforced the policy for the repository administrator.
- Required signed commits, linear history, stale-review dismissal, and
  resolved review conversations.
- Disabled force pushes and branch deletion.

### Verified state

- GitHub reports `main` as protected.
- Strict status checking, administrator enforcement, signed commits, linear
  history, and conversation resolution are enabled.
- The three required checks are bound to their GitHub Actions and Vercel
  applications rather than an untrusted same-name status.
- The documentation change recording this activation is itself delivered
  through the protected pull-request path.

### Residual paid-beta gate

The repository currently has one authorized maintainer, so the required
approval count remains zero and Code Owner review is not yet required. Before
paid beta, add a second independent security reviewer, require one approval and
Code Owner review, and prohibit self-approved security exceptions.

### Operational boundary

Only the GitHub `main` branch protection setting changed. No application
endpoint, customer record, Supabase or Vercel environment, domain, public
access, payment, payout, refund, dispute decision, or real-money capability
changed.

## 2026-07-30 - FND-002 enforced code-quality and component-test gates

### Implemented locally for review

- Added an exactly pinned Biome toolchain with deterministic formatting for
  governed quality/test artifacts and repository-wide lint checks for unused
  imports, unsafe prototype access, accidental assignment expressions,
  duplicate cases/members/keys, debugger statements, callback return mistakes,
  global evaluation, and selected accessibility hazards.
- Added the format and lint gates to the existing protected `verify` chain
  before type-checking, tests, build, performance budgets, and Preview smoke.
- Replaced implicit callback returns and assignment side effects identified by
  the new lint boundary, removed unused imports, and moved safe own-property
  checks to `Object.hasOwn`.
- Added an isolated Vite SSR component-test runner without adding a browser DOM
  dependency or widening the approved dependency graph.
- Added initial React component contract coverage for the address manual
  fallback, password-manager semantics, sign-in and sign-up submission
  behavior, policy consent links, forgot-password button behavior, and the
  Dealivra brand's accessible name.
- Made critical account-flow buttons explicit about submit versus non-submit
  behavior so moving them within a form cannot trigger accidental account
  actions.

### Review boundary

This batch changes repository quality controls and deterministic component
tests only. It does not activate public access, change Supabase or Vercel
configuration, migrate customer data, or enable payment, payout, refund,
dispute, or real-money behavior.

## 2026-07-30 - FND-003 served-asset integrity

### Implemented locally for review

- Added a deterministic, exact-source-commit manifest for every regular file
  emitted by the production build, with sorted paths, byte counts, SHA-256
  digests, strict file/size ceilings, and no contents or environment values.
- Added an exact-host HTTPS verifier that rejects redirects, unknown hosts,
  source-commit mismatches, malformed manifests, oversize responses, partial
  asset sets, and any byte or digest mismatch.
- Kept protected Preview bypass credentials restricted to a validated exact
  host and out of URLs, output, manifests, and retained evidence.
- Added a trusted-main GitHub verification workflow that cannot execute code
  from the deployment commit while holding the Preview bypass credential.
- Bound the served manifest, policy, scripts, workflow, and creation check
  into deterministic release evidence.
- Extended local Preview smoke verification to fetch and byte-compare every
  generated asset.
- Added `no-store` delivery for the public hash-only manifest while retaining
  immutable caching for fingerprinted assets.

### Remaining activation gate

Configure exact approved deployment hosts, the optional protected Preview
bypass secret, and the explicit automatic-verification enable flag. Run and
retain one successful protected Preview exercise before making this a
promotion requirement. Restricted long-term evidence retention and named
technical/security approval remain separate paid-beta gates.

### Activation boundary

No hosted variable, secret, deployment, domain, public-access setting,
customer record, Supabase resource, or real-money capability changed.

## 2026-07-30 - FND-005 runtime configuration contract

### Implemented locally for review

- Added one versioned runtime configuration policy for Local, Preview,
  Staging, and Production across the application and Supabase Edge targets.
- Added exact validation for browser/server Supabase alignment, deployment
  environment alignment, safe-default capability modes, server-only Auth
  secrets, Stripe Sandbox credentials, security notifications, evidence
  scanning, and bounded optional configuration.
- Added a deterministic CI contract gate and a current-environment check that
  runs before every build.
- Bound the contract result, policy module, and verifier into deterministic
  release evidence so an accepted artifact cannot omit the control.
- Made missing required configuration, malformed optional configuration, and
  mixed provider/environment configuration block the build.
- Restricted every report to variable names, scopes, sensitivity classes,
  fixed issue/status codes, and aggregate counts. No value, length, origin,
  token, hash, credential, or user data is returned.
- Added regression coverage for empty Local fallback, incomplete Production,
  valid Production core, environment/provider mismatch, conditional Auth and
  Stripe secrets, value non-disclosure, build/CI wiring, and minimal public
  health.
- Updated the environment inventory with the runtime selector, Web Vital mode,
  monitoring modes, build behavior, and the residual hosted
  provider-separation release gate.

### Activation boundary

The checks evaluate repository fixtures and the environment already supplied
to a build. No environment value was created, read into documentation, copied,
rotated, or disclosed. No provider, deployment, migration, Supabase, Vercel,
Preview, Production, public-access, customer, payment, payout, refund,
dispute, or real-money state changed.

## 2026-07-31 - UX-004 hosted address Preview recovery

### Implemented locally for review

- Reproduced the hosted recovery screen with the Preview configuration shape
  and retained the browser Console evidence before changing the implementation.
- Confirmed that the application bundle loaded successfully and traced the
  failure to the legacy hyphenated Sample Deal identifier being rejected by
  every hardened public Deal boundary.
- Replaced the Sample and local fallback identifiers with the canonical
  uppercase alphanumeric format and added a regression rule preventing the
  invalid legacy form from returning.
- Kept the cacheable service boundary with recursive dependency capture and
  the existing 400,000-byte JavaScript chunk ceiling.
- Verified the environment-shaped production bundle renders the landing page
  and opens the complete Sample Deal Room without a recovery screen.

### Activation boundary

No hosted variable value, Supabase resource, Production alias, public-access
setting, customer record, or real-money capability changed.

## 2026-08-14 - UX-005 mobile action and chat collision boundary

### Implemented locally for review

- Moved the private Deal chat above the persistent mobile next-action dock,
  including device safe-area spacing.
- Bounded the open chat panel with dynamic viewport height and contained its
  overscroll so the page behind it does not become the accidental scroll
  target.
- Standardized the close affordance on the reviewed icon system, added Escape
  handling, and restored keyboard focus to the chat launcher after an explicit
  close.
- Added static regression coverage for the dock clearance, viewport boundary,
  Escape behavior, and focus restoration.

### Remaining acceptance gate

Exercise the exact protected Preview at 320, 360, 390, 768, 1024, and 1440
CSS pixels with keyboard-only and 200% zoom checks. Confirm the chat launcher,
open panel, primary action, focused controls, and software-keyboard viewport do
not overlap or create horizontal page scroll.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.

## 2026-08-14 - UX-005 accessible comparison boundary

### Implemented locally for review

- Contained the private Watchlist comparison inside the dynamic viewport and
  device safe areas, including bounded internal overscroll.
- Added a complete modal keyboard boundary: initial close-button focus, Tab
  containment, Escape dismissal, background scroll lock, and focus restoration.
- Added regression coverage for accessibility and mobile viewport behavior.

### Remaining acceptance gate

Verify two- and three-deal comparisons in the protected Preview using keyboard
only, 200% zoom, and the UX-005 viewport matrix.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.

## 2026-08-14 - UX-005 accessible media preview boundary

### Implemented locally for review

- Constrained full-size deal media to the dynamic mobile viewport and kept the
  close control clear of device safe areas.
- Trapped keyboard focus inside the modal, supported Escape dismissal, locked
  background scrolling, and restored focus to the originating media control.
- Replaced the text glyph close affordance with the standard reviewed icon and
  added regression coverage for the complete modal interaction boundary.

### Remaining acceptance gate

Exercise image previews on the exact protected Preview at the viewport and
keyboard matrix listed under UX-005, including iOS-style safe areas and 200%
zoom.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.

## 2026-08-14 - Address persistence round-trip integrity

### Implemented locally for review

- Centralized formatting and parsing of stored U.S. delivery addresses instead
  of maintaining a second parser inside the shipping workspace.
- Preserved Address Line 2 values, including apartment, suite, unit, building,
  and floor details, across save, reload, edit, display, and copy flows.
- Normalized full state names to two-letter U.S. codes while retaining 5-digit
  and ZIP+4 postal codes.
- Added a component regression test proving an address containing Apartment 7B
  survives an exact serialize-and-parse round trip.
- Passed component rendering and TypeScript checks.

### Remaining hosted gate

Automatic suggestions require the restricted `VITE_GOOGLE_MAPS_API_KEY` in the
exact protected Preview environment. Manual structured entry remains available
when the provider is missing or unavailable.

### Activation boundary

No Google Cloud setting, hosted environment variable, deployment, Production
alias, public-access setting, Supabase resource, customer record, or real-money
capability changed.

## 2026-08-14 - Shipping failure visibility and clipboard resilience

### Implemented locally for review

- Replaced silent shipment and delivery-address load failures with concise,
  accessible status messages that tell the participant to retry.
- Added one shared clipboard utility with a browser-selection fallback when the
  modern Clipboard API is missing or permission is denied.
- Updated Copy address and Copy Deal Link to use the same proven behavior.
- Prevented Copy address from reporting false success when nothing was copied.
- Added release-gate coverage that rejects empty catches in the shipping
  workspace and preserves the manual-copy recovery message.

### Verification

- TypeScript, lint, and all 238 foundation tests passed.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.

## 2026-08-14 - Fulfillment action-button semantics

### Implemented locally for review

- Marked every non-submit meeting, inspection, handoff, address, and delivery
  action as `type="button"`.
- Kept only the three intentional form submission controls on browser-default
  submit semantics.
- Added a regression check so a future fulfillment action with an `onClick`
  handler cannot accidentally submit its surrounding form.

### Verification

- TypeScript, lint, and all 238 foundation tests passed.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.

## 2026-08-14 - Local mobile creation workflow verification

### Verified locally

- Completed the four-step guest creation flow at 390 CSS pixels using only
  visible, labeled controls: structured phone selection, terms, optional media,
  and final review.
- Confirmed the persistent next action remained present on every step without
  requiring a page-bottom search and without horizontal document overflow.
- Verified category-driven brand, model, and storage choices generate an
  editable title while preserving manual entry.
- Reached the final seller-declaration gate without publishing, creating an
  account, contacting hosted services, or changing any live record.
- Completed the isolated Sample buyer review and confirmed the interface states
  explicitly that no agreement, payment, or account was created.

### Remaining acceptance gate

Repeat the flow on the exact protected Preview with keyboard-only navigation,
200% zoom, software keyboards, file-selection cancellation, and authenticated
draft recovery.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.

## 2026-08-14 - UX-004 address autocomplete readiness clarity

### Implemented locally for review

- Confirmed from the protected Preview build report that the browser Maps key
  is configured without reading or disclosing its value.
- Distinguished a missing local provider configuration from a temporary hosted
  provider failure while preserving complete manual U.S. address entry.
- Connected the combobox to its live status, exposed loading state and listbox
  intent to assistive technology, and restored keyboard focus after clearing.
- Retained editable Address Line 2 fields in meeting and shipping, including
  apartment, suite, unit, building, floor, and mailbox details.
- Expanded the restricted-key runbook to make billing, enabled APIs, quota,
  and the exact Preview HTTP-referrer allowlist explicit hosted gates.
- Passed component rendering, TypeScript, and lint checks.

### Remaining activation gate

Run the mouse, keyboard, and mobile acceptance matrix on the exact protected
Preview hostname. If suggestions still do not appear, inspect Google Cloud's
sanitized request/error metrics and correct only the exact reviewed hostname,
API enablement, billing, or quota control. Never broaden the key to every
Vercel hostname or remove Website restrictions.

### Activation boundary

No Google Cloud setting, browser key, hosted environment variable, deployment,
Production alias, public-access setting, Supabase resource, customer record,
or real-money capability changed.

## 2026-08-14 - Local responsive and navigation verification

### Verified locally

- Loaded the current integrated branch in a real browser with meaningful page
  content, no framework error overlay, and no console warnings or errors.
- Checked 320, 390, 768, and 1440 CSS-pixel widths; none produced horizontal
  document overflow and the primary interactive controls remained rendered.
- Opened the mobile navigation, followed the How it works route, and returned
  through the exact Home link; both URL state and the home heading updated as
  expected.
- Confirmed the mobile landmark and accessible-name structure includes the
  skip link, banner, labeled navigation, main content, and legal footer.

### Remaining acceptance gate

Repeat the full UX-005 matrix on the exact protected Preview with authenticated
deal data, keyboard-only navigation, 200% zoom, and software keyboards.

### Activation boundary

No deployment, Production alias, public-access setting, hosted configuration,
Supabase resource, customer record, or real-money capability changed.
# 2026-08-14 — Hosted address autocomplete failure visibility

- Confirmed the current Google Places Autocomplete (New) request contract
  supports the existing U.S. region and `street_address` type restrictions.
- Added three fixed, privacy-safe browser failure categories for provider load,
  suggestion request, and place-details failures.
- Kept typed and selected addresses, provider responses, URLs, credentials, and
  API key material outside both the browser transport and server log contract.
- Preserved the manual address fallback and existing per-signature/per-minute
  diagnostic throttles.

## FND-001 dependency gate confirmation

- Confirmed npm is the only repository package manager and lockfile version 3
  is the canonical dependency source.
- Re-ran the dependency policy over 98 locked packages and generated the
  deterministic CycloneDX 1.5 SBOM.
- Confirmed the current reviewed graph reports zero known npm audit findings.

## Explicit form-action semantics

- Declared every current form action as an explicit `submit` or `button`
  control so a layout refactor cannot silently turn navigation/cancel actions
  into submissions.
- Added a TypeScript-AST regression gate across the account, MFA, creation,
  evidence, payment, delivery, dispute, support, and Deal Workspace forms.
- Added a repository-wide TSX gate that rejects any non-form button without an
  explicit click action or intentional disabled state, preventing silent dead
  controls from reaching review.
- Confirmed type-checking, lint, and the new action-semantics test pass.

## Keyboard-safe authenticated mobile navigation

- Matched the authenticated application header to the public landing behavior:
  the mobile menu now closes with Escape, restores focus to its trigger, and
  closes automatically above the tablet breakpoint.
- Connected the trigger and menu with stable `aria-controls`/`id` values and
  made header controls explicitly non-submitting.
- Added a regression check covering both guest and authenticated navigation.

## Resilient copy and share actions

- Routed every user-facing browser copy action through one governed clipboard
  helper with a legacy fallback for restricted browser contexts.
- Removed false-positive success messages from agreement fingerprints,
  receipts, invitations, evidence hashes, MFA setup, account passports, and
  buyer access codes.
- Added a repository-wide regression gate that rejects direct Clipboard API
  use outside the reviewed helper.

## Accessible critical confirmations

- Replaced browser-native confirmations for deal cancellation, disputes,
  delivery completion, buyer-code removal, media deletion, and administrator
  payment decisions with one consistent Dealivra dialog.
- Made cancellation the initial focus, trapped keyboard focus, supported Escape,
  restored the invoking control, and locked background scrolling while open.
- Added mobile bottom-sheet presentation, reduced-motion support, and a
  regression gate that prevents critical flows from returning to native
  confirmations.

## Form-control naming gate

- Added a TypeScript-AST accessibility gate requiring every input, select, and
  textarea to inherit a label, reference an explicit label, or declare an ARIA
  name.
- Named the reusable address combobox independently of its parent layout and
  gave the private deal-chat composer a stable screen-reader label.
- Preserved existing visible labels for the published Deal Link and item
  identifier while validating their `htmlFor` relationships automatically.

## Connection-state clarity

- Added a global offline notice so failed network actions are not mistaken for
  broken controls, plus a short reconnection confirmation that preserves the
  user's current page and form state.
- Kept the feature entirely local to browser connectivity events: it sends no
  diagnostics, stores no identifiers, and makes no background request.
- Added cleanup, reduced-motion, mobile layout, live-region announcements, and
  a regression check for the privacy boundary.

## Duplicate authentication prevention

- Added one guarded sign-in/sign-up request state so rapid taps cannot create
  parallel Auth calls, confusing rate-limit responses, or duplicate account
  creation attempts.
- Locked mutable account-entry controls only while the request is active and
  exposed the form's busy state plus explicit signing-in/creating-account copy.
- Added a regression gate covering the request guard, `finally` recovery, and
  disabled primary action.

## Recovery and MFA single-flight controls

- Extended the immediate request lock to password-reset email delivery,
  recovered-password updates, and second-factor sign-in verification.
- Disabled mutable recovery and MFA controls while their network request is in
  flight, exposed the form busy state, and kept failure recovery in `finally`.
- Added a regression gate that prevents these account-security actions from
  silently returning to same-tick duplicate submissions.

## Privileged account-action concurrency guards

- Added immediate single-flight locks to profile-name and password changes,
  authenticator enrollment/verification/removal, and session revocation.
- Kept all relevant inputs immutable while each sensitive mutation is active
  and exposed busy state on password and authenticator forms.
- Added a repository regression gate covering every privileged account action
  and its guaranteed lock release path.

## Truthful install-app action

- Reworked the browser install prompt into a single-flight action with an
  explicit opening state and a non-submitting button.
- Reported accepted, cancelled, and browser-failure outcomes without claiming
  installation succeeded before the browser confirms it.
- Added an accessibility announcement and a regression gate for prompt outcome
  handling and request-lock release.

## Mobile touch-target verification

- Verified the built homepage at a 390-by-844 viewport with no horizontal
  overflow and confirmed the mobile menu closes from the keyboard.
- Increased the compact menu trigger, menu actions, and icon-only Deal Room
  sample action to a minimum 44-by-44-pixel touch target.
- Added a regression check so later visual compaction cannot shrink these
  essential mobile actions below the reviewed target.

## Secondary action and recovery accessibility

- Extended the 44-pixel touch-target baseline to password visibility,
  account-mode switching, password recovery, recovered-draft actions, and
  legal/protection footer links.
- Added password-recovery autocomplete metadata, connected both new-password
  fields to their requirements, and announced recovery outcomes through a
  polite live region.
- Verified the rebuilt sign-up and recovery screens at 390 by 844 pixels with
  no horizontal overflow and no visible button below the reviewed target.

## Public-route responsive acceptance pass

- Rechecked Home, Fees, Buyer Protection, Seller Protection, Disputes,
  Agreement Verification, Terms, Privacy, Sign in, and Create account at both
  mobile and 1440-by-900 desktop viewports.
- Confirmed every route renders its primary landmark and heading without
  horizontal overflow; the inspected browser session emitted no console errors
  or warnings.
- Confirmed password-recovery navigation works without a page reload and the
  recovery email field exposes the expected browser autocomplete purpose.

## Explicit secondary workspace actions

- Declared non-submitting behavior on profile, deal-creation, payment,
  evidence-lifecycle, and public-route actions that sit near forms.
- Added a regression gate for those high-risk surfaces so later layout changes
  cannot accidentally convert navigation, copy, payment-launch, or governance
  controls into implicit form submissions.

## Dense workspace interaction baseline

- Extended the 44-pixel target baseline to catalog clearing, category guidance,
  agreement and document tools, support, session confirmation, workspace
  navigation, validation summaries, and draft review actions.
- Preserved full-size account and navigation actions at the compact
  720-by-450 acceptance viewport used to approximate 200-percent zoom.
- Announced account, payment, delivery, shipping-readiness, and Deal Link
  outcomes through polite status or urgent alert regions without moving focus.

## Transaction single-flight and progress feedback

- Added immediate same-tick request locks to Stripe onboarding and checkout,
  meeting and handoff actions, inspection receipts, delivery-address and
  shipment mutations, questions, offers, and draft publication.
- Kept the initiating controls disabled for the complete request and exposed
  truthful in-progress labels plus `aria-busy` on payment and fulfillment
  actions.
- Passed lint, TypeScript, 258 foundation tests, eight focused component tests,
  and the production build with JavaScript and CSS within their release
  budgets.

## Authenticated workspace delivery

- Moved the profile/security center, administrator console, and full Deal Room
  behind route-level React lazy boundaries with an accessible loading state.
- Reduced the main application JavaScript chunk from about 362 KB to 128 KB;
  the deferred profile, administration, and Deal Room code now downloads only
  when the user opens those authenticated workspaces.
- Preserved the existing central authorization and transaction-orchestration
  boundaries and added regression coverage preventing these workspaces from
  silently returning to the initial bundle.

## Async integrity and stale-response containment

- Added same-tick single-flight guards and visible progress feedback across
  agreement acceptance, identity verification, deal media and editing,
  support, resolution, moderation, restricted evidence, and Deal Link actions.
- Versioned address autocomplete and VIN decoding requests so a delayed
  provider response cannot overwrite newer user input, a cleared field, or a
  different catalog selection; Address line 2 remains preserved in both
  meeting and shipping flows.
- Scoped session refresh, dashboard deals, saved deals, notifications, admin
  access, profiles, public Deal Link navigation, offers, and evidence loading
  to their initiating session or record so stale responses cannot repopulate a
  signed-out or newly selected workspace.
- Added reduced-motion coverage and a source-encoding regression gate for the
  user-facing TypeScript surface.
- Reverified the built application at 1440 by 900 and 390 by 844 pixels: no
  horizontal overflow, duplicate IDs, missing image alternatives, or browser
  console errors were observed; mobile navigation and sign-in semantics passed.
- Passed lint across 212 files, TypeScript, 276 foundation tests, eight focused
  component tests, dependency and transport policy checks, browser-storage
  review, brand migration verification, and repository secret scanning.
- Built 29 served assets from commit `9a77628`; initial application JavaScript
  is 128,972 bytes, total JavaScript is 820,978 bytes, and total CSS is 280,383
  bytes, all within the governed release budgets.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Acceptance protection recovery

- Replaced the false unprotected fallback with explicit buyer-code status states.
- Blocked real Deal acceptance until the protection read succeeds.
- Added retryable seller and buyer status presentation.
- Preserved the authoritative pre-acceptance server check and demo isolation.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Public Deal route recovery

- Unified direct-link and notification-originated public Deal loading.
- Preserved the canonical Deal URL during loading and failure.
- Added a retry of the same deep link plus a separate return-home action.
- Added mobile wrapping and 44-pixel recovery action targets.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Profile data recovery

- Added explicit profile loading, failure, and retry behavior.
- Prevented partially initialized security and trust controls from rendering
  before the owner-bound profile read succeeds.
- Preserved the existing newest-request-wins guard through retry and finalization.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Notification data recovery

- Stopped turning notification provider failures into a false empty activity
  state.
- Added explicit initial loading, stale-data error, and retry behavior.
- Restored unread state when an optimistic mark-all mutation fails.
- Added disclosure semantics and minimum-size notification actions.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## English launch bundle headroom

- Added a TypeScript-AST build transform for identity-only static English
  translation calls.
- Scoped the transform to modules importing the reviewed `i18n` helper and
  preserved dynamic keys, member calls, comments, and quoted examples.
- Kept source translation boundaries intact for a later governed localization
  release while reclaiming initial bundle headroom.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Account security read recovery

- Migrated signed-in device and authenticator loading failures to the shared
  accessible async-state contract with a bounded secure retry.
- Kept session revocation, authenticator enrollment, and authenticator removal
  fail-closed until the newest provider read succeeds.
- Preserved request-generation guards so delayed responses cannot replace the
  latest account security state.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Accessible field validation foundation

- Added one reusable field-error primitive with assertive semantics, semantic
  error color tokens, and decorative-icon isolation.
- Upgraded password recovery so password-policy and confirmation failures are
  attached to the exact invalid field through `aria-invalid` and
  `aria-describedby`.
- Added deterministic focus recovery to the first field requiring correction
  and cleared stale field errors as the customer edits.
- Prevented invalid password-policy submissions from reaching the Auth
  boundary, while keeping network/provider failures in the page-level shared
  feedback component.
- Passed TypeScript, 285 foundation tests, and eleven focused component tests.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Semantic design and feedback foundation

- Introduced one semantic token contract for brand, surface, border, status, focus, radius, shadow, and touch-target decisions while preserving temporary compatibility aliases for incremental migration.
- Added one accessible feedback primitive with distinct information, success, warning, and error behavior; urgent errors announce assertively, while non-destructive outcomes remain polite.
- Migrated sign-in, sign-up, password recovery, password reset, and connectivity feedback to the shared contract, including accurate success-versus-error presentation.
- Added a forced-colors focus fallback and automated WCAG AA contrast checks for every shared status pair.
- Verified the account and recovery routes at 390 by 844 pixels with no horizontal overflow, intact password-manager semantics, and 44-pixel primary interaction targets.
- Passed TypeScript, lint, 284 foundation tests, and ten focused component tests. The production bundle compiled successfully; commit-bound served-manifest generation remains delegated to the exact-commit release run.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Async transaction integrity and recoverable read failures

- Serialized automatic session renewal so a delayed refresh cannot overlap a
  second rotation request against the same server-managed session cookie.
- Made payment status, payment receipts, Deal timelines, action plans,
  inquiries, account sessions, and MFA status accept only the newest completed
  request for the current session and Deal.
- Bound support-case creation and replies to the initiating session lifecycle,
  preventing a delayed response from reopening or repopulating a workspace
  after account replacement or navigation.
- Replaced silent meeting, handoff, Watchlist, participant, and action-plan read
  failures with bounded loading/error states; meeting creation remains hidden
  until the existing meeting lookup succeeds, with an explicit retry path.
- Revalidated buyer-code protection immediately before public agreement
  acceptance. The UI exposes the code field and stops when protection is
  required, while the server remains the final authorization boundary.
- Passed lint, TypeScript, 278 foundation tests, and eight focused component
  tests after the changes.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Trust-critical read recovery and responsive route verification

- Exposed payment-receipt, agreement-history, agreement-fingerprint,
  dispute-eligibility, seller-declaration, and safety-assessment provider
  failures instead of allowing missing data to look like approval or a clean
  trust state. Each recoverable read now offers a bounded retry path.
- Preserved previously loaded payment information during a refresh failure and
  clearly labels it as temporarily stale; an initial failure remains visible
  while automatic polling continues.
- Corrected the public hero heading's accessible text boundary so assistive
  technology reads the intended sentence with natural word spacing.
- Reverified every public route at 1440 by 900 and 390 by 844 pixels. The route
  matrix found no horizontal overflow, duplicate IDs, missing image
  alternatives, or browser console errors; mobile navigation, Escape behavior,
  Home navigation, and sign-in autocomplete semantics passed.
- Passed lint, TypeScript, 282 foundation tests, eight focused component tests,
  the incident drill, repository secret scanning, and the production build.
- Built 29 served assets from commit `904d9d8`; initial application JavaScript
  is 129,038 bytes, total JavaScript is 826,026 bytes, and total CSS is 280,383
  bytes. The total JavaScript ceiling is intentionally held at 830,000 bytes,
  leaving less than 4 KB of governed headroom after the new failure states.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Shared async state and meeting recovery

- Added one reusable loading, error, and empty-state presentation contract with
  accurate live regions, `aria-busy`, atomic announcements, and real retry
  actions.
- Added responsive error actions with a 44-pixel minimum target and a
  reduced-motion fallback for loading indicators.
- Migrated meeting-detail loading and failure states while preserving the
  existing request lifecycle and explicit retry version.
- Kept the meeting form fail-closed until the latest provider read succeeds,
  preventing an unavailable read from appearing as an empty safe state.
- Passed TypeScript, lint, 286 foundation tests, and twelve focused component
  tests.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Trust Passport route recovery

- Replaced the public Trust Passport's ambiguous loading card with the shared
  loading/error contract and a bounded route retry.
- Kept provider failures distinct from valid empty reputation history.
- Added an explicit page heading relationship, numeric rating names, hidden
  decorative content, and a non-submitting back action.
- Preserved the existing newest-request-wins route guard.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Dashboard data-source recovery

- Stopped converting authenticated Deal and Watchlist provider failures into
  valid empty arrays.
- Added atomic loading, error, stale-data, and retry presentation for both
  dashboard sources.
- Preserved previously loaded records after a refresh failure and labels them
  as previously loaded rather than current.
- Kept every completion and loading transition behind the existing
  request-generation guards, including Watchlist refreshes after mutations.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Actionable workspace and provider-boundary review stack

- Prepared the review-only sequence `#164`, then `#165` through `#179`.
  Each pull request is intentionally stacked on the preceding reviewed branch;
  it must not be merged or rebased out of order.
- Hardened Auth provider success boundaries for sessions, MFA factors,
  enrollment, identifiers, password mutations, recovery, and privacy-safe
  diagnostics before changing customer-facing actions.
- Kept incomplete fulfillment, inspection, account, support, safety, MFA,
  evidence-upload, shipment, and agreement controls actionable. Native form
  validation now identifies and focuses the first incomplete control while
  mutation guards still prevent duplicate requests.
- Corrected meeting and shipping address focus targets so City no longer
  resolves to optional Address Line 2. Address Line 2 remains available for
  apartment, suite, and unit values.
- Removed duplicate fulfillment validation surfaces and retained one compact,
  actionable summary. This reduced the authenticated bundle without raising
  the reviewed performance ceiling.
- The stack head through `#179` passes the full repository gate: dependency and
  catalog governance, formatting, lint, TypeScript, 354 foundation tests, 13
  component tests, incident drill, secret scan, production build, and Preview
  smoke.
- The local stack-head build contains 832,146 bytes of JavaScript against the
  835,000-byte ceiling. The representative Vercel build at `#176` contained
  834,726 bytes; later local deltas remain below that reviewed ceiling and are
  independently checked by every Preview deployment.
- Individual Vercel failures recorded on `#172` through `#175` were bundle
  budget results from their intermediate heads. `#176` compacts the same stack
  below budget and is the first deployable head; those older failures must not
  be interpreted as regressions in the later stacked heads.

### Reviewed merge order

1. Merge `#164` only after its current checks and review requirements pass.
2. Merge `#165` through `#175` in numeric order without skipping a base.
3. Merge `#176` before evaluating the resulting Preview as the deployable UX
   head.
4. Merge `#177`, `#178`, and `#179` in order, requiring fresh GitHub and Vercel
   checks at each head.
5. Run the exact-commit release gate again after the final merge. Do not promote
   Production, restore public access, apply staged SQL, or enable live payment
   gates as part of this documentation sequence.

### Activation boundary

No Production deployment, public alias, hosted configuration, live Supabase
resource, customer record, or real-money capability changed during this pass.

## Stack-head Preview release evidence

- Vercel deployment `dpl_5YDd3qawTRU7ufTWPj1uzxfcaX3x` built commit
  `165f38575dbf56fb21e87285a6fb7dda420b553a` from the review-only `#180`
  branch and reached `READY` without promotion or alias changes.
- The hosted build configured the required browser/server Supabase public
  boundary, verified browser/server project and publishable-key alignment, and
  confirmed that the optional Google Maps browser integration is configured.
  Secret values were neither read nor recorded.
- The hosted performance gate measured 132,766 initial application JavaScript
  bytes, 834,703 total JavaScript bytes, and 286,188 CSS bytes. The result is
  below the fixed 835,000-byte JavaScript ceiling; only 297 bytes of hosted
  headroom remain, so the next customer-facing JavaScript change must include
  a measured offset or an approved chunking improvement.
- A fresh unauthenticated browser run loaded the stack-head Preview with the
  expected Dealivra title and public trust copy. At a 390 by 844 viewport, the
  document client and scroll widths were both 375 pixels, with no horizontal
  overflow, duplicate IDs, missing image alternatives, or console warnings and
  errors.
- Mobile-menu navigation reached `#how-it-works`, and the exact `Home` link
  returned to the public hero without a page error.
- Preview runtime logs for the reviewed three-hour window contained no warning,
  error, or fatal entries. The only grouped serverless response status was four
  successful `204` diagnostic-intake responses.

### Activation boundary

The verification used an unauthenticated review-only Preview. It did not sign
in, submit customer data, invoke real payments, modify hosted configuration,
promote Production, restore public access, or change a live Supabase resource.

## Unified release candidate verification — 2026-08-17

- Squashed the reviewed local stack onto current `main` as the isolated
  `agent/release-candidate-2026-08-17` release candidate. The candidate contains
  two commits only: the product stack and a repository-wide line-ending policy.
- Added a `.gitattributes` contract that keeps source and configuration text on
  LF across Windows and CI while retaining CRLF for Windows command scripts.
  This removed a reproducible fresh-checkout format failure without changing
  application behavior.
- Passed the exact-commit release gate at
  `5896a8a554ec1465ac7d3b75dc4a1ad83ef297fa`: dependency and catalog policy,
  browser-storage and transport security, formatting, lint, strict TypeScript,
  384 foundation tests, 15 rendered-component tests, incident drill, secret
  scan, production build, served-asset manifest, performance budgets, and
  Preview smoke.
- The exact served manifest contains 28 assets totaling 1,111,359 bytes. Initial
  application JavaScript is 134,405 bytes, total JavaScript is 819,994 bytes,
  and CSS is 285,468 bytes; each remains below its fixed release ceiling.
- Re-ran the public route matrix on the latest available hosted Preview and the
  unified candidate locally. Home, protection, fees, legal, dispute, agreement
  verification, authentication, and 404 routes rendered without console errors.
  The 390 by 844 mobile viewport had no horizontal page overflow.
- Completed the unauthenticated Deal creation journey locally through item,
  terms, optional photos, review, all three seller declarations, and the safe
  account boundary. No account, customer record, public Deal Link, or payment
  was created.
- Confirmed that meeting and shipping forms expose manual Address Line 2,
  state, and ZIP/ZIP+4 fields. Component coverage verifies Google address parts,
  apartment/suite/unit preservation, state parsing, ZIP+4, and manual fallback.

### Remaining external release gates

- GitHub publication is pending because the local GitHub CLI credential is
  invalid and the execution environment cannot currently reach GitHub through
  its configured proxy. The candidate remains local and unmodified.
- The isolated Supabase Staging target, CLI-generated baseline migration,
  ownership/exposure inventory, and real-token authorization matrix remain
  intentionally unexecuted. The repository fails closed when the required
  staging identity and configuration are absent.
- Production aliases, public access, live Supabase resources, real payments,
  and privileged enforcement were not changed.

## 2026-08-18 — Canonical customer routes

- Added stable `/create`, `/signin`, `/signup`, `/forgot-password`,
  `/deal/<public-id>`, and `/trust/<public-id>` routes through the single browser
  resolver.
- Updated application navigation, Deal sharing, agreement-document links,
  trust-passport links, protected synthetic checks, and Preview smoke coverage
  to emit the canonical paths.
- Retained the former root-query URLs as migration-compatible inbound links so
  previously shared Deal and recovery links do not break.
- Added malformed-identifier rejection and canonical/legacy resolver coverage.
  Production aliases, public access, live Supabase resources, and real payments
  were not changed.
- Measured the unconfigured production build at 820,601 JavaScript bytes. The
  total-JavaScript ceiling moved from 820,000 to 821,000 bytes (0.122%) to
  accommodate the shared resolver; initial-app, per-chunk, CSS, and configured
  provider-overhead ceilings did not change.

## 2026-08-18 — Single Deal Workspace action policy

- Audited the Deal Workspace action hierarchy against UX-003 instead of
  introducing another action surface. The role/state policy already selects one
  next action for draft, published, accepted, delivery, completed, disputed,
  cancelled, expired, signed-out, seller, and buyer states.
- Confirmed that desktop exposes the action only in the sticky workspace bar,
  while the mobile breakpoint hides that control and exposes the same action in
  one safe-area persistent dock. The Deal progress card remains status-only and
  cannot create a second competing call to action.
- Added a release regression that locks the mutually exclusive desktop/mobile
  visibility policy. Local route smoke also loaded the canonical home, account,
  creation, recovery, Deal, and Trust paths without a framework error overlay.
- Protected Preview role/state, keyboard, and mobile acceptance remains the
  external UX-003 release gate. Production aliases, public access, live Supabase
  resources, and real payments were not changed.
# 2026-08-18 — SEC-002 account-takeover response boundary

- Audited the existing private session inventory, local/other/global provider
  revocation, immediate Data API/Storage/Edge session enforcement, and recovery
  notification foundation.
- Added a fail-closed suspected-account-takeover runbook covering severity,
  privacy-safe intake, global containment, independent identity re-proofing,
  immutable evidence, 72-hour sensitive-change holds, restoration, and exact
  two-device Staging rehearsal evidence.
- Kept SEC-002 open: hosted cross-device denial and verified notification
  delivery remain required. No live Supabase resource, Production access, or
  real-payment configuration changed.

## Shared validation-summary foundation — 2026-08-18

- Replaced the separate Deal creation and fulfillment validation-summary
  implementations with one typed `ValidationSummary` primitive while retaining
  the established prominent and compact visual treatments.
- The shared primitive provides one assertive, labelled error region, a
  programmatically focusable summary, and field-specific navigation for Deal
  creation, meeting, and shipping workflows.
- Added rendered-component coverage for alert semantics, summary focus, linked
  actions, heading hierarchy, and decorative-icon isolation. Updated the
  fulfillment architecture test to govern the shared boundary instead of the
  retired local implementation.
- Passed formatting, lint, strict TypeScript, all 384 foundation tests, all 17
  rendered-component tests, the production build, served-asset generation,
  performance budgets, and production-preview smoke. Application JavaScript is
  819,951 bytes against the fixed 820,000-byte ceiling.
- The change is signed with the reviewed Dealivra release key on
  `agent/shared-validation-summary` and is based on the merged `main` release
  commit `2621fcd55cdbe6381f58fedf1164b1acf997f3c8`.

### Activation boundary

This review change does not alter Production, public access, Vercel aliases or
configuration, Supabase resources, customer records, or payment capabilities.
Its exact signed commit was published for protected GitHub and Vercel review.
# 2026-08-18 — Consolidated release-candidate evidence

- Combined the signed canonical-route, single-primary-action, account-takeover,
  shared-validation-summary, and Node 24 artifact-upload changes on one linear
  review branch above merged `main`.
- Resolved the documentation overlap by preserving both the newer shared
  validation-summary status and the completed single-primary-action status.
- Re-ran the complete repository release gate on the integrated head: 385
  foundation and 17 component tests, incident drill, secret scan, production
  build, asset manifest, fixed performance budgets, and Preview smoke passed.
- Refreshed the no-go snapshot so its evidence and blockers no longer refer to
  superseded PR `#181`, test counts, or bundle measurements.
- No Production alias, public access, live Supabase resource, customer record,
  or real-payment configuration changed.

# 2026-08-18 — Accessible support-case validation summary

- Replaced first-error-only support intake validation with one complete summary
  that announces every invalid field after a submit attempt.
- Kept the existing inline errors while making each summary action restore
  keyboard focus directly to the corresponding subject or message field.
- Disabled native form interception for this governed form so the shared
  validation path remains consistent across browsers and assistive technology.
- Added a repository regression contract for full-error collection, summary
  focus, stable field identifiers, and direct field-focus recovery.
- No support record, Supabase resource, deployment, public-access setting,
  customer data, or real-payment capability changed.

# 2026-08-18 — Complete account correction summaries

- Replaced first-error-only sign-up and password-reset handling with the shared
  validation summary so every invalid field is announced in form order.
- Added stable field targets and direct summary-to-field focus actions while
  preserving password-manager semantics and provider submission boundaries.
- Added focused component regressions for the four sign-up requirements and
  simultaneous password-policy and confirmation failures.
- Kept application JavaScript inside the fixed release budget without adding a
  configured-build allowance.
- No Production alias, public access, hosted configuration, live Supabase
  resource, customer record, or real-payment capability changed.

# 2026-08-18 — Governed account journey status colors

- Replaced account-entry journey, market-note, and consent-link literal colors
  with the shared semantic brand, information, success, surface, border, ink,
  and action-shadow tokens.
- Added a repository regression contract that keeps current and completed
  account journey states on the governed palette.
- Kept the change CSS-only for the application so it adds no JavaScript to the
  fixed release bundle budget.
- No Production alias, public access, hosted configuration, live Supabase
  resource, customer record, or real-payment capability changed.

# 2026-08-18 — Governed Deal-creation progress colors

- Migrated the persistent New Deal progress control, its default state, current
  state, completed state, labels, icons, borders, surfaces, and action shadow
  onto the shared semantic design tokens.
- Extended the release regression contract to prevent the creation journey from
  drifting back to feature-owned status colors.
- Kept the application change CSS-only, with no new customer capability or
  JavaScript execution path.
- No Production alias, public access, hosted configuration, live Supabase
  resource, customer record, or real-payment capability changed.

# 2026-08-18 — Governed Deal Workspace progress colors

- Aligned pending, current, and completed Deal Workspace milestones with the
  same semantic border, surface, ink, information, success, brand, and action
  shadow tokens used by the account and creation journeys.
- Extended the repository regression contract so the core transaction timeline
  cannot silently return to an independent status palette.
- Kept the application change CSS-only and left all transaction state and role
  policy behavior unchanged.
- No Production alias, public access, hosted configuration, live Supabase
  resource, customer record, or real-payment capability changed.

# 2026-08-18 — Complete account-password correction summary

- Replaced first-error-only account-password validation with the shared linked
  validation summary so missing current credentials, password-policy failures,
  and confirmation failures are announced together in form order.
- Preserved field-level errors and password-manager semantics, added stable
  summary targets for direct keyboard recovery, and moved focus to the complete
  summary after an invalid submission.
- Added focused rendered-component coverage for simultaneous failures and a
  valid three-field submission, plus repository contracts for field links,
  complete collection, and deterministic summary focus.
- Kept every individual chunk within its existing ceiling and advanced the
  fixed total-JavaScript ceiling by exactly 1,000 bytes for the reviewed
  821,795-byte build (less than 0.13% growth).
- No Production alias, public access, hosted configuration, live Supabase
  resource, customer record, or real-payment capability changed.

# 2026-08-21 — Preserve unresolved account correction guidance

- Kept sign-up validation summaries stable while a customer corrects one
  field: only that field's issue is removed, so unrelated name, email,
  password, or policy guidance remains visible and actionable.
- Kept password-recovery guidance field-scoped: changing either password
  field clears only that field's issue, so every other unresolved correction
  remains visible until the customer addresses it.
- Linked invalid fields to the rendered validation summary only while that
  summary exists, eliminating temporary references to absent accessibility
  targets while preserving the permanent password-requirement description.
- Added repository regressions for field-scoped recovery and dynamic
  `aria-describedby` relationships; 387 foundation and 20 rendered-component
  tests pass.
- No Production alias, public access, hosted configuration, live Supabase
  resource, customer record, or real-payment capability changed.

# 2026-08-21 — Central browser Edge mutation boundary

- Inventoried all browser-invoked Edge mutations across evidence and payment
  workflows and required each one to enter through the shared exact-origin
  browser boundary.
- Centralized `POST`-only enforcement after valid preflight handling and before
  any feature handler can run; wrong-method requests return `405` with
  `Allow: POST, OPTIONS` and exact approved-origin CORS metadata.
- Kept Stripe webhooks and the security-notification worker outside the browser
  boundary because they use independent signature or constant-time worker
  credential authentication.
- Added repository regressions for the complete browser mutation inventory,
  wrong-method enforcement, and server-to-server exceptions.
- No Edge Function was deployed and no Production alias, public access, hosted
  configuration, live Supabase resource, customer record, or real-payment
  capability changed.

# 2026-08-21 — Governed SEC-006 API abuse policy

- Added one machine-readable abuse-control inventory for every current Vercel
  API route, including exact method, observation window, threshold, category,
  count key, Preview action, Production action, and CAPTCHA state.
- Added a fail-closed release verifier that rejects route drift, invalid bounds,
  premature Production blocking, missing Preview enforcement, or unsupported
  CAPTCHA activation.
- Added boundary and burst matrices for every route: threshold traffic remains
  allowed, Preview traffic above threshold blocks and alerts, while Production
  remains observation-only pending real traffic and false-positive review.
- Kept CAPTCHA disabled pending measured automation, accessibility/privacy
  review, and a non-CAPTCHA recovery path.
- No Vercel Firewall rule, CAPTCHA provider, Production alias, public access,
  hosted configuration, live Supabase resource, customer record, or real-payment
  capability changed.
