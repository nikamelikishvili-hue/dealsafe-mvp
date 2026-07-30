# Catalog governance

## Purpose

Dealivra's guided catalog reduces typing, but it must never silently change the
meaning of an existing agreement. Every active catalog release is therefore a
versioned, reviewed dataset with a named owner, source record, validation
evidence, adoption metrics, and a rollback path.

The catalog is a convenience and normalization layer. It is not proof of
ownership, authenticity, compatibility, vehicle condition, or market value.
Every guided category keeps a keyboard-accessible **Not listed** path.

## Ownership and approvals

| Responsibility | Accountable role |
|---|---|
| Coverage, labels, U.S. launch relevance | Product Operations |
| Schema, API, caching, validation, deployment | Engineering |
| Fraud, prohibited-goods, privacy, and public-field review | Trust & Safety |
| Final active-release approval | All three roles |

No single role may publish an active release alone. The GitHub pull request is
the release record and must contain the manifest diff, validator result, full
repository verification, Preview deployment, and reviewer decision.

## Source policy

- Every release manifest records each source, its owner, retrieval date, and
  exactly how Dealivra used it.
- Curated entries require a repository documentation reference. External
  sources require HTTPS and may not be copied into an active release without
  Product Operations and Trust & Safety review.
- NHTSA vPIC remains a server-side VIN reference. Runtime provider output is
  bounded to reviewed fields and is not automatically promoted into the
  catalog.
- NHTSA responses use a finite deadline and an incremental 256,000-byte
  stream ceiling before JSON parsing; invalid or excessive responses retain
  the existing safe manual-entry path.
- Model names are labels, not guarantees. A provider or manufacturer label
  change creates a new catalog version; existing deals retain the version and
  labels recorded when the agreement was created.

## Version and release procedure

1. Create a new immutable `catalog/releases/<version>.json` manifest.
2. Use `YYYY-MM-DD.sequence` for `catalogVersion`.
3. Update `src/catalog.v1.json`, its SHA-256 in the manifest, and
   `catalog/active-release.json`.
4. Run `npm run catalog:verify`.
5. Run `npm run verify`.
6. Review manual fallback, keyboard navigation, responsive layout, public and
   private field boundaries, and the Vercel Preview.
7. Merge only after required checks pass. The merge commit is the release
   evidence and the production deployment must reference that exact commit.

The automated validator hashes UTF-8 dataset bytes after normalizing CRLF to
the repository's LF line ending, so the manifest checksum is identical on
Windows and Linux. It rejects bare carriage returns, path traversal, checksum
drift, unexpected categories, duplicate IDs/labels/models, missing source
ownership, unsafe analytics dimensions, incomplete evidence, or a destructive
rollback plan.

## Update cadence

- Product Operations reviews coverage every 30 days.
- A release is stale after 45 days without recorded review.
- An incorrect or unsafe option receives an emergency review within 24 hours.
- A new release is also triggered by a provider schema change, a material U.S.
  coverage gap, or a manual fallback rate above the approved operating
  threshold.

An unchanged review still creates a dated evidence note; it does not require a
new dataset version.

## Adoption metrics

`public.get_admin_catalog_adoption(integer)` returns only administrator-visible
aggregate counts for 7, 30, or 90 days. Approved dimensions are
`catalog_version` and `category_id`. Measures include structured brand/model
coverage, manual fallback, and draft/published/accepted/completed counts.

The metric must never return a Deal ID, public ID, user ID, email, address,
serial number, evidence path, message, payment identifier, or a group that can
identify a participant. The Admin catalog panel consumes only these aggregate
rows.

Operating review should answer:

- Which catalog version is creating new deals?
- Which categories have high **Not listed** or legacy fallback?
- Are brand and model completion rates improving?
- Are structured listings reaching published, accepted, and completed states?

## Rollback procedure

1. Pause promotion of the affected release; do not delete historical records.
2. Revert the catalog commit or point `catalog/active-release.json` to the last
   verified manifest in a reviewed pull request.
3. Run `npm run catalog:verify` and `npm run verify`.
4. Verify the Vercel Preview, then deploy the tested revert commit.
5. Confirm `/api/catalog` returns the restored version and the Admin catalog
   metrics still group older deals under their originally recorded versions.
6. Record the reason, affected version, detection time, decision owner,
   production deployment, and follow-up correction.

Rollback never rewrites `deals.catalog_version` or structured identity fields.
Existing agreements remain auditable and no destructive database rollback is
required.

## Release evidence

The initial governed release is `2026-07-27.2`. Release `2026-07-29.1` is a
checksum-governance correction for the same reviewed category, brand, model,
and variant labels; it does not silently expand or remove catalog options. The
active pointer and immutable manifests live under `catalog/`. Future releases
add a new manifest rather than editing prior evidence.
