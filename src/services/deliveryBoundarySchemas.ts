import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type DeliveryRequestBoundary =
  | 'deal_meeting_read_request'
  | 'meeting_proposal_request'
  | 'meeting_confirmation_request'
  | 'meeting_arrival_request'
  | 'handoff_pin_generate_request'
  | 'handoff_complete_request'
  | 'deal_inspection_read_request'
  | 'deal_inspection_record_request'
  | 'deal_shipment_read_request'
  | 'shipping_evidence_readiness_request'
  | 'delivery_details_read_request'
  | 'delivery_details_save_request'
  | 'deal_action_plan_request'
  | 'shipment_create_request'
  | 'shipment_delivery_confirmation_request';

export type DeliveryErrorBoundary =
  | 'deal_meeting_read_error'
  | 'meeting_proposal_error'
  | 'meeting_confirmation_error'
  | 'meeting_arrival_error'
  | 'handoff_pin_generate_error'
  | 'handoff_complete_error'
  | 'deal_inspection_read_error'
  | 'deal_inspection_record_error'
  | 'deal_shipment_read_error'
  | 'shipping_evidence_readiness_error'
  | 'delivery_details_read_error'
  | 'delivery_details_save_error'
  | 'deal_action_plan_error'
  | 'shipment_create_error'
  | 'shipment_delivery_confirmation_error';

export type DeliveryBoundary =
  | DeliveryRequestBoundary
  | DeliveryErrorBoundary;

export interface DealIdRequestPayload {
  p_deal_id: string;
}

export interface MeetingProposalRequestPayload extends DealIdRequestPayload {
  p_location_name: string;
  p_address: string;
  p_scheduled_at: string;
}

export interface HandoffCompleteRequestPayload extends DealIdRequestPayload {
  p_pin: string;
}

export interface InspectionRecordRequestPayload extends DealIdRequestPayload {
  p_item_reviewed: true;
  p_price_confirmed: true;
  p_handoff_confirmed: true;
  p_reference_checked: true;
}

export interface DeliveryDetailsSaveRequestPayload extends DealIdRequestPayload {
  p_recipient_name: string;
  p_full_address: string;
  p_country: string;
  p_instructions: string | null;
}

export interface ShipmentCreateRequestPayload extends DealIdRequestPayload {
  p_carrier: string;
  p_tracking_number: string;
}

export interface DeliveryErrorEnvelopePayload {
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const trackingPattern = /^[A-Z0-9][A-Z0-9 ./_-]{2,98}[A-Z0-9]$/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const maximumMeetingLeadMs = 366 * 24 * 60 * 60 * 1_000;

const safeMessages: Partial<Record<string, string>> = {
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  location_name_invalid: 'Enter a meeting place containing 2 to 120 characters.',
  address_invalid: 'Enter a complete address containing 10 to 500 characters.',
  scheduled_at_invalid: 'Choose a valid meeting time within the next year.',
  handoff_pin_invalid: 'Enter the six-digit handoff PIN.',
  recipient_name_invalid: 'Enter the recipient name using 2 to 100 characters.',
  country_invalid: 'Enter a country using 2 to 80 characters.',
  instructions_invalid: 'Delivery instructions cannot exceed 500 characters.',
  carrier_invalid: 'Enter a carrier name using 2 to 80 characters.',
  tracking_number_invalid: 'Enter a valid tracking number using 4 to 100 characters.',
};

export class DeliveryBoundaryValidationError extends Error {
  readonly boundary: DeliveryBoundary;
  readonly issue: string;

  constructor(boundary: DeliveryBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The delivery request could not be processed safely. Please try again.',
    );
    this.name = 'DeliveryBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: DeliveryBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.delivery.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new DeliveryBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: DeliveryBoundary,
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
    required.some(key => !Object.hasOwn(source, key))
    || Object.keys(source).some(key => !allowed.has(key))
  ) {
    reject(boundary, issue);
  }
  return source;
}

function boundedString(
  value: unknown,
  boundary: DeliveryBoundary,
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
  boundary: DeliveryBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  const result = boundedString(
    value,
    boundary,
    issue,
    minimum,
    maximum + 8,
  ).trim();
  if (result.length < minimum || result.length > maximum) {
    reject(boundary, issue);
  }
  return result;
}

function uuid(
  value: unknown,
  boundary: DeliveryBoundary,
  issue = 'deal_id_invalid',
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function dealIdRequest(
  value: unknown,
  boundary: DeliveryRequestBoundary,
): DealIdRequestPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id'],
  );
  return { p_deal_id: uuid(source.p_deal_id, boundary) };
}

export function parseDealMeetingReadRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'deal_meeting_read_request');
}

export function parseMeetingProposalRequest(
  value: unknown,
  nowMs = Date.now(),
): MeetingProposalRequestPayload {
  const boundary = 'meeting_proposal_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_location_name', 'p_address', 'p_scheduled_at'],
  );
  const scheduledAt = boundedString(
    source.p_scheduled_at,
    boundary,
    'scheduled_at_invalid',
    20,
    40,
  );
  const scheduledAtMs = Date.parse(scheduledAt);
  if (
    !Number.isFinite(nowMs)
    || !Number.isFinite(scheduledAtMs)
    || scheduledAtMs <= nowMs
    || scheduledAtMs > nowMs + maximumMeetingLeadMs
  ) {
    reject(boundary, 'scheduled_at_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_location_name: trimmedString(
      source.p_location_name,
      boundary,
      'location_name_invalid',
      2,
      120,
    ),
    p_address: trimmedString(
      source.p_address,
      boundary,
      'address_invalid',
      10,
      500,
    ),
    p_scheduled_at: new Date(scheduledAtMs).toISOString(),
  };
}

export function parseMeetingConfirmationRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'meeting_confirmation_request');
}

export function parseMeetingArrivalRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'meeting_arrival_request');
}

export function parseHandoffPinGenerateRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'handoff_pin_generate_request');
}

export function parseHandoffCompleteRequest(
  value: unknown,
): HandoffCompleteRequestPayload {
  const boundary = 'handoff_complete_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_pin'],
  );
  const pin = boundedString(
    source.p_pin,
    boundary,
    'handoff_pin_invalid',
    6,
    6,
  );
  if (!/^\d{6}$/.test(pin)) reject(boundary, 'handoff_pin_invalid');
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_pin: pin,
  };
}

export function parseDealInspectionReadRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'deal_inspection_read_request');
}

export function parseDealInspectionRecordRequest(
  value: unknown,
): InspectionRecordRequestPayload {
  const boundary = 'deal_inspection_record_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [
      'p_deal_id',
      'p_item_reviewed',
      'p_price_confirmed',
      'p_handoff_confirmed',
      'p_reference_checked',
    ],
  );
  for (const key of [
    'p_item_reviewed',
    'p_price_confirmed',
    'p_handoff_confirmed',
    'p_reference_checked',
  ] as const) {
    if (source[key] !== true) reject(boundary, 'inspection_confirmation_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_item_reviewed: true,
    p_price_confirmed: true,
    p_handoff_confirmed: true,
    p_reference_checked: true,
  };
}

export function parseDealShipmentReadRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'deal_shipment_read_request');
}

export function parseShippingEvidenceReadinessRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'shipping_evidence_readiness_request');
}

export function parseDeliveryDetailsReadRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'delivery_details_read_request');
}

export function parseDeliveryDetailsSaveRequest(
  value: unknown,
): DeliveryDetailsSaveRequestPayload {
  const boundary = 'delivery_details_save_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [
      'p_deal_id',
      'p_recipient_name',
      'p_full_address',
      'p_country',
      'p_instructions',
    ],
  );
  const rawInstructions = source.p_instructions;
  let instructions: string | null = null;
  if (rawInstructions !== null) {
    instructions = trimmedString(
      rawInstructions,
      boundary,
      'instructions_invalid',
      1,
      500,
    );
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_recipient_name: trimmedString(
      source.p_recipient_name,
      boundary,
      'recipient_name_invalid',
      2,
      100,
    ),
    p_full_address: trimmedString(
      source.p_full_address,
      boundary,
      'address_invalid',
      10,
      500,
    ),
    p_country: trimmedString(
      source.p_country,
      boundary,
      'country_invalid',
      2,
      80,
    ),
    p_instructions: instructions,
  };
}

export function parseDealActionPlanRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'deal_action_plan_request');
}

export function parseShipmentCreateRequest(
  value: unknown,
): ShipmentCreateRequestPayload {
  const boundary = 'shipment_create_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_carrier', 'p_tracking_number'],
  );
  const trackingNumber = trimmedString(
    source.p_tracking_number,
    boundary,
    'tracking_number_invalid',
    4,
    100,
  ).toUpperCase();
  if (!trackingPattern.test(trackingNumber)) {
    reject(boundary, 'tracking_number_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_carrier: trimmedString(
      source.p_carrier,
      boundary,
      'carrier_invalid',
      2,
      80,
    ),
    p_tracking_number: trackingNumber,
  };
}

export function parseShipmentDeliveryConfirmationRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'shipment_delivery_confirmation_request');
}

export function parseDeliveryPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: DeliveryErrorBoundary,
): DeliveryErrorEnvelopePayload {
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
