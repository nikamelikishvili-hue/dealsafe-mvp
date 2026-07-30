# Node provider response stream boundary

## Objective

Dealivra's Node server must stop oversized Supabase Auth and NHTSA VIN
responses while bytes are still arriving. A declared length is useful but is
not sufficient because a provider or intermediary can omit it or send more
bytes than declared.

## Reviewed contract

The shared Node reader:

- accepts only a native `Response` and a reviewed finite byte ceiling;
- rejects malformed or excessive `Content-Length` before reading;
- reads incrementally and cancels immediately when actual bytes exceed the
  ceiling;
- rejects unreadable streams and invalid UTF-8 with one fixed error that
  contains no response material;
- returns text only after the complete bounded stream has passed.

Supabase Auth retains its 262,144-byte ceiling, JSON media requirement,
10-second deadline, semantic response validation, rate-limit mapping, and
controlled empty 204 logout exception. NHTSA VIN retains its 256,000-byte
ceiling, 4.5-second deadline, reviewed field projection, hashed bounded cache,
and customer-safe manual-entry recovery.

## Verification

Release evidence must prove:

- a multi-chunk response is cancelled as soon as it crosses the configured
  actual-byte boundary;
- malformed and excessive declared lengths fail before semantic parsing;
- Auth accepts only its existing bounded JSON contract;
- VIN maps a boundary rejection to `VIN_PROVIDER_INVALID_RESPONSE`;
- direct `Response.text()` calls are absent from both governed parsers;
- the complete test, type, secret, build-budget, and Preview smoke gates pass.

## Monitoring and rollback

Monitor only the existing fixed invalid-provider-response categories. Never
record raw provider bodies, tokens, email addresses, VINs, or arbitrary
diagnostics. A regression freezes Auth/VIN promotion and rolls back to the
last verified application commit; do not restore whole-body reads or remove
the ceilings as an incident workaround.

## Activation boundary

This work is local and review-only. It contacts no provider, deploys no
endpoint, applies no migration, changes no environment setting, and mutates no
customer, Supabase, Vercel, Preview, Production, public-access, payment,
payout, refund, dispute, or real-money state.
