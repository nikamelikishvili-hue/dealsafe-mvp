# Authenticated RPC authorization matrix

## Purpose

Dealivra's signed-in database role is only an API transport role. It is not an
authorization decision. Every elevated RPC must independently bind its work to
the authenticated user, a deal-participant relationship, or the
server-controlled administrator role.

This standard governs all authenticated `SECURITY DEFINER` functions and the
rollback-only production test in
`supabase/tests/authenticated_rpc_cross_role_rollback.sql`.

## Role matrix

| Function class | Ordinary member | Seller | Buyer | Unrelated signed-in user | Administrator | Service role |
|---|---|---|---|---|---|---|
| Self-service profile, session, notification, saved-item, and payout-status RPCs | Own record only | Own record only | Own record only | Own record only | Own record unless an admin RPC is used | Explicit operational access |
| Published-deal actions before acceptance | Bounded action permitted by the deal state | Owner action | Prospective-buyer action | No private participant data | No implicit bypass | Explicit operational access |
| Accepted-deal records and actions | Participant relationship required | Permitted seller actions | Permitted buyer actions | Denied or zero rows | Participant access only unless a separate admin RPC exists | Explicit operational access |
| Administrator reporting and moderation RPCs | Denied with `Admin access required` | Denied unless also an administrator | Denied unless also an administrator | Denied | Permitted after the application-role check | Explicit operational access |
| Anonymous Deal Link projections | Reviewed public projection only | Same bounded projection | Same bounded projection | Same bounded projection | Same bounded projection | Explicit operational access |

No function may infer administrator status from client metadata, email address,
or a browser-supplied claim. `profiles.app_role`, read through
`is_dealsafe_admin()`, is the current server-controlled authority.

## Exact governed inventory

The production rollback suite locks the full 63-signature signed-in elevated
inventory. It fails if:

- a signed-in elevated function is added, removed, or changes signature;
- `PUBLIC` or `anon` gains execute access;
- `authenticated` or `service_role` loses the reviewed explicit grant;
- a fixed `search_path` is removed;
- the definition no longer contains a reviewed `auth.uid()` or administrator
  boundary.

The eight anonymous public-projection exceptions remain separately locked by
`security_definer_advisor_hardening_rollback.sql`.

## Dynamic production proof

The cross-role suite uses existing records without returning identity values or
changing persisted data:

1. It selects one administrator, one ordinary member, and one accepted deal
   with a seller, buyer, and unrelated ordinary member.
2. It applies transaction-local authenticated JWT context for each role.
3. It proves the ordinary member is denied by all five administrator readers
   and all three administrator mutators.
4. It proves the administrator passes the same role gate; mutators then reach
   their safe object-not-found guard when given a reserved nonexistent UUID.
5. It proves the unrelated user cannot read the accepted deal's action plan,
   delivery data, inspection, messages, offers, participants, payment record,
   timeline, protected-payment status, or shipping-evidence readiness.
6. It proves both actual participants retain their expected positive access.
7. It rolls the entire transaction back.

The test fixture deliberately excludes an unrelated user who previously asked
a question or made an offer on the selected deal, because those users may
legitimately retain access to their own pre-acceptance inquiry or offer.

## Change-control rule

Every new browser-callable elevated RPC must be classified in this matrix,
added to the exact inventory, receive both an allow and deny assertion where a
cross-user boundary exists, and pass the rollback suite against production
before merge. A failure is a release blocker; the test must never be weakened
to accommodate an unexplained result.

This evidence validates authorization behavior. It does not authorize public
launch, real-money processing, automatic payout, or removal of deployment
protection.
