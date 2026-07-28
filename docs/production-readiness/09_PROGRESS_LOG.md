# Production-readiness progress log

This log records completed delivery evidence. A backlog item is not marked complete from code alone when it also requires staging, provider, legal, accessibility, security, or operational evidence.

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
| FND-002 | In progress | Add formatter/linter and real unit/component suites |
| FND-003 | In progress | CI file exists; GitHub execution and branch requirement still need confirmation |
| FND-004 | In progress | Dependency audit exists; secret/SAST/license tooling remains |
| SEC-004 | In progress | Initial headers exist; browser/Preview validation and CSP reporting remain |

### Next batch

- Confirm the GitHub CI run on the pushed branch.
- Add the real test toolchain and application-level unit/component tests.
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
