# Legacy identifier register

Dealivra was originally developed under the DealSafe name. New runtime identifiers must use `dealivra`. The limited names below remain only where changing them without a migration could lose user preferences, break database callers, or change the identity of an in-flight payment operation.

## Approved migration aliases

| Legacy identifier | Location | Reason retained | Removal condition |
|---|---|---|---|
| `dealsafe_session` | Browser cleanup only | Removes an old browser-readable refresh-token record; it is never accepted as a current session | Remove after the supported cleanup window and security review |
| `dealsafe_language` | One-time browser preference migration | Copies a valid language preference to `dealivra_language`, then deletes the old key | Remove after the supported preference migration window |
| `is_dealsafe_admin` | PostgreSQL RPC | Existing database setup files and deployed clients may still reference the function | Replace through a versioned database migration and compatibility window |
| `dealsafe_private` | PostgreSQL schema | Renaming a deployed schema requires a coordinated database migration | Replace only through a reviewed migration with authorization tests |
| `DEALSAFE_PLATFORM_FEE_BPS` | Supabase Edge Function fallback | Prevents a silent fee change while operators migrate configuration | Remove after every non-production and production environment uses `DEALIVRA_PLATFORM_FEE_BPS` |
| `dealsafe-*` idempotency keys | Stripe request history | Changing the namespace can defeat retry deduplication for existing operations | Keep permanently for existing operation types or migrate with provider-approved versioning |
| `dealsafe_*` Stripe metadata | Existing Stripe records | Supports lookup and reconciliation of records written before the rename | Read during the historical retention period; new fields require a separately reviewed payment migration |

## Current Dealivra identifiers

- Browser session: `dealivra_session_v2`
- Session events: `dealivra-session-updated` and `dealivra-session-expired`
- Language preference: `dealivra_language`
- Google Maps callback/data marker: `__dealivraGoogleMapsReady` and `data-dealivra-google-maps`
- Platform fee configuration: `DEALIVRA_PLATFORM_FEE_BPS`
- Authentication log namespace: `dealivra-auth`

## Guardrails

- New source code, cookies, storage keys, events, environment variables, analytics events, assets, and user-facing content must use Dealivra.
- A legacy identifier must not be reused for a new feature.
- Removal of database, payment, or idempotency aliases requires migration and rollback evidence.
- Tests must distinguish an approved compatibility alias from an accidental new runtime identifier.
