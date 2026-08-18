# Database ownership inventory

## Purpose

DAT-002 requires every application table, view, function, Storage bucket,
policy, and grant to have a machine-readable database owner and an operational
steward. The inventory is read-only and contains object metadata only; it does
not select customer rows, object paths, identities, tokens, or secrets.

## Staging gate

The manual Staging database gate runs the 17 rollback SQL suites first, then
executes `supabase/database_ownership_inventory.sql` through `psql`. Each JSON
line is piped directly to:

```text
npm run database:ownership:validate
```

The validator fails when an object class is absent, an identity is duplicated,
an owner is a browser-facing role, or owner/exposure/steward metadata is
missing. Function-grant identities use PostgreSQL `specific_name` so overloaded
functions remain distinct.

## Required evidence

A successful Staging run must retain:

- the exact reviewed commit;
- the Staging target-guard result;
- PASS evidence for all 17 rollback suites;
- the validator summary and object counts by class;
- the workflow run URL and timestamp.

The raw inventory is not uploaded as an artifact because it is operational
metadata. Production credentials and Production execution are prohibited in
this gate.

DAT-002 closes only after the inventory passes against isolated Staging and an
owner reviews the resulting class counts. Repository preparation alone does
not authorize Production changes.
