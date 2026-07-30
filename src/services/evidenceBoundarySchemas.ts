import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type EvidenceRequestBoundary =
  | 'evidence_files_request'
  | 'evidence_maintenance_request'
  | 'dispute_open_request'
  | 'dispute_resolve_request'
  | 'dispute_financial_request';

export type EvidenceErrorBoundary =
  | 'evidence_files_error'
  | 'evidence_maintenance_error'
  | 'evidence_storage_error'
  | 'evidence_list_error'
  | 'dispute_open_error'
  | 'dispute_queue_error'
  | 'dispute_resolve_error';

export type EvidenceBoundary = EvidenceRequestBoundary | EvidenceErrorBoundary;

type EvidenceUploadType =
  | 'seller_packing_video'
  | 'seller_item_photo'
  | 'seller_serial_number'
  | 'seller_package_weight'
  | 'buyer_unboxing_video'
  | 'buyer_received_photo'
  | 'buyer_damage_photo'
  | 'other';

type EvidenceUploadMimeType =
  | 'image/webp'
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime';

export type EvidenceFilesRequestPayload =
  | {
      action: 'request-upload';
      dealId: string;
      uploaderRole: 'seller' | 'buyer';
      evidenceType: EvidenceUploadType;
      fileName: string;
      claimedMimeType: EvidenceUploadMimeType;
      fileSize: number;
    }
  | { action: 'finalize-upload'; intakeId: string }
  | { action: 'signed-url'; evidenceId: string };

export type EvidenceMaintenanceRequestPayload =
  | { action: 'snapshot' }
  | { action: 'refresh-inventory' }
  | { action: 'approve-deletion'; evidenceId: string; reason: string }
  | { action: 'place-legal-hold'; evidenceId: string; reason: string }
  | {
      action: 'release-legal-hold';
      evidenceId: string;
      holdKey: string;
      reason: string;
    }
  | { action: 'acknowledge-alert'; alertId: string };

export interface OpenDisputeRequestPayload {
  p_deal_id: string;
  p_reason: string;
}

export interface ResolveDisputeRequestPayload {
  p_dispute_id: string;
  p_decision: 'resolved_buyer' | 'resolved_seller' | 'cancelled';
  p_resolution_note: string;
}

export interface FinancialDisputeRequestPayload {
  disputeId: string;
  decision: 'resolved_buyer' | 'resolved_seller';
  note: string;
}

export interface EvidenceErrorEnvelopePayload {
  message: string;
  code: string | null;
}

const imageEvidenceTypes = new Set([
  'seller_item_photo',
  'seller_serial_number',
  'seller_package_weight',
  'buyer_received_photo',
  'buyer_damage_photo',
]);
const videoEvidenceTypes = new Set([
  'seller_packing_video',
  'buyer_unboxing_video',
]);
const sellerEvidenceTypes = new Set([
  'seller_packing_video',
  'seller_item_photo',
  'seller_serial_number',
  'seller_package_weight',
]);
const buyerEvidenceTypes = new Set([
  'buyer_unboxing_video',
  'buyer_received_photo',
  'buyer_damage_photo',
  'other',
]);
const imageMimeTypes = new Set(['image/webp']);
const videoMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const safeMessages: Partial<Record<string, string>> = {
  evidence_id_invalid: 'The selected evidence record is invalid. Refresh and try again.',
  intake_id_invalid: 'The secure upload record is invalid. Start the upload again.',
  alert_id_invalid: 'The selected lifecycle alert is invalid. Refresh and try again.',
  hold_key_invalid: 'The selected legal hold is invalid. Refresh and try again.',
  deal_id_invalid: 'The selected deal is invalid. Refresh and try again.',
  dispute_id_invalid: 'The selected dispute is invalid. Refresh and try again.',
  evidence_reason_invalid: 'Provide a reason containing 10 to 1,000 characters.',
  dispute_reason_invalid: 'Describe the problem using 10 to 2,000 characters.',
  resolution_note_invalid: 'Resolution note must contain 3 to 1,000 characters.',
  file_name_invalid: 'Rename this file using a short, ordinary file name.',
  file_size_invalid: 'This file is empty or its size could not be verified.',
  file_type_invalid: 'Choose a supported photo or video.',
  evidence_type_invalid: 'Choose an evidence type available to your role.',
};

export class EvidenceBoundaryValidationError extends Error {
  readonly boundary: EvidenceBoundary;
  readonly issue: string;

  constructor(boundary: EvidenceBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The evidence or dispute request could not be processed safely. Please try again.',
    );
    this.name = 'EvidenceBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: EvidenceBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.evidence.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new EvidenceBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: EvidenceBoundary,
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
  boundary: EvidenceBoundary,
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

function trimmedString(
  value: unknown,
  boundary: EvidenceBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  const result = boundedString(value, boundary, issue, minimum, maximum).trim();
  if (result.length < minimum || result.length > maximum) reject(boundary, issue);
  return result;
}

function uuid(
  value: unknown,
  boundary: EvidenceBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function assertStatus(status: number, boundary: EvidenceErrorBoundary) {
  if (!Number.isSafeInteger(status) || status < 400 || status > 599) {
    reject(boundary, 'status_invalid');
  }
}

function parseErrorCode(
  value: unknown,
  boundary: EvidenceErrorBoundary,
): string | null {
  if (value === null || value === undefined) return null;
  const code = boundedString(value, boundary, 'error_code_invalid', 1, 64);
  if (!/^[a-z0-9_.-]+$/i.test(code)) reject(boundary, 'error_code_invalid');
  return code;
}

export function parseEvidenceFilesRequest(
  value: unknown,
): EvidenceFilesRequestPayload {
  const boundary = 'evidence_files_request';
  const actionSource = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['action'],
    [
      'dealId',
      'uploaderRole',
      'evidenceType',
      'fileName',
      'claimedMimeType',
      'fileSize',
      'intakeId',
      'evidenceId',
    ],
  );
  if (actionSource.action === 'finalize-upload') {
    const source = exactRecord(
      value,
      boundary,
      'request_shape_invalid',
      ['action', 'intakeId'],
    );
    return {
      action: 'finalize-upload',
      intakeId: uuid(source.intakeId, boundary, 'intake_id_invalid'),
    };
  }
  if (actionSource.action === 'signed-url') {
    const source = exactRecord(
      value,
      boundary,
      'request_shape_invalid',
      ['action', 'evidenceId'],
    );
    return {
      action: 'signed-url',
      evidenceId: uuid(source.evidenceId, boundary, 'evidence_id_invalid'),
    };
  }
  if (actionSource.action !== 'request-upload') {
    reject(boundary, 'request_shape_invalid');
  }
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    [
      'action',
      'dealId',
      'uploaderRole',
      'evidenceType',
      'fileName',
      'claimedMimeType',
      'fileSize',
    ],
  );
  if (source.uploaderRole !== 'seller' && source.uploaderRole !== 'buyer') {
    reject(boundary, 'evidence_type_invalid');
  }
  if (typeof source.evidenceType !== 'string') {
    reject(boundary, 'evidence_type_invalid');
  }
  const allowedEvidence = source.uploaderRole === 'seller'
    ? sellerEvidenceTypes
    : buyerEvidenceTypes;
  if (!allowedEvidence.has(source.evidenceType)) {
    reject(boundary, 'evidence_type_invalid');
  }
  if (
    typeof source.claimedMimeType !== 'string'
    || (
      !imageMimeTypes.has(source.claimedMimeType)
      && !videoMimeTypes.has(source.claimedMimeType)
    )
  ) {
    reject(boundary, 'file_type_invalid');
  }
  const requiresImage = imageEvidenceTypes.has(source.evidenceType);
  const requiresVideo = videoEvidenceTypes.has(source.evidenceType);
  if (
    (requiresImage && !imageMimeTypes.has(source.claimedMimeType))
    || (requiresVideo && !videoMimeTypes.has(source.claimedMimeType))
  ) {
    reject(boundary, 'file_type_invalid');
  }
  if (
    typeof source.fileSize !== 'number'
    || !Number.isSafeInteger(source.fileSize)
    || source.fileSize < 1
    || source.fileSize > (
      imageMimeTypes.has(source.claimedMimeType)
        ? 10 * 1024 * 1024
        : 50 * 1024 * 1024
    )
  ) {
    reject(boundary, 'file_size_invalid');
  }
  const fileName = trimmedString(
    source.fileName,
    boundary,
    'file_name_invalid',
    1,
    160,
  );
  if (/[/\\]/u.test(fileName)) reject(boundary, 'file_name_invalid');
  return {
    action: 'request-upload',
    dealId: uuid(source.dealId, boundary, 'deal_id_invalid'),
    uploaderRole: source.uploaderRole,
    evidenceType: source.evidenceType as EvidenceUploadType,
    fileName,
    claimedMimeType: source.claimedMimeType as EvidenceUploadMimeType,
    fileSize: source.fileSize,
  };
}

export function parseEvidenceMaintenanceRequest(
  value: unknown,
): EvidenceMaintenanceRequestPayload {
  const boundary = 'evidence_maintenance_request';
  const actionSource = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['action'],
    ['evidenceId', 'reason', 'holdKey', 'alertId'],
  );
  if (
    actionSource.action === 'snapshot'
    || actionSource.action === 'refresh-inventory'
  ) {
    exactRecord(value, boundary, 'request_shape_invalid', ['action']);
    return { action: actionSource.action };
  }
  if (actionSource.action === 'acknowledge-alert') {
    const source = exactRecord(
      value,
      boundary,
      'request_shape_invalid',
      ['action', 'alertId'],
    );
    return {
      action: 'acknowledge-alert',
      alertId: uuid(source.alertId, boundary, 'alert_id_invalid'),
    };
  }
  if (
    actionSource.action !== 'approve-deletion'
    && actionSource.action !== 'place-legal-hold'
    && actionSource.action !== 'release-legal-hold'
  ) {
    reject(boundary, 'request_shape_invalid');
  }
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    actionSource.action === 'release-legal-hold'
      ? ['action', 'evidenceId', 'holdKey', 'reason']
      : ['action', 'evidenceId', 'reason'],
  );
  const evidenceId = uuid(source.evidenceId, boundary, 'evidence_id_invalid');
  const reason = trimmedString(
    source.reason,
    boundary,
    'evidence_reason_invalid',
    10,
    1_000,
  );
  if (actionSource.action === 'release-legal-hold') {
    return {
      action: 'release-legal-hold',
      evidenceId,
      holdKey: uuid(source.holdKey, boundary, 'hold_key_invalid'),
      reason,
    };
  }
  return { action: actionSource.action, evidenceId, reason };
}

export function parseOpenDisputeRequest(
  value: unknown,
): OpenDisputeRequestPayload {
  const boundary = 'dispute_open_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_deal_id', 'p_reason'],
  );
  return {
    p_deal_id: uuid(source.p_deal_id, boundary, 'deal_id_invalid'),
    p_reason: trimmedString(
      source.p_reason,
      boundary,
      'dispute_reason_invalid',
      10,
      2_000,
    ),
  };
}

export function parseResolveDisputeRequest(
  value: unknown,
): ResolveDisputeRequestPayload {
  const boundary = 'dispute_resolve_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['p_dispute_id', 'p_decision', 'p_resolution_note'],
  );
  if (
    source.p_decision !== 'resolved_buyer'
    && source.p_decision !== 'resolved_seller'
    && source.p_decision !== 'cancelled'
  ) {
    reject(boundary, 'decision_invalid');
  }
  return {
    p_dispute_id: uuid(source.p_dispute_id, boundary, 'dispute_id_invalid'),
    p_decision: source.p_decision,
    p_resolution_note: trimmedString(
      source.p_resolution_note,
      boundary,
      'resolution_note_invalid',
      3,
      1_000,
    ),
  };
}

export function parseFinancialDisputeRequest(
  value: unknown,
): FinancialDisputeRequestPayload {
  const boundary = 'dispute_financial_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['disputeId', 'decision', 'note'],
  );
  if (
    source.decision !== 'resolved_buyer'
    && source.decision !== 'resolved_seller'
  ) {
    reject(boundary, 'decision_invalid');
  }
  return {
    disputeId: uuid(source.disputeId, boundary, 'dispute_id_invalid'),
    decision: source.decision,
    note: trimmedString(
      source.note,
      boundary,
      'resolution_note_invalid',
      3,
      1_000,
    ),
  };
}

export function parseEvidenceEdgeErrorEnvelope(
  value: unknown,
  status: number,
  boundary: Extract<
    EvidenceErrorBoundary,
    'evidence_files_error' | 'evidence_maintenance_error'
  >,
): EvidenceErrorEnvelopePayload {
  assertStatus(status, boundary);
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    ['error'],
    ['code'],
  );
  const message = trimmedString(
    source.error,
    boundary,
    'error_message_invalid',
    1,
    512,
  );
  return {
    message,
    code: parseErrorCode(source.code, boundary),
  };
}

export function parsePostgrestErrorEnvelope(
  value: unknown,
  status: number,
  boundary: Extract<
    EvidenceErrorBoundary,
    | 'evidence_list_error'
    | 'dispute_open_error'
    | 'dispute_queue_error'
    | 'dispute_resolve_error'
  >,
): EvidenceErrorEnvelopePayload {
  assertStatus(status, boundary);
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    ['message'],
    ['code', 'details', 'hint'],
  );
  const message = trimmedString(
    source.message,
    boundary,
    'error_message_invalid',
    1,
    512,
  );
  for (const key of ['details', 'hint'] as const) {
    if (
      key in source
      && source[key] !== null
      && typeof source[key] !== 'undefined'
    ) {
      boundedString(source[key], boundary, `${key}_invalid`, 0, 2_000);
    }
  }
  return {
    message,
    code: parseErrorCode(source.code, boundary),
  };
}

export function parseStorageErrorEnvelope(
  value: unknown,
  status: number,
): EvidenceErrorEnvelopePayload {
  const boundary = 'evidence_storage_error';
  assertStatus(status, boundary);
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    [],
    ['statusCode', 'error', 'message', 'code'],
  );
  if (!('message' in source) && !('error' in source)) {
    reject(boundary, 'error_shape_invalid');
  }
  if ('statusCode' in source) {
    const statusCode = source.statusCode;
    const parsedStatus = typeof statusCode === 'number'
      ? statusCode
      : typeof statusCode === 'string' && /^\d{3}$/.test(statusCode)
        ? Number(statusCode)
        : Number.NaN;
    if (!Number.isSafeInteger(parsedStatus) || parsedStatus !== status) {
      reject(boundary, 'status_code_invalid');
    }
  }
  const messageSource = 'message' in source ? source.message : source.error;
  const message = trimmedString(
    messageSource,
    boundary,
    'error_message_invalid',
    1,
    512,
  );
  if ('error' in source && source.error !== messageSource) {
    boundedString(source.error, boundary, 'error_name_invalid', 1, 128);
  }
  return {
    message,
    code: parseErrorCode(source.code, boundary),
  };
}
