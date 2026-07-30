import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AdminRequestBoundary =
  | 'admin_access_request'
  | 'admin_revenue_summary_request'
  | 'admin_revenue_transactions_request'
  | 'admin_catalog_adoption_request';

export type AdminErrorBoundary =
  | 'admin_revenue_summary_error'
  | 'admin_revenue_transactions_error'
  | 'admin_catalog_adoption_error';

export type AdminBoundary = AdminRequestBoundary | AdminErrorBoundary;

export interface AdminRevenueTransactionsRequestPayload {
  p_limit: number;
}

export interface AdminCatalogAdoptionRequestPayload {
  p_days: 7 | 30 | 90;
}

export interface AdminErrorEnvelopePayload {
  message: string;
  code: string | null;
}

const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

export class AdminBoundaryValidationError extends Error {
  readonly boundary: AdminBoundary;
  readonly issue: string;

  constructor(boundary: AdminBoundary, issue: string) {
    super(
      issue === 'transaction_limit_invalid'
        ? 'Choose a transaction limit from 1 to 200.'
        : issue === 'catalog_window_invalid'
          ? 'Choose a 7, 30, or 90 day catalog window.'
          : 'The administration request could not be processed safely. Please try again.',
    );
    this.name = 'AdminBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: AdminBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.admin.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AdminBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: AdminBoundary,
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

function emptyRequest(
  value: unknown,
  boundary: Extract<
    AdminRequestBoundary,
    'admin_access_request' | 'admin_revenue_summary_request'
  >,
): Record<string, never> {
  exactRecord(value, boundary, 'request_shape_invalid', []);
  return {};
}

function boundedString(
  value: unknown,
  boundary: AdminBoundary,
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

export function parseAdminAccessRequest(
  value: unknown,
): Record<string, never> {
  return emptyRequest(value, 'admin_access_request');
}

export function parseAdminRevenueSummaryRequest(
  value: unknown,
): Record<string, never> {
  return emptyRequest(value, 'admin_revenue_summary_request');
}

export function parseAdminRevenueTransactionsRequest(
  value: unknown,
): AdminRevenueTransactionsRequestPayload {
  const boundary = 'admin_revenue_transactions_request';
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
    || source.p_limit > 200
  ) {
    reject(boundary, 'transaction_limit_invalid');
  }
  return { p_limit: source.p_limit };
}

export function parseAdminCatalogAdoptionRequest(
  value: unknown,
): AdminCatalogAdoptionRequestPayload {
  const boundary = 'admin_catalog_adoption_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_days'],
  );
  if (
    source.p_days !== 7
    && source.p_days !== 30
    && source.p_days !== 90
  ) {
    reject(boundary, 'catalog_window_invalid');
  }
  return { p_days: source.p_days };
}

export function parseAdminPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: AdminErrorBoundary,
): AdminErrorEnvelopePayload {
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
  return { message, code };
}
