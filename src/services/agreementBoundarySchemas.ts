import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AgreementRequestBoundary =
  | 'seller_declaration_request'
  | 'agreement_document_request'
  | 'agreement_history_request'
  | 'agreement_verification_request'
  | 'deal_link_renewal_request'
  | 'acceptance_protection_request'
  | 'buyer_access_code_request'
  | 'watchlist_read_request'
  | 'watchlist_write_request';

export type AgreementErrorBoundary =
  | 'seller_declaration_error'
  | 'agreement_document_error'
  | 'agreement_history_error'
  | 'agreement_verification_error'
  | 'deal_link_renewal_error'
  | 'acceptance_protection_error'
  | 'buyer_access_code_error'
  | 'watchlist_read_error'
  | 'watchlist_write_error';

export type AgreementBoundary =
  | AgreementRequestBoundary
  | AgreementErrorBoundary;

export interface PublicIdRequestPayload {
  p_public_id: string;
}

export interface AgreementDocumentRequestPayload
  extends PublicIdRequestPayload {
  p_version: number | null;
}

export interface AgreementVerificationRequestPayload
  extends PublicIdRequestPayload {
  p_content_hash: string;
}

export interface DealLinkRenewalRequestPayload {
  p_deal_id: string;
  p_days: 1 | 3 | 7 | 14 | 30;
}

export interface BuyerAccessCodeRequestPayload {
  p_deal_id: string;
  p_enabled: boolean;
}

export interface WatchlistWriteRequestPayload extends PublicIdRequestPayload {
  p_saved: boolean;
}

export interface AgreementErrorEnvelopePayload {
  code: string | null;
}

const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hashPattern = /^[a-f0-9]{64}$/;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const renewalDays = new Set([1, 3, 7, 14, 30]);

const safeMessages: Partial<Record<string, string>> = {
  public_id_invalid: 'Enter a valid Deal Link identifier.',
  content_hash_invalid: 'Enter the complete 64-character agreement hash.',
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  agreement_version_invalid: 'Choose a valid agreement version.',
  renewal_days_invalid: 'Choose an available Deal Link renewal period.',
  enabled_invalid: 'Choose whether buyer access protection is enabled.',
  saved_invalid: 'Choose whether this deal should be saved.',
};

export class AgreementBoundaryValidationError extends Error {
  readonly boundary: AgreementBoundary;
  readonly issue: string;

  constructor(boundary: AgreementBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The agreement request could not be processed safely. Please try again.',
    );
    this.name = 'AgreementBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: AgreementBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.agreement.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AgreementBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: AgreementBoundary,
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
  boundary: AgreementBoundary,
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

function publicId(
  value: unknown,
  boundary: AgreementBoundary,
): string {
  const result = boundedString(
    value,
    boundary,
    'public_id_invalid',
    6,
    40,
  ).trim().toUpperCase();
  if (!publicIdPattern.test(result)) reject(boundary, 'public_id_invalid');
  return result;
}

function uuid(value: unknown, boundary: AgreementBoundary): string {
  const result = boundedString(
    value,
    boundary,
    'deal_id_invalid',
    36,
    36,
  );
  if (!uuidPattern.test(result)) reject(boundary, 'deal_id_invalid');
  return result.toLowerCase();
}

function publicIdRequest(
  value: unknown,
  boundary: Exclude<
    AgreementRequestBoundary,
    | 'agreement_document_request'
    | 'agreement_verification_request'
    | 'deal_link_renewal_request'
    | 'buyer_access_code_request'
    | 'watchlist_write_request'
  >,
): PublicIdRequestPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id'],
  );
  return { p_public_id: publicId(source.p_public_id, boundary) };
}

export function parseSellerDeclarationRequest(
  value: unknown,
): PublicIdRequestPayload {
  return publicIdRequest(value, 'seller_declaration_request');
}

export function parseAgreementDocumentRequest(
  value: unknown,
): AgreementDocumentRequestPayload {
  const boundary = 'agreement_document_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_version'],
  );
  let version: number | null = null;
  if (source.p_version !== null) {
    if (
      typeof source.p_version !== 'number'
      || !Number.isSafeInteger(source.p_version)
      || source.p_version < 1
      || source.p_version > 1_000_000
    ) {
      reject(boundary, 'agreement_version_invalid');
    }
    version = source.p_version;
  }
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_version: version,
  };
}

export function parseAgreementHistoryRequest(
  value: unknown,
): PublicIdRequestPayload {
  return publicIdRequest(value, 'agreement_history_request');
}

export function parseAgreementVerificationRequest(
  value: unknown,
): AgreementVerificationRequestPayload {
  const boundary = 'agreement_verification_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_content_hash'],
  );
  const contentHash = boundedString(
    source.p_content_hash,
    boundary,
    'content_hash_invalid',
    64,
    72,
  ).trim().toLowerCase();
  if (!hashPattern.test(contentHash)) {
    reject(boundary, 'content_hash_invalid');
  }
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_content_hash: contentHash,
  };
}

export function parseDealLinkRenewalRequest(
  value: unknown,
): DealLinkRenewalRequestPayload {
  const boundary = 'deal_link_renewal_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_days'],
  );
  if (
    typeof source.p_days !== 'number'
    || !Number.isSafeInteger(source.p_days)
    || !renewalDays.has(source.p_days)
  ) {
    reject(boundary, 'renewal_days_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_days: source.p_days as DealLinkRenewalRequestPayload['p_days'],
  };
}

export function parseAcceptanceProtectionRequest(
  value: unknown,
): PublicIdRequestPayload {
  return publicIdRequest(value, 'acceptance_protection_request');
}

export function parseBuyerAccessCodeRequest(
  value: unknown,
): BuyerAccessCodeRequestPayload {
  const boundary = 'buyer_access_code_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_enabled'],
  );
  if (typeof source.p_enabled !== 'boolean') {
    reject(boundary, 'enabled_invalid');
  }
  return {
    p_deal_id: uuid(source.p_deal_id, boundary),
    p_enabled: source.p_enabled,
  };
}

export function parseWatchlistReadRequest(
  value: unknown,
): PublicIdRequestPayload {
  return publicIdRequest(value, 'watchlist_read_request');
}

export function parseWatchlistWriteRequest(
  value: unknown,
): WatchlistWriteRequestPayload {
  const boundary = 'watchlist_write_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_id', 'p_saved'],
  );
  if (typeof source.p_saved !== 'boolean') reject(boundary, 'saved_invalid');
  return {
    p_public_id: publicId(source.p_public_id, boundary),
    p_saved: source.p_saved,
  };
}

export function parseAgreementPostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: AgreementErrorBoundary,
): AgreementErrorEnvelopePayload {
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
