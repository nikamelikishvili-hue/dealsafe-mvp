# Auth provider request allowlist

## Objective

Dealivra's server Auth proxy may call only the reviewed Supabase Auth
operations required by the application. A programming mistake or future
unreviewed caller must not be able to turn the shared helper into an arbitrary
Supabase Auth or REST client.

## Allowed Auth operations

The boundary permits only these route/method pairs:

| Operation | Method | Provider route | Bearer token |
|---|---|---|---|
| Create account | POST | `signup` | No |
| Password login | POST | `token?grant_type=password` | No |
| Refresh session | POST | `token?grant_type=refresh_token` | No |
| Password recovery | POST | `recover?redirect_to=<verified origin>` | No |
| Load current account | GET | `user` | Required |
| Change/reset password | PUT | `user` | Required |
| Enroll TOTP | POST | `factors` | Required |
| Challenge TOTP | POST | `factors/<UUID>/challenge` | Required |
| Verify TOTP | POST | `factors/<UUID>/verify` | Required |
| Remove unfinished/verified TOTP | DELETE | `factors/<UUID>` | Required |
| Revoke session scope | POST | `logout?scope=local|others|global` | Required |

Recovery accepts only the exact percent-encoded origin already validated from
the same-origin request. Additional query parameters, fragments, traversal,
admin routes, arbitrary REST paths, malformed factor identifiers, and unknown
logout scopes are denied.

## Request contract

- Shared Auth requests may contain only `method`, `headers`, and `body`
  options.
- Authenticated routes require exactly one `Authorization: Bearer ...` input
  header; anonymous routes reject caller-supplied headers.
- The helper supplies the reviewed API key and JSON media type itself.
- GET and DELETE routes reject bodies.
- POST and PUT routes require a valid non-array JSON object.
- Serialized outbound JSON is limited to 16,384 UTF-8 bytes.
- Protected REST RPC parameter objects use the same serialization and byte
  limit before network access.
- Rejected paths and bodies are never included in the fixed customer-safe
  boundary error.

## Verification

Automated release checks cover every allowed route plus:

- traversal and arbitrary admin/REST destinations;
- extra query parameters and unsupported logout scopes;
- wrong method and missing/extra authorization;
- body on a bodyless route;
- scalar, array, malformed, and oversized Unicode JSON;
- unexpected fetch options;
- invalid Auth destinations and oversized protected RPC parameters failing
  before provider access;
- the full signup/login/recovery/password/MFA/logout regression suite.

## Change control

Adding a provider route is a security change. The review must document:

1. why the existing allowlist cannot satisfy the operation;
2. its exact method, path, query, authentication, and body schema;
3. customer authorization and MFA requirements;
4. negative tests and customer-safe failure behavior;
5. logging, rate-limit, timeout, and rollback evidence.

Do not add wildcard Auth paths or accept arbitrary query strings.

## Rollback

Rollback is a reviewed redeployment of the last known-good application
commit. Do not bypass the allowlist to restore a failed Auth feature. If a
legitimate provider API changed, keep the affected operation unavailable
until its new exact contract is reviewed and tested.

## Activation boundary

This implementation is local and review-only. It does not contact Supabase,
change a Supabase/Vercel setting, deploy an endpoint, mutate customer data,
activate public access, or enable payments.
