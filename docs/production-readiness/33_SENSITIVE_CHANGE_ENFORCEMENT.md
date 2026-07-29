# Sensitive-change enforcement

## Decision

The 72-hour post-recovery hold is enforced at the last trusted application
boundary before a sensitive provider or Auth mutation. It is not a UI-only
warning.

The guarded paths are:

| Scope | Guarded operation |
|---|---|
| MFA | Start enrollment, verify an unverified enrollment, remove a verified factor |
| Payout | Create or resume Stripe Connect onboarding |
| Payout | Release seller funds after an accepted deal |
| Payout | Resolve a dispute in the seller's favor with a transfer |
| Email | No account-email mutation exists in the current product; one may not be added without this guard |

An unverified MFA setup may still be cancelled during the hold. Login and a
fresh TOTP step-up remain available because blocking them would lock the user
out. A buyer refund remains available because it returns funds and does not
pay the recovered seller account.

## Staged rollout

`DEALIVRA_RECOVERY_CONTROL_MODE` accepts exactly:

- `staged`: integration code is present but does not call the unapplied RPC;
- `enforced`: every guarded path calls the database boundary and fails closed.

Missing configuration defaults to `staged` only so this reviewed code can be
deployed before the migration. Any other value blocks the sensitive mutation.

The variable must not be set to `enforced` until all of the following are true
in the same environment:

1. `supabase/privileged_mfa_recovery_control.sql` has been reviewed and applied;
2. its rollback-only contract passes;
3. Vercel and Supabase Edge Functions both receive the exact `enforced` value;
4. notification delivery and second-reviewer ownership are verified;
5. a controlled active-hold test returns HTTP `423` before any Auth or Stripe
   mutation;
6. a controlled expired-hold test permits the same operation;
7. rollback is rehearsed without deleting recovery history.

Recovery completion is prohibited while either runtime remains `staged`.
After activation, changing the mode back to `staged` is an incident-level
control bypass and requires the documented emergency change process.

## Failure behavior

- An active hold returns a stable, non-secret `423` response.
- An unavailable RPC, malformed mode, invalid result, or provider error blocks
  the sensitive mutation with `503`.
- No Auth factor, Stripe account link, financial command, or provider transfer
  is created before the relevant guard passes.
- Status reads, ordinary sign-in, step-up verification, cancellation of an
  unfinished factor, and buyer refunds remain available.

## Verification boundary

Repository tests prove the exact path wiring and staged/enforced behavior. The
database rollback proof verifies hold creation, expiration, grants, and RLS.
Production remains unchanged in this stage: the migration is unapplied and the
runtime switch is not activated.
