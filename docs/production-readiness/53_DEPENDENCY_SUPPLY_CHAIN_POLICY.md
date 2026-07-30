# Dependency supply-chain policy

## Objective

Make dependency provenance, integrity, license, and install-script changes an
explicit review event. A passing vulnerability audit is necessary but does not
prove that the lockfile came from the reviewed registry or that a new package
cannot execute an unreviewed installation script.

## Enforced offline gate

The full repository verification now checks every locked package before
TypeScript or application tests run. The gate requires:

- npm lockfile version 3;
- exact agreement between `package.json` and the lockfile root;
- exact direct and transitive package versions;
- HTTPS tarballs from `registry.npmjs.org` only;
- valid 64-byte SHA-512 integrity values;
- no local-link dependency;
- a reviewed license identifier;
- at most 150 locked packages; and
- exact review of every package that declares an install script.

The gate is offline. It reads only the committed manifest and lockfile and
cannot download, install, update, or publish a package.

## Reviewed license set

The current reviewed lock graph contains only:

- `0BSD`;
- `Apache-2.0`;
- `BSD-3-Clause`;
- `ISC`;
- `MIT`; and
- `MPL-2.0`.

This is an engineering allowlist, not a legal opinion. A new or changed
identifier blocks verification until ownership, obligations, notices,
distribution mode, and counsel requirements are reviewed.

## Install-script exception

The only accepted package with an install script is
`node_modules/fsevents@2.3.3`. It must remain:

- development-only;
- optional; and
- Darwin-only.

Any new version, path, platform, production use, non-optional use, or additional
install-script package fails the gate. The exception exists for the current
locked development toolchain and is not permission to add arbitrary lifecycle
scripts.

## Relationship to other controls

- `npm ci` installs the exact lock graph.
- The offline policy validates provenance/integrity/license/script properties.
- The repository secret scan checks committed material.
- `npm audit --audit-level=high` remains a separate online CI step.
- The deterministic CycloneDX inventory records every locked component,
  integrity value, license, provenance URL, and resolvable dependency edge.
- CodeQL runs the extended JavaScript/TypeScript security query suite as a
  separate GitHub security check with scoped ownership and finding SLAs.
- Deterministic release evidence records the lockfile and policy script hashes
  plus the exact SBOM and CodeQL workflow, and confirms SBOM/dependency gates
  completed first.

## Required follow-up

Before external beta:

1. assign a second independent security approver;
2. require the quality/security and CodeQL checks in branch protection;
3. archive the exact release SBOM and evidence in the restricted long-term
   evidence store;
4. retain required third-party notices; and
5. rehearse a vulnerable/deprecated dependency replacement.

Ownership, severity, triage/remediation SLAs, exceptions, and the deterministic
SBOM contract are defined in
[72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md](72_STATIC_ANALYSIS_AND_SBOM_GOVERNANCE.md).

## Rollback

Revert the policy and verification/evidence wiring together in a reviewed
change. Do not add an unknown license, registry, link, integrity algorithm, or
install script to the allowlist merely to make CI green. Unexpected supply
chain drift freezes release until reviewed.

## Activation boundary

This policy does not access the network, install/update dependencies, publish a
package, deploy, change GitHub/Vercel/Supabase settings, access customer data,
enable public access, or authorize payment or other real-money behavior.
