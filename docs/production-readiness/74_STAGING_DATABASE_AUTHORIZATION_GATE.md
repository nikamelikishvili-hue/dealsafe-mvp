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
- the connection explicitly specifies exactly one `sslmode=require` or
  `sslmode=verify-full` parameter; missing, empty, duplicate, and other modes
  are rejected before a client connects;
- the job executes in the protected GitHub `staging` environment.

## Current verification — 2026-09-08

A supplemental Supabase MCP run against isolated Staging at source commit
`9367ddd456a482494c5c38aaa0ce0fc8369f13f4` passed 16 of the 17 SQL suites.
The lifecycle suite was not run: its global claim function could touch an
existing queue item (one pending/approved/processing item was observed).
See [the status-only evidence record](evidence/2026-09-08-staging-sql-supplement.json)
for the complete inventory, source hashes, preflight, and limitations.

Each executed suite ran as one transaction with its original assertions and
final rollback. Nine suites additionally used a read-only transaction; all
had a 15-second statement timeout and a 2-second lock timeout. The observed
user, profile, deal, dispute, evidence, integrity-event, audit-event, and
Storage-object counts matched before and after. This is not a row-by-row
identity assertion. Audit/payment probes may advance identity sequences
despite rollback; no sequence was reset. No Production operation, actual
Stripe call, or Storage-byte deletion was performed.

This evidence does **not** complete the protected GitHub gate: it does not
prove that workflow's direct-Postgres/TLS path, migration step, or ownership
inventory. The `staging` environment still has no secrets. DAT-001 and DAT-003
remain open; SQL role settings are not real Auth tokens. The data-free baseline
workflow also needs a reviewed synthetic-fixture bootstrap before its
fixture-dependent suites can prove an empty rebuild. Historical results below
are not current-candidate launch evidence.

The TLS guard now rejects absent and duplicate modes instead of claiming TLS
was required for an ambiguous URL. `require` enforces encryption but is not a
hostname/certificate-verification claim; use `verify-full` with the appropriate
trusted CA for that protection ([PostgreSQL SSL documentation](https://www.postgresql.org/docs/current/libpq-ssl.html)).

## Previously recorded verification (historical)

The connected Supabase organization now has an isolated Staging project
(`dealivra-staging`) that is different from Production. Staging contains the
reviewed schema and 30 applied migration records. The repository still lacks a
complete timestamped migration chain capable of building an empty database,
so DAT-001 remains open.

An earlier run recorded all 17 rollback-only database authorization and integrity
suites passing against Staging. That recorded matrix covers seller, buyer, outsider, administrator,
MFA, evidence, dispute, support, payment-command, immutable-audit, and RLS
boundaries. The Staging fixtures use only synthetic `.invalid` identities and
fake provider identifiers; no Production customer rows or payment objects were
copied.

The manual Staging workflow now discovers the complete reviewed
`supabase/tests/*_rollback.sql` inventory, fails unless the inventory contains
exactly 17 suites, and executes every suite with `psql -X -v ON_ERROR_STOP=1`.
This prevents a newly failing authorization area from being hidden behind one
representative test file. Repository foundation tests pin this workflow
contract so reducing the suite or weakening fail-fast behavior fails CI.

The post-change Supabase advisors report no error-level finding. Security
notices are 29 intentional deny-all/RPC-only tables without permissive RLS
policies, 91 reviewed `security definer` API projections, the `pg_net`
extension location, and the provider-level leaked-password protection setting.
The latter remains a paid-beta activation gate rather than a database-policy
exception. Performance notices are informational (34 foreign-key candidates
and 44 currently unused indexes) and require workload evidence before adding
or removing indexes.

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
3. the sorted list of exactly 17 reviewed rollback suites;
4. the successful fail-fast output from every suite, including seller, buyer,
   outsider, support, and administrator allow/deny results;
5. private maintenance-table regression output;
6. rollback or disposable-database proof.

## Remaining launch gates

- DAT-001: convert the ordered SQL history into timestamped migrations and
  prove empty/upgrade/rollback paths.
- DAT-003: extend the passing SQL role matrix to authenticated HTTP requests
  using synthetic Staging tokens and Storage objects, including anonymous and
  expired-session cases.
- Run backup/restore evidence and define RPO/RTO before paid beta.
- Never promote this migration from Staging until the owner-only verifier and
  scheduled evidence-maintenance path pass end to end.

Production, public access, live Supabase resources, Vercel aliases, and real
payments are intentionally unchanged by this repository batch.
