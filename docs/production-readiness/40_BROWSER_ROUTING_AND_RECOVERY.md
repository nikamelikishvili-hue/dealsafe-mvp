# Browser routing and recovery

Status: implemented locally for review on 2026-07-29. This document does not
authorize a Preview or Production deployment.

## Objective

ARC-002 requires Dealivra URLs to behave predictably when a customer:

- opens a saved link directly;
- refreshes the browser;
- moves backward or forward through browser history;
- follows a password-recovery link;
- opens a public agreement-verification or policy page; or
- enters an unknown address.

## Canonical route rules

`src/navigation.ts` is the single browser-route resolver. It recognizes:

- `/` and public landing-page sections;
- `/?start=create`, `/?start=signin`, `/?start=signup`, and
  `/?start=forgot`;
- `/?deal=<public-id>` and agreement document mode;
- `/?trust=<public-id>`;
- Supabase recovery fragments containing a recovery access token;
- `/verify`;
- the six public protection, fee, dispute, terms, and privacy paths; and
- an explicit `not-found` result for every other path.

Recovery tokens take precedence and are never placed into titles, metadata,
visible errors, or logs. Deal and trust identifiers are accepted only on the
root application path, so an unknown path cannot silently become a valid deal
page because it also contains a query parameter.

## History and asynchronous safety

The full application listens to `popstate`, resolves the current URL again, and
restores query-driven as well as path-driven views. Public deal and trust
requests are fenced with a monotonically increasing request identifier. A slow
response from an older browser-history entry cannot replace a newer page.

Public record loading has a named loading screen. An unavailable Deal Link
keeps its separate, customer-readable failure state. Unknown paths render a
visible 404 page and receive `noindex,nofollow,noarchive` metadata.

## Application recovery boundary

Both the optimized public landing page and the full application are wrapped in
`AppErrorBoundary`. An unexpected React render failure shows:

- a short non-technical explanation;
- `Try again`;
- `Return to home`; and
- a statement that no transaction action completed on that screen.

The customer view does not expose exception messages, stack traces, provider
responses, tokens, or environment details. Render and asynchronous bootstrap
failures use fixed privacy-safe categories; neither the local record nor the
staged observability transport receives an `Error`, message, stack, component
stack, URL, browser state, or customer data. A failed dynamic application
import also renders the same recovery page instead of leaving a blank or
unresponsive screen.

## Verification

Automated tests cover root, section, public information, verification,
creation, sign-in, sign-up, password recovery, trust passport, Deal Link,
document mode, recovery-token precedence, trailing slashes, and unknown-path
rejection. Source assertions require browser-history synchronization, the
loading state, the 404 state, and the recovery boundary.

Protected Preview browser evidence must still prove:

1. refresh on every supported direct URL;
2. Back and Forward across home, sign-in, public information, and Deal Link;
3. an unknown URL on desktop and mobile;
4. recovery-link handling without token leakage;
5. an intentionally injected render failure; and
6. absence of horizontal overflow and obscured focus.

## Remaining architecture boundary

The current Vite single-page application rewrites non-API paths to
`index.html`. The customer receives the correct visible 404 and no-index
metadata, but the edge response remains HTTP 200. A target framework with
server-aware routes must return an actual HTTP 404 before ARC-002 can be marked
fully complete. Protected account records also still require authenticated,
non-public route identifiers during the ARC-001/ARC-003 migration.
