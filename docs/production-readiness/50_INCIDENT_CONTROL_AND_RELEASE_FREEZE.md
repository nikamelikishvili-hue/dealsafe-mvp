# Incident control and release freeze

## Decision

Dealivra has a deterministic, fail-closed incident state machine and a local
release drill. It prevents an urgent incident from being marked resolved out
of sequence and prevents resolution from automatically reopening a release or
financial action.

The implementation is pure local policy. It does not page, publish, deploy,
change Vercel, access Supabase/Stripe, alter public access, or mutate any
customer or payment state.

## Incident declaration

Declarations contain only an incident reference, severity, fixed category,
public-impact boolean, and declaration time. Allowed categories are account
security, evidence integrity, payment integrity, privacy, service availability,
and third-party provider.

Critical and high incidents freeze the release gate. Payment-integrity
incidents also freeze financial safety. All incidents require evidence
preservation. A public-impact incident creates a status-draft requirement, not
an automatic publication.

## Ordered state model

The only normal path is:

```text
declared → triaged → contained → monitoring → resolved
```

A resolved incident may be reopened to triaged. Time cannot move backwards,
unknown/excess fields are rejected, and a direct declared-to-resolved command
fails. The first accepted transition activates evidence preservation.

`resolved` does not remove `frozen` or `review_required` release status and
does not unfreeze a payment action. Those decisions require independent
authorized review, complete evidence, and the normal release/payment controls.

## Status communication

Public-impact incidents may generate a short fixed draft for the current
state. The draft contains no cause, provider, customer, payment, account,
evidence, or security detail and always carries
`requires_authorized_review`. This code cannot publish a status update.

Incident-specific impact, affected regions, customer guidance, regulatory
notices, and post-incident reporting require Security/Privacy/Legal review.

## Evidence manifest

The manifest accepts at most 100 entries. Each contains only a fixed kind,
SHA-256 digest, and collection time. It deliberately excludes raw logs,
screenshots, request bodies, provider payloads, credentials, and customer
content. The original evidence remains in an approved restricted system with
its retention/legal-hold controls.

## Automated local drill

`npm run incident:drill` is part of the release verification chain. It proves:

- a critical declaration freezes release;
- premature resolution fails;
- triage, containment, monitoring, and resolution are ordered;
- final resolution remains frozen;
- the public message remains a draft;
- evidence stores a hash rather than raw content.

The drill uses no network, provider, database, credential, or live incident.

## Activation and completion gate

OBS-005 remains open until:

1. on-call roles and backups are assigned;
2. paging and acknowledgement targets pass in protected non-production;
3. status-page approval roles and templates are approved;
4. forensic storage, retention, Legal Hold, and access logging are verified;
5. a technical failure drill and cross-functional tabletop pass;
6. customer support, Privacy/Legal, payment, and executive escalation paths
   are exercised;
7. recovery and post-incident review timelines are measured;
8. the release/financial unfreeze process has separate authorization.

## Rollback

Policy rollback restores the prior reviewed source but may not erase an active
incident, evidence manifest, release freeze, financial hold, or audit history.
When policy behavior is uncertain, keep the gate frozen and escalate to the
named owner.
