# Payment request boundary

Status: implemented locally; protected Preview deployment evidence remains
required.

## Objective

Authenticated payment endpoints must reject ambiguous or resource-intensive
browser bodies before database commands or Stripe requests. Browser-side
schemas improve usability but are never the server authority.

## Shared rules

Request bytes are consumed through the shared streaming body reader. The
reader cancels the stream as soon as it exceeds the payment ceiling; it does
not allocate an unbounded `Request.text()` value when `Content-Length` is
missing or dishonest.

Connect, Checkout, payout release, and dispute resolution accept:

- an active authenticated request that has already passed exact-origin checks;
- `Content-Type: application/json` with an optional UTF-8 charset;
- a declared and actual UTF-8 body size no larger than 8,192 bytes;
- one non-null JSON object; and
- only the keys explicitly allowed for that endpoint.

| Endpoint | Allowed keys |
|---|---|
| Stripe Connect | `action`, `dealPublicId` |
| Checkout | `dealId` |
| Payout release | `dealId` |
| Dispute financial resolution | `disputeId`, `decision`, `note` |

Required values and their detailed formats remain enforced by the endpoint
after the shared structural boundary.

## Rejection behavior

Unsupported media types, malformed/negative/oversized content lengths, empty
bodies, invalid JSON, arrays, scalar values, excess keys, and bodies over the
actual byte limit fail before payment configuration, RPC, or provider access.
The customer receives one safe request error and HTTP 413 only for excess
size; no submitted field/value or parser detail is returned or logged.

The signed Stripe webhook is deliberately excluded from the payment JSON
schema because signature verification requires the unmodified raw text. It
still uses the shared streaming reader under a separate 262,144-byte webhook
ceiling before signature verification.

## Release evidence

Before deployment, tests must prove:

1. valid bodies reach the existing endpoint validation;
2. every rejected body performs no database or provider call;
3. multi-byte Unicode cannot bypass the byte ceiling;
4. an incorrect declared length and a large chunked body fail;
5. excess and prototype-like keys fail;
6. customer errors and operational records contain no request content;
7. Connect, Checkout, payout, refund, and seller-release authorization still
   fail for unauthorized users; and
8. webhook signature verification is unchanged.

## Rollback

Rollback restores the previously reviewed Edge Function set together. A
rollback must not increase the size limit, accept generic form content, or
remove exact-key validation as an emergency workaround. If a legitimate
client request fails, capture only its schema/version and byte count in a
controlled test, correct the reviewed contract, and redeploy.

## Activation boundary

This change does not deploy an Edge Function, parse a real request, contact
Stripe, access a database, or authorize real-money operation.
