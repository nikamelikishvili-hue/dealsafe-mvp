# Payment provider error and observability standard

## Purpose

PAY-004 gives customers one safe explanation and support reference while giving
operators enough sanitized detail to locate the corresponding Dealivra
operation, Stripe request, financial command, or webhook delivery.

This control applies only to the US Stripe Sandbox beta. It does not enable
real-money mode, automatic payout, the public custom domain, or a public launch.

## Customer error contract

Every protected payment Edge Function failure returns:

- a reviewed customer-safe `error` message;
- a bounded machine `code`;
- a server-generated UUID `correlationId`;
- a `retryable` boolean;
- `Cache-Control: no-store`; and
- the same value in `X-Dealivra-Correlation-Id`.

The browser displays the safe message and support reference. It never displays:

- a raw Stripe message, payload, request body, stack, or database error;
- a provider request identifier;
- a secret, card, bank, identity, address, email, or session value; or
- a claim token, idempotency key, internal account ID, or service-role detail.

Unknown exceptions fail closed as `payment_service_error`. Only explicitly
constructed `PaymentOperationError` messages are customer-visible.

## Provider normalization

The Stripe adapter parses only bounded provider type/code fields and the
validated `request-id` response header.

| Condition | Dealivra code | HTTP | Retry |
|---|---|---:|---|
| Stripe rate limit | `provider_rate_limited` | 503 | Yes |
| Provider/API outage | `provider_unavailable` | 503 | Yes |
| Network failure | `provider_network_error` | 503 | Yes |
| Provider authentication/configuration | `provider_configuration_error` | 503 | No |
| Rejected provider request | `provider_request_rejected` | 502 | No |
| Unknown Dealivra failure | `payment_service_error` | 500 | No |

Financial calls that may have succeeded at Stripe but were not safely recorded
are not returned as ordinary provider failures. They use a reconciliation code
and remain blocked from blind retry.

## Structured operator record

Sanitized log entries use schema `dealivra.payment.operation.v1` and contain:

- timestamp, severity, operation, event, outcome, and elapsed milliseconds;
- the Dealivra correlation ID;
- bounded Dealivra and provider codes;
- HTTP/provider status and retryability;
- validated Stripe request ID when available;
- internal deal, command, or Stripe event identifier when applicable.

The logger accepts only fixed fields and bounded identifiers. It does not accept
arbitrary objects, provider messages, request bodies, headers, user text, or
stack traces.

`stripe_financial_commands` persists the correlation ID and validated Stripe
request ID. `stripe_webhook_events` persists the correlation ID. Both tables
remain RLS-enabled and service-role-only.

## Operations exception queue

`stripe_payment_operation_exceptions` is a service-only, security-invoker view
covering:

- failed financial commands;
- financial commands whose five-minute claim lease is stale;
- failed webhook events; and
- webhook events whose five-minute processing lease is stale.

The queue contains identifiers, bounded codes, state, attempts, and timestamps.
It contains no raw provider payload or customer data.

## Monitoring and alert policy

Private-beta operations must monitor:

| Signal | Initial threshold | Response |
|---|---:|---|
| Any reconciliation-required code | 1 | Freeze the command and open an operations case |
| `provider_configuration_error` | 1 | Disable the affected payment action and page the payment owner |
| Failed/stale exception queue | 1 for 5 minutes | Investigate by correlation ID before retry |
| Provider 5xx/network failures | 3 in 5 minutes | Pause new Checkout creation if sustained |
| Webhook `apply_failed` or `claim_failed` | 1 | Preserve Stripe retry and inspect the event ledger |
| Invalid signatures | 10 in 5 minutes | Security review; do not weaken signature verification |

No alert automatically releases, refunds, retries, or changes financial state.

## Support workflow

1. Ask the customer only for the displayed support reference.
2. Locate the structured log by `correlation_id`.
3. Join to the service-only command or webhook ledger.
4. When needed, locate the provider request in Stripe using
   `provider_request_id`.
5. Verify current provider and Dealivra state before any retry.
6. Record the resolution in the approved case/audit workflow.

## Release and rollback

Release requires:

- migration and rollback-only database evidence;
- browser-role denial for the ledgers and exception view;
- tests proving raw provider messages cannot reach customer responses or logs;
- deterministic correlation in response body/header, structured logs, and
  service-only records;
- negative HTTP checks and a synthetic provider-failure log lookup;
- protected Preview, CI, and exact-commit production evidence.

Rollback the Edge Functions first if customer errors regress. The added columns,
indexes, and service-only view are forward-compatible and may remain in place;
dropping correlation evidence during an active financial investigation is not
an approved rollback.
