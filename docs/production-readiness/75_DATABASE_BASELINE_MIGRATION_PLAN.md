# Database baseline migration plan

## Objective

Close DAT-001 by replacing manually ordered setup SQL with a reproducible,
timestamped migration chain that can build an empty database and upgrade the
isolated Staging project. Production is not a baseline source or a test target.

## Protected source and prerequisites

Use only the isolated `dealivra-staging` project. Before connecting the CLI,
run the existing `npm run staging:database-target` guard with the protected
Staging environment variables. Confirm the CLI version and command surface
with `supabase --version`, `supabase migration new --help`,
`supabase db dump --help`, `supabase db diff --help`, and
`supabase migration list --help`; do not copy flags from memory.

The CLI access token, database password, and direct database URL remain
environment secrets. They must never be written to a migration, seed file,
artifact, console command, issue, or pull request.

## Baseline capture

The manual-only `Staging database baseline proof` workflow performs this
sequence in the protected GitHub `staging` environment. It uses a pinned CLI,
has no push or pull-request trigger, uploads a verified artifact for seven
days, and has read-only repository permissions. Two additional environment
secrets are required:

- `DEALIVRA_STAGING_SUPABASE_ACCESS_TOKEN`;
- `DEALIVRA_STAGING_SUPABASE_DB_PASSWORD`.

The workflow intentionally does not commit, push, open a pull request, deploy,
or touch Production.

The target guard runs immediately after checkout, before Node setup,
dependency installation, Supabase CLI installation, or any provider command.
An incomplete environment therefore fails quickly without contacting Supabase.
Disposable-stack cleanup runs only when that stack was started successfully;
an expected preflight rejection cannot create a misleading cleanup failure.

1. Start from a clean reviewed branch with no `supabase/migrations` directory.
2. Link the CLI to the isolated Staging project after the target guard passes.
3. Run `supabase migration new dealivra_staging_baseline`. Require exactly one
   canonical baseline file, then use `supabase db dump --linked --file` to
   populate that file with schema only. Run `supabase db diff --linked --use-migra`
   into a temporary file and append it only after the command succeeds. This
   second pass captures managed-schema and default-privilege differences after
   replaying the dump in a disposable shadow database. The CLI creates the
   timestamp; never invent it. Neither command applies changes to Staging.
   Before replay, prepend the reviewed revocations of API-role default grants
   for future postgres-owned public functions, tables and sequences. pg_dump
   restores object ACLs assuming stock defaults; the local Supabase template
   otherwise adds API-role access which is absent from the source object ACLs.
   The dump's final default-privilege statements restore the source defaults.
   This preamble executes only in the shadow/disposable database, never hosted.
4. Review the generated SQL for unexpected extension changes, especially
   `DROP EXTENSION`, and for any object outside the reviewed schemas.
5. Run `npm run database:baseline:verify`. The verifier requires the baseline
   to be first, canonical timestamp ordering, unique timestamps, no Auth user
   inserts, no connection URL or privileged credential, no deprecated
   extension version pin, and emits only file sizes and SHA-256 hashes.
6. Run `supabase migration list --linked` to report the existing history. This
   inventory is not evidence that the new baseline and hosted history align.

Run `34656757704`, attempt 3, authenticated successfully on 2026-09-11 but
`db pull` rejected the empty local history against 30 existing Staging
migrations. Do not mark those migrations reverted merely to unblock capture.
The schema dump plus diff reproduces the two capture passes in the pinned
CLI's initial-pull implementation without its history check or remote history
write. The generated baseline is for disposable rebuild proof; it must not be
pushed to the existing hosted project. Reconciliation with the existing
history and upgrade proof remain separate, reviewed activation gates.

## Empty-database proof

Use a local Docker-backed Supabase stack. The fixture runner below deliberately
does not support a hosted target, even a disposable Staging project:

1. run `supabase db reset --local` against the local stack;
2. run `npm run database:local:rollback -- --local-disposable`. It first commits
   the separately reviewed synthetic fixture bootstrap, then runs exactly the
   17 named `supabase/tests/*_rollback.sql` suites with `ON_ERROR_STOP=1`;
3. run Supabase database advisors and review every security finding;
4. run `npm run verify` and record the exact commit and migration hashes;
5. destroy the disposable environment or retain only synthetic `.invalid`
   fixtures.

Seed files may contain synthetic development data only. Never dump Production
data into `seed.sql`, and never use `--include-seed` against Production.

### Local fixture boundary

`supabase/tests/fixtures/local-authorization-bootstrap.sql` is not a migration,
an automatic `seed.sql`, or a rollback suite. A schema-only rebuild lacks the
users, deals, private buckets, and maintenance configuration that these suites
require. The explicit local bootstrap supplies synthetic prerequisites without
changing application grants, RLS policies, or rollback assertions.

The runner accepts no connection URL or target override. Every database command
uses `127.0.0.1:54322`, database/user `postgres`, no shell, no psql startup file,
bounded execution, and a minimal subprocess environment. Hosted credentials,
libpq service files/settings, and preload variables are not forwarded. Only
the disposable CLI stack's local default password is supplied. Process output
is withheld on failures because SQL errors may contain the synthetic Vault
secret. The process reports the failed filename and stops without retries.

Loopback alone cannot prove disposability (for example, an operator could
forward a remote port). The SQL independently checks the explicit local marker
and refuses populated application/Auth/Storage/Vault/scheduler state before
its first write. Never port-forward a hosted database onto the local test port.
Use only the reviewed local executable and freshly rebuilt CLI stack. A rerun
requires another local reset; the bootstrap never deletes or reconciles
pre-existing data. Cron fixture jobs are inactive no-ops, and no usable login
passwords, authenticated sessions, real payment requests, or object bytes are
created. The local Authenticator role setting required by the schema tests is
restored only inside this disposable bootstrap.

### 2026-09-08 verification status

The previous workflow ran the rollback suites immediately after schema reset
without preparing their required data. The new runner and bootstrap address
that missing step, but their presence is **not** empty-database execution proof.
No local Docker/Postgres engine was available during preparation, and the
CLI-generated baseline and protected Staging credentials were still missing.
Unit tests of the runner cannot validate SQL constraints or triggers. Keep
DAT-001 open until the real isolated reset, bootstrap, all 17 suites, advisors,
and upgrade proof have executed successfully. The earlier 16/17 hosted
supplement remains a separate result, not a pass for this local workflow.

## Upgrade and rollback proof

Create a disposable database at the last reviewed schema, apply only pending
migrations, and rerun the 17-suite authorization matrix. A deployed migration
is rolled back by a new forward migration, not by rewriting published history.
Any destructive down migration requires independent review and a verified
backup/restore rehearsal.

## Completion evidence

DAT-001 can close only when the repository contains the CLI-generated baseline,
the empty-database reset passes, Staging upgrade passes, all 17 SQL suites pass,
advisors have no unreviewed error-level finding, and the exact migration
manifest is attached to the reviewed commit. Production, public access, live
payments, and customer data remain unchanged until a separate launch approval.

## First hosted preflight evidence

GitHub Actions run `32494006891` on reviewed `main` commit
`8c57cad22820cca72e2ebb14559f94c1b18e9a0e` confirmed the fail-closed boundary:
the isolated `staging` environment existed, but its required protected values
were absent. The target guard rejected the run before Supabase CLI installation,
linking, migration capture, or any database command. No database was contacted
or changed. Configure the two project-reference variables and three secrets
listed above before repeating the baseline capture.

## 2026-08-23 protected-environment reconciliation

The isolated Staging and Production project-reference variables are now set in
the protected GitHub `staging` environment and are intentionally different.
The access token, database password, and direct database URL remain absent, so
the hosted workflow still fails closed before it can contact Supabase.

A data-free Staging migration-history manifest now pins the 30 observed remote
versions by ordered name, byte count, and SHA-256. It contains no SQL, database
URL, credential, user row, or payment data. The manifest is drift evidence, not
a replacement for the CLI-generated baseline, empty-database reset, or upgrade
proof required to close DAT-001.

## 2026-08-24 exact-main preflight evidence

GitHub Actions run `32759970707` evaluated the manual baseline workflow on
reviewed `main` commit `35214dae98df003d9792e08b77a235deebca93c1`.
The two protected project-reference variables were present and distinct, but
the Staging database URL, Supabase access token, and database password were not
configured as environment secrets.

The target guard rejected the run at step 3. Node setup, dependency
installation, Supabase CLI installation, project linking, baseline capture,
migration comparison, local-stack startup, SQL suites, advisors, and artifact
upload were all skipped. No Supabase project or database was contacted or
changed.

This is current fail-closed evidence, not DAT-001 completion. The next valid
run requires all three secret names in the protected `staging` environment and
must retain its generated data-free baseline and empty-database proof.
