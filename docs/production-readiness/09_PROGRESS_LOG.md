# Production-readiness progress log

This log records completed delivery evidence. A backlog item is not marked complete from code alone when it also requires staging, provider, legal, accessibility, security, or operational evidence.

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

