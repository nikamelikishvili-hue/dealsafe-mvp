import type { VerificationStatus } from '../domain';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type TrustResponseBoundary =
  | 'deal_risk_assessment'
  | 'public_seller_trust_profile'
  | 'trust_passport_settings'
  | 'trust_passport_toggle'
  | 'public_trust_passport';

export type DealRiskLevel = 'low' | 'medium' | 'high';
export type DealRiskSignal =
  | 'unverified_seller'
  | 'new_account'
  | 'limited_history'
  | 'no_photos'
  | 'single_photo'
  | 'missing_serial'
  | 'payment_language'
  | 'community_reports'
  | 'no_flags';

export interface RiskAssessmentPayload {
  risk_score: number;
  risk_level: DealRiskLevel;
  signals: DealRiskSignal[];
}

export interface PublicTrustProfilePayload {
  display_name: string;
  verification_status: VerificationStatus;
  member_since: string;
  completed_sales: number;
  rating_count: number;
  average_rating: number | null;
}

export interface TrustPassportSettingsPayload {
  public_id: string;
  enabled: boolean;
}

export interface TrustPassportRatingPayload {
  stars: number;
  created_at: string;
}

export interface TrustPassportPayload {
  display_name: string;
  verification_status: VerificationStatus;
  member_since: string;
  completed_deals: number;
  completed_sales: number;
  completed_purchases: number;
  rating_count: number;
  average_rating: number | null;
  recent_ratings: TrustPassportRatingPayload[];
}

export class TrustResponseValidationError extends Error {
  readonly boundary: TrustResponseBoundary;
  readonly issue: string;

  constructor(boundary: TrustResponseBoundary, issue: string) {
    super('The trust service returned an invalid response. Please try again later.');
    this.name = 'TrustResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

const verificationStatuses = new Set<VerificationStatus>([
  'not_started',
  'pending',
  'verified',
  'failed',
]);
const riskLevels = new Set<DealRiskLevel>(['low', 'medium', 'high']);
const riskSignals = new Set<DealRiskSignal>([
  'unverified_seller',
  'new_account',
  'limited_history',
  'no_photos',
  'single_photo',
  'missing_serial',
  'payment_language',
  'community_reports',
  'no_flags',
]);
const riskSignalOrder = new Map<DealRiskSignal, number>([
  ['unverified_seller', 0],
  ['new_account', 1],
  ['limited_history', 2],
  ['no_photos', 3],
  ['single_photo', 4],
  ['missing_serial', 5],
  ['payment_language', 6],
  ['community_reports', 7],
  ['no_flags', 8],
]);
const riskSignalScores = new Map<DealRiskSignal, number>([
  ['unverified_seller', 18],
  ['new_account', 20],
  ['limited_history', 10],
  ['no_photos', 20],
  ['single_photo', 8],
  ['missing_serial', 10],
  ['payment_language', 25],
  ['no_flags', 0],
]);
const trustPublicIdPattern = /^[A-F0-9]{12}$/;
const maximumClockSkewMs = 5 * 60_000;
const maximumAggregateCount = Number.MAX_SAFE_INTEGER;

function reject(boundary: TrustResponseBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.trust.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new TrustResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: TrustResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function rows(
  value: unknown,
  boundary: TrustResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): unknown[] {
  if (
    !Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
  ) {
    reject(boundary, issue);
  }
  return value;
}

function integer(
  value: unknown,
  boundary: TrustResponseBoundary,
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
  boundary: TrustResponseBoundary,
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

function timestamp(
  value: unknown,
  boundary: TrustResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 20, 80);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || parsed > Date.now() + maximumClockSkewMs) {
    reject(boundary, issue);
  }
  return result;
}

function verificationStatus(
  value: unknown,
  boundary: TrustResponseBoundary,
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

function averageRating(
  value: unknown,
  ratingCount: number,
  boundary: TrustResponseBoundary,
): number | null {
  if (ratingCount === 0) {
    if (value !== null) reject(boundary, 'average_rating_without_ratings');
    return null;
  }
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 1
    || value > 5
    || Math.abs(value * 10 - Math.round(value * 10)) > Number.EPSILON * 10
  ) {
    reject(boundary, 'average_rating_invalid');
  }
  return value;
}

function publicTrustProfile(
  value: unknown,
  boundary: TrustResponseBoundary,
): PublicTrustProfilePayload {
  const source = record(value, boundary, 'profile_row_invalid');
  const ratingCount = integer(
    source.rating_count,
    boundary,
    'rating_count_invalid',
    0,
    maximumAggregateCount,
  );
  return {
    display_name: boundedString(
      source.display_name,
      boundary,
      'display_name_invalid',
      1,
      120,
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
    completed_sales: integer(
      source.completed_sales,
      boundary,
      'completed_sales_invalid',
      0,
      maximumAggregateCount,
    ),
    rating_count: ratingCount,
    average_rating: averageRating(
      source.average_rating,
      ratingCount,
      boundary,
    ),
  };
}

function expectedRiskLevels(score: number): DealRiskLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function parseRiskSignals(
  value: unknown,
  boundary: TrustResponseBoundary,
): DealRiskSignal[] {
  const source = rows(value, boundary, 'risk_signals_invalid', 1, 6);
  const result = source.map(signal => {
    if (
      typeof signal !== 'string'
      || !riskSignals.has(signal as DealRiskSignal)
    ) {
      reject(boundary, 'risk_signal_invalid');
    }
    return signal as DealRiskSignal;
  });
  if (new Set(result).size !== result.length) {
    reject(boundary, 'risk_signal_duplicate');
  }
  if (
    result.includes('no_flags')
    && (result.length !== 1 || result[0] !== 'no_flags')
  ) {
    reject(boundary, 'risk_no_flags_contract_invalid');
  }
  if (
    result.includes('new_account')
    && result.includes('limited_history')
  ) {
    reject(boundary, 'risk_account_signal_conflict');
  }
  if (result.includes('no_photos') && result.includes('single_photo')) {
    reject(boundary, 'risk_media_signal_conflict');
  }
  for (let index = 1; index < result.length; index += 1) {
    if (
      (riskSignalOrder.get(result[index]) ?? -1)
      <= (riskSignalOrder.get(result[index - 1]) ?? -1)
    ) {
      reject(boundary, 'risk_signal_order_invalid');
    }
  }
  return result;
}

function riskScoreMatchesSignals(
  score: number,
  signals: DealRiskSignal[],
): boolean {
  const fixedScore = signals.reduce(
    (total, signal) => total + (riskSignalScores.get(signal) ?? 0),
    0,
  );
  if (!signals.includes('community_reports')) {
    return score === Math.min(100, fixedScore);
  }
  return score === Math.min(100, fixedScore + 15)
    || score === Math.min(100, fixedScore + 30);
}

export function parseDealRiskAssessmentRows(
  value: unknown,
): RiskAssessmentPayload | null {
  const boundary: TrustResponseBoundary = 'deal_risk_assessment';
  const result = rows(
    value,
    boundary,
    'risk_collection_invalid',
    0,
    1,
  );
  if (result.length === 0) return null;
  const source = record(result[0], boundary, 'risk_row_invalid');
  const score = integer(
    source.risk_score,
    boundary,
    'risk_score_invalid',
    0,
    100,
  );
  if (
    typeof source.risk_level !== 'string'
    || !riskLevels.has(source.risk_level as DealRiskLevel)
  ) {
    reject(boundary, 'risk_level_invalid');
  }
  const level = source.risk_level as DealRiskLevel;
  const signals = parseRiskSignals(source.signals, boundary);
  if (level !== expectedRiskLevels(score)) {
    reject(boundary, 'risk_level_contract_invalid');
  }
  if (!riskScoreMatchesSignals(score, signals)) {
    reject(boundary, 'risk_score_contract_invalid');
  }
  return {
    risk_score: score,
    risk_level: level,
    signals,
  };
}

export function parsePublicSellerTrustProfileRows(
  value: unknown,
): PublicTrustProfilePayload | null {
  const boundary: TrustResponseBoundary = 'public_seller_trust_profile';
  const result = rows(
    value,
    boundary,
    'profile_collection_invalid',
    0,
    1,
  );
  return result.length === 0
    ? null
    : publicTrustProfile(result[0], boundary);
}

function trustPublicId(
  value: unknown,
  boundary: TrustResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 12, 12);
  if (!trustPublicIdPattern.test(result)) reject(boundary, issue);
  return result;
}

export function parseTrustPassportSettingsRows(
  value: unknown,
): TrustPassportSettingsPayload {
  const boundary: TrustResponseBoundary = 'trust_passport_settings';
  const result = rows(
    value,
    boundary,
    'settings_collection_invalid',
    1,
    1,
  );
  const source = record(result[0], boundary, 'settings_row_invalid');
  if (typeof source.enabled !== 'boolean') {
    reject(boundary, 'settings_enabled_invalid');
  }
  return {
    public_id: trustPublicId(
      source.public_id,
      boundary,
      'settings_public_id_invalid',
    ),
    enabled: source.enabled,
  };
}

export function parseTrustPassportToggleResponse(value: unknown): string {
  return trustPublicId(
    value,
    'trust_passport_toggle',
    'toggle_public_id_invalid',
  );
}

function passportRating(
  value: unknown,
  boundary: TrustResponseBoundary,
): TrustPassportRatingPayload {
  const source = record(value, boundary, 'recent_rating_invalid');
  return {
    stars: integer(
      source.stars,
      boundary,
      'recent_rating_stars_invalid',
      1,
      5,
    ),
    created_at: timestamp(
      source.created_at,
      boundary,
      'recent_rating_timestamp_invalid',
    ),
  };
}

export function parsePublicTrustPassportRows(
  value: unknown,
): TrustPassportPayload | null {
  const boundary: TrustResponseBoundary = 'public_trust_passport';
  const result = rows(
    value,
    boundary,
    'passport_collection_invalid',
    0,
    1,
  );
  if (result.length === 0) return null;
  const source = record(result[0], boundary, 'passport_row_invalid');
  const ratingCount = integer(
    source.rating_count,
    boundary,
    'rating_count_invalid',
    0,
    maximumAggregateCount,
  );
  const completedDeals = integer(
    source.completed_deals,
    boundary,
    'completed_deals_invalid',
    0,
    maximumAggregateCount,
  );
  const completedSales = integer(
    source.completed_sales,
    boundary,
    'completed_sales_invalid',
    0,
    maximumAggregateCount,
  );
  const completedPurchases = integer(
    source.completed_purchases,
    boundary,
    'completed_purchases_invalid',
    0,
    maximumAggregateCount,
  );
  if (completedDeals !== completedSales + completedPurchases) {
    reject(boundary, 'completed_deal_counts_invalid');
  }
  const recentRatings = rows(
    source.recent_ratings,
    boundary,
    'recent_ratings_invalid',
    0,
    Math.min(5, ratingCount),
  ).map(value => passportRating(value, boundary));
  for (let index = 1; index < recentRatings.length; index += 1) {
    if (
      Date.parse(recentRatings[index].created_at)
      > Date.parse(recentRatings[index - 1].created_at)
    ) {
      reject(boundary, 'recent_rating_order_invalid');
    }
  }
  return {
    display_name: boundedString(
      source.display_name,
      boundary,
      'display_name_invalid',
      1,
      120,
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
    completed_deals: completedDeals,
    completed_sales: completedSales,
    completed_purchases: completedPurchases,
    rating_count: ratingCount,
    average_rating: averageRating(
      source.average_rating,
      ratingCount,
      boundary,
    ),
    recent_ratings: recentRatings,
  };
}
