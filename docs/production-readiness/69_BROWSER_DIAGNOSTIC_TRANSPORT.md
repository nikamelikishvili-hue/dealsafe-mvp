# Browser diagnostic transport

## Objective

Client failures, runtime-contract rejections, and Web Vital buckets must be
observable without creating three separate, open-ended browser network
boundaries. Diagnostics must never contain customer context or delay the
customer's operation.

## Transport contract

One shared best-effort transport accepts only these same-origin endpoints:

- `/api/security/client-failure`, at most 512 encoded bytes;
- `/api/security/runtime-rejection`, at most 1,024 encoded bytes;
- `/api/security/web-vital`, at most 512 encoded bytes.

The transport independently revalidates the exact schema and key set for the
selected endpoint, including permitted client-failure pairs, bounded
runtime-rejection dimensions, valid Web Vital rating/bucket combinations, and
an occurrence count fixed to one. It then serializes the fixed-schema object,
measures UTF-8 bytes, and rejects extra-key, inconsistent, empty, cyclic,
excessive, or unknown-endpoint input before network access. It sends POST JSON
with omitted credentials, no referrer, keepalive, and a 5-second abort
deadline.

The response is intentionally ignored. A failure is swallowed without retry,
logging a provider response, or changing customer state. Existing per-reporter
signature cooldowns and minute limits remain the first abuse boundary.

## Verification

Automated coverage proves:

1. exact allowlisted payloads produce only the reviewed endpoints and JSON;
2. an extra privacy-sensitive field, an inconsistent dimension pair, an
   excessive payload, and an unknown endpoint are rejected;
3. no-browser execution performs no transport;
4. all three reporters delegate to the shared transport;
5. the transport has the reviewed deadline and privacy options;
6. the deny-by-default network inventory observes one diagnostic fetch rather
   than three independent fetches;
7. the full type, test, secret, build, budget, and Preview-smoke gate passes.

Before activation of any monitoring intake, a protected Preview must prove
accepted, oversized, unavailable, timeout, rate-limit, navigation/pagehide,
and disabled-mode behavior without URL, user, device, payload, or credential
leakage.

## Rollout and rollback

The monitoring modes remain default-off until their separate ownership,
retention, alerting, and privacy gates pass. If the shared transport causes a
compatibility issue, keep monitoring disabled while investigating; it must
not block application startup or customer actions.

Rollback reverts the three callers and shared transport together. Do not add
an arbitrary endpoint, increase a byte limit, attach credentials, remove the
deadline, or add automatic retries without security and privacy review.

No diagnostic was sent and no endpoint, environment, provider, Supabase,
Vercel, Preview, Production, public-access, customer, payment, payout, refund,
dispute, or real-money state was changed by this local control.
