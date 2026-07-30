# Application bundle splitting

## Objective

Keep Dealivra's authenticated application shell reviewable and cacheable
without hiding oversized-chunk warnings or weakening runtime validation.

The public landing page already loads the authenticated application through a
dynamic import. This control adds a second boundary inside that application:
reviewed service and runtime-validation modules are emitted separately from the
large presentation/orchestration chunk.

## Implemented control

- Vite uses Rolldown's supported `output.codeSplitting.groups` configuration.
- Modules below `src/services/` are assigned to named `deal-services` chunks.
- Service dependencies are not captured recursively, avoiding accidental
  duplication or an unreviewed catch-all vendor bundle.
- A 240,000-byte group ceiling allows Rolldown to split the service boundary
  again when necessary.
- The maximum JavaScript chunk budget is reduced from 560,000 to 400,000 bytes.
- Development, build, and Preview use Vite's native configuration loader on
  the repository's pinned Node 24 runtime.
- No warning limit is increased, no warning output is suppressed, and total
  JavaScript/CSS budgets remain enforced.

## Verified local result

Before this change, the authenticated `app` chunk was 539.58 kB minified.
After splitting, it is 364.80 kB and the service boundary is emitted as two
chunks of 79.98 kB and 102.00 kB. The public entry chunk remains separately
cacheable. Total JavaScript remains below the existing 825,000-byte ceiling.

The exact content hashes are build-specific and are therefore not treated as
stable identifiers.

## Release evidence

A reviewed release must retain:

1. the complete `npm run verify` output;
2. the emitted asset size table;
3. the performance-budget result;
4. the production Preview smoke result;
5. a browser trace proving the landing page does not request the authenticated
   application before the user opens an application route;
6. a representative authenticated navigation trace with no missing chunk or
   CSP error.

## Rollback

Rollback consists of reverting the Vite code-splitting configuration and the
associated budget change together. Do not raise the chunk ceiling or suppress
the warning as a rollback. If a split produces a runtime cycle or failed asset
request, freeze the release, retain the failed build evidence, and revert the
whole reviewed commit.

## Activation boundary

This is a build-output change only. It does not activate a Vercel deployment,
change a Vercel or Supabase resource, access customer data, alter public
availability, enable payment/payout/refund behavior, or authorize Production.
