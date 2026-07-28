# SECURITY DEFINER governance

## Purpose

Dealivra uses elevated database functions only where Row Level Security cannot
express the complete transaction safely. Every browser-callable function must
have an explicit role grant, fixed `search_path`, bounded inputs and outputs,
and internal ownership or application-role authorization.

An advisor warning is not accepted merely because a function is convenient.
Each exception must be necessary, reviewed, tested, and listed here.

## Anonymous exception allowlist

The anonymous role can execute only these elevated, read-only projections:

| Function | Public purpose | Privacy boundary |
|---|---|---|
| `get_public_deal(text)` | Opens a valid Deal Link | Returns the reviewed listing projection; hidden or unavailable deals are excluded |
| `get_deal_acceptance_protection(text)` | Shows whether a buyer code is required | Returns one boolean, never the code or hash |
| `get_deal_risk_assessment(text)` | Shows explainable safety signals | Returns bounded labels and score, not reports or participant records |
| `get_public_agreement_history(text)` | Shows published agreement versions | Returns published terms and aggregate acceptance count |
| `verify_agreement_record(text,text)` | Verifies a published agreement fingerprint | Requires a 64-character fingerprint and returns one bounded match |
| `get_public_seller_declaration(text)` | Shows seller attestation state | Returns only attested state and timestamp |
| `get_public_seller_trust_profile(text)` | Shows Deal Link seller trust summary | Returns aggregate reputation, not contact or identity data |
| `get_public_trust_passport(text)` | Opens an opted-in trust passport | Returns only the user-approved public aggregate |

These functions intentionally remain `SECURITY DEFINER` because anonymous users
have no direct table access. `PUBLIC` receives no execute grant. Any addition,
signature change, output expansion, or write behavior requires a new security
review and allowlist test.

## Active-session pre-request hook

`enforce_active_auth_session()` is `SECURITY INVOKER`. It does not need owner
rights:

- anonymous and trusted service requests return without a protected lookup;
- authenticated requests call the separately protected
  `is_current_auth_session_active()` helper;
- the helper remains `SECURITY DEFINER`, has a fixed empty `search_path`, and
  is executable only by `authenticated` and `service_role`;
- PostgREST continues to call the pre-request hook for every Data API request.

This removes an unnecessary anonymous elevated endpoint without weakening
immediate session revocation.

## Signed-in function rule

An authenticated grant is not authorization by itself. Elevated application
functions must check one of:

- the current user owns or participates in the target deal;
- the target row is bound to `auth.uid()`;
- the current user has the required server-controlled application role;
- a service-only provider command is invoked by `service_role`.

Administrative RPCs remain callable by the signed-in API role so that the
application can reach them, but must deny ordinary members inside the function.
Cross-role allow/deny tests remain mandatory before public beta.

## Advisor interpretation

- `RLS enabled, no policy` is intentional only for service-owned ledgers and
  projection source tables that browser roles cannot access directly.
- The eight anonymous `SECURITY DEFINER` warnings above are reviewed public
  projection exceptions, not general table access.
- Any other anonymous elevated function is a release blocker.
- Auth leaked-password protection is a separate Auth configuration gate and
  remains a release blocker until enabled and verified.

Reference remediation:
[Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
and
[password security](https://supabase.com/docs/guides/auth/password-security).
