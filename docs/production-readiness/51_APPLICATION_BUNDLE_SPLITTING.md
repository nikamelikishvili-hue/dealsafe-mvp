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
- Modules below `src/services/` and their reviewed dependencies are assigned
  to the named `deal-services` boundary.
- Service dependencies are captured recursively so shared domain, currency,
  media, and evidence-policy helpers cannot be emitted back into the app chunk
  and create an `app -> service -> app` initialization cycle.
- A 400,000-byte group ceiling keeps the service boundary within the enforced
  JavaScript chunk budget without splitting that dependency closure apart.
- The maximum JavaScript chunk budget is reduced from 560,000 to 400,000 bytes.
- Development, build, and Preview use Vite's native configuration loader on
  the repository's pinned Node 24 runtime.
- No warning limit is increased, no warning output is suppressed, and total
  JavaScript/CSS budgets remain enforced.

## Verified local result

With the hosted Supabase and Google Maps configuration shape enabled, the
reviewed diagnostic build emits a 350.21 kB authenticated `app` chunk and one
202.93 kB dependency-complete service chunk. The public entry chunk remains
separately cacheable at 220.74 kB, and total JavaScript remains below the
existing 825,000-byte ceiling. The service chunk has no import back to the app
or public entry chunk.

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

Rollback consists of restoring the last reviewed dependency-complete service
boundary and its associated budget together. Do not disable recursive
dependency capture, raise the chunk ceiling, or suppress the warning as a
rollback. If a split produces a runtime cycle or failed asset request, freeze
the release and retain the failed build evidence before reverting.

## Activation boundary

This is a build-output change only. It does not activate a Vercel deployment,
change a Vercel or Supabase resource, access customer data, alter public
availability, enable payment/payout/refund behavior, or authorize Production.
