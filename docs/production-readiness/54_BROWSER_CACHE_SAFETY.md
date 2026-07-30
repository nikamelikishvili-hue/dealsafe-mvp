# Browser cache safety

Status: implemented locally; activation and cross-browser production evidence
remain required.

## Objective

Dealivra must not expose an earlier account, agreement, payment, delivery,
evidence, support, or dispute state because a browser worker served a stale
application shell or private response. Caching is an availability optimization
for immutable public build assets, never a source of truth.

## Enforced boundary

The service worker may handle only a request that is all of:

- `GET`;
- same-origin;
- free of a query string;
- under `/assets/`; and
- a JavaScript, CSS, WOFF, or WOFF2 build asset.

The response must be successful HTTP 200, basic/default, and have a matching
script, stylesheet, or font content type before it is stored.

The worker does not intercept or cache:

- navigations or HTML;
- Auth, API, catalog, payment, payout, webhook, support, or monitoring traffic;
- account, deal, agreement, delivery, evidence, dispute, or administrator data;
- media, uploads, signed URLs, manifests, icons, or source maps;
- cross-origin or query-bearing requests; or
- non-GET requests.

## Update and retirement

- The worker script and application shell use `no-cache, no-store,
  must-revalidate`.
- Build assets remain immutable because filenames are content-hashed.
- Registration bypasses the HTTP cache for worker updates and requests an
  update after registration.
- Activation removes retired `dealivra-*` and `dealsafe-*` caches while leaving
  unrelated cache namespaces untouched.
- A new worker skips the waiting phase, cleans old Dealivra caches, then claims
  controlled clients.

Dealivra intentionally provides no offline account or transaction UI. A
network failure must be visible rather than silently displaying stale
transaction state.

## Release evidence

Before promotion, the reviewed commit must pass:

1. the static cache-boundary regression test;
2. the production Preview smoke test against the emitted worker;
3. a clean-profile Chromium test proving navigations and API responses do not
   enter Cache Storage;
4. an upgrade test from the previous Production worker proving retired shell
   caches are deleted;
5. offline navigation proof that no prior private screen is rendered; and
6. sign-in, password recovery, sign-out, account, deal, and dispute smoke tests
   after a worker upgrade.

Production evidence records browser versions, worker state transitions,
reviewed commit, deployment identifier, timestamp, and pass/fail only. It must
not contain cookies, tokens, URLs with queries, participant data, evidence, or
response bodies.

## Rollback

Rollback restores the previously reviewed worker and asset set as one release.
The rollback worker must keep navigation/private traffic network-only and
retire caches created by the reverted release. If worker activation or cache
cleanup is uncertain, freeze promotion and instruct internal testers to close
all controlled tabs before retesting; do not weaken the cache boundary.

## Activation boundary

This repository change does not deploy a worker, alter a Vercel project, clear
a real browser cache, or authorize public/real-money operation. Activation
requires the normal release evidence, incident gate, and reviewed promotion.
