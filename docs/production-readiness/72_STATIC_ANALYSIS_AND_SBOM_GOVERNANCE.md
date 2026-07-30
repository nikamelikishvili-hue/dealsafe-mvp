# Static analysis and SBOM governance

## Objective

Make source-code security findings and the exact dependency inventory visible,
owned, time-bound, and cryptographically tied to the reviewed release commit.
These controls support review; they do not authorize production promotion or
real-money operation.

## Static analysis control

GitHub CodeQL analyzes JavaScript and TypeScript on every pull request to
`main`, every push to `main`, a weekly schedule, and an authorized manual run.
The workflow uses:

- the supported CodeQL Action v4;
- the no-build JavaScript/TypeScript database mode;
- the `security-extended` query suite;
- read-only repository/package access plus only the required
  `security-events: write` permission; and
- a bounded 20-minute job.

The CodeQL result is a separate required review signal. The release-evidence
manifest binds the exact workflow source, but does not falsely claim that a
parallel CodeQL run passed. Before external beta, branch protection must
require both the quality/security workflow and CodeQL.

## Deterministic dependency inventory

`npm run release:sbom` produces a CycloneDX 1.5 application SBOM directly from
the reviewed npm lockfile. It includes every locked component, exact version,
SHA-512 integrity, reviewed license, registry tarball, development/production
classification, and resolvable dependency relationship.

The document intentionally has:

- no wall-clock timestamp;
- no checkout-directory name;
- no machine username, absolute path, environment value, or secret;
- a deterministic UUID derived from the canonical package and lockfile data;
- stable component and dependency ordering; and
- a SHA-256 sidecar digest.

The quality workflow generates the SBOM before release evidence. The exact SBOM,
generator, policy, CodeQL workflow, dependency policy, manifests, and lockfile
are all hashed into the release-evidence artifact retained by CI.

## Ownership

The repository `CODEOWNERS` file assigns the authorized repository owner
`@nikamelikishvili-hue` to CodeQL, CI, dependency manifests, dependency/SBOM
policies, generators, and this governance record.

Before a paid beta, a second independent security reviewer must be assigned.
Until then, no CodeQL, dependency, license, secret, or provenance exception may
be self-approved for a public or real-money release.

## Finding severity and SLA

| Finding | Triage | Remediation or contained mitigation | Release effect |
|---|---:|---:|---|
| Exposed secret or actively exploited issue | Immediately | Contain immediately; rotate/revoke before further release work | Freeze release and follow incident control |
| Critical SAST/dependency finding | 1 business day | 3 calendar days | Blocks merge and promotion |
| High SAST/dependency finding | 1 business day | 7 calendar days | Blocks external-beta promotion |
| Medium finding | 5 business days | 30 calendar days | Must have an owned issue before promotion |
| Low finding | 10 business days | 90 calendar days | Track in the security backlog |
| Unknown/unreviewed license or provenance drift | 1 business day | Before merge | Blocks merge and promotion |

The clock starts when GitHub or CI first records the finding. The owner records
severity, affected commit/package, customer and financial exposure, assignee,
due date, remediation evidence, and verification result. Sensitive exploit or
secret details must not be placed in a public issue.

## Exception policy

An exception requires:

1. a linked private finding record;
2. concrete false-positive or compensating-control evidence;
3. an owner and expiry no later than 30 days;
4. independent security approval; and
5. a regression test or scanner configuration change in the reviewed commit.

Expired, ownerless, or self-approved exceptions fail closed. Suppression only
to make a check green is prohibited.

## Verification

Reviewers must verify:

1. CodeQL completes and publishes no unresolved blocking result;
2. dependency policy, SBOM generation, audit, secret scan, build, tests, and
   Preview smoke pass on the same reviewed commit;
3. running SBOM generation twice without source changes produces identical
   bytes and digest;
4. the SBOM component count matches the lockfile package count;
5. release evidence contains the exact SBOM and control-source hashes; and
6. branch protection names CodeQL and the quality/security workflow as
   required checks before external beta.

## Rollback and failure

A missing CodeQL result, malformed SBOM, component mismatch, digest mismatch,
unowned blocking finding, or expired exception freezes promotion. Revert the
entire workflow/policy/evidence change together; never weaken severity, license,
integrity, ownership, or evidence rules merely to restore a green check.

## Activation boundary

This change reads repository source and lockfile data only. It does not access
customer data, change GitHub branch protection, deploy code, alter Vercel or
Supabase configuration, enable public access, contact payment providers, or
authorize payment, payout, refund, dispute, or other real-money behavior.
