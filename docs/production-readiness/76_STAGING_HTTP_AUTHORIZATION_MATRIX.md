# Staging HTTP authorization matrix

## Purpose

DAT-003 requires authorization proof through the same hosted Data API and
Storage HTTP boundaries used by a browser. SQL role simulation remains useful,
but it cannot prove JWT expiry, gateway behavior, publishable-key handling, or
Storage API enforcement.

## Synthetic roles and surfaces

The status-only runner uses four short-lived synthetic Staging sessions:

- seller for one synthetic accepted deal;
- buyer for the same deal;
- unrelated signed-in outsider;
- expired authenticated session.

It proves seller and buyer can read the protected action plan, the outsider
receives an empty governed projection, and expired/anonymous requests are
denied. It then attempts cross-user, expired, and anonymous Storage uploads,
proves seller and buyer can upload only under their own UUID folders, and
deletes both probe objects before reporting success.

## Privacy and mutation boundary

The report contains only fixed surface names, HTTP statuses, PASS/FAIL, and a
timestamp. It never includes tokens, subjects, deal IDs, paths, response
bodies, emails, or object bytes. The probe is a generated one-pixel PNG under
the public product-media bucket; it is not evidence and contains no customer
data. Cleanup failure fails the matrix.

Required values belong only in the protected GitHub `staging` environment or
an ephemeral operator process:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
DEALIVRA_HTTP_MATRIX_ORIGIN
DEALIVRA_HTTP_MATRIX_DEAL_ID
DEALIVRA_HTTP_MATRIX_SELLER_TOKEN
DEALIVRA_HTTP_MATRIX_BUYER_TOKEN
DEALIVRA_HTTP_MATRIX_OUTSIDER_TOKEN
DEALIVRA_HTTP_MATRIX_EXPIRED_TOKEN
```

Never paste these values into chat, screenshots, workflow inputs, logs, source
control, issues, or pull requests. Tokens must be synthetic, environment-bound,
and short-lived. Production is not an allowed target.

DAT-003 closes only after the matrix passes against isolated Staging, all probe
objects are absent, and the existing 17 rollback SQL suites still pass.
