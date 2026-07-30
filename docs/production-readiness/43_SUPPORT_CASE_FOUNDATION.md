# Private support-case foundation

## Status

OPS-001 and OPS-002 have a staged local implementation for review. It is not
applied to Supabase and is not enabled in any browser environment. The source
provides private member intake, bounded SLA targets, a minimal privileged
queue, atomic assignment, case-scoped detail, append-only conversation
history, resolution, and material audit events.

This is a production foundation, not permission to operate customer support.
Activation still requires a named queue owner, escalation/on-call coverage,
monitored SLA alerts, trained operators, retention approval, and deployed
cross-account authorization evidence.

## Customer contract

A signed-in member can:

- open at most five active cases;
- select one reviewed category;
- optionally associate a Deal only when the member is its buyer or seller;
- see only cases they opened;
- read the complete conversation for their own case; and
- reply while the case is active.

The customer projection contains a public support reference, optional public
Deal identifier, category, subject, status, priority, deadlines, timestamps,
and messages. It does not expose internal account UUIDs, operator UUIDs,
internal Deal UUIDs, notes, provider diagnostics, or queue metadata.

The UI explicitly warns customers never to submit passwords, authenticator
codes, full card numbers, or government identity numbers. Safety concerns use
the shortest response target, but the UI states that support is not an
immediate-emergency channel.

## Queue and assignment contract

`support`, `compliance`, and `admin` roles require current AAL2 before any
queue or operator action. The open queue returns only:

- public support reference;
- category and priority;
- active status;
- whether the case is unassigned or assigned to the viewer;
- first-response and resolution deadlines; and
- creation/update timestamps.

It deliberately omits subject, message, requester, Deal, address, identity,
payment, evidence, and contact data. An operator receives full case detail
only after atomically claiming the case. A different operator cannot browse
the claimed case. Reply and resolution require the same assignment and AAL2.

## Storage and audit contract

- `support_cases` and `support_case_messages` have RLS enabled.
- `public`, `anon`, and `authenticated` receive no direct table privileges.
- Browser access is only through the reviewed RPC allowlist.
- Message rows are append-only; update, delete, and truncate are rejected.
- Open, claim, reply, and resolve operations append immutable material audit
  events without copying message or subject content into audit metadata.
- One active case per requester, Deal-or-general context, and category is
  enforced with a partial unique index.
- A transaction advisory lock prevents concurrent requests from bypassing the
  five-active-case limit.

## SLA model

| Category | Priority | First response target | Resolution target |
|---|---|---:|---:|
| Safety concern | Urgent | 1 hour | 24 hours |
| Other reviewed categories | Normal | 24 hours | 72 hours |

These are product targets, not guarantees. Before activation, an operations
owner must define business hours, after-hours escalation, breach alerts,
handoff rules, closure/reopen policy, and customer copy approved by counsel.

## Browser and service boundary

`VITE_SUPPORT_CASES_ENABLED` must equal exactly `enabled` before the member
support center renders. Missing, empty, malformed, or different values fail
closed. The flag is browser-visible and must never be treated as
authorization.

Every support request, success response, and reviewed error envelope is
runtime validated. Unknown keys, invalid identifiers, excessive text, control
characters, unexpected states, duplicate rows/messages, inconsistent
summaries, invalid ordering, and contradictory deadlines fail closed.
Diagnostics include only schema, boundary, and bounded issue; they exclude
case references, subject/message text, participant identity, and provider
content.

## Governed activation

1. Review `supabase/support_case_setup.sql` and its dependency order.
2. Verify rollback and backup/restore ownership.
3. Apply only to an isolated Staging project.
4. Run `supabase/tests/support_case_authorization_rollback.sql`.
5. Prove customer A cannot list/read/reply to customer B's case.
6. Prove password-only privileged sessions cannot queue, claim, read, reply,
   or resolve.
7. Prove AAL2 privileged sessions see only minimal unassigned/mine queue data.
8. Prove claim is atomic and another operator cannot read the claimed case.
9. Prove every material action creates a privacy-safe immutable audit event.
10. Configure the queue owner, SLA alerts, escalation, retention, and runbook.
11. Enable the browser flag in protected Staging and test keyboard, mobile,
    failure, refresh, and duplicate-submission journeys.
12. Approve Production separately; never copy a Staging approval.

## Rollback

Disable `VITE_SUPPORT_CASES_ENABLED` first. This hides the UI and stops new
browser support RPC calls without weakening database controls. Preserve case,
message, and audit records under the approved retention policy. Revoke RPC
execute privileges before any schema rollback. Do not drop tables or messages
as an incident response shortcut.

## Current non-activation boundary

No live Supabase table, policy, grant, function, customer record, Preview,
Production deployment, public access setting, payment, payout, refund, or
real-money state changed. All SQL and UI changes remain on the protected local
review branch, and the browser gate defaults to off.
