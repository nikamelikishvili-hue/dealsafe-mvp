# Server failure monitoring

## Decision

Unexpected Vercel service failures must leave an operator-actionable signal
without serializing an exception or customer/provider data. Dealivra classifies
the failure before the logging boundary and passes exactly a fixed schema,
machine boundary, and reviewed issue to `server/serverFailureReporter.mjs`.

This source change covers same-origin Auth Functions, the public catalog read,
and the server-side NHTSA VIN decoder. Payment Edge Functions keep their
separate correlation-rich, reviewed payment observability contract. CSP,
runtime-schema rejection, and browser failures keep their narrower dedicated
contracts.

## Exact record

The reporter accepts exactly:

| Field | Rule |
|---|---|
| `schema` | Fixed `dealivra.server-failure.v1` |
| `boundary` | Lowercase machine operation, 2–96 characters |
| `issue` | One reviewed issue allowlisted in source |

It writes:

- fixed `dealivra.server-failure-monitor.v1`;
- server-generated random event ID and occurrence time;
- bounded Vercel environment and reviewed release SHA;
- fixed event schema, boundary, and issue.

It does not accept an `Error`, cause, message, name, code, stack, URL, request
headers/body, IP address, cookie, authorization, account/session/Deal/case
identifier, email, VIN, catalog query, provider request/response, or arbitrary
metadata.

## Current classification

| Surface | Boundary | Issues |
|---|---|---|
| Auth proxy and privileged recovery | Internal `auth_*` operation | missing/invalid configuration, provider unavailable, unexpected failure |
| Public catalog | `catalog_read` | catalog unavailable |
| NHTSA VIN decoder | `vehicle_vin_decode` | provider unavailable, timeout, invalid response |

Expected customer errors are not server failures: invalid credentials,
provider throttling, invalid/unknown VIN, unsupported catalog category,
authorization denial, and invalid request input retain their existing bounded
customer/error telemetry paths.

## Operational gate

Before public release, the environment must prove:

1. Vercel runtime logs are restricted to named operations/Security owners;
2. any log drain receives only the exact record and uses encrypted transport;
3. raw retention is no more than 30 days and deletion is verified;
4. alerts aggregate only environment, release, boundary, and issue;
5. one protected synthetic for Auth provider outage, catalog unavailability,
   and VIN timeout produces the expected fixed record;
6. the corresponding customer response remains generic and contains no
   configuration/provider detail;
7. a rollback to the prior reviewed release restores service without changing
   the log privacy contract.

Initial alert policy:

| Signal | Initial condition | Action |
|---|---|---|
| First failure for a release/boundary | One event | Triage before promotion |
| Repeated surface failure | 5 events in 5 minutes | Notify the owning service on-call |
| Broad or sustained failure | 20 events or 3 boundaries in 5 minutes | Page application on-call and freeze promotion |
| Auth configuration failure | Any production event | Page Security/application owner immediately |

Thresholds require protected non-production tuning. A lack of logs is not
proof of health; the critical journeys also require uptime/synthetic checks.

## Rollback

Roll back the application release rather than weakening or enriching the
logging contract. Preserve only approved sanitized records for the incident
window. Do not add temporary exception dumps, provider bodies, request data, or
customer identifiers. Re-run the protected failure synthetics after recovery
and confirm both the safe customer response and fixed log record.

## Remaining scope

Repository tests prove normalization and the Auth/catalog/VIN wiring. External
drain/retention/alert evidence, deployed synthetics, and an inventory of every
remaining Supabase Edge Function and provider worker are required before
OBS-001 can close.
