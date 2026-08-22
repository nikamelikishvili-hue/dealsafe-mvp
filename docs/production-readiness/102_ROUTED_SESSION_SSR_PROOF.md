# Routed session and origin-rendering proof

## Decision status

This is a bounded ARC-001 proof, not a Production framework cutover. It establishes the security and HTTP contract that the target routed application must preserve before Dealivra migrates customer routes.

The preferred target remains a React server framework with file-based routing and server components on Vercel. Next.js App Router is the leading candidate because it supplies origin rendering, route-local 404/error boundaries, server-only reads, and an incremental React migration path. Final acceptance still requires a protected Preview implementation and measured comparison against the current Vite build.

## What the proof implements

Two exact, non-customer Preview routes are available:

- `/__architecture/public` renders HTML at the origin with a nonce-bound CSP;
- `/__architecture/protected` reads only the `HttpOnly` refresh cookie, rotates it through the existing bounded Auth provider transport, enforces AAL2 when a verified factor exists, and renders no token or customer identifier into HTML.

Both routes return `404` outside Vercel Preview. They do not change the public SPA, Production aliases, live provider configuration, payment behavior, or database state.

## Security properties

- Preview-only fail-closed activation based on `VERCEL_ENV`.
- Exact rewrites; no wildcard catches API or unknown routes.
- The public proof permits `GET` and `HEAD`; the protected proof permits only `GET` so a crawler or health probe cannot rotate a session cookie.
- Private, no-store HTML responses.
- Per-response cryptographic nonce and a route-specific deny-by-default CSP.
- `frame-ancestors 'none'`, `base-uri 'none'`, `noindex`, `nosniff`, and no-referrer output.
- HTML escaping before server-rendered identity text is inserted.
- Missing, rejected, malformed, or insufficient-assurance sessions redirect to canonical sign-in.
- Provider failures return a generic `503` and use the governed server-failure monitor.
- Access and refresh credentials never enter the rendered document.

## Preview acceptance matrix

The protected branch Preview must prove:

| Request | Expected result |
|---|---|
| `GET /__architecture/public` | `200`, origin HTML, noindex, nonce CSP |
| `HEAD /__architecture/public` | `200`, no body |
| `POST /__architecture/public` | `405`, `Allow: GET, HEAD` |
| unauthenticated `GET /__architecture/protected` | `307` to canonical sign-in |
| `HEAD /__architecture/protected` | `405`, `Allow: GET`, without provider contact |
| authenticated AAL1 account without enrolled MFA | `200`, no token in HTML |
| authenticated account with verified MFA but no AAL2 | `307` and refresh cookie cleared |
| authenticated AAL2 account | `200`, rotated refresh cookie, no token in HTML |
| either route on Production | `404` |
| unknown sibling path | edge `404` |

## Remaining ARC-001 work

1. Build the same contract in an isolated Next.js App Router Preview using the pinned repository supply-chain policy.
2. Compare build size, cold-start behavior, CSP delivery, route 404s, and authenticated refresh behavior.
3. Confirm that the existing Deal Workspace can mount as a client island without browser-persisted credentials.
4. Approve an architecture decision record and migration sequence.
5. Migrate one public route and one low-risk protected read before any transactional workflow.

ARC-001 remains **in progress** until the framework Preview and migration decision are accepted. This proof narrows the risk; it does not authorize Production access or live payments.
