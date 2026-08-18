# Reporting request boundary

## Shared contract

Client-failure, runtime-rejection, and Web Vitals intake now use one server-only
request boundary. The shared control enforces POST, a canonical same-origin
HTTPS Origin (with HTTP allowed only for local development), normalized JSON
media, bounded body parsing, no-store response headers, and privacy-safe runtime
metadata.

Centralizing this logic prevents one diagnostic endpoint from silently drifting
to weaker host, origin, content-type, size, or response behavior. Endpoint-level
schemas, size ceilings, modes, and log allowlists remain deliberately separate.

## Verification

The API route inventory requires every local diagnostic route to invoke the
shared request and body controls. Foundation tests exercise malformed schemes,
credentials, paths, multi-host input, unsupported media, endpoint-specific size
limits, default-off modes, and fixed-schema logging.

## Activation boundary

This refactor does not enable monitoring, alter Production, change public access,
touch hosted configuration or live data, or activate payments.
