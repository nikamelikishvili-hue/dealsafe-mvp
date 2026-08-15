# Authentication origin canonicalization

## Threat boundary

Every same-origin authentication mutation now validates a canonical Origin
rather than comparing only its host text. Public HTTP origins, credentials,
paths, queries, fragments, malformed forwarded hosts, multi-host lists, and
host path injection are rejected before provider contact.

Local development remains available only for `localhost` and `127.0.0.1` over
HTTP. Public origins must use HTTPS.

## Request-host rules

- Origin is parsed by the existing strict `requestOrigin` boundary.
- The platform-forwarded host is preferred when present.
- Host text is trimmed, length bounded, single valued, path free, and required
  to round-trip through URL host parsing.
- The canonical Origin host must exactly match the validated request host.
- Rejections return a bounded 403 response and do not call the Auth provider.

## Verification

Foundation tests cover a same-host path, insecure public HTTP, comma-separated
forwarded hosts, host path injection, and credential-like host input. Each
case verifies that the provider is never contacted.

## Activation boundary

This server-boundary change does not alter Production, public access, hosted
configuration, live Supabase resources, customer records, or payments.
