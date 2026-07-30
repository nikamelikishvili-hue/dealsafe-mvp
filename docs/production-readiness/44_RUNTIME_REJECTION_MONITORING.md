# Runtime rejection monitoring

## Decision

Dealivra has one governed path for reporting a runtime request or response that
does not match its reviewed contract. The path is deliberately narrower than a
general error tracker. It can say which schema boundary rejected which bounded
reason, in which environment and release. It cannot send the rejected value or
any customer, transaction, credential, browser-location, or provider data.

The source is implemented for review and remains inactive. Production,
Preview, public access, Supabase, payments, and provider configuration are not
changed by this source change.

## Browser contract

`src/services/runtimeRejectionReporter.ts` accepts exactly:

| Field | Rule |
|---|---|
| `schema` | One versioned Dealivra request/response rejection schema |
| `boundary` | Lowercase machine identifier, 1–96 characters |
| `issue` | Lowercase machine reason, 1–96 characters |

Unknown and excess fields are rejected before a report is logged or sent. The
reporter:

- uses one central normalization function for every current validator;
- keeps the local console diagnostic restricted to the same three fields;
- suppresses the same signature from transport for 30 seconds;
- permits at most 20 transport attempts per browser minute;
- sends only in a production-mode build;
- uses a same-origin relative URL, `credentials: omit`,
  `referrerPolicy: no-referrer`, and a 1 KB server limit;
- treats transport failure as best-effort and never changes the customer
  operation result.

The reporter must never accept arbitrary metadata, `Error` objects, stack
traces, URLs, query strings, headers, user/session/Deal/case IDs, email,
address, message, description, amount, token, access code, tracking value,
evidence path/hash, or provider response.

## Intake and structured log

`POST /api/security/runtime-rejection` requires an exact same-origin request
with `application/json`. The function defaults to
`DEALIVRA_RUNTIME_REJECTION_MODE=staged`, returns `204`, and records nothing.
An unknown mode returns `503`. Only exact `enforced` mode validates and records
a report.

The accepted body contains exactly the three browser dimensions and
`occurrence_count` from 1 through 100. The server allowlist contains the exact
reviewed schemas and rejects unknown or future schemas until this document,
the tests, and the allowlist are reviewed together.

The complete enforced log contract is:

| Field | Source |
|---|---|
| `schema` | Fixed `dealivra.runtime-rejection-monitor.v1` |
| `event_id` | Server-generated random UUID |
| `received_at` | Server receipt time |
| `environment` | Bounded Vercel environment or `unknown` |
| `release` | Reviewed 40-character commit SHA or `unknown` |
| `event_schema` | Exact allowlisted rejection schema |
| `boundary` | Validated browser dimension |
| `issue` | Validated browser dimension |
| `occurrence_count` | Validated bounded count |

Request headers are used only for method, origin, host, content type, and size
validation. They are not included in the log. The endpoint does not log or
derive IP address, cookie, authorization, referrer, user agent, URL, customer
identifier, rejected payload, stack trace, or provider content.

## Activation gate

An authorized release owner may set a protected non-production environment to
`enforced` only after all of the following are recorded:

1. the exact reviewed commit is deployed behind access protection;
2. the log destination and access roles are approved;
3. raw event retention is no more than 30 days and deletion is verified;
4. a Vercel Firewall rule bounds POST volume to this endpoint without copying
   request identifiers into application logs;
5. alert ownership and an acknowledgement target are assigned;
6. a synthetic allowlisted rejection creates one sanitized event;
7. the event contains every expected dimension and none of the prohibited
   values;
8. switching back to `staged` stops new records after redeployment.

Production activation additionally requires at least seven days of protected
non-production evidence and Security/Privacy release approval. A browser rate
cap is cost containment, not an abuse boundary; Firewall enforcement is
mandatory before public activation.

## Initial alert policy

Alerts begin conservatively and must be tuned from non-production evidence:

| Signal | Initial condition | Owner action |
|---|---|---|
| New schema/boundary/issue signature | First occurrence for a release | Triage contract drift before promotion |
| Repeated signature | 10 events in 5 minutes for one release | Inspect the exact release; roll back if customer journey is impaired |
| Broad rejection cluster | 3 boundaries or 50 events in 5 minutes | Page the application on-call and freeze promotion |
| Intake unavailable | Synthetic event absent in two consecutive checks | Restore monitoring or keep the release blocked |

Alerts and dashboards aggregate only the fields in the structured log contract.
They must not enrich the event with customer/session/transaction identity.

## Synthetic proof

The synthetic check runs only in a protected non-production environment and
posts a fixed allowlisted event:

```json
{
  "schema": "dealivra.service.response-rejection.v1",
  "boundary": "synthetic_contract_probe",
  "issue": "synthetic_shape_invalid",
  "occurrence_count": 1
}
```

The check passes only when one matching sanitized event arrives within the
approved window, no prohibited dimension is present, and the alert path
acknowledges it. It must never use a real account, Deal, support case, payment,
or provider response.

## Rollback

1. Set `DEALIVRA_RUNTIME_REJECTION_MODE=staged` in the affected environment.
2. Redeploy the last reviewed commit and verify the endpoint returns `204`
   without a new structured record.
3. Keep the Firewall rule in place; do not broaden endpoint access during
   diagnosis.
4. Preserve only the already-approved sanitized events needed for the incident
   window.
5. Fix and re-run the protected synthetic proof before reactivation.

Monitoring rollback must never disable runtime validation. Invalid service data
continues to fail closed even when transport is staged or unavailable.
