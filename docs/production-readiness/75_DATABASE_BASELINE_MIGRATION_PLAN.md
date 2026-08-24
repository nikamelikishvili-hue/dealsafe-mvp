# Database baseline migration plan

## Objective

Close DAT-001 by replacing manually ordered setup SQL with a reproducible,
timestamped migration chain that can build an empty database and upgrade the
isolated Staging project. Production is not a baseline source or a test target.

## Protected source and prerequisites

Use only the isolated `dealivra-staging` project. Before connecting the CLI,
run the existing `npm run staging:database-target` guard with the protected
Staging environment variables. Confirm the CLI version and command surface
with `supabase --version`, `supabase db pull --help`, and
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
3. Run `supabase db pull dealivra_staging_baseline`. The CLI must create the
   timestamped baseline file; never invent its timestamp or filename.
4. Review the generated SQL for unexpected extension changes, especially
   `DROP EXTENSION`, and for any object outside the reviewed schemas.
5. Run `npm run database:baseline:verify`. The verifier requires the baseline
   to be first, canonical timestamp ordering, unique timestamps, no Auth user
   inserts, no connection URL or privileged credential, no deprecated
   extension version pin, and emits only file sizes and SHA-256 hashes.
6. Run `supabase migration list` and retain value-free local/remote alignment
   evidence.

`db pull` records the generated baseline as applied in the linked Staging
migration history. This is why the target guard and separate Staging project
are mandatory before capture.

## Empty-database proof

Use a local Docker-backed Supabase stack or a disposable non-Production
project:

1. run `supabase db reset` against the local stack;
2. run all 17 sorted `supabase/tests/*_rollback.sql` suites with
   `ON_ERROR_STOP=1`;
3. run Supabase database advisors and review every security finding;
4. run `npm run verify` and record the exact commit and migration hashes;
5. destroy the disposable environment or retain only synthetic `.invalid`
   fixtures.

Seed files may contain synthetic development data only. Never dump Production
data into `seed.sql`, and never use `--include-seed` against Production.

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
