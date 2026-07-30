import type { CurrencyCode } from '../currency';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type PaymentResponseBoundary =
  | 'protected_payment_status'
  | 'stripe_connect_status'
  | 'stripe_connect_onboarding'
  | 'stripe_checkout'
  | 'stripe_dispute_resolution';

export type ProtectedPaymentStatePayload =
  | 'not_started'
  | 'checkout_created'
  | 'processing'
  | 'funds_secured'
  | 'release_pending'
  | 'released'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded'
  | 'disputed'
  | 'release_failed';

export interface ProtectedPaymentStatusPayload {
  status: ProtectedPaymentStatePayload;
  item_amount_cents: number;
  platform_fee_cents: number;
  seller_amount_cents: number;
  currency: CurrencyCode;
  checkout_expires_at: string | null;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  disputed_at: string | null;
  failure_message: string | null;
  seller_connected: boolean;
  seller_payouts_ready: boolean;
  viewer_role: 'seller' | 'buyer';
}

export interface StripeConnectStatusPayload {
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  ready: boolean;
}

export interface StripeConnectOnboardingPayload {
  url: string;
  expiresAt: number;
}

export interface StripeCheckoutPayload {
  url: string;
  expiresAt: string;
  reused: boolean;
}

export type StripeDisputeResolutionPayload =
  | {
      resolved: true;
      action: 'refund';
      refundId: string;
      idempotent: boolean;
    }
  | {
      resolved: true;
      action: 'transfer';
      transferId: string;
      idempotent: boolean;
    };

export class PaymentResponseValidationError extends Error {
  readonly boundary: PaymentResponseBoundary;
  readonly issue: string;

  constructor(boundary: PaymentResponseBoundary, issue: string) {
    super('The secure payment service returned an invalid response. Please try again later.');
    this.name = 'PaymentResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

const paymentStates = new Set<ProtectedPaymentStatePayload>([
  'not_started',
  'checkout_created',
  'processing',
  'funds_secured',
  'release_pending',
  'released',
  'failed',
  'expired',
  'cancelled',
  'refund_pending',
  'refunded',
  'disputed',
  'release_failed',
]);
export const paymentCurrencyCodes = [
  'USD',
  'EUR',
  'GBP',
  'GEL',
  'TRY',
  'ILS',
  'CNY',
  'JPY',
  'KRW',
  'INR',
  'CAD',
  'AUD',
  'CHF',
  'AED',
  'SAR',
] as const satisfies readonly CurrencyCode[];
const currencies = new Set<CurrencyCode>(paymentCurrencyCodes);
const paidStates = new Set<ProtectedPaymentStatePayload>([
  'funds_secured',
  'release_pending',
  'released',
  'refund_pending',
  'refunded',
  'disputed',
  'release_failed',
]);
const maximumAmountCents = 100_000_000_000;

function reject(
  boundary: PaymentResponseBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.payment.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new PaymentResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function boolean(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function integer(
  value: unknown,
  boundary: PaymentResponseBoundary,
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
  boundary: PaymentResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function nullableString(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
  maximum: number,
): string | null {
  if (value === null) return null;
  return boundedString(value, boundary, issue, 0, maximum);
}

function timestampOrNull(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  const result = boundedString(value, boundary, issue, 20, 40);
  if (!Number.isFinite(Date.parse(result))) reject(boundary, issue);
  return result;
}

function futureTimestamp(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
  maximumFutureMs: number,
): string {
  const result = boundedString(value, boundary, issue, 20, 40);
  const timestamp = Date.parse(result);
  if (
    !Number.isFinite(timestamp)
    || timestamp <= Date.now()
    || timestamp > Date.now() + maximumFutureMs
  ) {
    reject(boundary, issue);
  }
  return result;
}

function safeStripeUrl(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
  expectedOrigin: string,
): string {
  const result = boundedString(value, boundary, issue, 20, 4_096);
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    reject(boundary, issue);
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.origin !== expectedOrigin
    || parsed.username
    || parsed.password
  ) {
    reject(boundary, issue);
  }
  return parsed.toString();
}

function stripeId(
  value: unknown,
  boundary: PaymentResponseBoundary,
  issue: string,
  prefix: 're_' | 'tr_',
): string {
  const result = boundedString(value, boundary, issue, 11, 258);
  const expression = prefix === 're_'
    ? /^re_[A-Za-z0-9_]{8,255}$/
    : /^tr_[A-Za-z0-9_]{8,255}$/;
  if (!expression.test(result)) reject(boundary, issue);
  return result;
}

export function parseProtectedPaymentStatusRows(
  value: unknown,
): ProtectedPaymentStatusPayload {
  const boundary = 'protected_payment_status';
  if (!Array.isArray(value) || value.length !== 1) {
    reject(boundary, 'row_count_invalid');
  }
  const source = record(value[0], boundary, 'row_not_object');
  const statusValue = boundedString(source.status, boundary, 'status_invalid', 3, 32);
  if (!paymentStates.has(statusValue as ProtectedPaymentStatePayload)) {
    reject(boundary, 'status_invalid');
  }
  const status = statusValue as ProtectedPaymentStatePayload;
  const itemAmount = integer(
    source.item_amount_cents,
    boundary,
    'item_amount_invalid',
    1,
    maximumAmountCents,
  );
  const platformFee = integer(
    source.platform_fee_cents,
    boundary,
    'platform_fee_invalid',
    0,
    maximumAmountCents,
  );
  const sellerAmount = integer(
    source.seller_amount_cents,
    boundary,
    'seller_amount_invalid',
    0,
    maximumAmountCents,
  );
  if (platformFee + sellerAmount !== itemAmount) {
    reject(boundary, 'amounts_do_not_balance');
  }
  const currencyValue = boundedString(source.currency, boundary, 'currency_invalid', 3, 3);
  if (!currencies.has(currencyValue as CurrencyCode)) {
    reject(boundary, 'currency_invalid');
  }
  const paidAt = timestampOrNull(source.paid_at, boundary, 'paid_at_invalid');
  const releasedAt = timestampOrNull(source.released_at, boundary, 'released_at_invalid');
  const refundedAt = timestampOrNull(source.refunded_at, boundary, 'refunded_at_invalid');
  const disputedAt = timestampOrNull(source.disputed_at, boundary, 'disputed_at_invalid');
  if (paidStates.has(status) && paidAt === null) {
    reject(boundary, 'paid_timestamp_missing');
  }
  if (status === 'released' && releasedAt === null) {
    reject(boundary, 'released_timestamp_missing');
  }
  if (status === 'refunded' && refundedAt === null) {
    reject(boundary, 'refunded_timestamp_missing');
  }
  if (status === 'disputed' && disputedAt === null) {
    reject(boundary, 'disputed_timestamp_missing');
  }
  if (paidAt !== null) {
    const paidTime = Date.parse(paidAt);
    if (
      (releasedAt !== null && Date.parse(releasedAt) < paidTime)
      || (refundedAt !== null && Date.parse(refundedAt) < paidTime)
      || (disputedAt !== null && Date.parse(disputedAt) < paidTime)
    ) {
      reject(boundary, 'event_timestamp_order_invalid');
    }
  }
  const sellerConnected = boolean(
    source.seller_connected,
    boundary,
    'seller_connected_invalid',
  );
  const sellerPayoutsReady = boolean(
    source.seller_payouts_ready,
    boundary,
    'seller_payouts_ready_invalid',
  );
  if (sellerPayoutsReady && !sellerConnected) {
    reject(boundary, 'seller_payout_state_conflict');
  }
  const viewerRole = boundedString(source.viewer_role, boundary, 'viewer_role_invalid', 5, 6);
  if (viewerRole !== 'seller' && viewerRole !== 'buyer') {
    reject(boundary, 'viewer_role_invalid');
  }
  return {
    status,
    item_amount_cents: itemAmount,
    platform_fee_cents: platformFee,
    seller_amount_cents: sellerAmount,
    currency: currencyValue as CurrencyCode,
    checkout_expires_at: timestampOrNull(
      source.checkout_expires_at,
      boundary,
      'checkout_expires_at_invalid',
    ),
    paid_at: paidAt,
    released_at: releasedAt,
    refunded_at: refundedAt,
    disputed_at: disputedAt,
    failure_message: nullableString(
      source.failure_message,
      boundary,
      'failure_message_invalid',
      500,
    ),
    seller_connected: sellerConnected,
    seller_payouts_ready: sellerPayoutsReady,
    viewer_role: viewerRole,
  };
}

export function parseStripeConnectStatusResponse(
  value: unknown,
): StripeConnectStatusPayload {
  const boundary = 'stripe_connect_status';
  const source = record(value, boundary, 'status_not_object');
  const connected = boolean(source.connected, boundary, 'connected_invalid');
  const detailsSubmitted = boolean(
    source.detailsSubmitted,
    boundary,
    'details_submitted_invalid',
  );
  const payoutsEnabled = boolean(
    source.payoutsEnabled,
    boundary,
    'payouts_enabled_invalid',
  );
  const transfersActive = boolean(
    source.transfersActive,
    boundary,
    'transfers_active_invalid',
  );
  const ready = boolean(source.ready, boundary, 'ready_invalid');
  if (
    (!connected && (detailsSubmitted || payoutsEnabled || transfersActive || ready))
    || ready !== (connected && detailsSubmitted && payoutsEnabled && transfersActive)
  ) {
    reject(boundary, 'connect_state_conflict');
  }
  return {
    connected,
    detailsSubmitted,
    payoutsEnabled,
    transfersActive,
    ready,
  };
}

export function parseStripeConnectOnboardingResponse(
  value: unknown,
): StripeConnectOnboardingPayload {
  const boundary = 'stripe_connect_onboarding';
  const source = record(value, boundary, 'onboarding_not_object');
  const expiresAt = integer(
    source.expiresAt,
    boundary,
    'expires_at_invalid',
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const expiresAtMs = expiresAt * 1_000;
  if (
    !Number.isSafeInteger(expiresAtMs)
    || expiresAtMs <= Date.now()
    || expiresAtMs > Date.now() + 24 * 60 * 60 * 1_000
  ) {
    reject(boundary, 'expires_at_invalid');
  }
  return {
    url: safeStripeUrl(
      source.url,
      boundary,
      'onboarding_url_invalid',
      'https://connect.stripe.com',
    ),
    expiresAt,
  };
}

export function parseStripeCheckoutResponse(
  value: unknown,
): StripeCheckoutPayload {
  const boundary = 'stripe_checkout';
  const source = record(value, boundary, 'checkout_not_object');
  return {
    url: safeStripeUrl(
      source.url,
      boundary,
      'checkout_url_invalid',
      'https://checkout.stripe.com',
    ),
    expiresAt: futureTimestamp(
      source.expiresAt,
      boundary,
      'expires_at_invalid',
      25 * 60 * 60 * 1_000,
    ),
    reused: source.reused === undefined
      ? false
      : boolean(source.reused, boundary, 'reused_invalid'),
  };
}

export function parseStripeDisputeResolutionResponse(
  value: unknown,
): StripeDisputeResolutionPayload {
  const boundary = 'stripe_dispute_resolution';
  const source = record(value, boundary, 'resolution_not_object');
  if (source.resolved !== true) reject(boundary, 'resolved_invalid');
  const idempotent = source.idempotent === undefined
    ? false
    : boolean(source.idempotent, boundary, 'idempotent_invalid');
  if (source.action === 'refund') {
    if ('transferId' in source) reject(boundary, 'provider_id_conflict');
    return {
      resolved: true,
      action: 'refund',
      refundId: stripeId(source.refundId, boundary, 'refund_id_invalid', 're_'),
      idempotent,
    };
  }
  if (source.action === 'transfer') {
    if ('refundId' in source) reject(boundary, 'provider_id_conflict');
    return {
      resolved: true,
      action: 'transfer',
      transferId: stripeId(source.transferId, boundary, 'transfer_id_invalid', 'tr_'),
      idempotent,
    };
  }
  reject(boundary, 'action_invalid');
}
