import type { CurrencyCode } from '../currency';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';
import type { ProtectedPaymentStatePayload } from './paymentRuntimeSchemas';

type JsonRecord = Record<string, unknown>;

export type AdminResponseBoundary =
  | 'admin_access'
  | 'admin_revenue_summary'
  | 'admin_revenue_transactions'
  | 'admin_catalog_adoption';

export interface AdminRevenueSummaryPayload {
  currency: CurrencyCode;
  total_payment_volume_cents: number;
  total_commission_earned_cents: number;
  total_released_to_sellers_cents: number;
  total_protected_cents: number;
  total_refunded_cents: number;
  payment_count: number;
  released_count: number;
  refunded_count: number;
  disputed_count: number;
}

export interface AdminRevenueTransactionPayload {
  transaction_id: string;
  deal_id: string;
  public_id: string;
  title: string;
  status: ProtectedPaymentStatePayload;
  currency: CurrencyCode;
  item_amount_cents: number;
  platform_fee_cents: number;
  seller_amount_cents: number;
  seller_name: string;
  buyer_name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminCatalogAdoptionPayload {
  window_days: 7 | 30 | 90;
  catalog_version: string;
  category_id: string;
  deal_count: number;
  structured_brand_count: number;
  structured_model_count: number;
  manual_fallback_count: number;
  draft_count: number;
  published_count: number;
  accepted_count: number;
  completed_count: number;
  latest_deal_at: string;
}

export class AdminResponseValidationError extends Error {
  readonly boundary: AdminResponseBoundary;
  readonly issue: string;

  constructor(boundary: AdminResponseBoundary, issue: string) {
    super('The administration service returned an invalid response. Please try again later.');
    this.name = 'AdminResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const catalogVersionPattern = /^(?:legacy|\d{4}-\d{2}-\d{2}\.[1-9][0-9]{0,3})$/;
const categoryIdPattern = /^[a-z][a-z0-9-]{0,63}$/;
const maximumClockSkewMs = 5 * 60_000;
const maximumTransactionAmountCents = 100_000_000_000;
const maximumAggregateCents = Number.MAX_SAFE_INTEGER;
const maximumAggregateCount = Number.MAX_SAFE_INTEGER;
export const adminCurrencyCodes = [
  'USD',
  'EUR',
  'GBP',
  'GEL',
  'TRY',
  'ILS',
  'CNY',
  'JPY',
  'KRW',
  'INR',
  'CAD',
  'AUD',
  'CHF',
  'AED',
  'SAR',
] as const satisfies readonly CurrencyCode[];
const currencies = new Set<CurrencyCode>(adminCurrencyCodes);
const revenueTransactionStates = new Set<ProtectedPaymentStatePayload>([
  'checkout_created',
  'processing',
  'funds_secured',
  'release_pending',
  'released',
  'failed',
  'expired',
  'cancelled',
  'refund_pending',
  'refunded',
  'disputed',
  'release_failed',
]);
const catalogWindows = new Set<7 | 30 | 90>([7, 30, 90]);

function reject(boundary: AdminResponseBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.admin.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AdminResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function rows(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
  maximum: number,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    reject(boundary, issue);
  }
  return value;
}

function integer(
  value: unknown,
  boundary: AdminResponseBoundary,
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

function boundedString(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function uuid(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function publicId(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 6, 32);
  if (!publicIdPattern.test(result)) reject(boundary, issue);
  return result;
}

function timestamp(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 20, 40);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || parsed > Date.now() + maximumClockSkewMs) {
    reject(boundary, issue);
  }
  return result;
}

function currency(
  value: unknown,
  boundary: AdminResponseBoundary,
  issue: string,
): CurrencyCode {
  const result = boundedString(value, boundary, issue, 3, 3);
  if (!currencies.has(result as CurrencyCode)) reject(boundary, issue);
  return result as CurrencyCode;
}

function assertUnique(
  identifiers: string[],
  boundary: AdminResponseBoundary,
  issue: string,
) {
  if (new Set(identifiers).size !== identifiers.length) {
    reject(boundary, issue);
  }
}

export function parseAdminAccessResponse(value: unknown): boolean {
  const boundary: AdminResponseBoundary = 'admin_access';
  if (typeof value !== 'boolean') reject(boundary, 'access_scalar_invalid');
  return value;
}

export function parseAdminRevenueSummaryRows(
  value: unknown,
): AdminRevenueSummaryPayload {
  const boundary: AdminResponseBoundary = 'admin_revenue_summary';
  const collection = rows(
    value,
    boundary,
    'summary_collection_invalid',
    1,
  );
  if (collection.length !== 1) reject(boundary, 'summary_row_count_invalid');
  const source = record(collection[0], boundary, 'summary_row_invalid');
  const result: AdminRevenueSummaryPayload = {
    currency: currency(source.currency, boundary, 'summary_currency_invalid'),
    total_payment_volume_cents: integer(
      source.total_payment_volume_cents,
      boundary,
      'summary_volume_invalid',
      0,
      maximumAggregateCents,
    ),
    total_commission_earned_cents: integer(
      source.total_commission_earned_cents,
      boundary,
      'summary_commission_invalid',
      0,
      maximumAggregateCents,
    ),
    total_released_to_sellers_cents: integer(
      source.total_released_to_sellers_cents,
      boundary,
      'summary_seller_release_invalid',
      0,
      maximumAggregateCents,
    ),
    total_protected_cents: integer(
      source.total_protected_cents,
      boundary,
      'summary_protected_invalid',
      0,
      maximumAggregateCents,
    ),
    total_refunded_cents: integer(
      source.total_refunded_cents,
      boundary,
      'summary_refunded_invalid',
      0,
      maximumAggregateCents,
    ),
    payment_count: integer(
      source.payment_count,
      boundary,
      'summary_payment_count_invalid',
      0,
      maximumAggregateCount,
    ),
    released_count: integer(
      source.released_count,
      boundary,
      'summary_released_count_invalid',
      0,
      maximumAggregateCount,
    ),
    refunded_count: integer(
      source.refunded_count,
      boundary,
      'summary_refunded_count_invalid',
      0,
      maximumAggregateCount,
    ),
    disputed_count: integer(
      source.disputed_count,
      boundary,
      'summary_disputed_count_invalid',
      0,
      maximumAggregateCount,
    ),
  };

  if (result.currency !== 'USD') {
    reject(boundary, 'summary_currency_contract_invalid');
  }
  if (
    result.released_count > result.payment_count
    || result.refunded_count > result.payment_count
    || result.disputed_count > result.payment_count
  ) {
    reject(boundary, 'summary_count_contract_invalid');
  }
  const releasedGross =
    result.total_commission_earned_cents
    + result.total_released_to_sellers_cents;
  const assignedVolume =
    releasedGross
    + result.total_protected_cents
    + result.total_refunded_cents;
  if (
    !Number.isSafeInteger(releasedGross)
    || !Number.isSafeInteger(assignedVolume)
    || assignedVolume > result.total_payment_volume_cents
  ) {
    reject(boundary, 'summary_amount_contract_invalid');
  }
  if (
    result.payment_count === 0
    && (
      result.total_payment_volume_cents !== 0
      || releasedGross !== 0
      || result.total_protected_cents !== 0
      || result.total_refunded_cents !== 0
    )
  ) {
    reject(boundary, 'summary_empty_state_invalid');
  }
  return result;
}

function parseRevenueTransaction(
  value: unknown,
  boundary: AdminResponseBoundary,
): AdminRevenueTransactionPayload {
  const source = record(value, boundary, 'transaction_row_invalid');
  const status = boundedString(
    source.status,
    boundary,
    'transaction_status_invalid',
    6,
    32,
  );
  if (!revenueTransactionStates.has(status as ProtectedPaymentStatePayload)) {
    reject(boundary, 'transaction_status_invalid');
  }
  const itemAmount = integer(
    source.item_amount_cents,
    boundary,
    'transaction_item_amount_invalid',
    1,
    maximumTransactionAmountCents,
  );
  const platformFee = integer(
    source.platform_fee_cents,
    boundary,
    'transaction_platform_fee_invalid',
    0,
    maximumTransactionAmountCents,
  );
  const sellerAmount = integer(
    source.seller_amount_cents,
    boundary,
    'transaction_seller_amount_invalid',
    1,
    maximumTransactionAmountCents,
  );
  if (platformFee + sellerAmount !== itemAmount) {
    reject(boundary, 'transaction_amounts_do_not_balance');
  }
  const createdAt = timestamp(
    source.created_at,
    boundary,
    'transaction_created_at_invalid',
  );
  const updatedAt = timestamp(
    source.updated_at,
    boundary,
    'transaction_updated_at_invalid',
  );
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    reject(boundary, 'transaction_timestamp_order_invalid');
  }
  return {
    transaction_id: uuid(
      source.transaction_id,
      boundary,
      'transaction_id_invalid',
    ),
    deal_id: uuid(source.deal_id, boundary, 'transaction_deal_id_invalid'),
    public_id: publicId(
      source.public_id,
      boundary,
      'transaction_public_id_invalid',
    ),
    title: boundedString(
      source.title,
      boundary,
      'transaction_title_invalid',
      1,
      200,
    ),
    status: status as ProtectedPaymentStatePayload,
    currency: currency(
      source.currency,
      boundary,
      'transaction_currency_invalid',
    ),
    item_amount_cents: itemAmount,
    platform_fee_cents: platformFee,
    seller_amount_cents: sellerAmount,
    seller_name: boundedString(
      source.seller_name,
      boundary,
      'transaction_seller_name_invalid',
      1,
      120,
    ),
    buyer_name: boundedString(
      source.buyer_name,
      boundary,
      'transaction_buyer_name_invalid',
      1,
      120,
    ),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function parseAdminRevenueTransactionRows(
  value: unknown,
): AdminRevenueTransactionPayload[] {
  const boundary: AdminResponseBoundary = 'admin_revenue_transactions';
  const result = rows(
    value,
    boundary,
    'transaction_collection_invalid',
    200,
  ).map(row => parseRevenueTransaction(row, boundary));
  assertUnique(
    result.map(row => row.transaction_id),
    boundary,
    'transaction_id_duplicate',
  );
  assertUnique(
    result.map(row => row.deal_id),
    boundary,
    'transaction_deal_id_duplicate',
  );
  for (let index = 1; index < result.length; index += 1) {
    if (
      Date.parse(result[index].created_at)
      > Date.parse(result[index - 1].created_at)
    ) {
      reject(boundary, 'transaction_order_invalid');
    }
  }
  return result;
}

function parseCatalogAdoption(
  value: unknown,
  expectedWindowDays: 7 | 30 | 90,
  boundary: AdminResponseBoundary,
): AdminCatalogAdoptionPayload {
  const source = record(value, boundary, 'catalog_row_invalid');
  const windowDays = integer(
    source.window_days,
    boundary,
    'catalog_window_invalid',
    7,
    90,
  );
  if (
    !catalogWindows.has(windowDays as 7 | 30 | 90)
    || windowDays !== expectedWindowDays
  ) {
    reject(boundary, 'catalog_window_contract_invalid');
  }
  const catalogVersion = boundedString(
    source.catalog_version,
    boundary,
    'catalog_version_invalid',
    6,
    32,
  );
  if (!catalogVersionPattern.test(catalogVersion)) {
    reject(boundary, 'catalog_version_invalid');
  }
  const categoryId = boundedString(
    source.category_id,
    boundary,
    'catalog_category_invalid',
    1,
    64,
  );
  if (!categoryIdPattern.test(categoryId)) {
    reject(boundary, 'catalog_category_invalid');
  }
  const dealCount = integer(
    source.deal_count,
    boundary,
    'catalog_deal_count_invalid',
    1,
    maximumAggregateCount,
  );
  const result: AdminCatalogAdoptionPayload = {
    window_days: windowDays as 7 | 30 | 90,
    catalog_version: catalogVersion,
    category_id: categoryId,
    deal_count: dealCount,
    structured_brand_count: integer(
      source.structured_brand_count,
      boundary,
      'catalog_brand_count_invalid',
      0,
      dealCount,
    ),
    structured_model_count: integer(
      source.structured_model_count,
      boundary,
      'catalog_model_count_invalid',
      0,
      dealCount,
    ),
    manual_fallback_count: integer(
      source.manual_fallback_count,
      boundary,
      'catalog_fallback_count_invalid',
      0,
      dealCount,
    ),
    draft_count: integer(
      source.draft_count,
      boundary,
      'catalog_draft_count_invalid',
      0,
      dealCount,
    ),
    published_count: integer(
      source.published_count,
      boundary,
      'catalog_published_count_invalid',
      0,
      dealCount,
    ),
    accepted_count: integer(
      source.accepted_count,
      boundary,
      'catalog_accepted_count_invalid',
      0,
      dealCount,
    ),
    completed_count: integer(
      source.completed_count,
      boundary,
      'catalog_completed_count_invalid',
      0,
      dealCount,
    ),
    latest_deal_at: timestamp(
      source.latest_deal_at,
      boundary,
      'catalog_latest_deal_at_invalid',
    ),
  };
  if (result.structured_model_count > result.structured_brand_count) {
    reject(boundary, 'catalog_structure_contract_invalid');
  }
  return result;
}

export function parseAdminCatalogAdoptionRows(
  value: unknown,
  expectedWindowDays: 7 | 30 | 90,
): AdminCatalogAdoptionPayload[] {
  const boundary: AdminResponseBoundary = 'admin_catalog_adoption';
  const result = rows(
    value,
    boundary,
    'catalog_collection_invalid',
    256,
  ).map(row => parseCatalogAdoption(row, expectedWindowDays, boundary));
  assertUnique(
    result.map(row => `${row.catalog_version}:${row.category_id}`),
    boundary,
    'catalog_dimension_duplicate',
  );
  for (let index = 1; index < result.length; index += 1) {
    if (result[index].deal_count > result[index - 1].deal_count) {
      reject(boundary, 'catalog_order_invalid');
    }
  }
  return result;
}
