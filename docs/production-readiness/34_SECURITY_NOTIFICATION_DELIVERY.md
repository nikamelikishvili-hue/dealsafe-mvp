# Security notification delivery

## Purpose

Privileged MFA recovery events must notify the verified account channel without
putting an email address, password, token, authenticator code, recovery code, or
identity document into the recovery database.

The database outbox therefore contains only a target user ID, a bounded
template key, a non-secret case reference, and—only on completion—the cooldown
deadline. The private worker resolves the current verified Auth email in server
context immediately before delivery.

## Worker boundary

`security-notifications` is a non-browser Supabase Edge Function:

- it accepts only `POST`;
- it has no CORS headers;
- a high-entropy bearer value is compared through fixed-size SHA-256 digests;
- `DEALIVRA_SECURITY_NOTIFICATION_MODE` must equal `enforced`;
- the service-role RPC claims at most 10 eligible jobs so bounded provider
  timeouts remain within the Edge execution budget;
- only a confirmed Auth email may receive a message;
- templates are fixed in code and reject unknown keys or malformed payloads;
- provider reads are capped at 16 KiB and time out after 10 seconds;
- Resend receives one deterministic idempotency key per outbox record;
- the database records only the provider delivery reference or a bounded
  failure code;
- a service-only health RPC returns ready, retrying, and dead-letter counts
  plus a bounded oldest-pending age without exposing a user, case, recipient,
  message, or provider reference.

Logs and HTTP responses contain counts and fixed error codes only. They do not
contain recipient addresses, user IDs, case payloads, provider response
messages, API keys, or message content.

## Delivery and retry behavior

The claim RPC uses `FOR UPDATE SKIP LOCKED`, five attempts, and a five-minute
retry interval. Provider timeout, rate limiting, and server errors use the same
outbox record and idempotency key. Resend documents a 24-hour idempotency
window, which covers the bounded retry schedule.

A successful provider response is not considered complete until the outbox
record stores its delivery reference. Invalid templates and missing verified
recipients fail safely. After five failed claims, the record remains
undelivered for operator review. The worker emits
`queue_attention_required/dead_letter_present` with aggregate counts and
returns `attention_required: true`; activation still requires an external
alert rule and a named owner for this condition.

## Activation gate

The worker and schedule must remain `staged` until:

1. a dedicated sending subdomain is verified with SPF and DKIM;
2. DMARC policy and aggregate-report ownership are documented;
3. the sender address and Resend account are approved for security mail;
4. the worker secret is generated outside source control and stored in
   Supabase Vault;
5. a Supabase Cron job invokes only the exact Edge Function with the Vault
   secret;
6. opened, approved, rejected, completed, retry, bounce, complaint, and
   suppression scenarios are verified;
7. retry exhaustion creates an owned alert;
8. the unsubscribe requirement is reviewed correctly: these are mandatory
   transactional security notices, not marketing mail;
9. privacy, retention, provider DPA, and incident-response owners approve the
   flow.

No domain record, Resend integration, Vault secret, Cron job, Edge deployment,
or Production environment value is created by this repository stage.

## Current references

- Resend send-email API and idempotency:
  `https://resend.com/docs/api-reference/emails/send-email`
- Resend domain verification:
  `https://resend.com/docs/dashboard/domains/introduction`
- Supabase server-only Auth user lookup:
  `https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid`
- Supabase scheduled Edge Functions and Vault:
  `https://supabase.com/docs/guides/functions/schedule-functions`
