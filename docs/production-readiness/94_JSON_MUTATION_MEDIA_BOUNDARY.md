# JSON mutation media boundary

## Request contract

Every same-origin endpoint that accepts a JSON body now requires the canonical
`application/json` media type before reading the payload or contacting a
provider. Parameters such as `charset=utf-8` remain accepted after normalized
media-type parsing.

The control covers signup, password login, recovery, password mutation, MFA,
logout scope selection, privileged MFA recovery, and VIN decoding. Cookie-only
refresh does not require a body and remains under the canonical POST and Origin
controls.

## Failure behavior

Missing, form, text, multipart, and other unsupported media types return a
bounded 415 response. Provider calls, credentials, database work, and body
normalization do not run after rejection.

The API route inventory now distinguishes JSON mutations from bodyless
same-origin mutations. Removing the shared media guard fails verification.

## Activation boundary

This server-boundary change does not alter Production, public access, hosted
configuration, live Supabase resources, customer records, or payments.
