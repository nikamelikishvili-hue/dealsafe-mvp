import type { VerificationStatus } from '../domain';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AccountActivityResponseBoundary =
  | 'profile_summary'
  | 'account_sessions'
  | 'identity_verification'
  | 'deal_timeline'
  | 'deal_participants';

export interface ProfileRatingPayload {
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface ProfileSummaryPayload {
  display_name: string;
  verification_status: VerificationStatus;
  member_since: string;
  completed_deals: number;
  rating_count: number;
  average_rating: number | null;
  recent_ratings: ProfileRatingPayload[];
}

export interface AccountSessionPayload {
  session_id: string;
  created_at: string;
  last_active_at: string;
  expires_at: string | null;
  user_agent: string;
  current_session: boolean;
}

export interface TimelineEventPayload {
  id: string;
  event_type: string;
  created_at: string;
  is_mine: boolean;
}

export interface DealParticipantsPayload {
  seller_name: string;
  seller_verification: VerificationStatus;
  buyer_name: string;
  buyer_verification: VerificationStatus;
  accepted_at: string | null;
  viewer_role: 'seller' | 'buyer';
}

const verificationStatuses = new Set<VerificationStatus>([
  'not_started',
  'pending',
  'verified',
  'failed',
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timelineIdPattern =
  /^(?:created-)?[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventTypePattern = /^[a-z][a-z0-9_.]{2,79}$/;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const maximumClockSkewMs = 5 * 60_000;

export class AccountActivityResponseValidationError extends Error {
  readonly boundary: AccountActivityResponseBoundary;
  readonly issue: string;

  constructor(boundary: AccountActivityResponseBoundary, issue: string) {
    super('The account service returned an invalid response. Please try again later.');
    this.name = 'AccountActivityResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(
  boundary: AccountActivityResponseBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.account-activity.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AccountActivityResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: AccountActivityResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function exactRecord(
  value: unknown,
  boundary: AccountActivityResponseBoundary,
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
  boundary: AccountActivityResponseBoundary,
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
  boundary: AccountActivityResponseBoundary,
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
  boundary: AccountActivityResponseBoundary,
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
  boundary: AccountActivityResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function timestamp(
  value: unknown,
  boundary: AccountActivityResponseBoundary,
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

function nullableTimestamp(
  value: unknown,
  boundary: AccountActivityResponseBoundary,
  issue: string,
  maximumFutureMs = maximumClockSkewMs,
): string | null {
  if (value === null) return null;
  return timestamp(value, boundary, issue, maximumFutureMs);
}

function verificationStatus(
  value: unknown,
  boundary: AccountActivityResponseBoundary,
  issue: string,
): VerificationStatus {
  if (
    typeof value !== 'string'
    || !verificationStatuses.has(value as VerificationStatus)
  ) {
    reject(boundary, issue);
  }
  return value as VerificationStatus;
}

export function parseProfileSummaryRows(
  value: unknown,
): ProfileSummaryPayload[] {
  const boundary = 'profile_summary';
  return rows(value, boundary, 0, 1).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'display_name',
      'verification_status',
      'member_since',
      'completed_deals',
      'rating_count',
      'average_rating',
      'recent_ratings',
    ]);
    const ratingCount = integer(
      source.rating_count,
      boundary,
      'rating_count_invalid',
      0,
      Number.MAX_SAFE_INTEGER,
    );
    let averageRating: number | null = null;
    if (source.average_rating !== null) {
      if (
        typeof source.average_rating !== 'number'
        || !Number.isFinite(source.average_rating)
        || source.average_rating < 1
        || source.average_rating > 5
        || Math.round(source.average_rating * 10) !== source.average_rating * 10
      ) {
        reject(boundary, 'average_rating_invalid');
      }
      averageRating = source.average_rating;
    }
    if (
      (ratingCount === 0 && averageRating !== null)
      || (ratingCount > 0 && averageRating === null)
    ) {
      reject(boundary, 'average_rating_contract_invalid');
    }
    const recentRows = rows(source.recent_ratings, boundary, 0, 5);
    let previousRatingAt = Number.POSITIVE_INFINITY;
    const recentRatings = recentRows.map(rating => {
      const ratingSource = exactRecord(
        rating,
        boundary,
        'recent_rating_shape_invalid',
        ['stars', 'comment', 'created_at'],
      );
      let comment: string | null = null;
      if (ratingSource.comment !== null) {
        comment = boundedString(
          ratingSource.comment,
          boundary,
          'rating_comment_invalid',
          1,
          1_000,
        );
      }
      const createdAt = timestamp(
        ratingSource.created_at,
        boundary,
        'rating_created_at_invalid',
      );
      const createdAtMs = Date.parse(createdAt);
      if (createdAtMs > previousRatingAt) {
        reject(boundary, 'recent_rating_order_invalid');
      }
      previousRatingAt = createdAtMs;
      return {
        stars: integer(
          ratingSource.stars,
          boundary,
          'rating_stars_invalid',
          1,
          5,
        ),
        comment,
        created_at: createdAt,
      };
    });
    if (recentRatings.length > ratingCount) {
      reject(boundary, 'recent_rating_count_invalid');
    }
    return {
      display_name: boundedString(
        source.display_name,
        boundary,
        'display_name_invalid',
        1,
        100,
      ),
      verification_status: verificationStatus(
        source.verification_status,
        boundary,
        'verification_status_invalid',
      ),
      member_since: timestamp(
        source.member_since,
        boundary,
        'member_since_invalid',
      ),
      completed_deals: integer(
        source.completed_deals,
        boundary,
        'completed_deals_invalid',
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      rating_count: ratingCount,
      average_rating: averageRating,
      recent_ratings: recentRatings,
    };
  });
}

export function parseAccountSessionRows(
  value: unknown,
): AccountSessionPayload[] {
  const boundary = 'account_sessions';
  const parsed = rows(value, boundary, 0, 20).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'session_id',
      'created_at',
      'last_active_at',
      'expires_at',
      'user_agent',
      'current_session',
    ]);
    const sessionId = boundedString(
      source.session_id,
      boundary,
      'session_id_invalid',
      36,
      36,
    );
    if (!uuidPattern.test(sessionId)) reject(boundary, 'session_id_invalid');
    const createdAt = timestamp(
      source.created_at,
      boundary,
      'created_at_invalid',
    );
    const lastActiveAt = timestamp(
      source.last_active_at,
      boundary,
      'last_active_at_invalid',
    );
    if (Date.parse(lastActiveAt) < Date.parse(createdAt)) {
      reject(boundary, 'session_time_order_invalid');
    }
    return {
      session_id: sessionId.toLowerCase(),
      created_at: createdAt,
      last_active_at: lastActiveAt,
      expires_at: nullableTimestamp(
        source.expires_at,
        boundary,
        'expires_at_invalid',
        366 * 24 * 60 * 60 * 1_000,
      ),
      user_agent: boundedString(
        source.user_agent,
        boundary,
        'user_agent_invalid',
        1,
        512,
      ),
      current_session: boolean(
        source.current_session,
        boundary,
        'current_session_invalid',
      ),
    };
  });
  const currentIndexes = parsed
    .map((session, index) => session.current_session ? index : -1)
    .filter(index => index >= 0);
  if (
    currentIndexes.length > 1
    || (currentIndexes.length === 1 && currentIndexes[0] !== 0)
  ) {
    reject(boundary, 'current_session_order_invalid');
  }
  for (let index = 1; index < parsed.length; index += 1) {
    if (
      !parsed[index - 1].current_session
      && Date.parse(parsed[index].last_active_at)
        > Date.parse(parsed[index - 1].last_active_at)
    ) {
      reject(boundary, 'last_active_order_invalid');
    }
  }
  return parsed;
}

export function parseIdentityVerificationResponse(
  value: unknown,
): VerificationStatus {
  return verificationStatus(
    value,
    'identity_verification',
    'verification_status_invalid',
  );
}

export function parseTimelineEventRows(
  value: unknown,
): TimelineEventPayload[] {
  const boundary = 'deal_timeline';
  let previousAt = Number.POSITIVE_INFINITY;
  return rows(value, boundary, 0, 500).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'id',
      'event_type',
      'created_at',
      'is_mine',
    ]);
    const id = boundedString(source.id, boundary, 'id_invalid', 36, 44);
    if (!timelineIdPattern.test(id)) reject(boundary, 'id_invalid');
    const eventType = boundedString(
      source.event_type,
      boundary,
      'event_type_invalid',
      3,
      80,
    );
    if (!eventTypePattern.test(eventType)) {
      reject(boundary, 'event_type_invalid');
    }
    const createdAt = timestamp(
      source.created_at,
      boundary,
      'created_at_invalid',
    );
    const createdAtMs = Date.parse(createdAt);
    if (createdAtMs > previousAt) reject(boundary, 'event_order_invalid');
    previousAt = createdAtMs;
    return {
      id: id.toLowerCase(),
      event_type: eventType,
      created_at: createdAt,
      is_mine: boolean(source.is_mine, boundary, 'is_mine_invalid'),
    };
  });
}

export function parseDealParticipantsRows(
  value: unknown,
): DealParticipantsPayload[] {
  const boundary = 'deal_participants';
  return rows(value, boundary, 0, 1).map(row => {
    const source = exactRecord(row, boundary, 'row_shape_invalid', [
      'seller_name',
      'seller_verification',
      'buyer_name',
      'buyer_verification',
      'accepted_at',
      'viewer_role',
    ]);
    if (source.viewer_role !== 'seller' && source.viewer_role !== 'buyer') {
      reject(boundary, 'viewer_role_invalid');
    }
    return {
      seller_name: boundedString(
        source.seller_name,
        boundary,
        'seller_name_invalid',
        1,
        100,
      ),
      seller_verification: verificationStatus(
        source.seller_verification,
        boundary,
        'seller_verification_invalid',
      ),
      buyer_name: boundedString(
        source.buyer_name,
        boundary,
        'buyer_name_invalid',
        1,
        100,
      ),
      buyer_verification: verificationStatus(
        source.buyer_verification,
        boundary,
        'buyer_verification_invalid',
      ),
      accepted_at: nullableTimestamp(
        source.accepted_at,
        boundary,
        'accepted_at_invalid',
      ),
      viewer_role: source.viewer_role,
    };
  });
}
