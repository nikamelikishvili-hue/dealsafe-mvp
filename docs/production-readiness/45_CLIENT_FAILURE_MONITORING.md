# Client failure recovery and monitoring

## Decision

Dealivra must recover visibly from a render or asynchronous application-load
failure without copying an exception into the customer view or monitoring
system. Browser failures are classified only by a fixed reviewed category.
Error objects, messages, names, stacks, component stacks, event/rejection
values, URLs, browser state, customer data, and provider responses are never
accepted by the reporter.

The source is staged for review. It does not change a Vercel variable, drain,
Firewall rule, deployment, public access, Supabase resource, payment, or live
provider.

## Recovery behavior

The root React boundary reports a fixed `application_render /
react_render_failed` category and shows one accessible recovery screen with:

- a non-technical loading-failure explanation;
- `Try again`;
- `Return to home`; and
- confirmation that no transaction action completed on that screen.

A failed dynamic application import reports `application_bootstrap /
bundle_load_failed` and renders the same recovery screen. Localization startup
failure reports a fixed category but continues with the existing safe fallback.
Global browser errors and unhandled promise rejections report fixed
`browser_runtime` categories. The handlers do not receive or forward the event
payload.

The U.S. address autocomplete reports only whether the Google Places provider
failed to load, a suggestion request failed, or selected place details could
not be read. The typed address, selected result, API response, URL, and API key
are never attached. Manual address entry remains available after every failure.

## Browser contract

`src/services/clientFailureReporter.ts` accepts exactly one of:

| Boundary | Issue |
|---|---|
| `application_render` | `react_render_failed` |
| `application_bootstrap` | `bundle_load_failed` |
| `application_bootstrap` | `localization_initialization_failed` |
| `browser_runtime` | `window_error` |
| `browser_runtime` | `unhandled_promise_rejection` |
| `address_autocomplete` | `provider_load_failed` |
| `address_autocomplete` | `suggestion_request_failed` |
| `address_autocomplete` | `place_details_failed` |

The schema is fixed to `dealivra.client-failure.v1`. Unknown combinations and
excess fields are rejected. Transport is restricted to production-mode builds,
deduplicates the same category for 30 seconds, allows at most 10 attempts per
browser minute, omits credentials/referrer data, and cannot interrupt the
customer operation.

## Intake and log contract

`POST /api/security/client-failure` requires exact same-origin JSON and accepts
at most 512 bytes. Missing `DEALIVRA_CLIENT_FAILURE_MODE` defaults to `staged`,
returns `204`, and records nothing. Invalid mode returns `503`. Exact
`enforced` mode accepts only the eight reviewed category pairs plus a count from
1 through 100.

The complete structured record is:

- fixed schema `dealivra.client-failure-monitor.v1`;
- server-generated random event ID and receipt time;
- bounded Vercel environment and reviewed release SHA;
- fixed event schema, boundary, issue, and count.

The endpoint does not log or derive the IP address, cookie, authorization,
referrer, user agent, URL, Error, message, stack, component, browser state,
customer identifier, application record, or provider content.

## Activation and alert gate

Protected non-production enforcement requires:

1. an approved log drain with least-privilege access;
2. no more than 30 days of raw retention with verified deletion;
3. a Vercel Firewall threshold for the exact endpoint;
4. a named application on-call and acknowledgement target;
5. a synthetic render and a synthetic bundle-load failure on the reviewed
   release;
6. proof that the recovery screen is usable by keyboard and mobile viewport;
7. proof that each record contains only the approved dimensions; and
8. a switch back to `staged` followed by proof that no new record is written.

Initial alerts:

- first new category for a release: triage before promotion;
- five identical failures in five minutes: inspect the release and affected
  journey;
- 20 client failures or three categories in five minutes: page the application
  on-call and freeze promotion;
- two consecutive missing protected synthetic results: keep the release
  blocked.

Production enforcement needs seven days of protected non-production evidence,
Security/Privacy approval, and a rehearsed rollback. Browser throttling is not
an abuse boundary; public activation requires the Firewall rule.

## Rollback

Set `DEALIVRA_CLIENT_FAILURE_MODE=staged`, redeploy the last reviewed commit,
and verify the endpoint returns `204` without creating a record. Keep the
Firewall rule and the customer recovery screen. Monitoring rollback must never
remove the React boundary, dynamic-import recovery, customer-safe message, or
fixed-category local diagnostic.
