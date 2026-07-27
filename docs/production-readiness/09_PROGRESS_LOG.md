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

