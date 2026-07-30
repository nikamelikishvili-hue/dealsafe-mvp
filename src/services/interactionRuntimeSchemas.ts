import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type InteractionResponseBoundary =
  | 'notification_list'
  | 'message_list'
  | 'offer_list'
  | 'inquiry_list'
  | 'inquiry_created'
  | 'current_user_deal_seller'
  | 'safety_report_created'
  | 'admin_report_list';

export interface DealNotificationPayload {
  id: string;
  deal_id: string;
  public_id: string;
  title: string;
  event_type: string;
  created_at: string;
  is_mine: boolean;
  is_read: boolean;
}

export interface DealMessagePayload {
  id: number;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
}

export interface DealOfferPayload {
  id: string;
  amount_cents: number;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  buyer_name: string;
  created_at: string;
  is_mine: boolean;
}

export interface DealInquiryPayload {
  id: string;
  buyer_name: string;
  body: string;
  seller_reply: string | null;
  created_at: string;
  replied_at: string | null;
  is_mine: boolean;
}

export interface AdminReportPayload {
  report_id: string;
  deal_id: string;
  public_id: string;
  title: string;
  reason: string;
  report_status: 'open' | 'reviewed' | 'dismissed';
  moderation_status: 'visible' | 'hidden';
  created_at: string;
  reporter_name: string;
  seller_name: string;
  resolution_note: string | null;
}

export class InteractionResponseValidationError extends Error {
  readonly boundary: InteractionResponseBoundary;
  readonly issue: string;

  constructor(boundary: InteractionResponseBoundary, issue: string) {
    super('The communication service returned an invalid response. Please try again later.');
    this.name = 'InteractionResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const eventTypePattern = /^[a-z][a-z0-9_]{0,79}$/;
const notificationIdPattern =
  /^(?:[1-9][0-9]{0,18}|inquiry-reply-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const maximumAmountCents = 100_000_000_000;
const maximumClockSkewMs = 5 * 60_000;

function reject(
  boundary: InteractionResponseBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.interaction.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new InteractionResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function rows(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
  maximum: number,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    reject(boundary, issue);
  }
  return value;
}

function boundedString(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function boundedText(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || value !== value.trim()
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function nullableText(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string | null {
  if (value === null) return null;
  return boundedText(value, boundary, issue, minimum, maximum);
}

function boolean(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function integer(
  value: unknown,
  boundary: InteractionResponseBoundary,
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

function uuid(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function publicId(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 6, 32);
  if (!publicIdPattern.test(result)) reject(boundary, issue);
  return result;
}

function timestamp(
  value: unknown,
  boundary: InteractionResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 20, 40);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || parsed > Date.now() + maximumClockSkewMs) {
    reject(boundary, issue);
  }
  return result;
}

function enumeration<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  boundary: InteractionResponseBoundary,
  issue: string,
): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    reject(boundary, issue);
  }
  return value as T;
}

function assertUnique(
  identifiers: string[],
  boundary: InteractionResponseBoundary,
  issue: string,
) {
  if (new Set(identifiers).size !== identifiers.length) {
    reject(boundary, issue);
  }
}

function assertTimestampOrder(
  values: string[],
  direction: 'ascending' | 'descending',
  boundary: InteractionResponseBoundary,
  issue: string,
) {
  for (let index = 1; index < values.length; index += 1) {
    const previous = Date.parse(values[index - 1]);
    const current = Date.parse(values[index]);
    const invalid = direction === 'ascending'
      ? current < previous
      : current > previous;
    if (invalid) reject(boundary, issue);
  }
}

function parseNotification(
  value: unknown,
  boundary: InteractionResponseBoundary,
): DealNotificationPayload {
  const source = record(value, boundary, 'notification_row_invalid');
  const id = boundedString(source.id, boundary, 'notification_id_invalid', 1, 80);
  if (!notificationIdPattern.test(id)) {
    reject(boundary, 'notification_id_invalid');
  }
  const eventType = boundedString(
    source.event_type,
    boundary,
    'notification_event_type_invalid',
    1,
    80,
  );
  if (!eventTypePattern.test(eventType)) {
    reject(boundary, 'notification_event_type_invalid');
  }
  const isMine = boolean(
    source.is_mine,
    boundary,
    'notification_is_mine_invalid',
  );
  const isRead = boolean(
    source.is_read,
    boundary,
    'notification_is_read_invalid',
  );
  if (isMine && !isRead) {
    reject(boundary, 'notification_read_state_invalid');
  }
  return {
    id,
    deal_id: uuid(source.deal_id, boundary, 'notification_deal_id_invalid'),
    public_id: publicId(
      source.public_id,
      boundary,
      'notification_public_id_invalid',
    ),
    title: boundedString(
      source.title,
      boundary,
      'notification_title_invalid',
      1,
      200,
    ),
    event_type: eventType,
    created_at: timestamp(
      source.created_at,
      boundary,
      'notification_timestamp_invalid',
    ),
    is_mine: isMine,
    is_read: isRead,
  };
}

export function parseDealNotificationRows(
  value: unknown,
): DealNotificationPayload[] {
  const boundary: InteractionResponseBoundary = 'notification_list';
  const result = rows(
    value,
    boundary,
    'notification_collection_invalid',
    50,
  ).map(row => parseNotification(row, boundary));
  assertUnique(
    result.map(row => row.id),
    boundary,
    'notification_id_duplicate',
  );
  assertTimestampOrder(
    result.map(row => row.created_at),
    'descending',
    boundary,
    'notification_order_invalid',
  );
  return result;
}

function parseMessage(
  value: unknown,
  boundary: InteractionResponseBoundary,
): DealMessagePayload {
  const source = record(value, boundary, 'message_row_invalid');
  return {
    id: integer(
      source.id,
      boundary,
      'message_id_invalid',
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    sender_id: uuid(source.sender_id, boundary, 'message_sender_id_invalid'),
    sender_name: boundedString(
      source.sender_name,
      boundary,
      'message_sender_name_invalid',
      1,
      120,
    ),
    body: boundedText(
      source.body,
      boundary,
      'message_body_invalid',
      1,
      1_000,
    ),
    created_at: timestamp(
      source.created_at,
      boundary,
      'message_timestamp_invalid',
    ),
    is_mine: boolean(source.is_mine, boundary, 'message_is_mine_invalid'),
  };
}

export function parseDealMessageRows(value: unknown): DealMessagePayload[] {
  const boundary: InteractionResponseBoundary = 'message_list';
  const result = rows(
    value,
    boundary,
    'message_collection_invalid',
    200,
  ).map(row => parseMessage(row, boundary));
  assertUnique(
    result.map(row => String(row.id)),
    boundary,
    'message_id_duplicate',
  );
  assertTimestampOrder(
    result.map(row => row.created_at),
    'ascending',
    boundary,
    'message_order_invalid',
  );
  return result;
}

const offerStatuses = new Set<DealOfferPayload['status']>([
  'pending',
  'accepted',
  'declined',
  'withdrawn',
]);

function parseOffer(
  value: unknown,
  boundary: InteractionResponseBoundary,
): DealOfferPayload {
  const source = record(value, boundary, 'offer_row_invalid');
  return {
    id: uuid(source.id, boundary, 'offer_id_invalid'),
    amount_cents: integer(
      source.amount_cents,
      boundary,
      'offer_amount_invalid',
      100,
      maximumAmountCents,
    ),
    status: enumeration(
      source.status,
      offerStatuses,
      boundary,
      'offer_status_invalid',
    ),
    buyer_name: boundedString(
      source.buyer_name,
      boundary,
      'offer_buyer_name_invalid',
      1,
      120,
    ),
    created_at: timestamp(
      source.created_at,
      boundary,
      'offer_timestamp_invalid',
    ),
    is_mine: boolean(source.is_mine, boundary, 'offer_is_mine_invalid'),
  };
}

export function parseDealOfferRows(value: unknown): DealOfferPayload[] {
  const boundary: InteractionResponseBoundary = 'offer_list';
  const result = rows(
    value,
    boundary,
    'offer_collection_invalid',
    500,
  ).map(row => parseOffer(row, boundary));
  assertUnique(
    result.map(row => row.id),
    boundary,
    'offer_id_duplicate',
  );
  assertTimestampOrder(
    result.map(row => row.created_at),
    'descending',
    boundary,
    'offer_order_invalid',
  );
  return result;
}

function parseInquiry(
  value: unknown,
  boundary: InteractionResponseBoundary,
): DealInquiryPayload {
  const source = record(value, boundary, 'inquiry_row_invalid');
  const createdAt = timestamp(
    source.created_at,
    boundary,
    'inquiry_created_at_invalid',
  );
  const sellerReply = nullableText(
    source.seller_reply,
    boundary,
    'inquiry_reply_invalid',
    2,
    1_000,
  );
  const repliedAt = source.replied_at === null
    ? null
    : timestamp(source.replied_at, boundary, 'inquiry_replied_at_invalid');
  if ((sellerReply === null) !== (repliedAt === null)) {
    reject(boundary, 'inquiry_reply_state_invalid');
  }
  if (
    repliedAt !== null
    && Date.parse(repliedAt) < Date.parse(createdAt)
  ) {
    reject(boundary, 'inquiry_reply_order_invalid');
  }
  return {
    id: uuid(source.id, boundary, 'inquiry_id_invalid'),
    buyer_name: boundedString(
      source.buyer_name,
      boundary,
      'inquiry_buyer_name_invalid',
      1,
      120,
    ),
    body: boundedText(
      source.body,
      boundary,
      'inquiry_body_invalid',
      5,
      1_000,
    ),
    seller_reply: sellerReply,
    created_at: createdAt,
    replied_at: repliedAt,
    is_mine: boolean(source.is_mine, boundary, 'inquiry_is_mine_invalid'),
  };
}

export function parseDealInquiryRows(value: unknown): DealInquiryPayload[] {
  const boundary: InteractionResponseBoundary = 'inquiry_list';
  const result = rows(
    value,
    boundary,
    'inquiry_collection_invalid',
    100,
  ).map(row => parseInquiry(row, boundary));
  assertUnique(
    result.map(row => row.id),
    boundary,
    'inquiry_id_duplicate',
  );
  assertTimestampOrder(
    result.map(row => row.created_at),
    'descending',
    boundary,
    'inquiry_order_invalid',
  );
  return result;
}

export function parseInquiryIdResponse(value: unknown): string {
  return uuid(value, 'inquiry_created', 'inquiry_id_invalid');
}

export function parseCurrentUserDealSellerResponse(value: unknown): boolean {
  return boolean(
    value,
    'current_user_deal_seller',
    'seller_flag_invalid',
  );
}

export function parseSafetyReportIdResponse(value: unknown): string {
  return uuid(value, 'safety_report_created', 'report_id_invalid');
}

const reportStatuses = new Set<AdminReportPayload['report_status']>([
  'open',
  'reviewed',
  'dismissed',
]);
const moderationStatuses = new Set<AdminReportPayload['moderation_status']>([
  'visible',
  'hidden',
]);

function parseAdminReport(
  value: unknown,
  boundary: InteractionResponseBoundary,
): AdminReportPayload {
  const source = record(value, boundary, 'report_row_invalid');
  const reportStatus = enumeration(
    source.report_status,
    reportStatuses,
    boundary,
    'report_status_invalid',
  );
  const resolutionNote = nullableText(
    source.resolution_note,
    boundary,
    'report_resolution_note_invalid',
    3,
    500,
  );
  if (
    (reportStatus === 'open' && resolutionNote !== null)
    || (reportStatus !== 'open' && resolutionNote === null)
  ) {
    reject(boundary, 'report_resolution_state_invalid');
  }
  return {
    report_id: uuid(source.report_id, boundary, 'report_id_invalid'),
    deal_id: uuid(source.deal_id, boundary, 'report_deal_id_invalid'),
    public_id: publicId(
      source.public_id,
      boundary,
      'report_public_id_invalid',
    ),
    title: boundedString(
      source.title,
      boundary,
      'report_title_invalid',
      1,
      200,
    ),
    reason: boundedText(
      source.reason,
      boundary,
      'report_reason_invalid',
      3,
      1_200,
    ),
    report_status: reportStatus,
    moderation_status: enumeration(
      source.moderation_status,
      moderationStatuses,
      boundary,
      'report_moderation_status_invalid',
    ),
    created_at: timestamp(
      source.created_at,
      boundary,
      'report_timestamp_invalid',
    ),
    reporter_name: boundedString(
      source.reporter_name,
      boundary,
      'report_reporter_name_invalid',
      1,
      120,
    ),
    seller_name: boundedString(
      source.seller_name,
      boundary,
      'report_seller_name_invalid',
      1,
      120,
    ),
    resolution_note: resolutionNote,
  };
}

export function parseAdminReportRows(value: unknown): AdminReportPayload[] {
  const boundary: InteractionResponseBoundary = 'admin_report_list';
  const result = rows(
    value,
    boundary,
    'report_collection_invalid',
    200,
  ).map(row => parseAdminReport(row, boundary));
  assertUnique(
    result.map(row => row.report_id),
    boundary,
    'report_id_duplicate',
  );

  let nonOpenSeen = false;
  let previousOpenTimestamp = Number.POSITIVE_INFINITY;
  let previousClosedTimestamp = Number.POSITIVE_INFINITY;
  for (const report of result) {
    const createdAt = Date.parse(report.created_at);
    if (report.report_status === 'open') {
      if (nonOpenSeen || createdAt > previousOpenTimestamp) {
        reject(boundary, 'report_order_invalid');
      }
      previousOpenTimestamp = createdAt;
    } else {
      nonOpenSeen = true;
      if (createdAt > previousClosedTimestamp) {
        reject(boundary, 'report_order_invalid');
      }
      previousClosedTimestamp = createdAt;
    }
  }
  return result;
}
