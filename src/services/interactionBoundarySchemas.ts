import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type InteractionRequestBoundary =
  | 'notification_list_request'
  | 'notification_deal_read_request'
  | 'notification_all_read_request'
  | 'message_list_request'
  | 'message_send_request'
  | 'offer_create_request'
  | 'offer_list_request'
  | 'offer_response_request'
  | 'inquiry_create_request'
  | 'inquiry_list_request'
  | 'inquiry_reply_request'
  | 'current_user_deal_seller_request'
  | 'safety_report_create_request'
  | 'admin_report_list_request'
  | 'admin_report_resolve_request'
  | 'deal_moderation_request';

export type InteractionErrorBoundary =
  | 'notification_list_error'
  | 'notification_read_error'
  | 'message_list_error'
  | 'message_send_error'
  | 'offer_create_error'
  | 'offer_list_error'
  | 'offer_response_error'
  | 'inquiry_create_error'
  | 'inquiry_list_error'
  | 'inquiry_reply_error'
  | 'current_user_deal_seller_error'
  | 'safety_report_create_error'
  | 'admin_report_list_error'
  | 'admin_report_resolve_error'
  | 'deal_moderation_error';

export type InteractionBoundary =
  | InteractionRequestBoundary
  | InteractionErrorBoundary;

export interface DealIdRequestPayload {
  p_deal_id: string;
}

export interface SendDealMessageRequestPayload extends DealIdRequestPayload {
  p_body: string;
}

export interface CreateOfferRequestPayload {
  p_public_id: string;
  p_amount_cents: number;
  p_typed_name: string;
}

export interface RespondOfferRequestPayload {
  p_offer_id: string;
  p_accept: boolean;
}

export interface CreateInquiryRequestPayload {
  p_public_id: string;
  p_body: string;
}

export interface ReplyInquiryRequestPayload {
  p_inquiry_id: string;
  p_reply: string;
}

export interface SafetyReportRequestPayload {
  p_public_id: string;
  p_category:
    | 'Suspected fraud'
    | 'Prohibited item'
    | 'Misleading information'
    | 'Duplicate or stolen photos'
    | 'Other';
  p_details: string;
}

export interface AdminReportListRequestPayload {
  p_status: 'open' | 'reviewed' | 'dismissed' | 'all';
}

export interface AdminReportResolutionRequestPayload {
  p_report_id: string;
  p_decision: 'reviewed' | 'dismissed';
  p_resolution_note: string;
}

export interface DealModerationRequestPayload {
  p_deal_id: string;
  p_status: 'visible' | 'hidden';
  p_note: string;
}

export interface InteractionErrorEnvelopePayload {
  message: string;
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const maximumAmountCents = 100_000_000_000;
const reportCategories = new Set<SafetyReportRequestPayload['p_category']>([
  'Suspected fraud',
  'Prohibited item',
  'Misleading information',
  'Duplicate or stolen photos',
  'Other',
]);

const safeMessages: Partial<Record<string, string>> = {
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  public_id_invalid: 'The selected Deal Link is invalid. Refresh and try again.',
  offer_id_invalid: 'The selected offer is invalid. Refresh and try again.',
  inquiry_id_invalid: 'The selected question is invalid. Refresh and try again.',
  report_id_invalid: 'The selected report is invalid. Refresh and try again.',
  message_invalid: 'Message must contain 1 to 1,000 characters.',
  question_invalid: 'Question must contain 5 to 1,000 characters.',
  reply_invalid: 'Reply must contain 2 to 1,000 characters.',
  offer_amount_invalid: 'Enter a valid offer amount.',
  typed_name_invalid: 'Enter your full name using 2 to 80 characters.',
  report_category_invalid: 'Choose a valid report category.',
  report_details_invalid: 'Report details must contain 10 to 1,000 characters.',
  resolution_note_invalid: 'Resolution note must contain 3 to 500 characters.',
  moderation_note_invalid: 'Moderation note must contain 3 to 500 characters.',
};

export class InteractionBoundaryValidationError extends Error {
  readonly boundary: InteractionBoundary;
  readonly issue: string;

  constructor(boundary: InteractionBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The communication request could not be processed safely. Please try again.',
    );
    this.name = 'InteractionBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: InteractionBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.interaction.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new InteractionBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: InteractionBoundary,
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
  boundary: InteractionBoundary,
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

function trimmedText(
  value: unknown,
  boundary: InteractionBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  const result = boundedString(value, boundary, issue, minimum, maximum).trim();
  if (result.length < minimum || result.length > maximum) {
    reject(boundary, issue);
  }
  return result;
}

function uuid(
  value: unknown,
  boundary: InteractionRequestBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function publicId(
  value: unknown,
  boundary: InteractionRequestBoundary,
): string {
  const result = boundedString(
    value,
    boundary,
    'public_id_invalid',
    6,
    32,
  ).trim().toUpperCase();
  if (!publicIdPattern.test(result)) reject(boundary, 'public_id_invalid');
  return result;
}

function dealIdRequest(
  value: unknown,
  boundary: Extract<
    InteractionRequestBoundary,
    | 'notification_deal_read_request'
    | 'message_list_request'
    | 'offer_list_request'
    | 'inquiry_list_request'
    | 'current_user_deal_seller_request'
  >,
): DealIdRequestPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id'],
  );
  return {
    p_deal_id: uuid(source.p_deal_id, boundary, 'deal_id_invalid'),
  };
}

export function parseNotificationListRequest(
  value: unknown,
): { p_limit: number } {
  const boundary = 'notification_list_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_limit'],
  );
  if (
    typeof source.p_limit !== 'number'
    || !Number.isSafeInteger(source.p_limit)
    || source.p_limit < 1
    || source.p_limit > 50
  ) {
    reject(boundary, 'limit_invalid');
  }
  return { p_limit: source.p_limit };
}

export function parseNotificationDealReadRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'notification_deal_read_request');
}

export function parseNotificationAllReadRequest(
  value: unknown,
): Record<string, never> {
  exactRecord(value, 'notification_all_read_request', 'request_shape_invalid', []);
  return {};
}

export function parseMessageListRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'message_list_request');
}

export function parseSendDealMessageRequest(
  value: unknown,
): SendDealMessageRequestPayload {
  const boundary = 'message_send_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_body'],
  );
  return {
    p_deal_id: uuid(source.p_deal_id, boundary, 'deal_id_invalid'),
    p_body: trimmedText(source.p_body, boundary, 'message_invalid', 1, 1_000),
  };
}

export function parseCreateOfferRequest(
  value: unknown,
): CreateOfferRequestPayload {
  const boundary = 'offer_create_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_amount_cents', 'p_typed_name'],
  );
  if (
    typeof source.p_amount_cents !== 'number'
    || !Number.isSafeInteger(source.p_amount_cents)
    || source.p_amount_cents < 100
    || source.p_amount_cents > maximumAmountCents
  ) {
    reject(boundary, 'offer_amount_invalid');
  }
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_amount_cents: source.p_amount_cents,
    p_typed_name: trimmedText(
      source.p_typed_name,
      boundary,
      'typed_name_invalid',
      2,
      80,
    ),
  };
}

export function parseOfferListRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'offer_list_request');
}

export function parseRespondOfferRequest(
  value: unknown,
): RespondOfferRequestPayload {
  const boundary = 'offer_response_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_offer_id', 'p_accept'],
  );
  if (typeof source.p_accept !== 'boolean') {
    reject(boundary, 'offer_decision_invalid');
  }
  return {
    p_offer_id: uuid(source.p_offer_id, boundary, 'offer_id_invalid'),
    p_accept: source.p_accept,
  };
}

export function parseCreateInquiryRequest(
  value: unknown,
): CreateInquiryRequestPayload {
  const boundary = 'inquiry_create_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_body'],
  );
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_body: trimmedText(source.p_body, boundary, 'question_invalid', 5, 1_000),
  };
}

export function parseInquiryListRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'inquiry_list_request');
}

export function parseReplyInquiryRequest(
  value: unknown,
): ReplyInquiryRequestPayload {
  const boundary = 'inquiry_reply_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_inquiry_id', 'p_reply'],
  );
  return {
    p_inquiry_id: uuid(source.p_inquiry_id, boundary, 'inquiry_id_invalid'),
    p_reply: trimmedText(source.p_reply, boundary, 'reply_invalid', 2, 1_000),
  };
}

export function parseCurrentUserDealSellerRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealIdRequest(value, 'current_user_deal_seller_request');
}

export function parseSafetyReportRequest(
  value: unknown,
): SafetyReportRequestPayload {
  const boundary = 'safety_report_create_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_category', 'p_details'],
  );
  if (
    typeof source.p_category !== 'string'
    || !reportCategories.has(
      source.p_category as SafetyReportRequestPayload['p_category'],
    )
  ) {
    reject(boundary, 'report_category_invalid');
  }
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_category: source.p_category as SafetyReportRequestPayload['p_category'],
    p_details: trimmedText(
      source.p_details,
      boundary,
      'report_details_invalid',
      10,
      1_000,
    ),
  };
}

export function parseAdminReportListRequest(
  value: unknown,
): AdminReportListRequestPayload {
  const boundary = 'admin_report_list_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_status'],
  );
  if (
    source.p_status !== 'open'
    && source.p_status !== 'reviewed'
    && source.p_status !== 'dismissed'
    && source.p_status !== 'all'
  ) {
    reject(boundary, 'report_status_invalid');
  }
  return { p_status: source.p_status };
}

export function parseAdminReportResolutionRequest(
  value: unknown,
): AdminReportResolutionRequestPayload {
  const boundary = 'admin_report_resolve_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_report_id', 'p_decision', 'p_resolution_note'],
  );
  if (
    source.p_decision !== 'reviewed'
    && source.p_decision !== 'dismissed'
  ) {
    reject(boundary, 'report_decision_invalid');
  }
  return {
    p_report_id: uuid(source.p_report_id, boundary, 'report_id_invalid'),
    p_decision: source.p_decision,
    p_resolution_note: trimmedText(
      source.p_resolution_note,
      boundary,
      'resolution_note_invalid',
      3,
      500,
    ),
  };
}

export function parseDealModerationRequest(
  value: unknown,
): DealModerationRequestPayload {
  const boundary = 'deal_moderation_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_status', 'p_note'],
  );
  if (source.p_status !== 'visible' && source.p_status !== 'hidden') {
    reject(boundary, 'moderation_status_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary, 'deal_id_invalid'),
    p_status: source.p_status,
    p_note: trimmedText(
      source.p_note,
      boundary,
      'moderation_note_invalid',
      3,
      500,
    ),
  };
}

export function parseInteractionPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: InteractionErrorBoundary,
): InteractionErrorEnvelopePayload {
  if (
    !Number.isSafeInteger(status)
    || status < 400
    || status > 599
  ) {
    reject(boundary, 'status_invalid');
  }
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    ['message'],
    ['code', 'details', 'hint'],
  );
  const message = trimmedText(
    source.message,
    boundary,
    'error_message_invalid',
    1,
    512,
  );
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
  return { message, code };
}
