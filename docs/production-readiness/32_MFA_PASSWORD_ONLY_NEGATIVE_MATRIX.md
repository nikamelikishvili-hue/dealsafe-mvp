# MFA password-only negative matrix

## Purpose

The matrix proves that an enrolled privileged account cannot use a valid
password-only (`aal1`) session to cross any protected data boundary.

A successful UI challenge alone is not evidence. The same account must be
tested with:

- a short-lived password-only AAL1 token;
- a short-lived password-plus-TOTP AAL2 control token;
- one known protected Storage object that the AAL2 control can read.

Both tokens must belong to the same user. Tokens and object contents are never
written to output.

## Automated matrix

`scripts/run-mfa-password-only-matrix.mjs` tests:

| Surface | Password-only requirement | AAL2 control requirement |
|---|---|---|
| Data API | Governed MFA `403` | RPC reaches `200` |
| Storage known object | Object is not readable | Range read reaches `200` or `206` |
| `evidence-files` | Governed MFA `403` | Reaches safe invalid-body handling |
| `stripe-connect` | Governed MFA `403` | Reaches safe invalid-body handling |
| `stripe-create-checkout` | Governed MFA `403` | Reaches safe invalid-body handling |
| `stripe-release-payment` | Governed MFA `403` | Reaches safe invalid-body handling |
| `stripe-resolve-dispute` | Governed MFA `403` | Reaches safe invalid-body handling |

The AAL2 Edge Function control deliberately sends `{}`. It must pass
authentication and stop at request validation before any financial provider
operation is eligible.

The report contains only:

- surface name;
- password-only HTTP status;
- AAL2 control HTTP status;
- `PASS`, `FAIL`, or `SKIP`;
- a fixed explanation.

Response bodies, user IDs, token claims, object names, and credentials are not
included.

## Required ephemeral environment

The following values must exist only in a trusted local process or approved CI
secret store:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
DEALIVRA_MFA_MATRIX_ORIGIN
DEALIVRA_MFA_MATRIX_AAL1_TOKEN
DEALIVRA_MFA_MATRIX_AAL2_TOKEN
DEALIVRA_MFA_MATRIX_STORAGE_OBJECT
```

The Storage value uses `bucket/path`. It must point to a non-sensitive test
object readable by the control account.

Never paste either token into chat, a ticket, a command transcript, a
screenshot, source control, or a documentation file.

## Database rollback proof

`supabase/tests/mfa_password_only_negative_matrix_rollback.sql`:

- chooses one privileged account without returning its identifier;
- uses request-local JWT claims for password-only and AAL2 control states;
- proves the private assurance helper rejects AAL1 and accepts AAL2;
- confirms the Data API hook and restrictive Storage policy use the same
  helper;
- rolls back the transaction.

## Current status

The harness and rollback proof are prepared. The live matrix is intentionally
not executed until:

1. `mfa_assurance_enforcement.sql` is approved for a protected environment;
2. an approved non-sensitive Storage control object exists;
3. both short-lived tokens can be placed in ephemeral local or CI secrets;
4. a second authorized reviewer observes the status-only result.

Any `SKIP` is a failed activation gate. Mandatory privileged MFA enforcement
must remain unapplied until every row is `PASS`.

