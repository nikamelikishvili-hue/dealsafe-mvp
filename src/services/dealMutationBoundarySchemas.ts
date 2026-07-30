import type { CurrencyCode } from '../currency';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';
import type { DealCategoryId } from '../domain';

type JsonRecord = Record<string, unknown>;

export type DealMutationRequestBoundary =
  | 'deal_draft_create_request'
  | 'deal_draft_update_request'
  | 'deal_publish_request'
  | 'deal_update_published_request'
  | 'deal_cancel_request'
  | 'saved_deals_request'
  | 'public_deal_request'
  | 'public_deal_accept_request'
  | 'media_upload_batch_request'
  | 'media_record_insert_request'
  | 'media_delete_request'
  | 'media_reorder_request';

export type DealMutationErrorBoundary =
  | 'deal_draft_create_error'
  | 'deal_draft_update_error'
  | 'deal_publish_error'
  | 'deal_update_published_error'
  | 'deal_cancel_error'
  | 'saved_deals_error'
  | 'public_deal_error'
  | 'public_deal_accept_error'
  | 'media_record_insert_error'
  | 'media_delete_error'
  | 'media_reorder_error';

export type DealMutationBoundary =
  | DealMutationRequestBoundary
  | DealMutationErrorBoundary;

export interface DealCatalogColumnsPayload {
  category_id: DealCategoryId;
  catalog_version: string;
  catalog_brand_id: string | null;
  catalog_brand_label: string | null;
  catalog_model_id: string | null;
  catalog_model_label: string | null;
  model_year: number | null;
  catalog_variant_id: string | null;
  catalog_variant_label: string | null;
}

interface DealEditableColumnsPayload {
  title: string;
  description: string;
  price_cents: number;
  currency: CurrencyCode;
  condition: 'Like new' | 'Good' | 'Fair';
  serial_last_four: string | null;
  delivery_method: 'Meet in person' | 'Ship to buyer';
  expires_at: string;
}

export interface DealDraftCreateRequestPayload
  extends DealEditableColumnsPayload,
    DealCatalogColumnsPayload {
  seller_id: string;
  status: 'draft';
  current_agreement_version: 0;
  published_at: null;
}

export interface DealDraftUpdateRequestPayload
  extends DealEditableColumnsPayload,
    DealCatalogColumnsPayload {
  updated_at: string;
}

export interface DealPublishRequestPayload {
  p_deal_id: string;
  p_title: string;
  p_description: string;
  p_price_cents: number;
  p_currency: CurrencyCode;
  p_condition: 'Like new' | 'Good' | 'Fair';
  p_serial_last_four: string | null;
  p_delivery_method: 'Meet in person' | 'Ship to buyer';
  p_expires_in_days: 1 | 3 | 7 | 14 | 30;
}

export interface PublishedDealUpdateRequestPayload {
  p_deal_id: string;
  p_title: string;
  p_description: string;
  p_price_cents: number;
  p_condition: 'Like new' | 'Good' | 'Fair';
  p_delivery_method: 'Meet in person' | 'Ship to buyer';
}

export interface DealCancelRequestPayload {
  p_deal_id: string;
  p_reason: string;
}

export interface PublicDealRequestPayload {
  p_public_id: string;
}

export interface PublicDealAcceptRequestPayload extends PublicDealRequestPayload {
  p_typed_name: string;
  p_access_code: string | null;
}

export interface MediaUploadBatchRequestPayload {
  dealId: string;
  ownerId: string;
  startIndex: number;
  fileCount: number;
}

export interface DealOwnerContextPayload {
  dealId: string;
  ownerId: string;
}

export interface MediaRecordInsertRequestPayload {
  deal_id: string;
  storage_path: string;
  sort_order: number;
}

export interface MediaDeleteRequestPayload {
  dealId: string;
  storagePath: string;
}

export interface MediaReorderRequestPayload {
  p_deal_id: string;
  p_paths: string[];
}

export interface DealMutationErrorEnvelopePayload {
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const catalogVersionPattern =
  /^(?:legacy|[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+)$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mediaFilePattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(?:jpg|jpeg|png|webp|heic|mp4|webm)$/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const currencyCodes = new Set<CurrencyCode>([
  'USD', 'EUR', 'GBP', 'GEL', 'TRY', 'ILS', 'CNY', 'JPY', 'KRW', 'INR',
  'CAD', 'AUD', 'CHF', 'AED', 'SAR',
]);
const categories = new Set<DealCategoryId>([
  'phone', 'tablet', 'laptop', 'vehicle', 'watch', 'camera', 'gaming',
  'tools', 'business', 'jewelry', 'collectible', 'general',
]);
const conditions = new Set(['Like new', 'Good', 'Fair']);
const deliveryMethods = new Set(['Meet in person', 'Ship to buyer']);
const expirationDays = new Set([1, 3, 7, 14, 30]);
const maximumPriceCents = 100_000_000_000;

const safeMessages: Partial<Record<string, string>> = {
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  seller_id_invalid: 'Your account could not be verified. Sign in again.',
  title_invalid: 'Item title must contain 3 to 120 characters.',
  description_invalid: 'Check the item description and try again.',
  price_invalid: 'Enter a valid price greater than zero.',
  currency_invalid: 'Choose a supported currency.',
  condition_invalid: 'Choose a valid item condition.',
  delivery_method_invalid: 'Choose a valid handoff method.',
  serial_invalid: 'Check the item identifier and try again.',
  expiration_invalid: 'Choose an available Deal Link expiration period.',
  catalog_invalid: 'Check the selected category, brand, and model.',
  public_id_invalid: 'Enter a valid Deal Link identifier.',
  typed_name_invalid: 'Enter your full legal name.',
  access_code_invalid: 'Enter the 6-digit buyer access code.',
  cancellation_reason_invalid: 'Enter a cancellation reason with at least 5 characters.',
  media_batch_invalid: 'Choose between 1 and 6 media files.',
  media_url_invalid: 'This media link is not trusted.',
  media_path_invalid: 'This media item is not valid for the selected deal.',
  media_order_invalid: 'The media order is invalid. Refresh and try again.',
};

export class DealMutationBoundaryValidationError extends Error {
  readonly boundary: DealMutationBoundary;
  readonly issue: string;

  constructor(boundary: DealMutationBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The deal request could not be processed safely. Please try again.',
    );
    this.name = 'DealMutationBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: DealMutationBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.deal-mutation.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new DealMutationBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: DealMutationBoundary,
  issue: string,
  required: readonly string[],
  optional: readonly string[] = [],
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  const source = value as JsonRecord;
  const allowed = new Set([...required, ...optional]);
  if (
    required.some(key => !Object.prototype.hasOwnProperty.call(source, key))
    || Object.keys(source).some(key => !allowed.has(key))
  ) {
    reject(boundary, issue);
  }
  return source;
}

function boundedString(
  value: unknown,
  boundary: DealMutationBoundary,
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

function trimmedString(
  value: unknown,
  boundary: DealMutationBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  const result = boundedString(
    value,
    boundary,
    issue,
    minimum,
    maximum + 256,
  ).trim();
  if (result.length < minimum || result.length > maximum) {
    reject(boundary, issue);
  }
  return result;
}

function uuid(
  value: unknown,
  boundary: DealMutationBoundary,
  issue = 'deal_id_invalid',
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function publicId(
  value: unknown,
  boundary: DealMutationBoundary,
): string {
  const result = trimmedString(
    value,
    boundary,
    'public_id_invalid',
    6,
    32,
  ).toUpperCase();
  if (!publicIdPattern.test(result)) reject(boundary, 'public_id_invalid');
  return result;
}

function safeInteger(
  value: unknown,
  boundary: DealMutationBoundary,
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

function isoTimestamp(
  value: unknown,
  boundary: DealMutationBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 20, 30);
  const parsed = new Date(result);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== result) {
    reject(boundary, issue);
  }
  return result;
}

function nullableString(
  value: unknown,
  boundary: DealMutationBoundary,
  issue: string,
  maximum: number,
): string | null {
  if (value === null) return null;
  return trimmedString(value, boundary, issue, 1, maximum);
}

function catalogColumns(
  source: JsonRecord,
  boundary: DealMutationBoundary,
): DealCatalogColumnsPayload {
  if (
    typeof source.category_id !== 'string'
    || !categories.has(source.category_id as DealCategoryId)
  ) {
    reject(boundary, 'catalog_invalid');
  }
  const version = trimmedString(
    source.catalog_version,
    boundary,
    'catalog_invalid',
    6,
    40,
  );
  if (!catalogVersionPattern.test(version)) reject(boundary, 'catalog_invalid');

  const brandId = nullableString(
    source.catalog_brand_id,
    boundary,
    'catalog_invalid',
    80,
  );
  const modelId = nullableString(
    source.catalog_model_id,
    boundary,
    'catalog_invalid',
    80,
  );
  const variantId = nullableString(
    source.catalog_variant_id,
    boundary,
    'catalog_invalid',
    80,
  );
  for (const id of [brandId, modelId, variantId]) {
    if (id !== null && !slugPattern.test(id)) reject(boundary, 'catalog_invalid');
  }
  const brandLabel = nullableString(
    source.catalog_brand_label,
    boundary,
    'catalog_invalid',
    80,
  );
  const modelLabel = nullableString(
    source.catalog_model_label,
    boundary,
    'catalog_invalid',
    100,
  );
  const variantLabel = nullableString(
    source.catalog_variant_label,
    boundary,
    'catalog_invalid',
    60,
  );

  let modelYear: number | null = null;
  if (source.model_year !== null) {
    modelYear = safeInteger(
      source.model_year,
      boundary,
      'catalog_invalid',
      1886,
      2100,
    );
  }
  const category = source.category_id as DealCategoryId;
  if (
    (modelId !== null && brandId === null)
    || (variantId !== null && modelId === null)
    || (brandLabel !== null && brandId === null)
    || (modelLabel !== null && modelId === null)
    || (variantLabel !== null && variantId === null)
    || (modelYear !== null && category !== 'vehicle')
  ) {
    reject(boundary, 'catalog_invalid');
  }
  return {
    category_id: category,
    catalog_version: version,
    catalog_brand_id: brandId,
    catalog_brand_label: brandLabel,
    catalog_model_id: modelId,
    catalog_model_label: modelLabel,
    model_year: modelYear,
    catalog_variant_id: variantId,
    catalog_variant_label: variantLabel,
  };
}

function editableColumns(
  source: JsonRecord,
  boundary: DealMutationBoundary,
  descriptionMinimum: number,
): DealEditableColumnsPayload {
  const currencyValue = trimmedString(
    source.currency,
    boundary,
    'currency_invalid',
    3,
    3,
  ).toUpperCase();
  if (!currencyCodes.has(currencyValue as CurrencyCode)) {
    reject(boundary, 'currency_invalid');
  }
  if (
    typeof source.condition !== 'string'
    || !conditions.has(source.condition)
  ) {
    reject(boundary, 'condition_invalid');
  }
  if (
    typeof source.delivery_method !== 'string'
    || !deliveryMethods.has(source.delivery_method)
  ) {
    reject(boundary, 'delivery_method_invalid');
  }
  const serial = nullableString(
    source.serial_last_four,
    boundary,
    'serial_invalid',
    4,
  );
  return {
    title: trimmedString(source.title, boundary, 'title_invalid', 3, 120),
    description: trimmedString(
      source.description,
      boundary,
      'description_invalid',
      descriptionMinimum,
      10_000,
    ),
    price_cents: safeInteger(
      source.price_cents,
      boundary,
      'price_invalid',
      1,
      maximumPriceCents,
    ),
    currency: currencyValue as CurrencyCode,
    condition: source.condition as DealEditableColumnsPayload['condition'],
    serial_last_four: serial,
    delivery_method:
      source.delivery_method as DealEditableColumnsPayload['delivery_method'],
    expires_at: isoTimestamp(
      source.expires_at,
      boundary,
      'expiration_invalid',
    ),
  };
}

const editableKeys = [
  'title',
  'description',
  'price_cents',
  'currency',
  'condition',
  'serial_last_four',
  'delivery_method',
  'expires_at',
] as const;
const catalogKeys = [
  'category_id',
  'catalog_version',
  'catalog_brand_id',
  'catalog_brand_label',
  'catalog_model_id',
  'catalog_model_label',
  'model_year',
  'catalog_variant_id',
  'catalog_variant_label',
] as const;

export function parseDealDraftCreateRequest(
  value: unknown,
): DealDraftCreateRequestPayload {
  const boundary = 'deal_draft_create_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [
      'seller_id',
      ...editableKeys,
      'status',
      'current_agreement_version',
      'published_at',
      ...catalogKeys,
    ],
  );
  if (
    source.status !== 'draft'
    || source.current_agreement_version !== 0
    || source.published_at !== null
  ) {
    reject(boundary, 'draft_state_invalid');
  }
  return {
    seller_id: uuid(source.seller_id, boundary, 'seller_id_invalid'),
    ...editableColumns(source, boundary, 0),
    status: 'draft',
    current_agreement_version: 0,
    published_at: null,
    ...catalogColumns(source, boundary),
  };
}

export function parseDealDraftUpdateRequest(
  value: unknown,
): DealDraftUpdateRequestPayload {
  const boundary = 'deal_draft_update_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [...editableKeys, 'updated_at', ...catalogKeys],
  );
  return {
    ...editableColumns(source, boundary, 0),
    updated_at: isoTimestamp(
      source.updated_at,
      boundary,
      'updated_at_invalid',
    ),
    ...catalogColumns(source, boundary),
  };
}

function expirationDay(
  value: unknown,
  boundary: DealMutationBoundary,
): 1 | 3 | 7 | 14 | 30 {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || !expirationDays.has(value)
  ) {
    reject(boundary, 'expiration_invalid');
  }
  return value as 1 | 3 | 7 | 14 | 30;
}

export function parseDealExpirationDays(
  value: unknown,
  boundary:
    | 'deal_draft_create_request'
    | 'deal_draft_update_request',
): 1 | 3 | 7 | 14 | 30 {
  return expirationDay(value, boundary);
}

export function parseDealIdRequest(
  value: unknown,
  boundary:
    | 'deal_draft_update_request'
    | 'deal_update_published_request',
): string {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['dealId'],
  );
  return uuid(source.dealId, boundary);
}

export function parseDealOwnerContext(
  value: unknown,
  boundary: 'deal_draft_update_request',
): DealOwnerContextPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['dealId', 'ownerId'],
  );
  return {
    dealId: uuid(source.dealId, boundary),
    ownerId: uuid(source.ownerId, boundary, 'seller_id_invalid'),
  };
}

export function parseDealPublishRequest(
  value: unknown,
): DealPublishRequestPayload {
  const boundary = 'deal_publish_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [
      'p_deal_id',
      'p_title',
      'p_description',
      'p_price_cents',
      'p_currency',
      'p_condition',
      'p_serial_last_four',
      'p_delivery_method',
      'p_expires_in_days',
    ],
  );
  const editable = editableColumns(
    {
      title: source.p_title,
      description: source.p_description,
      price_cents: source.p_price_cents,
      currency: source.p_currency,
      condition: source.p_condition,
      serial_last_four: source.p_serial_last_four,
      delivery_method: source.p_delivery_method,
      expires_at: new Date().toISOString(),
    },
    boundary,
    20,
  );
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_title: editable.title,
    p_description: editable.description,
    p_price_cents: editable.price_cents,
    p_currency: editable.currency,
    p_condition: editable.condition,
    p_serial_last_four: editable.serial_last_four,
    p_delivery_method: editable.delivery_method,
    p_expires_in_days: expirationDay(source.p_expires_in_days, boundary),
  };
}

export function parsePublishedDealUpdateRequest(
  value: unknown,
): PublishedDealUpdateRequestPayload {
  const boundary = 'deal_update_published_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [
      'p_deal_id',
      'p_title',
      'p_description',
      'p_price_cents',
      'p_condition',
      'p_delivery_method',
    ],
  );
  const title = trimmedString(
    source.p_title,
    boundary,
    'title_invalid',
    3,
    120,
  );
  const description = trimmedString(
    source.p_description,
    boundary,
    'description_invalid',
    3,
    10_000,
  );
  const priceCents = safeInteger(
    source.p_price_cents,
    boundary,
    'price_invalid',
    1,
    maximumPriceCents,
  );
  if (
    typeof source.p_condition !== 'string'
    || !conditions.has(source.p_condition)
  ) {
    reject(boundary, 'condition_invalid');
  }
  if (
    typeof source.p_delivery_method !== 'string'
    || !deliveryMethods.has(source.p_delivery_method)
  ) {
    reject(boundary, 'delivery_method_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_title: title,
    p_description: description,
    p_price_cents: priceCents,
    p_condition:
      source.p_condition as PublishedDealUpdateRequestPayload['p_condition'],
    p_delivery_method:
      source.p_delivery_method as PublishedDealUpdateRequestPayload['p_delivery_method'],
  };
}

export function parseDealCancelRequest(
  value: unknown,
): DealCancelRequestPayload {
  const boundary = 'deal_cancel_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_reason'],
  );
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_reason: trimmedString(
      source.p_reason,
      boundary,
      'cancellation_reason_invalid',
      5,
      1_000,
    ),
  };
}

export function parseSavedDealsRequest(value: unknown): Record<string, never> {
  const boundary = 'saved_deals_request';
  exactRecord(value, boundary, 'request_shape_invalid', []);
  return {};
}

export function parsePublicDealRequest(
  value: unknown,
): PublicDealRequestPayload {
  const boundary = 'public_deal_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id'],
  );
  return { p_public_id: publicId(source.p_public_id, boundary) };
}

export function parsePublicDealAcceptRequest(
  value: unknown,
): PublicDealAcceptRequestPayload {
  const boundary = 'public_deal_accept_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_typed_name', 'p_access_code'],
  );
  let accessCode: string | null = null;
  if (source.p_access_code !== null) {
    accessCode = trimmedString(
      source.p_access_code,
      boundary,
      'access_code_invalid',
      6,
      6,
    );
    if (!/^[0-9]{6}$/.test(accessCode)) {
      reject(boundary, 'access_code_invalid');
    }
  }
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_typed_name: trimmedString(
      source.p_typed_name,
      boundary,
      'typed_name_invalid',
      2,
      120,
    ),
    p_access_code: accessCode,
  };
}

export function parseMediaUploadBatchRequest(
  value: unknown,
): MediaUploadBatchRequestPayload {
  const boundary = 'media_upload_batch_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['dealId', 'ownerId', 'startIndex', 'fileCount'],
  );
  const startIndex = safeInteger(
    source.startIndex,
    boundary,
    'media_batch_invalid',
    0,
    5,
  );
  const fileCount = safeInteger(
    source.fileCount,
    boundary,
    'media_batch_invalid',
    1,
    6,
  );
  if (startIndex + fileCount > 6) reject(boundary, 'media_batch_invalid');
  return {
    dealId: uuid(source.dealId, boundary),
    ownerId: uuid(source.ownerId, boundary, 'seller_id_invalid'),
    startIndex,
    fileCount,
  };
}

function mediaStoragePath(
  value: unknown,
  boundary: DealMutationBoundary,
  ownerId: string,
  dealId: string,
): string {
  const path = boundedString(
    value,
    boundary,
    'media_path_invalid',
    1,
    512,
  );
  const segments = path.split('/');
  if (
    segments.length !== 3
    || segments[0].toLowerCase() !== ownerId
    || segments[1].toLowerCase() !== dealId
    || !mediaFilePattern.test(segments[2])
  ) {
    reject(boundary, 'media_path_invalid');
  }
  return `${ownerId}/${dealId}/${segments[2].toLowerCase()}`;
}

function mediaPathFromPublicUrl(
  value: unknown,
  boundary: DealMutationBoundary,
  expectedSupabaseUrl: unknown,
  ownerId: string,
  dealId: string,
): string {
  const rawUrl = boundedString(
    value,
    boundary,
    'media_url_invalid',
    1,
    2_048,
  );
  const serviceUrl = boundedString(
    expectedSupabaseUrl,
    boundary,
    'media_url_invalid',
    8,
    2_048,
  );
  let candidate: URL;
  let expected: URL;
  try {
    candidate = new URL(rawUrl);
    expected = new URL(serviceUrl);
  } catch {
    reject(boundary, 'media_url_invalid');
  }
  const prefix = '/storage/v1/object/public/deal-media/';
  if (
    candidate.origin !== expected.origin
    || candidate.username
    || candidate.password
    || candidate.search
    || candidate.hash
    || !candidate.pathname.startsWith(prefix)
  ) {
    reject(boundary, 'media_url_invalid');
  }
  const encodedSegments = candidate.pathname.slice(prefix.length).split('/');
  if (encodedSegments.length !== 3) reject(boundary, 'media_url_invalid');
  let decodedPath: string;
  try {
    decodedPath = encodedSegments.map(segment => decodeURIComponent(segment)).join('/');
  } catch {
    reject(boundary, 'media_url_invalid');
  }
  return mediaStoragePath(
    decodedPath,
    boundary,
    ownerId,
    dealId,
  );
}

export function parseMediaRecordInsertRequest(
  value: unknown,
  ownerId: string,
): MediaRecordInsertRequestPayload {
  const boundary = 'media_record_insert_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['deal_id', 'storage_path', 'sort_order'],
  );
  const dealId = uuid(source.deal_id, boundary);
  const normalizedOwnerId = uuid(ownerId, boundary, 'seller_id_invalid');
  return {
    deal_id: dealId,
    storage_path: mediaStoragePath(
      source.storage_path,
      boundary,
      normalizedOwnerId,
      dealId,
    ),
    sort_order: safeInteger(
      source.sort_order,
      boundary,
      'media_order_invalid',
      0,
      5,
    ),
  };
}

export function parseMediaDeleteRequest(
  value: unknown,
): MediaDeleteRequestPayload {
  const boundary = 'media_delete_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['dealId', 'ownerId', 'publicUrl', 'supabaseUrl'],
  );
  const dealId = uuid(source.dealId, boundary);
  const ownerId = uuid(source.ownerId, boundary, 'seller_id_invalid');
  return {
    dealId,
    storagePath: mediaPathFromPublicUrl(
      source.publicUrl,
      boundary,
      source.supabaseUrl,
      ownerId,
      dealId,
    ),
  };
}

export function parseMediaReorderRequest(
  value: unknown,
): MediaReorderRequestPayload {
  const boundary = 'media_reorder_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['dealId', 'ownerId', 'publicUrls', 'supabaseUrl'],
  );
  const dealId = uuid(source.dealId, boundary);
  const ownerId = uuid(source.ownerId, boundary, 'seller_id_invalid');
  if (
    !Array.isArray(source.publicUrls)
    || source.publicUrls.length < 1
    || source.publicUrls.length > 6
  ) {
    reject(boundary, 'media_order_invalid');
  }
  const paths = source.publicUrls.map(url => mediaPathFromPublicUrl(
    url,
    boundary,
    source.supabaseUrl,
    ownerId,
    dealId,
  ));
  if (new Set(paths).size !== paths.length) {
    reject(boundary, 'media_order_invalid');
  }
  return { p_deal_id: dealId, p_paths: paths };
}

export function parseDealMutationPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: DealMutationErrorBoundary,
): DealMutationErrorEnvelopePayload {
  if (!Number.isSafeInteger(status) || status < 400 || status > 599) {
    reject(boundary, 'status_invalid');
  }
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    ['message'],
    ['code', 'details', 'hint'],
  );
  const message = boundedString(
    source.message,
    boundary,
    'error_message_invalid',
    1,
    512,
  ).trim();
  if (!message) reject(boundary, 'error_message_invalid');
  for (const key of ['details', 'hint'] as const) {
    if (
      key in source
      && source[key] !== null
      && source[key] !== undefined
    ) {
      boundedString(source[key], boundary, `${key}_invalid`, 0, 2_000);
    }
  }
  let code: string | null = null;
  if ('code' in source && source.code !== null && source.code !== undefined) {
    code = boundedString(source.code, boundary, 'error_code_invalid', 1, 64);
    if (!/^[a-z0-9_.-]+$/i.test(code)) {
      reject(boundary, 'error_code_invalid');
    }
  }
  return { code };
}
