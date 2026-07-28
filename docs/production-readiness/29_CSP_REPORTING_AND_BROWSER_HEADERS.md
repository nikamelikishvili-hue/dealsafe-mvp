# CSP reporting and browser security headers

This runbook governs Dealivra's browser-response security headers and
Content-Security-Policy violation reporting. It is a defense-in-depth control;
it does not replace output encoding, authorization, dependency review, or
application security testing.

## Enforced response policy

The application response policy must include:

- a restrictive `default-src 'self'` fallback;
- explicit `base-uri`, `object-src`, `frame-ancestors`, `form-action`,
  `script-src`, `style-src`, `font-src`, `img-src`, `media-src`, `connect-src`,
  `frame-src`, `worker-src`, and `manifest-src` boundaries;
- hashes for every reviewed inline script and no `unsafe-inline` script source;
- HTTPS upgrade for insecure subresources;
- HSTS, MIME sniffing prevention, clickjacking protection, a bounded referrer
  policy, and a restrictive Permissions Policy;
- `X-Permitted-Cross-Domain-Policies: none`; and
- both legacy `report-uri` and modern `report-to` routing to the same
  same-origin endpoint for current browser compatibility.

`Reporting-Endpoints` maps the `csp-endpoint` group to
`/api/security/csp-report`. The relative endpoint remains same-origin in every
environment, so Preview reports cannot be sent to production and production
reports cannot be sent to Preview.

## Reporting endpoint contract

`POST /api/security/csp-report` accepts only:

- `application/csp-report`;
- `application/reports+json`; or
- `application/json` for controlled compatibility clients and automated tests.

The endpoint:

1. rejects non-POST methods;
2. rejects unsupported media types;
3. caps the request at 16 KiB and a maximum of 20 reports;
4. accepts legacy CSP envelopes and modern Reporting API arrays;
5. returns `204` without exposing processing details;
6. sets `no-store`, `Pragma: no-cache`, and `nosniff`; and
7. records only an allowlisted, bounded diagnostic event.

The endpoint is deliberately unauthenticated because browsers can generate a
violation before a session exists. It performs no database write and grants no
new capability.

## Privacy and hostile-input boundary

CSP reports are attacker-controlled telemetry. Dealivra never logs these report
fields:

- script or style samples;
- the original policy;
- referrer;
- cookies, authorization headers, or request headers;
- request body outside the normalized event;
- full user agent; or
- query strings and URL fragments.

Diagnostic URLs retain only the `http` or `https` origin and a bounded coarse
path. UUIDs, long identifiers, email-like path segments, and long numeric
segments are replaced with `:id`. `data:` and `blob:` values retain only their
scheme. Every stored string and number is bounded.

The normalized event contains only:

- schema version and a generated report correlation ID;
- server receipt timestamp;
- effective and violated directive;
- enforcement disposition;
- bounded status, line, and column numbers; and
- privacy-scrubbed document, blocked, and source URLs.

No CSP report is customer-facing evidence, an accusation, or a risk decision.

## Monitoring and incident handling

Before a private beta, operations must:

1. route `dealivra.csp-violation.v1` structured events to a restricted
   observability destination;
2. alert on a material sustained increase by directive and environment, not on
   a single report;
3. exclude report content from customer support exports and analytics;
4. retain reports only for the approved security-observability period;
5. confirm alert ownership and an escalation destination; and
6. test that intentional violations are visible without exposing query values,
   path identifiers, or injected samples.

When a new third-party origin is needed, do not widen `default-src`. Add the
narrowest directive and exact origin only after security and privacy review,
then run the entire header/CSP test gate.

## Release and rollback evidence

Repository acceptance requires:

- exact header assertions from `vercel.json`;
- inline script hash verification;
- legacy and modern report payload tests;
- method, media-type, malformed-body, and size-limit negative tests;
- privacy-redaction assertions; and
- the complete type-check, test, build, and verification gate.

Environment acceptance additionally requires:

- successful Preview deployment;
- protected Preview navigation;
- actual response-header inspection;
- a synthetic privacy-safe violation received in the correct environment; and
- confirmation that anonymous Preview access still redirects to protection.

If reporting causes unexpected load or observability failure, remove only
`report-uri`, `report-to`, and `Reporting-Endpoints` through a reviewed rollback.
Keep the enforcing CSP and all other browser security headers active.

## Remaining launch gates

Repository implementation does not complete SEC-004 by itself. Before marking
the item complete, record Preview response evidence, the synthetic event,
retention ownership, alert ownership, and one rollback rehearsal. Production
custom domains remain unbound until the broader launch gate is approved.

## Standards references

- [MDN: CSP `report-to`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to)
- [MDN: CSP `report-uri`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-uri)
- [MDN: `Reporting-Endpoints`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints)
- [W3C Reporting API](https://www.w3.org/TR/reporting-1/)
