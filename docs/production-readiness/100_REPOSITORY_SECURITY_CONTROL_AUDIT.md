# Repository security-control audit

Audit date: 2026-08-21

Scope: GitHub repository controls for `nikamelikishvili-hue/dealsafe-mvp`.
The follow-up observation is bound to `main` commit
`a91e84b6085bdd94a0b844b4a9d80884d9700ff5`. Hosted secret scanning, push
protection, vulnerability alerts, and Dependabot security updates were enabled
before this record was refreshed. This audit did not dismiss alerts, weaken
branch protection, change deployments, or access application data.

## Observed controls

The `main` branch currently enforces:

- strict required checks named `verify`, `Analyze JavaScript and TypeScript`,
  and `Vercel`;
- signed commits;
- administrator enforcement;
- linear history;
- resolved review conversations; and
- denial of force pushes and branch deletion.

These controls are valuable but do not independently establish approval or
finding resolution.

## Release-blocking gaps

### Independent approval is not enforced

The branch requires zero approving reviews. Code-owner review and last-push
approval are also disabled. Before external private beta, `main` must require
at least one independent approval from the designated security/release owner,
dismiss stale approvals, and require approval of the final pushed revision.
The organization must retain a documented emergency exception path rather than
bypassing this control informally.

### Current hosted finding queues are clear

The GitHub APIs returned zero open CodeQL findings on `refs/heads/main`, zero
open Dependabot alerts, and zero open secret-scanning alerts at the audited
commit. The ten high-severity CodeQL findings recorded by the 2026-08-15 audit
were remediated in source and the current main-target analysis passed. This is
evidence for the audited commit, not a permanent exemption from future scanner
triage.

Every new finding still requires source-level review on the exact candidate. A
true positive requires a tested fix; a false positive requires a reviewer,
rationale, affected commit, expiry or re-review condition, and retained
dismissal record. No alert should be dismissed solely to obtain a green merge
check.

The CodeQL workflow runs for pushes to `main`, pull requests whose base is
`main`, the weekly schedule, and manual dispatch. The current stacked Draft
pull requests target their preceding review branches, so their green `verify`
and Vercel results do not include the required `Analyze JavaScript and
TypeScript` check. The final main-target pull request must run CodeQL on the
fully assembled exact head; earlier component PR results cannot substitute for
that final analysis.

### Dependency advisory monitoring is enabled

Vulnerability alerts and Dependabot security updates are enabled. The hosted
queue contained zero open alerts at the audited commit. The local lockfile,
license, install-script, SBOM, and high-severity audit gates remain required
defense in depth. Before external private beta, the named owner must still
prove access and retain one synthetic or historical non-production
alert-to-triage record against the documented severity SLA.

### Hosted secret detection and push prevention are enabled

The repository security-and-analysis response reports `enabled` for secret
scanning and secret-scanning push protection. It reports `disabled` for
non-provider pattern scanning and validity checks; those optional capabilities
must not be represented as active. The deterministic local secret gate remains
required and complements the hosted controls.

Before external private beta, assign bypass review to a named security owner
and prove the block/approved-bypass/revocation workflow with a non-secret
synthetic fixture. Never upload a real credential to test the control. Any
future finding must be treated as potentially exposed: revoke first, then
investigate and document remediation without copying the value into an issue
or log.

## Required verification after remediation

1. Capture the branch-protection response showing the intended approval count,
   code-owner/last-push policy, stale-review dismissal, administrator
   enforcement, signatures, conversations, and exact required checks.
2. Confirm that the exact release-candidate pull request is based on `main`,
   reports zero open CodeQL findings, and passes the required `Analyze
   JavaScript and TypeScript` check for its exact head. Record disposition for
   any finding that appears after the audited commit and rerun analysis after
   each source fix and final rebase.
3. Verify the enabled Dependabot alert visibility with the named owner and
   record the triage SLA without copying advisory payloads into CI logs.
4. Verify the enabled hosted secret scanning and push protection with a
   non-secret synthetic token pattern, including named bypass review and a
   recorded revocation exercise.
5. Open a synthetic pull request that cannot merge without the independent
   approval and all required checks. Update the head and prove stale approval
   is invalidated.
6. Bind the resulting evidence to the immutable candidate commit and retain it
   with the release record.

## Go/no-go effect

The current repository control state remains **no-go for external private
beta**, but hosted dependency monitoring, secret scanning, and push protection
are no longer blockers. A clean pull request, passing `verify`, and a `READY`
Preview do not override the missing independent approval requirement or the
remaining hosted workflow exercises.

### Activation boundary

This document does not modify GitHub controls, dismiss alerts, enable hosted
features, merge the review stack, promote Production, restore public access,
change Vercel or Supabase configuration, access customer data, or enable real
payments.
