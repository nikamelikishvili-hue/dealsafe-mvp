-- Emergency rollback for AGR-001 database objects.
-- This preserves stored snapshot columns and data for forensic recovery.

drop function if exists public.get_public_agreement_document(text, integer);

drop trigger if exists prevent_agreement_version_mutation
on public.agreement_versions;
drop function if exists private.prevent_agreement_version_mutation();

drop trigger if exists populate_agreement_canonical_record
on public.agreement_versions;
drop function if exists private.populate_agreement_canonical_record();

-- Intentionally retain:
--   agreement_versions.schema_version
--   agreement_versions.canonical_payload
--   agreement_versions.canonical_hash
--   private.build_agreement_canonical_payload(..., identifier)
-- Removing them would destroy evidence needed to diagnose or restore records.
