# Deterministic release evidence

## Objective

Bind every CI build to one exact reviewed source commit and retain a
machine-readable, privacy-safe manifest of the inputs and emitted browser
assets. A local build, an uncommitted worktree, or a different checkout must
not be able to present itself as release evidence.

## Fail-closed provenance boundary

The evidence job runs only after the complete repository verification and
high-severity dependency audit have passed. It then requires:

- a lowercase 40-character `GITHUB_SHA`;
- the same value in the explicitly requested release commit;
- the checked-out Git `HEAD` to equal that value;
- a clean repository with no uncommitted or untracked source;
- the running Node major to match both `.nvmrc` and `package.json`;
- a valid active catalog pointer; and
- a completed production build.

Failure of any condition prevents manifest creation and therefore fails CI.
The script has no network client and does not authorize or initiate a
deployment.

## Evidence contract

The bounded manifest records:

- schema version and exact commit;
- pinned Node major and active catalog version;
- the fixed set of checks that precede evidence creation, including the
  browser-storage and outbound-transport deny-by-default policies plus
  deterministic dependency-SBOM creation;
- repository-relative file paths only;
- byte count and SHA-256 for each governed input and emitted asset;
- a clean-tree declaration;
- an explicit `production_authorization: not_granted` marker.

The manifest accepts at most 200 regular files, no symlinks, no parent-path or
absolute-path references, no excess fields, at most 5 MB per file, and at most
20 MB in total. It must include the CI workflow, Node/config/lock files, active
catalog inputs, evidence/scanning/budget scripts, CodeQL workflow and scoped
ownership, the exact CycloneDX SBOM and its generator/policy, both
browser-storage and outbound-transport policy scripts, policy module, built
HTML, and at least one built JavaScript and CSS asset. A manifest that omits
any required policy result, control source, or SBOM is rejected.

Customer identifiers, Auth/session values, environment-variable values,
provider payloads, source contents, logs, absolute machine paths, and
deployment secrets are not included.

## Artifact retention

CI writes:

- `dependency-sbom.cdx.json`;
- `dependency-sbom.cdx.sha256`;
- `release-evidence.json`; and
- `release-evidence.sha256`, containing the manifest's own SHA-256.

GitHub retains the ignored output directory as a workflow artifact for 30
days. Missing artifact files fail the upload step. The artifact is supporting
evidence, not a deployment approval or long-term compliance archive.

## Required follow-up

Before Production promotion:

1. require the CI check through branch protection;
2. review the exact manifest from the successful merge commit;
3. verify the Vercel deployment source commit equals the manifest commit;
4. verify the served asset hashes against the retained manifest;
5. copy approved evidence to a restricted, retention-governed archive;
6. record named technical/security release approvers; and
7. block promotion whenever incident control reports a frozen release gate.

## Rollback

Revert this evidence policy, generator, and CI wiring only as one reviewed
change. Do not bypass a failed manifest, disable clean-tree verification, or
manually construct an artifact. A provenance mismatch freezes release and is
investigated as a supply-chain or process-integrity incident.

## Activation boundary

This change does not deploy, publish, promote, change branch protection, alter
Vercel or Supabase settings, access customer data, enable public access, or
authorize payment, payout, refund, dispute, or other real-money behavior.
