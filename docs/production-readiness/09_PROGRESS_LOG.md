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

