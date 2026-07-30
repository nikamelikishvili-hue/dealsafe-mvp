# Canonical Agreement Record

Status: implemented locally for review; database activation is not authorized.

## Objective

Every agreement surface must represent one immutable database record:

- the on-page agreement code;
- agreement history;
- verification;
- preview;
- printed/PDF copy.

The browser is not an authority for agreement contents or hashes. It may format
the stored record for display, but it must not rebuild a legally meaningful
record from the current mutable deal object.

## Canonical schema

The first schema identifier is `dealivra.agreement.v1`. PostgreSQL creates a
`jsonb` payload containing:

- public Deal ID;
- agreement version;
- item title and description;
- structured catalog identity when stored;
- privacy-safe identifier suffix when recorded for a new version;
- price in minor units and currency;
- disclosed condition;
- delivery method;
- offer expiration.
- seller authority, lawful-item, and material-disclosure declarations when
  stored in that agreement version.

PostgreSQL serializes this payload and records its SHA-256 digest. The
`schema_version`, `canonical_payload`, and `canonical_hash` fields are written
at agreement-version insertion time. A database trigger rejects later updates
to an agreement version.

Participant names and current verification badges are displayed in a clearly
separate PDF section. They are current participant metadata and are not part of
the terms hash.

## Legacy compatibility

Existing `content_hash` values are retained. Backfill adds a canonical snapshot
and canonical hash without replacing the legacy hash. Public verification
accepts either a valid canonical or legacy 64-character SHA-256 value.

Legacy versions did not persist an identifier suffix inside `terms_json`.
Their canonical snapshot therefore reports that the identifier was not
recorded in that version rather than borrowing a possibly changed current
value.

## Security boundary

- The canonical builder is `SECURITY INVOKER`, immutable, and has an empty
  `search_path`.
- Trigger functions are not executable by `public`, `anon`, or
  `authenticated`.
- The public document RPC is the only new anonymous boundary.
- It is `SECURITY DEFINER` only to read the public, privacy-safe projection
  through RLS; it uses an empty `search_path`, schema-qualified relations,
  strict Deal ID validation, explicit grants, and no participant identifiers.
- The response excludes user IDs, email, phone, address, signature text, IP
  hash, user agent, private serial data, and storage paths.

## Client failure behavior

The PDF, preview, and download actions remain disabled until the exact stored
version is returned and both conditions pass:

1. schema is `dealivra.agreement.v1`;
2. canonical hash is a 64-character hexadecimal SHA-256 value.

There is no browser-generated fallback. A missing or invalid record fails
closed with a visible explanation.

## Staged activation

1. Restore a disposable database from a current backup.
2. Run `supabase/canonical_agreement_record.sql`.
3. Verify backfill row counts and confirm every legacy `content_hash` is
   unchanged.
4. Run `supabase/tests/canonical_agreement_record_rollback.sql` and the
   security-definer allowlist suite. They prove backfill integrity,
   deterministic payload generation, immutability, explicit grants, bounded
   public output, and invalid-ID denial without persisting test writes.
5. Deploy a protected Preview with the migration present.
6. Create one new agreement and compare the history, page code, preview, saved
   PDF, and verification result byte-for-byte.
7. Repeat with an existing legacy agreement.
8. Obtain product/legal review of the visible agreement language.
9. Only then schedule a Production migration with backup, monitoring, and a
   rollback owner.

## Rollback

`supabase/canonical_agreement_record_rollback.sql` removes the new public RPC
and write-time triggers. It intentionally retains the snapshot columns,
payloads, hashes, and canonical builder so evidence is not destroyed during an
incident. Restoring the prior history and verification functions is a separate
reviewed step.

## Release boundary

This implementation does not:

- apply any database migration;
- alter Production data;
- publish a deployment;
- create a legal signature;
- certify title, authenticity, insurance, or escrow;
- authorize real-money operation.

AGR-001 is complete only after the staged database and protected Preview proof
passes. AGR-003 still requires visual, accessibility, archival, and legal copy
review of the final PDF.
