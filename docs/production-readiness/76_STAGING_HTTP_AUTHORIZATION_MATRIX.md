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

It requires seller and buyer to receive exactly one protected action-plan row
with the correct viewer role and a recognized deal status. The outsider must
receive an empty JSON array; expired and anonymous requests must be explicitly
denied. Invalid action-plan evidence stops the run before any Storage mutation.
It then attempts cross-user, expired, and anonymous Storage uploads and checks
seller and buyer uploads under their own UUID folders. Each successful upload
must be visible in the owner's listing before deletion, and absent afterward.

## Privacy and mutation boundary

The report contains only fixed surface names, HTTP statuses, PASS/FAIL, and a
timestamp. It never includes tokens, subjects, deal IDs, paths, response
bodies, emails, or object bytes. The probe is a generated one-pixel PNG under
the public product-media bucket; it is not evidence and contains no customer
data. Both owner-scoped nonce paths are registered before uploads begin. Cleanup
attempts both paths even when an upload throws after writing or an outsider
unexpectedly succeeds. It uses scoped bulk removal and owner-authenticated
listings; inability to prove cleanup fails the matrix.

A lost response or server error is treated as a possible write even without a
success status. Its owner listing must witness the probe before deletion;
otherwise cleanup remains unproven rather than passing on empty listings alone.

Each request and response-body read has a ten-second deadline and a 64 KiB
body limit. Redirects are rejected. Transport failures and malformed or oversized
responses produce sanitized failure rows, never raw exception text. A server
error is not authorization evidence: denial requires HTTP 401/403 or a legacy
HTTP 400 response with an explicitly recognized authorization code. See the
[Supabase Storage error reference](https://supabase.com/docs/guides/storage/debugging/error-codes).

Required values belong only in the protected GitHub `staging` environment or
an ephemeral operator process:

```text
DEALIVRA_DATABASE_ENVIRONMENT=staging
DEALIVRA_STAGING_SUPABASE_PROJECT_REF
DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF
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

Preflight requires distinct Staging and Production project references and an
exact Staging API host, plus a modern `sb_publishable_` key. JWTs are bounded,
structurally validated, and checked for the expected issuer, audience, role,
subject, and expiry before any request. The three active subjects must differ;
the expired session may belong to an active subject. These local checks do not
verify signatures: the hosted authentication boundary remains responsible for
cryptographic verification.

Executable synthetic-provider tests exercise successful evidence, wrong target
rejection, denial classification, malformed action plans, interrupted writes,
timeouts, and cleanup failures. They do not replace a hosted Staging run.

DAT-003 closes only after the matrix passes against isolated Staging, all probe
objects are absent, and the existing 17 rollback SQL suites still pass.
