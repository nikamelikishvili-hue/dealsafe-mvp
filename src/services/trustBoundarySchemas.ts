import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type TrustRequestBoundary =
  | 'deal_risk_request'
  | 'public_seller_trust_request'
  | 'trust_passport_settings_request'
  | 'trust_passport_toggle_request'
  | 'public_trust_passport_request';

export type TrustErrorBoundary =
  | 'deal_risk_error'
  | 'public_seller_trust_error'
  | 'trust_passport_settings_error'
  | 'trust_passport_toggle_error'
  | 'public_trust_passport_error';

export type TrustBoundary = TrustRequestBoundary | TrustErrorBoundary;

export interface PublicDealTrustRequestPayload {
  p_public_id: string;
}

export interface TrustPassportToggleRequestPayload {
  p_enabled: boolean;
}

export interface TrustErrorEnvelopePayload {
  code: string | null;
}

const dealPublicIdPattern = /^[A-Z0-9]{6,32}$/;
const trustPublicIdPattern = /^[A-F0-9]{12}$/;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const safeMessages: Partial<Record<string, string>> = {
  public_id_invalid: 'The selected Deal Link is invalid. Refresh and try again.',
  trust_public_id_invalid: 'The Trust Passport link is invalid.',
};

export class TrustBoundaryValidationError extends Error {
  readonly boundary: TrustBoundary;
  readonly issue: string;

  constructor(boundary: TrustBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The trust request could not be processed safely. Please try again.',
    );
    this.name = 'TrustBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: TrustBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.trust.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new TrustBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: TrustBoundary,
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
  boundary: TrustBoundary,
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

function dealPublicId(
  value: unknown,
  boundary: Extract<
    TrustRequestBoundary,
    'deal_risk_request' | 'public_seller_trust_request'
  >,
): string {
  const result = boundedString(
    value,
    boundary,
    'public_id_invalid',
    6,
    32,
  ).trim().toUpperCase();
  if (!dealPublicIdPattern.test(result)) reject(boundary, 'public_id_invalid');
  return result;
}

function dealPublicIdRequest(
  value: unknown,
  boundary: Extract<
    TrustRequestBoundary,
    'deal_risk_request' | 'public_seller_trust_request'
  >,
): PublicDealTrustRequestPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id'],
  );
  return { p_public_id: dealPublicId(source.p_public_id, boundary) };
}

export function parseDealRiskRequest(
  value: unknown,
): PublicDealTrustRequestPayload {
  return dealPublicIdRequest(value, 'deal_risk_request');
}

export function parsePublicSellerTrustRequest(
  value: unknown,
): PublicDealTrustRequestPayload {
  return dealPublicIdRequest(value, 'public_seller_trust_request');
}

export function parseTrustPassportSettingsRequest(
  value: unknown,
): Record<string, never> {
  exactRecord(
    value,
    'trust_passport_settings_request',
    'request_shape_invalid',
    [],
  );
  return {};
}

export function parseTrustPassportToggleRequest(
  value: unknown,
): TrustPassportToggleRequestPayload {
  const boundary = 'trust_passport_toggle_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_enabled'],
  );
  if (typeof source.p_enabled !== 'boolean') {
    reject(boundary, 'enabled_invalid');
  }
  return { p_enabled: source.p_enabled };
}

export function parsePublicTrustPassportRequest(
  value: unknown,
): PublicDealTrustRequestPayload {
  const boundary = 'public_trust_passport_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id'],
  );
  const publicId = boundedString(
    source.p_public_id,
    boundary,
    'trust_public_id_invalid',
    12,
    16,
  ).trim().toUpperCase();
  if (!trustPublicIdPattern.test(publicId)) {
    reject(boundary, 'trust_public_id_invalid');
  }
  return { p_public_id: publicId };
}

export function parseTrustPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: TrustErrorBoundary,
): TrustErrorEnvelopePayload {
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
