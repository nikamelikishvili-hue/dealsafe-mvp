# Sanitized operational alert policy

## Decision

Dealivra has one deterministic policy for converting reviewed monitoring
records into non-identifying counters and operator alerts. It deliberately
does not forward or retain the input record. Correlation IDs, provider request
IDs, Deal IDs, customer identifiers, URLs, messages, headers, and arbitrary
extra fields disappear before the snapshot is returned.

The policy is implemented locally for review. It is not connected to a log
drain, dashboard, paging provider, schedule, Preview, Production, Supabase,
Stripe, or customer data.

## Accepted monitoring families

The classifier recognizes only these existing fixed schemas:

- runtime contract rejection;
- client failure;
- server failure;
- poor Web Vital bucket;
- failed protected synthetic result;
- Auth throttling or invalid-credential rejection;
- CSP violation;
- payment operation failure, integrity/configuration error, or invalid
  signature;
- security-notification worker/queue failure.

Unknown schemas and malformed values produce no counter. Payment input may
contain service-only correlation fields, but the output contains only a fixed
counter name. The classifier never serializes, logs, returns, or enriches the
source record.

Each input window is capped at 10,000 records and 1–15 minutes. Its metadata is
restricted to environment, reviewed release SHA (or `unknown`), normalized
window start, and duration.

## Initial alerts

| Alert | Threshold in one window | Severity | Fixed response |
|---|---:|---|---|
| Critical journey failed | 1 | Critical | Freeze release and page application owner |
| Payment integrity/reconciliation event | 1 | Critical | Freeze affected financial action and page payment owner |
| Payment provider configuration failure | 1 | Critical | Disable affected action and page payment owner |
| Security notification failure | 1 | High | Page Security and preserve the queue |
| Invalid payment signatures | 10 | High | Notify Security; preserve verification |
| Payment provider failures | 3 | High | Notify payment owner and pause promotion |
| Server failure cluster | 5 | High | Page application owner and freeze release |
| Client failure cluster | 5 warning / 20 high | Warning/High | Notify or page and freeze release |
| Runtime contract rejection cluster | 10 warning / 50 high | Warning/High | Investigate drift or page and freeze |
| Auth abuse cluster | 20 warning / 50 high | Warning/High | Notify/page Security and review Firewall |
| CSP violation cluster | 20 | Warning | Investigate policy/injection change |
| Poor Web Vital cluster | 20 | Warning | Review release performance |

Every output alert contains only a fixed schema, code, severity, observed
count, threshold, and fixed action. The action is an instruction for an
authorized human/runbook. The policy cannot call a provider or release,
refund, retry, cancel, block, or mutate anything.

## Activation gate

Before connecting this policy to an external drain:

1. prove the drain contains only reviewed source schemas;
2. configure 30-day-or-shorter raw retention and longer aggregate-only
   retention where approved;
3. name application, Security, and payment alert owners and backups;
4. map every fixed action to an approved incident runbook;
5. run one protected synthetic per critical/high alert;
6. prove duplicate events do not create paging storms;
7. prove the resulting snapshot contains none of the discarded input values;
8. rehearse acknowledgement, escalation, recovery, and disablement.

Threshold tuning requires protected non-production evidence and a documented
change. Thresholds must not be raised solely to silence an unexplained alert.

## Rollback

Disconnect paging first while keeping sanitized event collection available,
then restore the last reviewed policy. Do not replace the classifier with raw
log forwarding. No rollback may automatically alter a payment, account,
support case, dispute, access-control rule, or public-release state.
