# Logout JSON boundary

## Corrected endpoint classification

Logout accepts a bounded JSON body containing the requested revocation scope:
`local`, `others`, or `global`. It is therefore a JSON mutation, not a bodyless
cookie operation. The endpoint now requires canonical `application/json` after
method and same-origin validation and before parsing, provider contact, or
session revocation.

Refresh remains the only bodyless Auth mutation. The client already sends the
required media type, so valid sign-out behavior is unchanged.

## Verification

The API inventory classifies logout as `shared-json-mutation`. A negative test
proves unsupported media returns 415 without calling the Auth provider.

## Activation boundary

This correction does not revoke a live session, change Production, public
access, hosted configuration, live data, or real-money capabilities.
