import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

const currencyCodes = [
  'USD', 'EUR', 'GBP', 'GEL', 'TRY', 'ILS', 'CNY', 'JPY', 'KRW', 'INR',
  'CAD', 'AUD', 'CHF', 'AED', 'SAR',
] as const;
type CurrencyCode = typeof currencyCodes[number];

export type AgreementResponseBoundary =
  | 'seller_declaration'
  | 'agreement_document'
  | 'agreement_history'
  | 'agreement_verification'
  | 'deal_link_renewal'
  | 'acceptance_protection'
  | 'buyer_access_code'
  | 'watchlist_state';

export interface SellerDeclarationRecordPayload {
  attested: boolean;
  attested_at: string | null;
}

export interface AgreementCatalogIdentityPayload {
  category_id?: string;
  catalog_version?: string;
  brand_id?: string;
  brand_label?: string;
  model_id?: string;
  model_label?: string;
  model_year?: number;
  variant_id?: string;
  variant_label?: string;
}

export interface AgreementSellerDeclarationsPayload {
  has_authority_to_sell: true;
  not_stolen_counterfeit_or_prohibited: true;
  known_defects_and_material_facts_disclosed: true;
  attested_at: string;
}

export interface AgreementHistoryVersionPayload {
  version: number;
  price_cents: number;
  currency: CurrencyCode;
  condition: 'Like new' | 'Good' | 'Fair';
  delivery_method: 'Meet in person' | 'Ship to buyer';
  content_hash: string;
  created_at: string;
  acceptance_count: number;
  is_current: boolean;
}

export interface AgreementDocumentSnapshotPayload {
  schema_version: 'dealivra.agreement.v1';
  public_id: string;
  version: number;
  title: string;
  description: string;
  identifier: string | null;
  catalog_identity: AgreementCatalogIdentityPayload | null;
  seller_declarations: AgreementSellerDeclarationsPayload | null;
  price_cents: number;
  currency: CurrencyCode;
  condition: 'Like new' | 'Good' | 'Fair';
  delivery_method: 'Meet in person' | 'Ship to buyer';
  expires_at: string | null;
  content_hash: string;
  legacy_content_hash: string;
  created_at: string;
  acceptance_count: number;
  is_current: boolean;
}

export interface AgreementVerificationResultPayload {
  matched: true;
  public_id: string;
  version: number;
  is_current: boolean;
  created_at: string;
}

export interface DealRenewalResultPayload {
  agreement_version: number;
  expires_at: string;
}

const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const catalogVersionPattern =
  /^(?:legacy|[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+)$/;
const hashPattern = /^[a-f0-9]{64}$/;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const currencySet = new Set<CurrencyCode>(currencyCodes);
const conditionSet = new Set(['Like new', 'Good', 'Fair']);
const deliveryMethodSet = new Set(['Meet in person', 'Ship to buyer']);
const maximumClockSkewMs = 5 * 60_000;

export class AgreementResponseValidationError extends Error {
  readonly boundary: AgreementResponseBoundary;
  readonly issue: string;

  constructor(boundary: AgreementResponseBoundary, issue: string) {
    super('The agreement service returned an invalid response. Please try again later.');
    this.name = 'AgreementResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: AgreementResponseBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.agreement.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AgreementResponseValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
  keys: readonly string[],
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  const source = value as JsonRecord;
  if (
    keys.some(key => !Object.prototype.hasOwnProperty.call(source, key))
    || Object.keys(source).some(key => !keys.includes(key))
  ) {
    reject(boundary, issue);
  }
  return source;
}

function limitedRows(
  value: unknown,
  boundary: AgreementResponseBoundary,
  minimum: number,
  maximum: number,
): unknown[] {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
  ) {
    reject(boundary, 'rows_invalid');
  }
  return value;
}

function boundedString(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || controlPattern.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function integer(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    reject(boundary, issue);
  }
  return value;
}

function boolean(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function timestamp(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
  maximumFutureMs = maximumClockSkewMs,
): string {
  const result = boundedString(value, boundary, issue, 20, 48);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || parsed > Date.now() + maximumFutureMs) {
    reject(boundary, issue);
  }
  return new Date(parsed).toISOString();
}

function nullableFutureTimestamp(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  const result = boundedString(value, boundary, issue, 20, 48);
  const parsed = Date.parse(result);
  if (
    !Number.isFinite(parsed)
    || parsed < Date.now() - 10 * 366 * 24 * 60 * 60 * 1_000
    || parsed > Date.now() + 366 * 24 * 60 * 60 * 1_000
  ) {
    reject(boundary, issue);
  }
  return new Date(parsed).toISOString();
}

function publicId(
  value: unknown,
  boundary: AgreementResponseBoundary,
): string {
  const result = boundedString(value, boundary, 'public_id_invalid', 6, 32);
  if (!publicIdPattern.test(result)) reject(boundary, 'public_id_invalid');
  return result;
}

function hash(
  value: unknown,
  boundary: AgreementResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 64, 64).toLowerCase();
  if (!hashPattern.test(result)) reject(boundary, issue);
  return result;
}

function currency(
  value: unknown,
  boundary: AgreementResponseBoundary,
): CurrencyCode {
  if (
    typeof value !== 'string'
    || !currencySet.has(value as CurrencyCode)
  ) {
    reject(boundary, 'currency_invalid');
  }
  return value as CurrencyCode;
}

function condition(
  value: unknown,
  boundary: AgreementResponseBoundary,
): AgreementHistoryVersionPayload['condition'] {
  if (typeof value !== 'string' || !conditionSet.has(value)) {
    reject(boundary, 'condition_invalid');
  }
  return value as AgreementHistoryVersionPayload['condition'];
}

function deliveryMethod(
  value: unknown,
  boundary: AgreementResponseBoundary,
): AgreementHistoryVersionPayload['delivery_method'] {
  if (typeof value !== 'string' || !deliveryMethodSet.has(value)) {
    reject(boundary, 'delivery_method_invalid');
  }
  return value as AgreementHistoryVersionPayload['delivery_method'];
}

function optionalCatalogString(
  source: JsonRecord,
  key: string,
  boundary: AgreementResponseBoundary,
  maximum: number,
  pattern?: RegExp,
): string | undefined {
  if (!(key in source)) return undefined;
  const value = boundedString(source[key], boundary, `${key}_invalid`, 1, maximum);
  if (pattern && !pattern.test(value)) reject(boundary, `${key}_invalid`);
  return value;
}

function catalogIdentity(
  value: unknown,
  boundary: AgreementResponseBoundary,
): AgreementCatalogIdentityPayload | null {
  if (value === null) return null;
  const keys = [
    'category_id',
    'catalog_version',
    'brand_id',
    'brand_label',
    'model_id',
    'model_label',
    'model_year',
    'variant_id',
    'variant_label',
  ];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, 'catalog_identity_invalid');
  }
  const source = value as JsonRecord;
  if (Object.keys(source).some(key => !keys.includes(key))) {
    reject(boundary, 'catalog_identity_shape_invalid');
  }
  const result: AgreementCatalogIdentityPayload = {};
  result.category_id = optionalCatalogString(
    source,
    'category_id',
    boundary,
    40,
    slugPattern,
  );
  result.catalog_version = optionalCatalogString(
    source,
    'catalog_version',
    boundary,
    40,
    catalogVersionPattern,
  );
  result.brand_id = optionalCatalogString(source, 'brand_id', boundary, 80, slugPattern);
  result.brand_label = optionalCatalogString(source, 'brand_label', boundary, 120);
  result.model_id = optionalCatalogString(source, 'model_id', boundary, 80, slugPattern);
  result.model_label = optionalCatalogString(source, 'model_label', boundary, 120);
  result.variant_id = optionalCatalogString(source, 'variant_id', boundary, 80, slugPattern);
  result.variant_label = optionalCatalogString(source, 'variant_label', boundary, 120);
  if ('model_year' in source) {
    result.model_year = integer(
      source.model_year,
      boundary,
      'model_year_invalid',
      1886,
      2100,
    );
  }
  for (const key of Object.keys(result) as (keyof AgreementCatalogIdentityPayload)[]) {
    if (result[key] === undefined) delete result[key];
  }
  if (
    (result.model_id || result.variant_id) && !result.brand_id
    || result.variant_id && !result.model_id
  ) {
    reject(boundary, 'catalog_identity_relationship_invalid');
  }
  return result;
}

function sellerDeclarations(
  value: unknown,
  boundary: AgreementResponseBoundary,
): AgreementSellerDeclarationsPayload | null {
  if (value === null) return null;
  const source = exactRecord(value, boundary, 'seller_declarations_shape_invalid', [
    'has_authority_to_sell',
    'not_stolen_counterfeit_or_prohibited',
    'known_defects_and_material_facts_disclosed',
    'attested_at',
  ]);
  for (const key of [
    'has_authority_to_sell',
    'not_stolen_counterfeit_or_prohibited',
    'known_defects_and_material_facts_disclosed',
  ] as const) {
    if (source[key] !== true) {
      reject(boundary, 'seller_declaration_invalid');
    }
  }
  return {
    has_authority_to_sell: true,
    not_stolen_counterfeit_or_prohibited: true,
    known_defects_and_material_facts_disclosed: true,
    attested_at: timestamp(source.attested_at, boundary, 'attested_at_invalid'),
  };
}

function historyRow(
  row: unknown,
  boundary: Extract<
    AgreementResponseBoundary,
    'agreement_history' | 'agreement_document'
  >,
): AgreementHistoryVersionPayload {
  const source = exactRecord(row, boundary, 'row_shape_invalid', [
    'version',
    'price_cents',
    'currency',
    'condition',
    'delivery_method',
    'content_hash',
    'created_at',
    'acceptance_count',
    'is_current',
  ]);
  return {
    version: integer(source.version, boundary, 'version_invalid', 1, 1_000_000),
    price_cents: integer(
      source.price_cents,
      boundary,
      'price_cents_invalid',
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    currency: currency(source.currency, boundary),
    condition: condition(source.condition, boundary),
    delivery_method: deliveryMethod(source.delivery_method, boundary),
    content_hash: hash(source.content_hash, boundary, 'content_hash_invalid'),
    created_at: timestamp(source.created_at, boundary, 'created_at_invalid'),
    acceptance_count: integer(
      source.acceptance_count,
      boundary,
      'acceptance_count_invalid',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    is_current: boolean(source.is_current, boundary, 'is_current_invalid'),
  };
}

export function parseSellerDeclarationRows(
  value: unknown,
): SellerDeclarationRecordPayload[] {
  const boundary = 'seller_declaration';
  return limitedRows(value, boundary, 0, 1).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'attested',
      'attested_at',
    ]);
    const attested = boolean(source.attested, boundary, 'attested_invalid');
    const attestedAt = source.attested_at === null
      ? null
      : timestamp(source.attested_at, boundary, 'attested_at_invalid');
    if (attested !== (attestedAt !== null)) {
      reject(boundary, 'attestation_state_invalid');
    }
    return { attested, attested_at: attestedAt };
  });
}

export function parseAgreementDocumentRows(
  value: unknown,
): AgreementDocumentSnapshotPayload[] {
  const boundary = 'agreement_document';
  return limitedRows(value, boundary, 0, 1).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'schema_version',
      'public_id',
      'version',
      'title',
      'description',
      'identifier',
      'catalog_identity',
      'seller_declarations',
      'price_cents',
      'currency',
      'condition',
      'delivery_method',
      'expires_at',
      'content_hash',
      'legacy_content_hash',
      'created_at',
      'acceptance_count',
      'is_current',
    ]);
    if (source.schema_version !== 'dealivra.agreement.v1') {
      reject(boundary, 'schema_version_invalid');
    }
    let identifier: string | null = null;
    if (source.identifier !== null) {
      identifier = boundedString(
        source.identifier,
        boundary,
        'identifier_invalid',
        1,
        64,
      );
    }
    return {
      schema_version: 'dealivra.agreement.v1',
      public_id: publicId(source.public_id, boundary),
      version: integer(source.version, boundary, 'version_invalid', 1, 1_000_000),
      title: boundedString(source.title, boundary, 'title_invalid', 3, 120),
      description: boundedString(
        source.description,
        boundary,
        'description_invalid',
        3,
        10_000,
      ),
      identifier,
      catalog_identity: catalogIdentity(source.catalog_identity, boundary),
      seller_declarations: sellerDeclarations(source.seller_declarations, boundary),
      price_cents: integer(
        source.price_cents,
        boundary,
        'price_cents_invalid',
        1,
        Number.MAX_SAFE_INTEGER,
      ),
      currency: currency(source.currency, boundary),
      condition: condition(source.condition, boundary),
      delivery_method: deliveryMethod(source.delivery_method, boundary),
      expires_at: nullableFutureTimestamp(
        source.expires_at,
        boundary,
        'expires_at_invalid',
      ),
      content_hash: hash(source.content_hash, boundary, 'content_hash_invalid'),
      legacy_content_hash: hash(
        source.legacy_content_hash,
        boundary,
        'legacy_content_hash_invalid',
      ),
      created_at: timestamp(source.created_at, boundary, 'created_at_invalid'),
      acceptance_count: integer(
        source.acceptance_count,
        boundary,
        'acceptance_count_invalid',
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      is_current: boolean(source.is_current, boundary, 'is_current_invalid'),
    };
  });
}

export function parseAgreementHistoryRows(
  value: unknown,
): AgreementHistoryVersionPayload[] {
  const boundary = 'agreement_history';
  const parsed = limitedRows(value, boundary, 0, 1_000).map(row =>
    historyRow(row, boundary));
  let previousVersion = Number.POSITIVE_INFINITY;
  let currentCount = 0;
  for (const row of parsed) {
    if (row.version >= previousVersion) {
      reject(boundary, 'version_order_invalid');
    }
    previousVersion = row.version;
    if (row.is_current) currentCount += 1;
  }
  if (currentCount > 1 || (parsed.length > 0 && currentCount !== 1)) {
    reject(boundary, 'current_version_invalid');
  }
  if (parsed.length > 0 && !parsed[0].is_current) {
    reject(boundary, 'current_version_order_invalid');
  }
  return parsed;
}

export function parseAgreementVerificationRows(
  value: unknown,
): AgreementVerificationResultPayload[] {
  const boundary = 'agreement_verification';
  return limitedRows(value, boundary, 0, 1).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'matched',
      'public_id',
      'version',
      'is_current',
      'created_at',
    ]);
    if (source.matched !== true) reject(boundary, 'matched_invalid');
    return {
      matched: true,
      public_id: publicId(source.public_id, boundary),
      version: integer(source.version, boundary, 'version_invalid', 1, 1_000_000),
      is_current: boolean(source.is_current, boundary, 'is_current_invalid'),
      created_at: timestamp(source.created_at, boundary, 'created_at_invalid'),
    };
  });
}

export function parseDealRenewalRows(
  value: unknown,
): DealRenewalResultPayload[] {
  const boundary = 'deal_link_renewal';
  return limitedRows(value, boundary, 1, 1).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'agreement_version',
      'expires_at',
    ]);
    const expiresAt = nullableFutureTimestamp(
      source.expires_at,
      boundary,
      'expires_at_invalid',
    );
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
      reject(boundary, 'expires_at_invalid');
    }
    return {
      agreement_version: integer(
        source.agreement_version,
        boundary,
        'agreement_version_invalid',
        1,
        1_000_000,
      ),
      expires_at: expiresAt,
    };
  });
}

export function parseAcceptanceProtectionResponse(value: unknown): boolean {
  return boolean(value, 'acceptance_protection', 'state_invalid');
}

export function parseBuyerAccessCodeResponse(
  value: unknown,
): string | null {
  if (value === null) return null;
  const code = boundedString(
    value,
    'buyer_access_code',
    'code_invalid',
    6,
    6,
  );
  if (!/^\d{6}$/.test(code)) {
    reject('buyer_access_code', 'code_invalid');
  }
  return code;
}

export function parseWatchlistStateResponse(value: unknown): boolean {
  return boolean(value, 'watchlist_state', 'state_invalid');
}
