# Privacy-safe performance monitoring and build budgets

## Decision

Dealivra measures browser responsiveness without creating a browsing-history,
customer, Deal, session, or device dataset. The browser may report only a
fixed Core Web Vital metric and its reviewed quality bucket. Exact values,
page/route/URL, referrer, device information, account identifiers, and
application state are prohibited.

The source is implemented for review. The intake remains default-off and no
Vercel environment, log drain, alert, Firewall rule, Preview, Production,
public access, Supabase resource, payment, or customer record changed.

## Browser contract

The client observes supported browser entries for:

| Metric | Good | Needs improvement | Poor |
|---|---:|---:|---:|
| LCP | at most 2,500 ms | over 2,500 through 4,000 ms | over 4,000 ms |
| CLS | at most 0.1 | over 0.1 through 0.25 | over 0.25 |
| INP observer sample | at most 200 ms | over 200 through 500 ms | over 500 ms |

Only `metric`, `rating`, and the matching fixed `bucket` are transported. CLS
excludes entries with recent user input. The INP category uses the maximum
supported Event Timing entry observed in that page lifecycle; it is an
operational early warning, not a substitute for the official field percentile.
Unsupported observers are silently omitted.

The page sends each available metric at most once when it becomes hidden or
is left. Requests use omitted credentials, no referrer, a relative same-origin
endpoint, and best-effort keepalive. A failed performance report must never
retry or alter a customer operation.

## Server intake

`POST /api/security/web-vital` requires an exact same-origin JSON request of at
most 512 bytes. `DEALIVRA_WEB_VITAL_MODE` defaults to `staged`, returns `204`,
and records nothing. Unknown modes fail closed. Enforced mode accepts only one
of the nine reviewed metric/rating/bucket combinations and a count of exactly
one.

The complete log contract is:

- fixed monitor schema;
- server-generated random event ID and receipt time;
- bounded environment and reviewed release SHA;
- fixed event schema, metric, rating, bucket, and count.

The endpoint must not log exact timing, URL, route, referrer, request headers,
IP, user agent, device characteristics, user/session/Deal/case identifiers,
application state, or provider content.

## Build budgets

Every production build now fails when any of these reviewed ceilings is
exceeded:

| Asset | Ceiling |
|---|---:|
| One JavaScript chunk | 560,000 bytes |
| One CSS chunk | 200,000 bytes |
| Total JavaScript | 825,000 bytes |
| Total CSS | 290,000 bytes |

These ceilings are regression guards based on the current measured build, not
performance targets. They must not be increased merely to make CI pass. A
reviewed increase requires the before/after asset inventory, customer benefit,
mobile impact, and an owner for the next reduction. New feature work should
prefer route/component splitting and removal of unused code.

## Activation and rollback

Protected Preview activation requires an approved log drain, maximum 30-day
raw retention, named alert owner, endpoint Firewall threshold, sanitized
synthetic proof, aggregate-only dashboard, and a rollback rehearsal. Production
requires seven days of protected evidence and Security/Privacy approval.

Rollback sets `DEALIVRA_WEB_VITAL_MODE=staged` and redeploys the last reviewed
commit. Build budgets remain active during monitoring rollback.
