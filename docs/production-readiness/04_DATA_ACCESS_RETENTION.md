# Data access, privacy, and retention model

## 1. Data-minimization rule

Dealivra collects a field only when it has a documented product, safety, payment, support, or legal purpose. Every collected field must have:

- A data owner.
- A classification.
- An allowed audience.
- A retention trigger and deletion/anonymization action.
- A user-facing notice where required.

“It may be useful later” is not a valid collection purpose.

## 2. Data classes

| Class | Examples | Default treatment |
|---|---|---|
| Public | Brand content, published policies, explicitly public seller summary, approved listing category/brand/model/year/variant | Cacheable only as approved |
| Participant-private | Deal terms, participant names, chat, agreement status | Seller and claimed buyer only |
| Restricted personal | Address, meeting details, phone, full email, device/session metadata | Need-to-know, encrypted, never public |
| Restricted evidence | Photos, videos, documents, serial/IMEI, dispute material | Private storage, signed access, logged |
| Provider-confidential | Stripe/KYC references and status | Server/admin limited; raw provider data minimized |
| Critical secret | API keys, webhook secrets, service role, signing/encryption keys | Managed secret store only |
| Audit/security | State changes, authorization failures, admin commands | Append-only/restricted; redacted |

## 3. Role and access matrix

`Allow` means the minimum necessary fields, not the full database row.

| Record | Visitor | Seller | Buyer | Support | Trust & Safety | Finance | Security Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Public Deal Link projection | Allow | Allow | Allow | Allow | Allow | No | No |
| Draft deal | No | Own | No | No | Scoped escalation | No | No |
| Accepted terms/version | No | Participant | Participant | Case only | Case only | Amount/status only | Metadata only |
| Delivery address | No | Shipping need only | Own | Case only | Case only | No | Metadata only |
| Meeting location/time | No | Participant | Participant | Case only | Case only | No | Metadata only |
| Chat | No | Participant | Participant | Case with authorization | Case with authorization | No | No content by default |
| Evidence files | No | Participant/policy | Participant/policy | Case only | Case only | No | No content by default |
| Payment status | No | Participant | Participant | Case only | Case only | Authorized finance | Metadata only |
| Provider IDs | No | Own status only | Own status only | Limited | Limited | Required finance | Required security |
| Admin audit | No | No | No | Own actions | Scoped | Own actions | Allow |

Production support must use the application’s case-scoped access. Direct database browsing is not a normal support workflow.

## 4. RLS and API expectations

- Every table in an exposed schema has RLS enabled.
- Anonymous access is granted only to explicit public RPCs/views with allowlisted columns.
- Seller/buyer access is derived from the authenticated `auth.uid()` and the deal relationship.
- Role labels sent by the browser never grant access.
- Admin capability comes from a server-validated role source, not editable profile metadata.
- Views use invoker security or remain in an unexposed schema unless an audited `security definer` function is required.
- Storage policies validate both path ownership and deal participation.
- Deleting or replacing storage metadata cannot leave an uncontrolled object.
- RLS tests cover select, insert, update, delete, function execution, and signed-URL issuance.

## 5. Proposed retention schedule

Final periods require counsel and provider review before publication.

| Data | Active retention | Post-close proposal | End action |
|---|---|---|---|
| Unpublished draft | While active | 30 days after abandonment | Delete content and media |
| Expired unaccepted Deal Link | While active | 90 days | Delete/anonymize unless fraud hold |
| Agreement and acceptance | Deal life | 7 years after completion/cancellation | Legal review then delete/anonymize |
| Payment transaction/audit reference | Deal life | 7 years or required provider/legal period | Delete/anonymize when permitted |
| Routine chat | Deal life | 2 years after close | Delete unless dispute/legal hold |
| Evidence without dispute | Deal life | 1 year after close | Delete objects and metadata |
| Dispute evidence | Case life | 7 years after resolution proposal | Delete after legal review |
| Delivery address | Through delivery/support period | 90 days after undisputed completion | Remove granular address; preserve coarse audit if needed |
| Meeting details | Through handoff/support period | 90 days after undisputed completion | Delete granular location |
| Raw application logs | Operational need | 30–90 days | Delete/aggregate |
| Security audit events | Security/legal need | 1–7 years by event class | Delete/anonymize per policy |
| KYC result/reference | Provider/account need | Minimum required period | Delete reference when permitted |
| Backups | Recovery window | Defined rolling window | Automatic expiry and verified deletion |

Legal hold overrides ordinary deletion only for the scoped records and duration approved by policy. The hold and release are audited.

## 6. User privacy operations

Before paid pilot, users must be able to:

- See and correct profile data.
- Export their Dealivra-provided account/deal data in a usable format.
- Request account deletion.
- Understand records that cannot yet be deleted and why.
- Revoke optional public trust/passport visibility.
- End active sessions.
- Control optional marketing communications separately from transactional notices.

Requests must be authenticated and tracked without collecting excessive new identity data. Response deadlines are configured by applicable jurisdiction.

## 7. Sensitive provider data

- Stripe-hosted interfaces collect payment and payout credentials.
- KYC-hosted interfaces collect government-ID and biometric data where required.
- Dealivra stores provider, reference, status, reason code, timestamps, and review state only.
- Provider webhook payloads are filtered before long-term storage.
- Support sees a human-readable status and remediation link, not unnecessary identity details.

## 8. Encryption and key management

- TLS is mandatory for all external and internal provider communication.
- Database/storage encryption at rest is enabled through the managed provider.
- Secrets live in environment-specific secret stores and are never committed.
- Sensitive application-level ciphertext uses a managed key with version, rotation, access logging, and recovery procedure.
- Hashes are used for lookup/verification only when the domain has sufficient entropy or a keyed hash is used.
- Key rotation is tested before production.

## 9. Backup and deletion correctness

Deleting a record requires coordinated cleanup of:

- Primary database rows.
- Storage objects and derivatives.
- Search/index/cache copies.
- Analytics identifiers where applicable.
- Provider data when Dealivra controls deletion.

Backups expire according to their own schedule; deleted data is not restored into active production during a recovery without rerunning the deletion ledger.

