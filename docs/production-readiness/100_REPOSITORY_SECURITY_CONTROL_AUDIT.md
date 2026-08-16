# Repository security-control audit

Audit date: 2026-08-15

Scope: read-only GitHub repository controls for
`nikamelikishvili-hue/dealsafe-mvp`. This audit did not change settings,
alerts, branches, pull requests, deployments, or application data.

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

### Open CodeQL findings require triage

The read-only API returned ten open findings on `refs/heads/main`, all labelled
high severity by CodeQL:

| Alerts | Rule | Most recent path |
|---|---|---|
| `#10` | `js/clear-text-storage-of-sensitive-data` | `src/services/supabaseRest.ts` |
| `#8`, `#9` | `js/xss-through-dom` | `src/DealWorkspaceFeatures.tsx` |
| `#7` | `js/file-system-race` | `scripts/create-release-evidence.mjs` |
| `#2`–`#6` | `js/regex/missing-regexp-anchor` | `tests/foundation.test.mjs` |
| `#1` | `js/bad-tag-filter` | `tests/foundation.test.mjs` |

This table records scanner output, not a vulnerability conclusion. Each alert
must receive source-level review on the current candidate. A true positive
requires a tested fix; a false positive requires a reviewer, rationale,
affected commit, expiry/re-review condition, and retained dismissal record.
No alert should be dismissed solely to obtain a green merge check.

### Dependency alerts are not enabled

The Dependabot alerts API reported that alerts are disabled for this
repository. Before external private beta, enable dependency graph and
Dependabot alerts, confirm access for the named owner, define severity SLAs,
and prove one non-production alert-to-triage workflow. The repository's local
lockfile, license, install-script, SBOM, and audit gates remain useful defense
in depth but do not replace hosted advisory monitoring.

## Required verification after remediation

1. Capture the branch-protection response showing the intended approval count,
   code-owner/last-push policy, stale-review dismissal, administrator
   enforcement, signatures, conversations, and exact required checks.
2. Record disposition for every CodeQL alert against the exact release
   candidate; rerun analysis after each source fix and after the final rebase.
3. Verify Dependabot alert visibility with the named owner and record the
   triage SLA without copying advisory payloads or credentials into CI logs.
4. Open a synthetic pull request that cannot merge without the independent
   approval and all required checks. Update the head and prove stale approval
   is invalidated.
5. Bind the resulting evidence to the immutable candidate commit and retain it
   with the release record.

## Go/no-go effect

The current repository control state is **no-go for external private beta**.
A clean Draft PR, passing `verify`, and a `READY` Preview do not override the
missing approval requirement, unresolved scanner triage, or disabled hosted
dependency alerts.

### Activation boundary

This document does not modify GitHub controls, dismiss alerts, enable hosted
features, merge the review stack, promote Production, restore public access,
change Vercel or Supabase configuration, access customer data, or enable real
payments.
