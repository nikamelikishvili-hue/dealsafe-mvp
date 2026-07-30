import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AccountActivityRequestBoundary =
  | 'profile_summary_request'
  | 'account_sessions_request'
  | 'identity_verification_request'
  | 'rating_submit_request'
  | 'deal_timeline_request'
  | 'deal_participants_request';

export type AccountActivityErrorBoundary =
  | 'profile_summary_error'
  | 'account_sessions_error'
  | 'identity_verification_error'
  | 'rating_submit_error'
  | 'deal_timeline_error'
  | 'deal_participants_error';

export type AccountActivityBoundary =
  | AccountActivityRequestBoundary
  | AccountActivityErrorBoundary;

export interface DealIdRequestPayload {
  p_deal_id: string;
}

export interface RatingSubmitRequestPayload extends DealIdRequestPayload {
  p_stars: number;
  p_comment: string;
}

export interface AccountActivityErrorEnvelopePayload {
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const safeMessages: Partial<Record<string, string>> = {
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  rating_invalid: 'Choose a rating from 1 to 5 stars.',
  rating_comment_invalid: 'Rating comments cannot exceed 1,000 characters.',
};

export class AccountActivityBoundaryValidationError extends Error {
  readonly boundary: AccountActivityBoundary;
  readonly issue: string;

  constructor(boundary: AccountActivityBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The account request could not be processed safely. Please try again.',
    );
    this.name = 'AccountActivityBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: AccountActivityBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.account-activity.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AccountActivityBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: AccountActivityBoundary,
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
  boundary: AccountActivityBoundary,
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
  boundary: AccountActivityBoundary,
): string {
  const result = boundedString(value, boundary, 'deal_id_invalid', 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, 'deal_id_invalid');
  return result.toLowerCase();
}

function emptyRequest(
  value: unknown,
  boundary: AccountActivityRequestBoundary,
): Record<string, never> {
  exactRecord(value, boundary, 'request_shape_invalid', []);
  return {};
}

function dealRequest(
  value: unknown,
  boundary: Extract<
    AccountActivityRequestBoundary,
    'deal_timeline_request' | 'deal_participants_request'
  >,
): DealIdRequestPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id'],
  );
  return { p_deal_id: uuid(source.p_deal_id, boundary) };
}

export function parseProfileSummaryRequest(
  value: unknown,
): Record<string, never> {
  return emptyRequest(value, 'profile_summary_request');
}

export function parseAccountSessionsRequest(
  value: unknown,
): Record<string, never> {
  return emptyRequest(value, 'account_sessions_request');
}

export function parseIdentityVerificationRequest(
  value: unknown,
): Record<string, never> {
  return emptyRequest(value, 'identity_verification_request');
}

export function parseRatingSubmitRequest(
  value: unknown,
): RatingSubmitRequestPayload {
  const boundary = 'rating_submit_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_stars', 'p_comment'],
  );
  if (
    typeof source.p_stars !== 'number'
    || !Number.isSafeInteger(source.p_stars)
    || source.p_stars < 1
    || source.p_stars > 5
  ) {
    reject(boundary, 'rating_invalid');
  }
  const comment = boundedString(
    source.p_comment,
    boundary,
    'rating_comment_invalid',
    0,
    1_008,
  ).trim();
  if (comment.length > 1_000) reject(boundary, 'rating_comment_invalid');
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_stars: source.p_stars,
    p_comment: comment,
  };
}

export function parseDealTimelineRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealRequest(value, 'deal_timeline_request');
}

export function parseDealParticipantsRequest(
  value: unknown,
): DealIdRequestPayload {
  return dealRequest(value, 'deal_participants_request');
}

export function parseAccountActivityPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: AccountActivityErrorBoundary,
): AccountActivityErrorEnvelopePayload {
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
