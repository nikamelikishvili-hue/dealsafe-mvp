import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type SupportCategory =
  | 'account_access'
  | 'deal_help'
  | 'payment_question'
  | 'delivery_issue'
  | 'safety_concern'
  | 'technical_issue'
  | 'other';

export type SupportRequestBoundary =
  | 'support_case_create_request'
  | 'support_case_list_request'
  | 'support_case_read_request'
  | 'support_case_reply_request'
  | 'support_queue_request'
  | 'support_case_claim_request'
  | 'support_case_resolve_request'
  | 'support_case_error';

export interface CreateSupportCaseRequestPayload {
  p_deal_id: string | null;
  p_category: SupportCategory;
  p_subject: string;
  p_message: string;
}

export interface SupportReferenceRequestPayload {
  p_public_reference: string;
}

export interface ReplySupportCaseRequestPayload
  extends SupportReferenceRequestPayload {
  p_message: string;
}

export interface ResolveSupportCaseRequestPayload
  extends SupportReferenceRequestPayload {
  p_resolution_message: string;
}

export interface SupportQueueRequestPayload {
  p_scope: 'open' | 'mine';
}

export interface SupportErrorEnvelopePayload {
  code: string | null;
}

const categories = new Set<SupportCategory>([
  'account_access',
  'deal_help',
  'payment_question',
  'delivery_issue',
  'safety_concern',
  'technical_issue',
  'other',
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const referencePattern = /^SC-[0-9A-F]{12}$/;
const controlPattern = /[\u0000-\u001f\u007f]/u;

const safeMessages: Partial<Record<string, string>> = {
  category_invalid: 'Choose a valid support category.',
  subject_invalid: 'Subject must contain 5 to 120 characters.',
  message_invalid: 'Message must contain 10 to 2000 characters.',
  reference_invalid: 'Choose a valid support case.',
  queue_scope_invalid: 'Choose a valid support queue.',
  deal_id_invalid: 'The selected deal is unavailable.',
};

export class SupportBoundaryValidationError extends Error {
  readonly boundary: SupportRequestBoundary;
  readonly issue: string;

  constructor(boundary: SupportRequestBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The support request could not be processed safely.',
    );
    this.name = 'SupportBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(
  boundary: SupportRequestBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.support.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new SupportBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: SupportRequestBoundary,
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

function boundedText(
  value: unknown,
  boundary: SupportRequestBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== 'string' || value.length > maximum + 256) {
    reject(boundary, issue);
  }
  const result = value.trim();
  if (
    result.length < minimum
    || result.length > maximum
    || controlPattern.test(result)
  ) {
    reject(boundary, issue);
  }
  return result;
}

function dealId(
  value: unknown,
  boundary: SupportRequestBoundary,
): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    reject(boundary, 'deal_id_invalid');
  }
  return value.toLowerCase();
}

function category(
  value: unknown,
  boundary: SupportRequestBoundary,
): SupportCategory {
  if (
    typeof value !== 'string'
    || !categories.has(value as SupportCategory)
  ) {
    reject(boundary, 'category_invalid');
  }
  return value as SupportCategory;
}

function reference(
  value: unknown,
  boundary: SupportRequestBoundary,
): string {
  if (typeof value !== 'string') reject(boundary, 'reference_invalid');
  const result = value.trim().toUpperCase();
  if (!referencePattern.test(result)) {
    reject(boundary, 'reference_invalid');
  }
  return result;
}

export function parseCreateSupportCaseRequest(
  value: unknown,
): CreateSupportCaseRequestPayload {
  const boundary = 'support_case_create_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_category', 'p_subject', 'p_message'],
  );
  return {
    p_deal_id: dealId(source.p_deal_id, boundary),
    p_category: category(source.p_category, boundary),
    p_subject: boundedText(
      source.p_subject,
      boundary,
      'subject_invalid',
      5,
      120,
    ),
    p_message: boundedText(
      source.p_message,
      boundary,
      'message_invalid',
      10,
      2_000,
    ),
  };
}

export function parseMySupportCasesRequest(value: unknown): Record<string, never> {
  exactRecord(
    value,
    'support_case_list_request',
    'request_shape_invalid',
    [],
  );
  return {};
}

function referenceRequest(
  value: unknown,
  boundary: SupportRequestBoundary,
): SupportReferenceRequestPayload {
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_reference'],
  );
  return {
    p_public_reference: reference(source.p_public_reference, boundary),
  };
}

export function parseSupportCaseReadRequest(
  value: unknown,
): SupportReferenceRequestPayload {
  return referenceRequest(value, 'support_case_read_request');
}

export function parseSupportCaseClaimRequest(
  value: unknown,
): SupportReferenceRequestPayload {
  return referenceRequest(value, 'support_case_claim_request');
}

export function parseReplySupportCaseRequest(
  value: unknown,
): ReplySupportCaseRequestPayload {
  const boundary = 'support_case_reply_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_reference', 'p_message'],
  );
  return {
    p_public_reference: reference(source.p_public_reference, boundary),
    p_message: boundedText(
      source.p_message,
      boundary,
      'message_invalid',
      10,
      2_000,
    ),
  };
}

export function parseResolveSupportCaseRequest(
  value: unknown,
): ResolveSupportCaseRequestPayload {
  const boundary = 'support_case_resolve_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_public_reference', 'p_resolution_message'],
  );
  return {
    p_public_reference: reference(source.p_public_reference, boundary),
    p_resolution_message: boundedText(
      source.p_resolution_message,
      boundary,
      'message_invalid',
      10,
      2_000,
    ),
  };
}

export function parseSupportQueueRequest(
  value: unknown,
): SupportQueueRequestPayload {
  const boundary = 'support_queue_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_scope'],
  );
  if (source.p_scope !== 'open' && source.p_scope !== 'mine') {
    reject(boundary, 'queue_scope_invalid');
  }
  return { p_scope: source.p_scope };
}

export function parseSupportPostgrestErrorEnvelope(
  value: unknown,
  status: number,
): SupportErrorEnvelopePayload {
  const boundary = 'support_case_error';
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
  boundedText(source.message, boundary, 'error_message_invalid', 1, 512);
  for (const key of ['details', 'hint'] as const) {
    if (source[key] !== null && source[key] !== undefined) {
      boundedText(source[key], boundary, `${key}_invalid`, 0, 2_000);
    }
  }
  let code: string | null = null;
  if (source.code !== null && source.code !== undefined) {
    if (
      typeof source.code !== 'string'
      || source.code.length < 1
      || source.code.length > 64
      || !/^[a-z0-9_.-]+$/i.test(source.code)
    ) {
      reject(boundary, 'error_code_invalid');
    }
    code = source.code;
  }
  return { code };
}
