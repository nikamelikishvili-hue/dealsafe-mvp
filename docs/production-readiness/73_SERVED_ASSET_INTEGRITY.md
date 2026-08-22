# Served asset integrity

## Objective

Prove that the HTML, JavaScript, CSS, fonts, service worker, and other static
files returned by an approved deployment are the exact bytes emitted for one
reviewed source commit. A successful source build is not sufficient evidence
when the deployed bytes, source commit, redirect target, or host differ.

## Build manifest

Every production build creates `dist/dealivra-asset-manifest.json` after Vite
finishes and before performance budgets run. The deterministic manifest
contains only:

- the exact lowercase source commit supplied by Vercel or GitHub, with local
  Git `HEAD` as the development fallback;
- sorted repository-safe output paths;
- byte counts and SHA-256 digests;
- aggregate asset count and byte count; and
- an explicit `hashes_only` content marker.

It excludes its own file, file contents, environment values, customer data,
credentials, request data, machine paths, timestamps, URLs, and deployment
tokens. Conflicting build-commit declarations fail closed.

The policy accepts at most 200 regular non-symlink files, 5 MB per file, and
20 MB in total. It requires `index.html`, `sw.js`, and at least one JavaScript
and CSS asset. Absolute, parent-relative, duplicate, unsorted, or unexpected
schema fields are rejected.

## Deployment verifier

The verifier requires three independent values:

1. the exact HTTPS deployment origin;
2. the exact expected 40-character source commit; and
3. an exact comma-separated allowlist of approved deployment hosts.

The verifier downloads the manifest without following redirects, validates
the source commit and bounded schema, and then downloads every listed asset
with four bounded workers. Each response must remain on the approved origin,
arrive without a redirect, stay within its declared byte limit, and match both
the declared byte count and SHA-256 digest.

The same verifier then requests every exact SPA deep link, including bounded
Deal and trust identifiers. Each must return the reviewed application shell
with browser security headers. It also verifies the Preview-only public origin
route, its HEAD and method contract, the unauthenticated protected-route
redirect, and an unknown sibling path that must return a real HTTP `404`.

Protected Preview access may use
`DEALIVRA_DEPLOYMENT_BYPASS_TOKEN`. The token is sent only after exact-host
validation, only in the Vercel protection header, and is never printed or
included in evidence.

## GitHub activation

`.github/workflows/served-asset-integrity.yml` always checks out the trusted
verifier from `main`; it never executes verifier code from the deployment
commit that receives the protected token.

Manual verification is available through `workflow_dispatch`. Automatic
verification of successful GitHub deployment events remains fail-safe and
default-off until the repository owner configures:

- repository variable `DEALIVRA_ALLOWED_DEPLOYMENT_HOSTS` with exact approved
  Vercel hostnames;
- optional secret `DEALIVRA_DEPLOYMENT_BYPASS_TOKEN` for protected Preview;
  and
- repository variable `DEALIVRA_SERVED_ASSET_VERIFICATION_ENABLED=enabled`.

The workflow must be exercised against a reviewed protected Preview before it
is made a required promotion check.

## Release evidence

The deterministic release evidence includes the served manifest, both
manifest scripts, the pure policy module, the trusted workflow, and the
manifest-creation check. The local Preview smoke test also re-fetches and
byte-compares every manifest asset.

The public manifest is sent with `no-cache, no-store, must-revalidate`.
Fingerprint-named `/assets/*` remain immutable.

## Failure and rollback

Any missing manifest, source-commit mismatch, unknown host, redirect, size
mismatch, hash mismatch, timeout, malformed response, or incomplete asset set
fails verification and freezes promotion. Do not bypass a mismatch or copy a
token into a URL.

Rollback restores the last deployment whose source commit and complete served
asset set pass this verifier. Disabling automatic verification is an incident
containment action, not approval for a mismatched release.

## Activation boundary

This repository change does not configure hosted variables or secrets, start
public access, promote a deployment, alter Supabase, access customer data, or
enable payment, payout, refund, dispute, or other real-money behavior.
