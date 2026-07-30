# Evidence request boundary

## Objective

Evidence upload, signed access, lifecycle, legal-hold, deletion, alert, and
scheduled-maintenance actions must reject an unbounded or unreviewed request
before authentication-provider, database, Storage, or case-state work begins.

## Shared streaming boundary

The common request reader:

- validates a base-10 `Content-Length` when present;
- reads the body as a byte stream and cancels immediately above the configured
  limit;
- rejects unreadable and invalid UTF-8 streams without returning body content;
- never calls `Request.text()` or `Request.json()` on a potentially unbounded
  request.

Payment JSON now uses this reader with its existing 8,192-byte maximum.
Evidence JSON uses a 16,384-byte maximum.

## Evidence action contract

Evidence requests must use `application/json` with optional UTF-8 charset and
contain one non-array object. The `action` selects an exact allowed-key set:

- file actions: `request-upload`, `finalize-upload`, and `signed-url`;
- lifecycle actions: `snapshot`, `refresh-inventory`, `approve-deletion`,
  `place-legal-hold`, `release-legal-hold`, and `acknowledge-alert`;
- scheduled work: `run` with optional bounded `limit`.

Unknown actions, extra keys, arrays, scalar values, null, malformed JSON,
invalid lengths, and oversized bodies fail closed. Existing action-specific
UUID, role, reason, MIME, size, participant, AAL2, operator, hold, audit, and
scheduled-secret checks remain authoritative.

## Ordering and failure behavior

Browser evidence JSON is validated before `requireUser` contacts the Auth
provider. Scheduled JSON is validated before the maintenance RPC. This keeps
malformed or oversized work away from external services.

Boundary failures use fixed customer-safe evidence errors:

- oversized requests return HTTP 413;
- wrong media types return HTTP 415;
- other invalid shapes return HTTP 400.

No rejected request text, action payload, filename, evidence identifier,
legal-hold reason, alert identifier, secret, or participant detail is logged
or returned.

## Verification

Automated coverage proves:

- valid exact action objects pass;
- unreviewed actions and extra keys fail;
- wrong media types, malformed shapes, multi-byte Unicode overflow, and
  declared overflow fail;
- a multi-chunk stream is cancelled after crossing its byte limit;
- payment JSON no longer uses unbounded `Request.text()`;
- evidence endpoints contain no direct `Request.json()`;
- browser action validation precedes Auth-provider access;
- the full application release gate remains green.

## Rollout and rollback

Exercise every allowed action and every failure category in an
access-protected Preview with Sandbox resources. A provider compatibility
issue must be fixed by narrowing or paginating the request contract, not by
restoring unbounded parsing. Rollback is a reviewed deployment of the prior
known-good commit.

## Activation boundary

This implementation is local and review-only. It does not invoke an Edge
Function, contact Supabase or Stripe, apply a migration, change evidence or
customer data, deploy Preview/Production, enable public access, or enable any
payment capability.
