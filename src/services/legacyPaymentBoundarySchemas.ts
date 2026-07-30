import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type LegacyPaymentBoundary =
  | 'legacy_payment_record_request'
  | 'legacy_payment_record_error';

export interface LegacyPaymentRecordRequestPayload {
  p_deal_id: string;
}

export interface LegacyPaymentErrorEnvelopePayload {
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u001f\u007f]/u;

export class LegacyPaymentBoundaryValidationError extends Error {
  readonly boundary: LegacyPaymentBoundary;
  readonly issue: string;

  constructor(boundary: LegacyPaymentBoundary, issue: string) {
    super('The historical payment record could not be loaded safely.');
    this.name = 'LegacyPaymentBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: LegacyPaymentBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.legacy-payment.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new LegacyPaymentBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: LegacyPaymentBoundary,
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
  boundary: LegacyPaymentBoundary,
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

export function parseLegacyPaymentRecordRequest(
  value: unknown,
): LegacyPaymentRecordRequestPayload {
  const boundary = 'legacy_payment_record_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id'],
  );
  const dealId = boundedString(
    source.p_deal_id,
    boundary,
    'deal_id_invalid',
    36,
    36,
  );
  if (!uuidPattern.test(dealId)) reject(boundary, 'deal_id_invalid');
  return { p_deal_id: dealId.toLowerCase() };
}

export function parseLegacyPaymentPostgrestErrorEnvelope(
  value: unknown,
  status: number,
): LegacyPaymentErrorEnvelopePayload {
  const boundary = 'legacy_payment_record_error';
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
