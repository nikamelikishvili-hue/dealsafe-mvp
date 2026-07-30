import type { CurrencyCode } from '../currency';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';
import type {
  DealCategoryId,
  DealStatus,
  VerificationStatus,
} from '../domain';

type JsonRecord = Record<string, unknown>;

const dealStatuses = new Set<DealStatus>([
  'draft',
  'published',
  'accepted',
  'completed',
  'cancelled',
  'disputed',
]);
const verificationStatuses = new Set<VerificationStatus>([
  'not_started',
  'pending',
  'verified',
  'failed',
]);
const conditions = new Set(['Like new', 'Good', 'Fair'] as const);
const deliveryMethods = new Set([
  'Meet in person',
  'Ship to buyer',
] as const);
const categoryIds = new Set<DealCategoryId>([
  'phone',
  'tablet',
  'laptop',
  'vehicle',
  'watch',
  'camera',
  'gaming',
  'tools',
  'business',
  'jewelry',
  'collectible',
  'general',
]);
export const runtimeCurrencyCodes = [
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
const supportedCurrencyCodes = new Set<CurrencyCode>(runtimeCurrencyCodes);
const workflowDealStatuses = new Set([
  'accepted',
  'completed',
  'disputed',
  'cancelled',
] as const);
const meetingStatuses = new Set([
  'proposed',
  'confirmed',
  'cancelled',
] as const);
const shipmentStatuses = new Set(['shipped', 'delivered'] as const);

export type ServiceResponseBoundary =
  | 'user_deals'
  | 'saved_deals'
  | 'public_deal'
  | 'deal_action_plan'
  | 'shipping_evidence_readiness';

export class ServiceResponseValidationError extends Error {
  readonly boundary: ServiceResponseBoundary;
  readonly issue: string;

  constructor(boundary: ServiceResponseBoundary, issue: string) {
    super('The service returned an invalid response. Please try again later.');
    this.name = 'ServiceResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(
  boundary: ServiceResponseBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.service.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new ServiceResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function array(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
  maximum: number,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    reject(boundary, issue);
  }
  return value;
}

function string(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
  maximum: number,
  allowEmpty = false,
): string {
  if (
    typeof value !== 'string'
    || value.length > maximum
    || (!allowEmpty && !value.trim())
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function nullableString(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
  maximum: number,
): string | null {
  return value === null
    ? null
    : string(value, boundary, issue, maximum, true);
}

function optionalString(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
  maximum: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return string(value, boundary, issue, maximum, true);
}

function integer(
  value: unknown,
  boundary: ServiceResponseBoundary,
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

function optionalInteger(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return integer(value, boundary, issue, minimum, maximum);
}

function boolean(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function timestamp(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
): string {
  const result = string(value, boundary, issue, 80);
  if (!Number.isFinite(Date.parse(result))) reject(boundary, issue);
  return result;
}

function nullableTimestamp(
  value: unknown,
  boundary: ServiceResponseBoundary,
  issue: string,
): string | null {
  return value === null
    ? null
    : timestamp(value, boundary, issue);
}

function enumValue<const Value extends string>(
  value: unknown,
  allowed: ReadonlySet<Value>,
  boundary: ServiceResponseBoundary,
  issue: string,
): Value {
  if (typeof value !== 'string' || !allowed.has(value as Value)) {
    reject(boundary, issue);
  }
  return value as Value;
}

function nullableEnum<const Value extends string>(
  value: unknown,
  allowed: ReadonlySet<Value>,
  boundary: ServiceResponseBoundary,
  issue: string,
): Value | null {
  return value === null
    ? null
    : enumValue(value, allowed, boundary, issue);
}

export interface DealRowPayload {
  id: string;
  public_id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: CurrencyCode;
  condition: 'Like new' | 'Good' | 'Fair';
  serial_last_four: string | null;
  delivery_method: 'Meet in person' | 'Ship to buyer';
  category_id?: DealCategoryId;
  catalog_version?: string;
  catalog_brand_id?: string;
  catalog_brand_label?: string;
  catalog_model_id?: string;
  catalog_model_label?: string;
  model_year?: number;
  catalog_variant_id?: string;
  catalog_variant_label?: string;
  status: DealStatus;
  current_agreement_version: number;
  created_at: string;
  expires_at: string | null;
  deal_media: { storage_path: string; sort_order: number }[];
  seller_id?: string;
  buyer_id?: string;
}

function parseMedia(
  value: unknown,
  boundary: ServiceResponseBoundary,
  rowIndex: number,
) {
  if (value === undefined || value === null) return [];
  return array(
    value,
    boundary,
    `row_${rowIndex}_invalid_deal_media`,
    24,
  ).map((entry, mediaIndex) => {
    const source = record(
      entry,
      boundary,
      `row_${rowIndex}_media_${mediaIndex}_not_object`,
    );
    return {
      storage_path: string(
        source.storage_path,
        boundary,
        `row_${rowIndex}_media_${mediaIndex}_invalid_path`,
        1024,
      ),
      sort_order: integer(
        source.sort_order,
        boundary,
        `row_${rowIndex}_media_${mediaIndex}_invalid_order`,
        0,
        10_000,
      ),
    };
  });
}

function parseDealRow(
  value: unknown,
  boundary: ServiceResponseBoundary,
  rowIndex: number,
  agreementVersionField: 'current_agreement_version' | 'agreement_version',
): DealRowPayload {
  const source = record(value, boundary, `row_${rowIndex}_not_object`);
  const agreementVersion = integer(
    source[agreementVersionField],
    boundary,
    `row_${rowIndex}_invalid_agreement_version`,
    agreementVersionField === 'agreement_version' ? 1 : 0,
    1_000_000,
  );
  const categoryId = source.category_id === undefined
    || source.category_id === null
    ? undefined
    : enumValue(
      source.category_id,
      categoryIds,
      boundary,
      `row_${rowIndex}_invalid_category`,
    );
  const buyerId = optionalString(
    source.buyer_id,
    boundary,
    `row_${rowIndex}_invalid_buyer_id`,
    128,
  );
  return {
    id: string(source.id, boundary, `row_${rowIndex}_invalid_id`, 128),
    public_id: string(
      source.public_id,
      boundary,
      `row_${rowIndex}_invalid_public_id`,
      64,
    ),
    title: string(
      source.title,
      boundary,
      `row_${rowIndex}_invalid_title`,
      300,
    ),
    description: string(
      source.description,
      boundary,
      `row_${rowIndex}_invalid_description`,
      20_000,
      true,
    ),
    price_cents: integer(
      source.price_cents,
      boundary,
      `row_${rowIndex}_invalid_price`,
      0,
      1_000_000_000_000,
    ),
    currency: enumValue(
      source.currency,
      supportedCurrencyCodes,
      boundary,
      `row_${rowIndex}_invalid_currency`,
    ),
    condition: enumValue(
      source.condition,
      conditions,
      boundary,
      `row_${rowIndex}_invalid_condition`,
    ),
    serial_last_four: nullableString(
      source.serial_last_four,
      boundary,
      `row_${rowIndex}_invalid_serial`,
      64,
    ),
    delivery_method: enumValue(
      source.delivery_method,
      deliveryMethods,
      boundary,
      `row_${rowIndex}_invalid_delivery_method`,
    ),
    category_id: categoryId,
    catalog_version: optionalString(
      source.catalog_version,
      boundary,
      `row_${rowIndex}_invalid_catalog_version`,
      80,
    ),
    catalog_brand_id: optionalString(
      source.catalog_brand_id,
      boundary,
      `row_${rowIndex}_invalid_brand_id`,
      128,
    ),
    catalog_brand_label: optionalString(
      source.catalog_brand_label,
      boundary,
      `row_${rowIndex}_invalid_brand_label`,
      160,
    ),
    catalog_model_id: optionalString(
      source.catalog_model_id,
      boundary,
      `row_${rowIndex}_invalid_model_id`,
      128,
    ),
    catalog_model_label: optionalString(
      source.catalog_model_label,
      boundary,
      `row_${rowIndex}_invalid_model_label`,
      160,
    ),
    model_year: optionalInteger(
      source.model_year,
      boundary,
      `row_${rowIndex}_invalid_model_year`,
      1886,
      2200,
    ),
    catalog_variant_id: optionalString(
      source.catalog_variant_id,
      boundary,
      `row_${rowIndex}_invalid_variant_id`,
      128,
    ),
    catalog_variant_label: optionalString(
      source.catalog_variant_label,
      boundary,
      `row_${rowIndex}_invalid_variant_label`,
      160,
    ),
    status: enumValue(
      source.status,
      dealStatuses,
      boundary,
      `row_${rowIndex}_invalid_status`,
    ),
    current_agreement_version: agreementVersion,
    created_at: timestamp(
      source.created_at,
      boundary,
      `row_${rowIndex}_invalid_created_at`,
    ),
    expires_at: nullableTimestamp(
      source.expires_at,
      boundary,
      `row_${rowIndex}_invalid_expires_at`,
    ),
    deal_media: parseMedia(source.deal_media, boundary, rowIndex),
    seller_id: optionalString(
      source.seller_id,
      boundary,
      `row_${rowIndex}_invalid_seller_id`,
      128,
    ),
    buyer_id: buyerId,
  };
}

export function parseUserDealRows(value: unknown): DealRowPayload[] {
  const boundary = 'user_deals' as const;
  return array(value, boundary, 'rows_not_array', 500).map(
    (entry, index) => parseDealRow(
      entry,
      boundary,
      index,
      'current_agreement_version',
    ),
  );
}

function parseMediaPaths(
  value: unknown,
  boundary: 'saved_deals' | 'public_deal',
  rowIndex: number,
) {
  if (value === undefined || value === null) return [];
  return array(
    value,
    boundary,
    `row_${rowIndex}_invalid_media_paths`,
    24,
  ).map((entry, mediaIndex) => string(
    entry,
    boundary,
    `row_${rowIndex}_media_${mediaIndex}_invalid_path`,
    1024,
  ));
}

export interface PublicDealRowPayload extends DealRowPayload {
  agreement_version: number;
  seller_name: string;
  seller_contact_verified: boolean;
  seller_verification: VerificationStatus;
  media_paths: string[];
}

function parsePublicDealRow(
  value: unknown,
  rowIndex: number,
): PublicDealRowPayload {
  const boundary = 'public_deal' as const;
  const source = record(value, boundary, `row_${rowIndex}_not_object`);
  const base = parseDealRow(
    source,
    boundary,
    rowIndex,
    'agreement_version',
  );
  return {
    ...base,
    agreement_version: base.current_agreement_version,
    seller_name: string(
      source.seller_name,
      boundary,
      `row_${rowIndex}_invalid_seller_name`,
      160,
    ),
    seller_contact_verified: boolean(
      source.seller_contact_verified,
      boundary,
      `row_${rowIndex}_invalid_contact_verification`,
    ),
    seller_verification: enumValue(
      source.seller_verification,
      verificationStatuses,
      boundary,
      `row_${rowIndex}_invalid_seller_verification`,
    ),
    media_paths: parseMediaPaths(
      source.media_paths,
      boundary,
      rowIndex,
    ),
  };
}

export function parsePublicDealRows(
  value: unknown,
): PublicDealRowPayload[] {
  const boundary = 'public_deal' as const;
  return array(value, boundary, 'rows_not_array', 1).map(
    (entry, index) => parsePublicDealRow(entry, index),
  );
}

export interface SavedDealRowPayload extends DealRowPayload {
  seller_name: string;
  seller_contact_verified: boolean;
  seller_verification: VerificationStatus;
  media_paths: string[];
  saved_at: string;
}

export function parseSavedDealRows(
  value: unknown,
): SavedDealRowPayload[] {
  const boundary = 'saved_deals' as const;
  return array(value, boundary, 'rows_not_array', 500).map(
    (entry, index) => {
      const source = record(entry, boundary, `row_${index}_not_object`);
      return {
        ...parseDealRow(
          source,
          boundary,
          index,
          'current_agreement_version',
        ),
        seller_name: string(
          source.seller_name,
          boundary,
          `row_${index}_invalid_seller_name`,
          160,
        ),
        seller_contact_verified: boolean(
          source.seller_contact_verified,
          boundary,
          `row_${index}_invalid_contact_verification`,
        ),
        seller_verification: enumValue(
          source.seller_verification,
          verificationStatuses,
          boundary,
          `row_${index}_invalid_seller_verification`,
        ),
        media_paths: parseMediaPaths(
          source.media_paths,
          boundary,
          index,
        ),
        saved_at: timestamp(
          source.saved_at,
          boundary,
          `row_${index}_invalid_saved_at`,
        ),
      };
    },
  );
}

export interface DealActionPlanPayload {
  viewer_role: 'seller' | 'buyer';
  deal_status: 'accepted' | 'completed' | 'disputed' | 'cancelled';
  meeting_status: 'proposed' | 'confirmed' | 'cancelled' | null;
  seller_arrived: boolean;
  buyer_arrived: boolean;
  handoff_code_ready: boolean;
  shipment_status: 'shipped' | 'delivered' | null;
  inspection_recorded: boolean;
  rating_submitted: boolean;
  delivery_address_ready: boolean;
  payment_method_recorded: boolean;
  payment_method_confirmed: boolean;
  payment_marked_sent: boolean;
  payment_received: boolean;
}

export function parseDealActionPlanRows(
  value: unknown,
): DealActionPlanPayload[] {
  const boundary = 'deal_action_plan' as const;
  return array(value, boundary, 'rows_not_array', 1).map(
    (entry, index) => {
      const source = record(entry, boundary, `row_${index}_not_object`);
      return {
        viewer_role: enumValue(
          source.viewer_role,
          new Set(['seller', 'buyer'] as const),
          boundary,
          `row_${index}_invalid_viewer_role`,
        ),
        deal_status: enumValue(
          source.deal_status,
          workflowDealStatuses,
          boundary,
          `row_${index}_invalid_deal_status`,
        ),
        meeting_status: nullableEnum(
          source.meeting_status,
          meetingStatuses,
          boundary,
          `row_${index}_invalid_meeting_status`,
        ),
        seller_arrived: boolean(
          source.seller_arrived,
          boundary,
          `row_${index}_invalid_seller_arrived`,
        ),
        buyer_arrived: boolean(
          source.buyer_arrived,
          boundary,
          `row_${index}_invalid_buyer_arrived`,
        ),
        handoff_code_ready: boolean(
          source.handoff_code_ready,
          boundary,
          `row_${index}_invalid_handoff_code_ready`,
        ),
        shipment_status: nullableEnum(
          source.shipment_status,
          shipmentStatuses,
          boundary,
          `row_${index}_invalid_shipment_status`,
        ),
        inspection_recorded: boolean(
          source.inspection_recorded,
          boundary,
          `row_${index}_invalid_inspection_recorded`,
        ),
        rating_submitted: boolean(
          source.rating_submitted,
          boundary,
          `row_${index}_invalid_rating_submitted`,
        ),
        delivery_address_ready: boolean(
          source.delivery_address_ready,
          boundary,
          `row_${index}_invalid_delivery_address_ready`,
        ),
        payment_method_recorded: boolean(
          source.payment_method_recorded,
          boundary,
          `row_${index}_invalid_payment_method_recorded`,
        ),
        payment_method_confirmed: boolean(
          source.payment_method_confirmed,
          boundary,
          `row_${index}_invalid_payment_method_confirmed`,
        ),
        payment_marked_sent: boolean(
          source.payment_marked_sent,
          boundary,
          `row_${index}_invalid_payment_marked_sent`,
        ),
        payment_received: boolean(
          source.payment_received,
          boundary,
          `row_${index}_invalid_payment_received`,
        ),
      };
    },
  );
}

export interface SellerShippingEvidenceReadinessPayload {
  item_photo_ready: boolean;
  packing_video_ready: boolean;
  package_weight_ready: boolean;
  serial_required: boolean;
  serial_photo_ready: boolean;
  distinct_files_ready: boolean;
  ready: boolean;
}

export function parseShippingEvidenceReadinessRows(
  value: unknown,
): SellerShippingEvidenceReadinessPayload[] {
  const boundary = 'shipping_evidence_readiness' as const;
  return array(value, boundary, 'rows_not_array', 1).map(
    (entry, index) => {
      const source = record(entry, boundary, `row_${index}_not_object`);
      return {
        item_photo_ready: boolean(
          source.item_photo_ready,
          boundary,
          `row_${index}_invalid_item_photo_ready`,
        ),
        packing_video_ready: boolean(
          source.packing_video_ready,
          boundary,
          `row_${index}_invalid_packing_video_ready`,
        ),
        package_weight_ready: boolean(
          source.package_weight_ready,
          boundary,
          `row_${index}_invalid_package_weight_ready`,
        ),
        serial_required: boolean(
          source.serial_required,
          boundary,
          `row_${index}_invalid_serial_required`,
        ),
        serial_photo_ready: boolean(
          source.serial_photo_ready,
          boundary,
          `row_${index}_invalid_serial_photo_ready`,
        ),
        distinct_files_ready: boolean(
          source.distinct_files_ready,
          boundary,
          `row_${index}_invalid_distinct_files_ready`,
        ),
        ready: boolean(
          source.ready,
          boundary,
          `row_${index}_invalid_ready`,
        ),
      };
    },
  );
}
