import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type PaymentRequestBoundary =
  | 'stripe_connect_request'
  | 'stripe_checkout_request'
  | 'protected_payment_status_request';

export type PaymentErrorBoundary =
  | 'stripe_connect_error'
  | 'stripe_checkout_error'
  | 'stripe_dispute_resolution_error'
  | 'protected_payment_status_error';

export type PaymentBoundary = PaymentRequestBoundary | PaymentErrorBoundary;

export type StripeConnectRequestPayload =
  | { action: 'status' }
  | { action: 'onboard'; dealPublicId: string };

export interface StripeCheckoutRequestPayload {
  dealId: string;
}

export interface ProtectedPaymentStatusRequestPayload {
  p_deal_id: string;
}

export interface PaymentErrorEnvelopePayload {
  error: string;
  code: string;
  correlationId: string;
  retryable: boolean;
}

export interface PaymentPostgrestErrorPayload {
  message: string;
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const safeMessages: Partial<Record<string, string>> = {
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  public_id_invalid: 'The selected Deal Link is invalid. Refresh and try again.',
};

export class PaymentBoundaryValidationError extends Error {
  readonly boundary: PaymentBoundary;
  readonly issue: string;

  constructor(boundary: PaymentBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The secure payment request could not be processed safely. Please try again later.',
    );
    this.name = 'PaymentBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: PaymentBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.payment.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new PaymentBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: PaymentBoundary,
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
  boundary: PaymentBoundary,
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
  boundary: PaymentRequestBoundary,
): string {
  const result = boundedString(value, boundary, 'deal_id_invalid', 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, 'deal_id_invalid');
  return result.toLowerCase();
}

function assertErrorStatus(
  value: number,
  boundary: PaymentErrorBoundary,
) {
  if (!Number.isSafeInteger(value) || value < 400 || value > 599) {
    reject(boundary, 'status_invalid');
  }
}

function safeErrorCode(
  value: unknown,
  boundary: PaymentErrorBoundary,
): string {
  const result = boundedString(value, boundary, 'error_code_invalid', 1, 64);
  if (!/^[a-z0-9_]+$/.test(result)) reject(boundary, 'error_code_invalid');
  return result;
}

function correlationId(
  value: unknown,
  boundary: PaymentErrorBoundary,
): string {
  const result = boundedString(
    value,
    boundary,
    'correlation_id_invalid',
    36,
    36,
  );
  if (!uuidPattern.test(result)) reject(boundary, 'correlation_id_invalid');
  return result.toLowerCase();
}

export function parseStripeConnectRequest(
  value: unknown,
): StripeConnectRequestPayload {
  const boundary = 'stripe_connect_request';
  const actionSource = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['action'],
    ['dealPublicId'],
  );
  if (actionSource.action === 'status') {
    exactRecord(value, boundary, 'request_shape_invalid', ['action']);
    return { action: 'status' };
  }
  if (actionSource.action !== 'onboard') {
    reject(boundary, 'request_shape_invalid');
  }
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['action', 'dealPublicId'],
  );
  const dealPublicId = boundedString(
    source.dealPublicId,
    boundary,
    'public_id_invalid',
    6,
    32,
  ).trim().toUpperCase();
  if (!/^[A-Z0-9]{6,32}$/.test(dealPublicId)) {
    reject(boundary, 'public_id_invalid');
  }
  return { action: 'onboard', dealPublicId };
}

export function parseStripeCheckoutRequest(
  value: unknown,
): StripeCheckoutRequestPayload {
  const boundary = 'stripe_checkout_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['dealId'],
  );
  return { dealId: uuid(source.dealId, boundary) };
}

export function parseProtectedPaymentStatusRequest(
  value: unknown,
): ProtectedPaymentStatusRequestPayload {
  const boundary = 'protected_payment_status_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id'],
  );
  return { p_deal_id: uuid(source.p_deal_id, boundary) };
}

export function parsePaymentErrorEnvelope(
  value: unknown,
  status: number,
  correlationHeader: string | null,
  boundary: Extract<
    PaymentErrorBoundary,
    | 'stripe_connect_error'
    | 'stripe_checkout_error'
    | 'stripe_dispute_resolution_error'
  >,
): PaymentErrorEnvelopePayload {
  assertErrorStatus(status, boundary);
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    ['error', 'code', 'correlationId', 'retryable'],
  );
  const error = boundedString(
    source.error,
    boundary,
    'error_message_invalid',
    1,
    240,
  ).trim();
  if (!error) reject(boundary, 'error_message_invalid');
  const bodyCorrelationId = correlationId(
    source.correlationId,
    boundary,
  );
  const headerCorrelationId = correlationId(
    correlationHeader,
    boundary,
  );
  if (bodyCorrelationId !== headerCorrelationId) {
    reject(boundary, 'correlation_id_conflict');
  }
  if (typeof source.retryable !== 'boolean') {
    reject(boundary, 'retryable_invalid');
  }
  return {
    error,
    code: safeErrorCode(source.code, boundary),
    correlationId: bodyCorrelationId,
    retryable: source.retryable,
  };
}

export function parsePaymentPostgrestErrorEnvelope(
  value: unknown,
  status: number,
): PaymentPostgrestErrorPayload {
  const boundary = 'protected_payment_status_error';
  assertErrorStatus(status, boundary);
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
      && typeof source[key] !== 'undefined'
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
