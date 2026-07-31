# Staging database authorization gate

## Decision

Dealivra must use a separate Supabase project for Staging before any migration,
authorization matrix, or destructive rollback test is run outside a local
database. A branch, Preview URL, or different Vercel environment is not enough
if it still points to the Production project.

The gate is manual-only and refuses to run unless all of these are true:

- the selected environment is exactly `staging`;
- Staging and Production Supabase project references are valid and different;
- the direct PostgreSQL host belongs to the declared Staging project;
- the connection uses a reviewed TLS mode;
- the job executes in the protected GitHub `staging` environment.

## Current verified state

The connected Supabase organization currently exposes one active project. The
remote migration inventory contains 27 applied migrations, while the
repository still lacks a complete timestamped migration chain capable of
building an empty database. This keeps DAT-001 open.

The live advisor also identified
`dealsafe_private.evidence_maintenance_settings` with RLS disabled. The table
is not in an exposed schema and its ACL currently grants access only to the
database owner, so this is not evidence of direct browser access. It is still
a defense-in-depth inconsistency: every application-owned table must have RLS.

This batch therefore prepares, but does not apply to Production:

- a reviewed migration that enables RLS without forcing it for the owner-only
  `security definer` verifier;
- a database-wide RLS, policy, grant, view, and `security definer` contract;
- the existing participant/role RPC matrix behind an exact Staging target
  guard;
- a private-table regression that confirms zero browser/service grants and no
  permissive policies.

## Protected Staging configuration

Create a GitHub environment named `staging`, require a reviewer, and store:

| Kind | Name | Requirement |
|---|---|---|
| Variable | `DEALIVRA_STAGING_SUPABASE_PROJECT_REF` | Exact Staging project reference |
| Variable | `DEALIVRA_PRODUCTION_SUPABASE_PROJECT_REF` | Exact Production project reference; must differ |
| Secret | `DEALIVRA_STAGING_DATABASE_URL` | Direct Staging Postgres URL with protected credentials and reviewed TLS |

Do not place the database URL in repository variables, logs, screenshots,
issues, or pull-request text. Do not give this workflow a push or pull-request
trigger.

## Required evidence

The manual workflow must pass on a fresh isolated Staging database and retain:

1. the reviewed commit SHA;
2. the value-free target-verification result;
3. database security-contract output;
4. seller, buyer, outsider, support, and admin allow/deny results;
5. private maintenance-table regression output;
6. rollback or disposable-database proof.

## Remaining launch gates

- DAT-001: convert the ordered SQL history into timestamped migrations and
  prove empty/upgrade/rollback paths.
- DAT-003: extend the matrix to authenticated HTTP requests using real Staging
  tokens and Storage objects, including anonymous and expired-session cases.
- Run backup/restore evidence and define RPO/RTO before paid beta.
- Never promote this migration from Staging until the owner-only verifier and
  scheduled evidence-maintenance path pass end to end.

Production, public access, live Supabase resources, Vercel aliases, and real
payments are intentionally unchanged by this repository batch.
