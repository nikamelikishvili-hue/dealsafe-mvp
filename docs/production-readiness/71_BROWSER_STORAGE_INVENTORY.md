# Browser storage inventory

## Objective

New browser persistence must fail the release gate unless its file, storage
class, operation count, key, lifetime, and sensitive-data boundary have been
reviewed.

## Reviewed inventory

The executable policy permits four source files:

1. `app.tsx` — the short-lived, byte-bounded guest Deal draft;
2. `i18nFull.ts` — the non-sensitive language preference and legacy cleanup;
3. `main.tsx` — legacy token cleanup and presence-only session bootstrap;
4. `supabaseRest.ts` — the tab-scoped access session and persistent legacy
   refresh-token cleanup.

There are 14 reviewed local-storage calls and six reviewed session-storage
calls. Only `getItem`, `setItem`, and `removeItem` are accepted. Account session
data may not be written to or read from local storage; refresh secrets remain
in the server-managed HttpOnly cookie.

Any new file, call, method, count, persistent session access, `document.cookie`,
or IndexedDB use fails locally and in CI until the inventory and its privacy
review are intentionally updated.

## Verification

`npm run security:browser-storage` scans all TypeScript and JavaScript source
under `src`, verifies the exact inventory and required controls, and returns
only aggregate counts. It is part of `npm run verify`, with a regression test
that locks the current result and package-script wiring.

Before public activation, protected Preview evidence must cover guest draft
expiry and cleanup, tab-close session removal, server cookie rotation,
sign-out, storage-denied behavior, legacy cleanup, and a deliberately
unreviewed fixture rejected by CI.

## Rollout and rollback

This gate changes no runtime state. If it reports a false positive, correct the
parser or document and test a genuinely reviewed use; do not broadly exempt a
directory or add a wildcard.

No browser storage, endpoint, environment, provider, Supabase, Vercel,
Preview, Production, public-access, customer, payment, payout, refund,
dispute, or real-money state was changed by this local inventory.
