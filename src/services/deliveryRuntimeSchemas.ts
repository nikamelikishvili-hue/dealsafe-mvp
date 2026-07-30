import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type DeliveryResponseBoundary =
  | 'deal_meeting'
  | 'handoff_pin'
  | 'deal_inspection'
  | 'deal_shipment'
  | 'delivery_details';

export interface DealMeetingPayload {
  id: string;
  deal_id: string;
  proposed_by: string;
  location_name: string;
  address: string;
  scheduled_at: string;
  status: 'proposed' | 'confirmed' | 'cancelled';
  seller_arrived: boolean;
  buyer_arrived: boolean;
}

export interface DealInspectionPayload {
  agreement_version: number;
  item_reviewed: boolean;
  price_confirmed: boolean;
  handoff_confirmed: boolean;
  reference_checked: boolean;
  inspected_at: string;
  buyer_name: string;
}

export interface DealShipmentPayload {
  id: string;
  deal_id: string;
  carrier: string;
  tracking_number: string;
  status: 'shipped' | 'delivered';
  shipped_at: string;
  delivered_at: string | null;
}

export interface DealDeliveryDetailsPayload {
  recipient_name: string;
  full_address: string;
  country: string;
  instructions: string | null;
  updated_at: string;
  locked: boolean;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const maximumClockSkewMs = 5 * 60_000;

export class DeliveryResponseValidationError extends Error {
  readonly boundary: DeliveryResponseBoundary;
  readonly issue: string;

  constructor(boundary: DeliveryResponseBoundary, issue: string) {
    super('The delivery service returned an invalid response. Please try again later.');
    this.name = 'DeliveryResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: DeliveryResponseBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.delivery.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new DeliveryResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: DeliveryResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function exactRecord(
  value: unknown,
  boundary: DeliveryResponseBoundary,
  issue: string,
  keys: readonly string[],
): JsonRecord {
  const source = record(value, boundary, issue);
  if (
    keys.some(key => !Object.prototype.hasOwnProperty.call(source, key))
    || Object.keys(source).some(key => !keys.includes(key))
  ) {
    reject(boundary, issue);
  }
  return source;
}

function rows(
  value: unknown,
  boundary: DeliveryResponseBoundary,
): unknown[] {
  if (!Array.isArray(value) || value.length > 1) {
    reject(boundary, 'rows_invalid');
  }
  return value;
}

function boundedString(
  value: unknown,
  boundary: DeliveryResponseBoundary,
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

function uuid(
  value: unknown,
  boundary: DeliveryResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function timestamp(
  value: unknown,
  boundary: DeliveryResponseBoundary,
  issue: string,
  maximumFutureMs = maximumClockSkewMs,
): string {
  const result = boundedString(value, boundary, issue, 20, 40);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || parsed > Date.now() + maximumFutureMs) {
    reject(boundary, issue);
  }
  return new Date(parsed).toISOString();
}

function optionalTimestamp(
  value: unknown,
  boundary: DeliveryResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  return timestamp(value, boundary, issue);
}

function boolean(
  value: unknown,
  boundary: DeliveryResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function integer(
  value: unknown,
  boundary: DeliveryResponseBoundary,
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

export function parseDealMeetingRows(value: unknown): DealMeetingPayload[] {
  const boundary = 'deal_meeting';
  return rows(value, boundary).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'id',
      'deal_id',
      'proposed_by',
      'location_name',
      'address',
      'scheduled_at',
      'status',
      'seller_arrived',
      'buyer_arrived',
    ]);
    const status = boundedString(
      source.status,
      boundary,
      'status_invalid',
      8,
      9,
    );
    if (!['proposed', 'confirmed', 'cancelled'].includes(status)) {
      reject(boundary, 'status_invalid');
    }
    return {
      id: uuid(source.id, boundary, 'id_invalid'),
      deal_id: uuid(source.deal_id, boundary, 'deal_id_invalid'),
      proposed_by: uuid(source.proposed_by, boundary, 'proposed_by_invalid'),
      location_name: boundedString(
        source.location_name,
        boundary,
        'location_name_invalid',
        2,
        120,
      ),
      address: boundedString(
        source.address,
        boundary,
        'address_invalid',
        10,
        500,
      ),
      scheduled_at: timestamp(
        source.scheduled_at,
        boundary,
        'scheduled_at_invalid',
        366 * 24 * 60 * 60 * 1_000,
      ),
      status: status as DealMeetingPayload['status'],
      seller_arrived: boolean(
        source.seller_arrived,
        boundary,
        'seller_arrived_invalid',
      ),
      buyer_arrived: boolean(
        source.buyer_arrived,
        boundary,
        'buyer_arrived_invalid',
      ),
    };
  });
}

export function parseHandoffPinResponse(value: unknown): string {
  const boundary = 'handoff_pin';
  const pin = boundedString(value, boundary, 'pin_invalid', 6, 6);
  if (!/^\d{6}$/.test(pin)) reject(boundary, 'pin_invalid');
  return pin;
}

export function parseDealInspectionRows(value: unknown): DealInspectionPayload[] {
  const boundary = 'deal_inspection';
  return rows(value, boundary).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'agreement_version',
      'item_reviewed',
      'price_confirmed',
      'handoff_confirmed',
      'reference_checked',
      'inspected_at',
      'buyer_name',
    ]);
    return {
      agreement_version: integer(
        source.agreement_version,
        boundary,
        'agreement_version_invalid',
        1,
        1_000_000,
      ),
      item_reviewed: boolean(
        source.item_reviewed,
        boundary,
        'item_reviewed_invalid',
      ),
      price_confirmed: boolean(
        source.price_confirmed,
        boundary,
        'price_confirmed_invalid',
      ),
      handoff_confirmed: boolean(
        source.handoff_confirmed,
        boundary,
        'handoff_confirmed_invalid',
      ),
      reference_checked: boolean(
        source.reference_checked,
        boundary,
        'reference_checked_invalid',
      ),
      inspected_at: timestamp(
        source.inspected_at,
        boundary,
        'inspected_at_invalid',
      ),
      buyer_name: boundedString(
        source.buyer_name,
        boundary,
        'buyer_name_invalid',
        1,
        100,
      ),
    };
  });
}

export function parseDealShipmentRows(value: unknown): DealShipmentPayload[] {
  const boundary = 'deal_shipment';
  return rows(value, boundary).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'id',
      'deal_id',
      'carrier',
      'tracking_number',
      'status',
      'shipped_at',
      'delivered_at',
    ]);
    const status = boundedString(
      source.status,
      boundary,
      'status_invalid',
      7,
      9,
    );
    if (!['shipped', 'delivered'].includes(status)) {
      reject(boundary, 'status_invalid');
    }
    const shippedAt = timestamp(
      source.shipped_at,
      boundary,
      'shipped_at_invalid',
    );
    const deliveredAt = optionalTimestamp(
      source.delivered_at,
      boundary,
      'delivered_at_invalid',
    );
    if (
      (status === 'shipped' && deliveredAt !== null)
      || (status === 'delivered' && deliveredAt === null)
      || (
        deliveredAt !== null
        && Date.parse(deliveredAt) < Date.parse(shippedAt)
      )
    ) {
      reject(boundary, 'delivery_state_invalid');
    }
    return {
      id: uuid(source.id, boundary, 'id_invalid'),
      deal_id: uuid(source.deal_id, boundary, 'deal_id_invalid'),
      carrier: boundedString(
        source.carrier,
        boundary,
        'carrier_invalid',
        2,
        80,
      ),
      tracking_number: boundedString(
        source.tracking_number,
        boundary,
        'tracking_number_invalid',
        4,
        100,
      ),
      status: status as DealShipmentPayload['status'],
      shipped_at: shippedAt,
      delivered_at: deliveredAt,
    };
  });
}

export function parseDealDeliveryDetailsRows(
  value: unknown,
): DealDeliveryDetailsPayload[] {
  const boundary = 'delivery_details';
  return rows(value, boundary).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'recipient_name',
      'full_address',
      'country',
      'instructions',
      'updated_at',
      'locked',
    ]);
    let instructions: string | null = null;
    if (source.instructions !== null) {
      instructions = boundedString(
        source.instructions,
        boundary,
        'instructions_invalid',
        1,
        500,
      );
    }
    return {
      recipient_name: boundedString(
        source.recipient_name,
        boundary,
        'recipient_name_invalid',
        2,
        100,
      ),
      full_address: boundedString(
        source.full_address,
        boundary,
        'full_address_invalid',
        10,
        500,
      ),
      country: boundedString(
        source.country,
        boundary,
        'country_invalid',
        2,
        80,
      ),
      instructions,
      updated_at: timestamp(
        source.updated_at,
        boundary,
        'updated_at_invalid',
      ),
      locked: boolean(source.locked, boundary, 'locked_invalid'),
    };
  });
}
