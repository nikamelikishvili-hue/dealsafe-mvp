# API mutation-origin inventory

## Release control

Every application API route is now enumerated in a fail-closed policy. A new
route cannot enter the repository verification gate until it is classified as
read-only, shared same-origin, local same-origin telemetry, or intentionally
cross-origin browser reporting.

## Modes

- Shared same-origin routes must use the canonical POST and Origin guards.
- Local same-origin telemetry must enforce POST and its reviewed local guard.
- Read-only routes must retain explicit GET method handling.
- CSP browser reporting is the only intentional cross-origin intake and must
  retain media allowlisting, a streamed byte ceiling, bounded batch parsing,
  and privacy-safe normalization.

The inventory currently covers all fifteen files under `api/`. Missing,
unexpected, or weakened routes fail verification.

## Activation boundary

This repository gate does not alter Production, public access, hosted
configuration, live Supabase resources, customer records, or payments.
