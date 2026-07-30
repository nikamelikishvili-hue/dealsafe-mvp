import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type LegacyPaymentMethod =
  | 'cash_at_handoff'
  | 'bank_transfer'
  | 'payment_app'
  | 'card_invoice'
  | 'other';

export interface LegacyPaymentRecordPayload {
  method: LegacyPaymentMethod;
  buyer_confirmed_at: string | null;
  buyer_marked_sent_at: string | null;
  seller_marked_received_at: string | null;
  updated_at: string;
  viewer_role: 'seller' | 'buyer';
}

const methods = new Set<LegacyPaymentMethod>([
  'cash_at_handoff',
  'bank_transfer',
  'payment_app',
  'card_invoice',
  'other',
]);
const controlPattern = /[\u0000-\u001f\u007f]/u;
const maximumClockSkewMs = 5 * 60_000;

export class LegacyPaymentResponseValidationError extends Error {
  readonly issue: string;

  constructor(issue: string) {
    super('The historical payment service returned an invalid response.');
    this.name = 'LegacyPaymentResponseValidationError';
    this.issue = issue;
  }
}

function reject(issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.legacy-payment.response-rejection.v1',
    boundary: 'legacy_payment_record',
    issue: safeIssue,
  });
  throw new LegacyPaymentResponseValidationError(safeIssue);
}

function exactRecord(
  value: unknown,
  issue: string,
  keys: readonly string[],
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(issue);
  }
  const source = value as JsonRecord;
  if (
    keys.some(key => !Object.prototype.hasOwnProperty.call(source, key))
    || Object.keys(source).some(key => !keys.includes(key))
  ) {
    reject(issue);
  }
  return source;
}

function timestamp(value: unknown, issue: string): string {
  if (
    typeof value !== 'string'
    || value.length < 20
    || value.length > 35
    || controlPattern.test(value)
  ) {
    reject(issue);
  }
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.getTime())
    || parsed.getTime() > Date.now() + maximumClockSkewMs
  ) {
    reject(issue);
  }
  return value;
}

function nullableTimestamp(value: unknown, issue: string): string | null {
  return value === null ? null : timestamp(value, issue);
}

export function parseLegacyPaymentRecordRows(
  value: unknown,
): LegacyPaymentRecordPayload[] {
  if (!Array.isArray(value) || value.length > 1) reject('rows_invalid');
  if (!value.length) return [];
  const source = exactRecord(
    value[0],
    'record_shape_invalid',
    [
      'method',
      'buyer_confirmed_at',
      'buyer_marked_sent_at',
      'seller_marked_received_at',
      'updated_at',
      'viewer_role',
    ],
  );
  if (
    typeof source.method !== 'string'
    || !methods.has(source.method as LegacyPaymentMethod)
  ) {
    reject('method_invalid');
  }
  if (source.viewer_role !== 'seller' && source.viewer_role !== 'buyer') {
    reject('viewer_role_invalid');
  }
  const buyerConfirmedAt = nullableTimestamp(
    source.buyer_confirmed_at,
    'buyer_confirmed_at_invalid',
  );
  const buyerMarkedSentAt = nullableTimestamp(
    source.buyer_marked_sent_at,
    'buyer_marked_sent_at_invalid',
  );
  const sellerMarkedReceivedAt = nullableTimestamp(
    source.seller_marked_received_at,
    'seller_marked_received_at_invalid',
  );
  const updatedAt = timestamp(source.updated_at, 'updated_at_invalid');
  const confirmedTime = buyerConfirmedAt === null
    ? null
    : Date.parse(buyerConfirmedAt);
  if (
    (buyerMarkedSentAt !== null && buyerConfirmedAt === null)
    || (sellerMarkedReceivedAt !== null && buyerConfirmedAt === null)
    || (
      buyerMarkedSentAt !== null
      && confirmedTime !== null
      && Date.parse(buyerMarkedSentAt) < confirmedTime
    )
    || (
      sellerMarkedReceivedAt !== null
      && confirmedTime !== null
      && Date.parse(sellerMarkedReceivedAt) < confirmedTime
    )
    || [buyerConfirmedAt, buyerMarkedSentAt, sellerMarkedReceivedAt]
      .some(value => value !== null && Date.parse(value) > Date.parse(updatedAt))
  ) {
    reject('payment_state_invalid');
  }
  return [{
    method: source.method as LegacyPaymentMethod,
    buyer_confirmed_at: buyerConfirmedAt,
    buyer_marked_sent_at: buyerMarkedSentAt,
    seller_marked_received_at: sellerMarkedReceivedAt,
    updated_at: updatedAt,
    viewer_role: source.viewer_role,
  }];
}
