# Runtime service validation

## Status

ARC-004 slices 1 through 19 are implemented locally for review. They establish
small, dependency-free runtime validation boundaries for the Deal data that
drives the primary customer workspace and for browser-facing Auth, session,
TOTP MFA, protected-payment/Stripe, governed evidence/lifecycle, and
administrator dispute, safety-report, finance, and catalog-adoption success
responses, plus participant notifications, chat, offers, inquiries, public
seller trust, Digital Trust Passport, and explainable Deal risk projections.
Later slices validate the matching browser requests and provider error
envelopes, Deal mutation/media ownership, delivery/handoff, account activity,
canonical agreement records, the account-name mutation, and the read-only
historical payment receipt. The nineteenth slice adds exact staged
support-case request, response, and error contracts. ARC-004 remains open
until governed monitoring and deployed contract fixtures have equivalent
controls.

## Covered service responses

The first slice validates and normalizes:

- the signed-in user's Deal list and Deal draft create/update/publish results;
- saved Deal records;
- the public Deal Link projection;
- the participant-specific Deal action plan; and
- seller shipping-evidence readiness.

The second slice validates and normalizes:

- account creation with either a verified session or an email-confirmation
  requirement, rejecting contradictory states;
- password login with either a complete session or a bounded MFA challenge;
- refresh and MFA-verified session responses;
- MFA assurance status and verified TOTP factor summaries; and
- TOTP enrollment identity, device label, bounded Base32 secret, bounded
  `otpauth://` URI, and restricted inline SVG.

The third slice validates and normalizes:

- the participant-visible protected-payment status projection;
- seller Stripe Connect readiness;
- Stripe-hosted seller onboarding redirects;
- Stripe-hosted Checkout redirects; and
- administrator-approved dispute refund or seller-transfer confirmations.

Protected-payment rows must contain one reviewed status, safe integer amounts,
a supported currency, balanced item/fee/seller amounts, valid timestamps,
consistent seller payout flags, and one participant role. Paid states require
`paid_at`; released, refunded, and disputed states require their matching
authoritative event timestamps, which cannot precede payment. Stripe redirect
responses are accepted only for exact HTTPS origins owned by Stripe and
bounded, unexpired lifetimes. Financial resolution responses require the
matching sandbox-style refund or transfer identifier and reject contradictory
provider identifiers.

The fourth slice validates and normalizes:

- evidence upload intake IDs, quarantine bucket, participant/deal-bound Storage
  paths, and short-lived expiration;
- finalized and participant/case-visible evidence metadata, including scan,
  integrity, retention, and deletion-state invariants;
- exact-origin, short-lived private evidence viewer URLs and verified file
  metadata before the existing byte/hash verification runs;
- evidence lifecycle snapshots, inventory acknowledgements, deletion approval,
  legal hold, and alert acknowledgement responses; and
- administrator dispute queue rows, including reviewed state, payment state,
  currency, amount, timestamps, and resolution-state consistency.

Evidence rows must preserve the database contracts for clean scanning,
verified integrity, lifecycle deletion, and metadata redaction. Finalized
uploads must match the requested Deal and uploader role. Quarantine upload
paths must match the authenticated user, Deal, and intake identifiers exactly.
Private viewer URLs must remain on the configured Supabase HTTPS origin and
inside the signed `deal-evidence` Storage path.

The fifth slice validates and normalizes:

- the signed-in user's bounded, newest-first notification feed;
- participant chat messages in chronological order;
- newest-first Deal offers with safe integer amounts and reviewed states;
- buyer questions, seller replies, and reply-timestamp consistency;
- the scalar seller-role check and created inquiry/report identifiers; and
- the administrator safety-report queue, including moderation, resolution,
  uniqueness, and open-first ordering.

Own notification events must already be marked read. Message bodies, inquiry
text, names, titles, and report text are bounded before they reach React.
Collections reject duplicate identifiers and unexpected ordering. UUIDs,
public Deal IDs, booleans, timestamps, statuses, amount ranges, and
open/resolved report state are checked against the existing RPC contracts.

The sixth slice validates and normalizes:

- the exact administrator-access boolean returned by the role-check RPC;
- the single-row U.S. revenue summary, including safe aggregate amounts,
  counts, and released/protected/refunded partition consistency;
- the bounded newest-first protected-payment transaction ledger, including
  unique payment and Deal identifiers, balanced item/fee/seller amounts,
  reviewed payment states and currencies, and timestamp order; and
- privacy-preserving catalog-adoption rows for the requested 7, 30, or 90 day
  window, including unique version/category dimensions, safe aggregate counts,
  structured brand/model consistency, and count-descending order.

The catalog parser returns only the reviewed aggregate dimensions and measures.
Unexpected Deal, participant, address, serial, evidence, payment-provider, or
other fields never enter the application model. Administrator authorization
continues to be enforced by the existing server-side RPC checks.

The seventh slice validates and normalizes:

- the zero-or-one-row explainable Deal risk assessment;
- the zero-or-one-row public seller trust profile;
- the authenticated user's single Digital Trust Passport settings row;
- the Passport enable/disable mutation's public identifier; and
- the zero-or-one-row opt-in public Digital Trust Passport.

Deal risk responses must contain the exact reviewed signals in database-defined
order. Mutually exclusive account-age and media-count signals cannot coexist;
`no_flags` must be the sole zero-score signal; and the score, level, and signal
weights must agree, including the bounded community-report contribution.
Public seller and Passport reputation counts must be nonnegative safe integers.
Rating averages must be null when there are no ratings and otherwise remain in
the 1–5 range at one-decimal precision. Passport sales and purchases must sum
to completed Deals, recent ratings are limited to five, and rating history must
remain newest-first. Passport identifiers must be exact 12-character uppercase
hex values generated by the existing database contract.

The eighth slice validates and normalizes:

- account creation and password-login requests;
- refresh, password-recovery request, and password mutation commands;
- local, other-session, and global sign-out commands;
- MFA list, enrollment, challenge/verification, cancellation, and removal
  commands;
- bearer tokens used by the password, sign-out, and MFA proxies; and
- every non-success Auth proxy envelope, including optional reviewed error code
  and bounded 429 retry guidance.

Auth request objects must contain only the exact operation-specific keys. Email
and display-name inputs are normalized within reviewed bounds; new passwords
preserve the existing 12-character complexity rule; existing login/current
passwords remain compatible with historical credentials; MFA factors use
UUIDs; TOTP codes contain exactly six digits; and bearer tokens must have a
bounded JWT shape before entering an Authorization header. Password recovery
cannot carry a current password, password change must carry one, and a new
password cannot equal the current password.

Auth error bodies must contain one bounded customer-safe message and may carry
only a bounded machine-readable code and 429 retry delay. Retry guidance is
accepted only for status 429, must remain between 1 and 300 seconds, and must
agree between the body and `Retry-After` header when both are present. Unknown
fields, raw provider diagnostics, malformed status/code/message values, and
contradictory retry metadata fail closed.

Every Auth success response is parsed only after the proxy reports a successful
HTTP status. The client rejects malformed JWT-shaped access tokens, invalid
user/factor UUIDs, invalid email or timestamps, duplicate factor identifiers,
out-of-range expirations, inconsistent MFA removal state, and unsafe enrollment
SVG content. A `refresh_token` in any reviewed browser success envelope is an
explicit rejection because refresh credentials belong only in the server-set
HttpOnly cookie.

The validator rejects a response before it reaches React when the payload is
not the expected array/object shape, exceeds a bounded row or media count, uses
an unsupported enum, contains an unsafe integer, carries an invalid timestamp,
or exceeds a field-length limit. Optional database `null` values are normalized
to the service model where appropriate.

The seventeenth slice validates and normalizes:

- Deal creation, private-draft update, publication, published-Deal edit, and
  seller cancellation requests;
- saved-Deal and public Deal reads, including canonical public identifiers;
- buyer acceptance names, optional six-digit buyer access codes, and the
  exact three-result acceptance response;
- media upload batches, database media records, owner-bound public media URLs,
  deletion paths, and complete unique reorder requests; and
- the published-Deal agreement-version response and every reviewed PostgREST
  error envelope used by these operations.

Amounts must be positive safe integers within the reviewed Deal-record bound.
Titles, descriptions, serial suffixes, conditions, handoff methods, currencies,
expiry periods, timestamps, and catalog identity columns are canonicalized
before network use. Catalog IDs and labels must preserve their dependencies,
and vehicle years cannot appear outside the vehicle category.

Media URLs must use the configured Supabase origin, the public `deal-media`
bucket path, the signed-in owner's UUID, the selected Deal UUID, a UUID file
name, and one reviewed extension. Query strings, fragments, credentials,
foreign origins, path confusion, duplicate reorder entries, and batches over
six files fail closed. Database or provider messages are validated but never
forwarded to customers.

The eighteenth slice validates and normalizes:

- the account-name update request used for Auth metadata and the private
  profile row;
- reviewed Supabase Auth and PostgREST error envelopes for the name update;
- the zero-or-one-row historical payment receipt still shown on completed
  legacy Deals; and
- historical payment method, participant role, event timestamps, and state
  dependencies.

Account IDs and names are normalized before network use. Local account state
changes only after Auth metadata and the profile row both succeed. If the
profile update fails after Auth succeeds, the client performs a best-effort
compensating Auth update to the previous display name and reports only a fixed
customer-safe error.

The pre-Stripe payment acknowledgement mutations are not valid financial
truth. Their four unused browser exports are removed, their authenticated RPC
allowlist entries are removed, and the Stripe migration's explicit revocations
remain authoritative. The read-only historical receipt remains available for
existing completed records and is runtime validated before display.

The nineteenth slice validates and normalizes:

- customer support-case creation, list, detail, and reply requests;
- minimal AAL2 operator queue, claim, reply, and resolution commands;
- customer case summaries, chronological case-scoped messages, SLA targets,
  assignment state, priority, and reviewed status transitions; and
- reviewed PostgREST error envelopes without forwarding provider messages.

Support request objects accept only reviewed category, public reference,
optional Deal UUID, subject, message, queue scope, and resolution fields.
Customer text is trimmed and bounded before network use. Response collections
reject unknown fields, duplicates, inconsistent case summaries, invalid
message authors, contradictory timelines, resolved cases in an active queue,
and incorrect priority/SLA ordering.

The support center is staged behind `VITE_SUPPORT_CASES_ENABLED=enabled`.
Missing, empty, or any other value keeps the UI hidden and prevents support
RPC calls. This exact browser gate is a rollout control only; it does not grant
permission.

## Failure and monitoring contract

Invalid responses fail closed with one customer-safe error. The browser emits
only this bounded diagnostic envelope:

```text
schema: dealivra.service.response-rejection.v1
boundary: one reviewed boundary identifier
issue: one bounded machine-readable reason
```

The response body, Deal identifiers, names, addresses, descriptions, media
paths, tokens, and other customer data are never included in the diagnostic.
Every current runtime request/response validator now routes this exact envelope
through one governed reporter. The reporter keeps local diagnostics useful,
deduplicates the same signature for 30 seconds, caps transport at 20 events per
browser minute, omits credentials and referrer data, and never lets monitoring
failure block the customer operation.

The same-origin `/api/security/runtime-rejection` intake is default-off through
`DEALIVRA_RUNTIME_REJECTION_MODE=staged`. Enforced mode accepts only the 26
reviewed schemas and three bounded dimensions plus an occurrence count. It
adds only a random event ID, receipt time, environment, and release before
writing a structured log. It does not inspect or log a URL, cookie, referrer,
user agent, customer identifier, IP address, rejected value, or provider
response. See
[44_RUNTIME_REJECTION_MONITORING.md](44_RUNTIME_REJECTION_MONITORING.md) for
activation, alert, retention, synthetic proof, and rollback controls.

Payment response rejection uses the same privacy rule and emits only
`dealivra.payment.response-rejection.v1`, the reviewed boundary, and a bounded
issue. Amounts, checkout URLs, provider identifiers, failure messages,
correlation identifiers, and customer data are excluded.

Evidence response rejection emits only
`dealivra.evidence.response-rejection.v1`, the reviewed boundary, and a bounded
issue. Evidence names, paths, hashes, signed URLs and tokens, participant
names, dispute reasons and notes, amounts, identifiers, and provider errors are
excluded.

Communication and safety-report response rejection emits only
`dealivra.interaction.response-rejection.v1`, the reviewed boundary, and a
bounded issue. Message and inquiry bodies, replies, participant and reporter
names, notification and listing titles, report reasons and resolution notes,
amounts, identifiers, and provider errors are excluded.

Administrator finance and catalog rejection emits only
`dealivra.admin.response-rejection.v1`, the reviewed boundary, and a bounded
issue. Amounts, counts, transaction and Deal identifiers, listing titles,
participant names, catalog dimensions, timestamps, and provider errors are
excluded.

Public trust and risk rejection emits only
`dealivra.trust.response-rejection.v1`, the reviewed boundary, and a bounded
issue. Public identifiers, display names, verification state, reputation
counts, ratings, timestamps, risk scores, signals, and provider errors are
excluded.

Auth request and error rejection emits only
`dealivra.auth.boundary-rejection.v1`, the reviewed operation boundary, and a
bounded issue. Email addresses, names, passwords, TOTP codes, factor IDs,
access tokens, server error messages, provider diagnostics, retry values, and
unknown fields are excluded.

Deal mutation request/error rejection emits only
`dealivra.deal-mutation.boundary-rejection.v1`, the reviewed boundary, and a
bounded issue. Deal and participant identifiers, titles, descriptions,
serials, cancellation reasons, media URLs/paths, access codes, typed names,
amounts, catalog values, and provider diagnostics are excluded. Invalid
mutation success responses use
`dealivra.deal-mutation.response-rejection.v1` under the same privacy rule.

Account-name rejection emits only
`dealivra.account-mutation.boundary-rejection.v1`, the reviewed boundary, and
a bounded issue. Account identifiers, display names, provider messages, and
profile details are excluded.

Historical payment request and response rejection emits only
`dealivra.legacy-payment.boundary-rejection.v1` or
`dealivra.legacy-payment.response-rejection.v1`, the reviewed boundary, and a
bounded issue. Deal and participant identifiers, payment events, methods,
timestamps, and provider errors are excluded.

Support-case request and response rejection emits only
`dealivra.support.boundary-rejection.v1` or
`dealivra.support.response-rejection.v1`, the reviewed boundary, and a bounded
issue. Case references, Deal identifiers, subject/message text, participant
identity, assignment, provider errors, and unknown fields are excluded.

## Authorization boundary

Runtime validation is not authorization. It does not make a public projection
private, grant a participant access, or prove that a database row belongs to
the viewer. Supabase RLS and grants remain authoritative, and server-side RPC
and Edge Function checks continue to own transaction and role decisions.

Any future validator expansion must preserve least-privilege Data API grants,
RLS on exposed tables, explicit RPC authorization, and bounded public
projections. A TypeScript type or a successful browser parse must never be
treated as permission.

Auth runtime validation also does not establish identity or authorization. The
Supabase Auth provider, server proxy, signed access token, MFA assurance claim,
RLS, grants, and server-side role checks remain authoritative. Display metadata
is presentation-only. The browser request parser does not replace server-side
method, same-origin, size, session, rate-limit, password, MFA, or authorization
checks. The same-origin proxy remains the authority that converts provider
errors into reviewed customer-safe messages.

Payment runtime validation is also not payment confirmation. Stripe-signed
webhooks, immutable server-owned financial snapshots, fenced database
commands, Supabase authorization, and provider reconciliation remain
authoritative. A successful browser parse can display or redirect the user but
cannot release, refund, or settle funds.

Evidence runtime validation is not case authorization and does not make a
Storage object readable. Data API grants and RLS remain authoritative for the
safe evidence view. The evidence Edge Function continues to authorize the
participant or case reviewer and issue the signed URL; the browser still
revalidates the returned origin, expiry, size, MIME type, and SHA-256 bytes
before display.

Communication runtime validation is not participant authorization. Existing
Data API grants, RLS, and RPC ownership/participant checks remain authoritative
for notifications, chat, offers, inquiries, and safety reports. A valid message
or report shape never grants access to the underlying Deal or moderation queue.

Administrator runtime validation is not administrator authorization, financial
reconciliation, or catalog governance approval. The server-side administrator
role check, Data API grants, RLS, RPC authorization, Stripe-signed records,
immutable financial snapshots, and governed catalog release remain
authoritative.

Public trust runtime validation is not an identity endorsement, fraud
decision, or authorization grant. The existing SQL visibility rules,
moderation exclusion, Passport opt-in, Data API grants, and RPC execution
permissions remain authoritative. Risk signals are an explainable advisory
projection and do not prove that a seller or Deal is safe or unsafe.

Support runtime validation is not case authorization. The support tables deny
direct browser access. Security-definer RPCs restrict customers to their own
cases, expose only a minimal queue to privileged roles with current AAL2, and
return full case detail to an operator only after atomic assignment. Database
role, assignment, MFA, append-only message, audit, rate/duplicate, and SLA
controls remain authoritative.

## Remaining ARC-004 work

- activate and prove the staged privacy-safe rejection transport in a protected
  non-production environment with an approved drain, alert, Firewall rule,
  retention control, synthetic event, and rollback rehearsal; and
- add contract fixtures or integration tests for the deployed Supabase
  projections before external beta.

## Activation boundary

No Supabase resource, schema, policy, migration, RPC, Edge Function, customer
data, Preview, Production, public access, payment, payout, dispute, delivery,
or real-money behavior changed. The SQL changes are reviewed source changes
only and were not applied to a database. This slice validates the existing
account-name, historical-receipt, and staged support-case boundaries and
prevents revoked pre-Stripe payment mutations from being re-granted by a
future hardening run.
