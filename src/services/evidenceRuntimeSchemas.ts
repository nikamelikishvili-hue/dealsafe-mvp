import type { CurrencyCode } from '../currency';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';
import type { EvidenceUploadType } from '../../supabase/functions/_shared/evidence-policy';
import type { ProtectedPaymentStatePayload } from './paymentRuntimeSchemas';

type JsonRecord = Record<string, unknown>;

export type EvidenceResponseBoundary =
  | 'evidence_upload_intake'
  | 'evidence_finalize'
  | 'evidence_list'
  | 'evidence_signed_viewer'
  | 'evidence_lifecycle_snapshot'
  | 'evidence_lifecycle_inventory'
  | 'evidence_deletion_approval'
  | 'evidence_legal_hold'
  | 'evidence_alert_acknowledgement'
  | 'admin_dispute_list';

export type EvidenceRecordTypePayload =
  | EvidenceUploadType
  | 'carrier_pickup_scan'
  | 'carrier_delivery_scan'
  | 'carrier_delivery_photo'
  | 'carrier_weight'
  | 'chat_export';

export type EvidenceIntegrityStatusPayload =
  | 'unverified'
  | 'verified'
  | 'missing'
  | 'mismatch'
  | 'invalid'
  | 'deleted';

export type EvidenceLifecycleStatusPayload =
  | 'retained'
  | 'deletion_review'
  | 'deletion_approved'
  | 'deletion_processing'
  | 'deleted';

export interface DealEvidencePayload {
  id: string;
  deal_id: string;
  dispute_id: string | null;
  uploader_role: 'seller' | 'buyer' | 'admin';
  evidence_type: EvidenceRecordTypePayload;
  file_name: string | null;
  mime_type: string | null;
  detected_mime_type: string | null;
  file_size_bytes: number | null;
  sha256: string | null;
  scan_status: 'clean' | 'legacy_unscanned' | 'deleted';
  scanned_at: string | null;
  integrity_status: EvidenceIntegrityStatusPayload;
  integrity_checked_at: string | null;
  retention_class: 'routine_evidence' | 'dispute_evidence';
  retention_until: string | null;
  lifecycle_status: EvidenceLifecycleStatusPayload;
  deleted_at: string | null;
  created_at: string;
}

export interface EvidenceUploadIntakePayload {
  intakeId: string;
  path: string;
  bucket: 'deal-evidence-quarantine';
  expiresAt: string;
}

export interface EvidenceSignedViewerPayload {
  url: string;
  expiresAt: string;
  mimeType: 'image/webp' | 'video/mp4' | 'video/webm' | 'video/quicktime';
  fileName: string | null;
  fileSizeBytes: number;
  sha256: string;
  scanStatus: 'clean';
  scannedAt: string;
  integrityStatus: 'verified';
  integrityCheckedAt: string;
}

export interface EvidenceLifecycleJobPayload {
  jobId: string;
  jobType: 'integrity_check' | 'quarantine_cleanup' | 'evidence_delete';
  status: 'pending' | 'pending_review' | 'approved' | 'processing' | 'blocked' | 'failed';
  evidenceId: string | null;
  publicId: string | null;
  title: string | null;
  retentionClass: 'routine_evidence' | 'dispute_evidence' | null;
  retentionUntil: string | null;
  lifecycleStatus: EvidenceLifecycleStatusPayload | null;
  reasonCode: string;
  attempts: number;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  activeHold: boolean;
  holdKey: string | null;
}

export interface EvidenceLifecycleAlertPayload {
  alertId: string;
  alertType:
    | 'deletion_review_required'
    | 'integrity_failure'
    | 'maintenance_failure'
    | 'legal_hold_block';
  severity: 'info' | 'warning' | 'critical';
  ownerRole: 'admin' | 'compliance';
  status: 'open' | 'acknowledged';
  summary: string;
  evidenceId: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface EvidenceLifecycleSnapshotPayload {
  generatedAt: string;
  counts: {
    openAlerts: number;
    integrityQueued: number;
    quarantineQueued: number;
    deletionReviews: number;
    activeLegalHolds: number;
  };
  jobs: EvidenceLifecycleJobPayload[];
  alerts: EvidenceLifecycleAlertPayload[];
}

export interface EvidenceInventoryPayload {
  expiredIntakes: number;
  queuedQuarantineCleanup: number;
  queuedIntegrityChecks: number;
  classifiedEvidence: number;
  queuedDeletionReviews: number;
  refreshedAt: string;
}

export interface AdminDisputePayload {
  dispute_id: string;
  deal_id: string;
  public_id: string;
  title: string;
  reason: string;
  dispute_status:
    | 'open'
    | 'evidence_requested'
    | 'under_review'
    | 'resolved_buyer'
    | 'resolved_seller'
    | 'refunded'
    | 'cancelled';
  response_deadline: string;
  opened_at: string;
  opened_by_name: string;
  seller_name: string;
  buyer_name: string;
  payment_status: ProtectedPaymentStatePayload;
  item_amount_cents: number;
  currency: CurrencyCode;
  resolution_note: string | null;
}

export class EvidenceResponseValidationError extends Error {
  readonly boundary: EvidenceResponseBoundary;
  readonly issue: string;

  constructor(boundary: EvidenceResponseBoundary, issue: string) {
    super('The protected evidence service returned an invalid response. Please try again later.');
    this.name = 'EvidenceResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const safeCodePattern = /^[a-z0-9_]{1,80}$/;
const publicIdPattern = /^[A-Z0-9]{6,32}$/;
const maximumEvidenceBytes = 50 * 1024 * 1024;
const maximumAmountCents = 100_000_000_000;
const maximumCollectionSize = 500;
export const evidenceCurrencyCodes = [
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
const currencies = new Set<CurrencyCode>(evidenceCurrencyCodes);
const evidenceRecordTypes = new Set<EvidenceRecordTypePayload>([
  'seller_packing_video',
  'seller_item_photo',
  'seller_serial_number',
  'seller_package_weight',
  'carrier_pickup_scan',
  'carrier_delivery_scan',
  'carrier_delivery_photo',
  'carrier_weight',
  'buyer_unboxing_video',
  'buyer_received_photo',
  'buyer_damage_photo',
  'chat_export',
  'other',
]);
const canonicalMimeTypes = new Set<EvidenceSignedViewerPayload['mimeType']>([
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
const recordMimeTypes = new Set([
  ...canonicalMimeTypes,
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);
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
const openDisputeStatuses = new Set([
  'open',
  'evidence_requested',
  'under_review',
]);

function reject(boundary: EvidenceResponseBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.evidence.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new EvidenceResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function records(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
  maximum = maximumCollectionSize,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) reject(boundary, issue);
  return value;
}

function boundedString(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function nullableString(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
  maximum: number,
  minimum = 0,
): string | null {
  if (value === null) return null;
  return boundedString(value, boundary, issue, minimum, maximum);
}

function boolean(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function integer(
  value: unknown,
  boundary: EvidenceResponseBoundary,
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

function uuid(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (!uuidPattern.test(result)) reject(boundary, issue);
  return result.toLowerCase();
}

function nullableUuid(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  return uuid(value, boundary, issue);
}

function timestamp(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 20, 40);
  if (!Number.isFinite(Date.parse(result))) reject(boundary, issue);
  return result;
}

function nullableTimestamp(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  return timestamp(value, boundary, issue);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  boundary: EvidenceResponseBoundary,
  issue: string,
): T {
  const result = boundedString(value, boundary, issue, 1, 80) as T;
  if (!allowed.has(result)) reject(boundary, issue);
  return result;
}

function publicId(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 6, 32);
  if (!publicIdPattern.test(result)) reject(boundary, issue);
  return result;
}

function sha256(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 64, 64);
  if (!sha256Pattern.test(result)) reject(boundary, issue);
  return result;
}

function nullableSha256(
  value: unknown,
  boundary: EvidenceResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  return sha256(value, boundary, issue);
}

function parseDealEvidence(
  value: unknown,
  boundary: 'evidence_finalize' | 'evidence_list',
  expectedDealId?: string,
  expectedUploaderRole?: 'seller' | 'buyer',
): DealEvidencePayload {
  const source = record(value, boundary, 'evidence_not_object');
  const id = uuid(source.id, boundary, 'evidence_id_invalid');
  const dealId = uuid(source.deal_id, boundary, 'deal_id_invalid');
  if (expectedDealId && dealId !== expectedDealId.toLowerCase()) {
    reject(boundary, 'deal_id_mismatch');
  }
  const uploaderRole = enumValue(
    source.uploader_role,
    new Set(['seller', 'buyer', 'admin'] as const),
    boundary,
    'uploader_role_invalid',
  );
  if (expectedUploaderRole && uploaderRole !== expectedUploaderRole) {
    reject(boundary, 'uploader_role_mismatch');
  }
  const evidenceType = enumValue(
    source.evidence_type,
    evidenceRecordTypes,
    boundary,
    'evidence_type_invalid',
  );
  const fileName = nullableString(source.file_name, boundary, 'file_name_invalid', 160, 1);
  if (fileName !== null && /[/\\]/u.test(fileName)) reject(boundary, 'file_name_invalid');
  const mimeType = nullableString(source.mime_type, boundary, 'mime_type_invalid', 80, 1);
  if (mimeType !== null && !recordMimeTypes.has(mimeType)) {
    reject(boundary, 'mime_type_invalid');
  }
  const detectedMimeType = nullableString(
    source.detected_mime_type,
    boundary,
    'detected_mime_type_invalid',
    80,
    1,
  );
  if (
    detectedMimeType !== null
    && !canonicalMimeTypes.has(detectedMimeType as EvidenceSignedViewerPayload['mimeType'])
  ) {
    reject(boundary, 'detected_mime_type_invalid');
  }
  const fileSizeBytes = source.file_size_bytes === null
    ? null
    : integer(
      source.file_size_bytes,
      boundary,
      'file_size_invalid',
      1,
      maximumEvidenceBytes,
    );
  const digest = nullableSha256(source.sha256, boundary, 'sha256_invalid');
  const scanStatus = enumValue(
    source.scan_status,
    new Set(['clean', 'legacy_unscanned', 'deleted'] as const),
    boundary,
    'scan_status_invalid',
  );
  const scannedAt = nullableTimestamp(source.scanned_at, boundary, 'scanned_at_invalid');
  const integrityStatus = enumValue(
    source.integrity_status,
    new Set([
      'unverified',
      'verified',
      'missing',
      'mismatch',
      'invalid',
      'deleted',
    ] as const),
    boundary,
    'integrity_status_invalid',
  );
  const integrityCheckedAt = nullableTimestamp(
    source.integrity_checked_at,
    boundary,
    'integrity_checked_at_invalid',
  );
  const retentionClass = enumValue(
    source.retention_class,
    new Set(['routine_evidence', 'dispute_evidence'] as const),
    boundary,
    'retention_class_invalid',
  );
  const retentionUntil = nullableTimestamp(
    source.retention_until,
    boundary,
    'retention_until_invalid',
  );
  const lifecycleStatus = enumValue(
    source.lifecycle_status,
    new Set([
      'retained',
      'deletion_review',
      'deletion_approved',
      'deletion_processing',
      'deleted',
    ] as const),
    boundary,
    'lifecycle_status_invalid',
  );
  const deletedAt = nullableTimestamp(source.deleted_at, boundary, 'deleted_at_invalid');
  const createdAt = timestamp(source.created_at, boundary, 'created_at_invalid');

  if (
    scanStatus === 'clean'
    && (
      detectedMimeType === null
      || fileSizeBytes === null
      || digest === null
      || scannedAt === null
    )
  ) {
    reject(boundary, 'clean_scan_contract_invalid');
  }
  if (
    (integrityStatus === 'unverified' && integrityCheckedAt !== null)
    || (integrityStatus !== 'unverified' && integrityCheckedAt === null)
  ) {
    reject(boundary, 'integrity_timestamp_contract_invalid');
  }
  if (
    integrityStatus === 'verified'
    && (
      scanStatus !== 'clean'
      || detectedMimeType === null
      || fileSizeBytes === null
      || digest === null
    )
  ) {
    reject(boundary, 'verified_integrity_contract_invalid');
  }
  if (
    lifecycleStatus === 'deleted'
    && (
      deletedAt === null
      || scanStatus !== 'deleted'
      || integrityStatus !== 'deleted'
      || fileName !== null
      || mimeType !== null
      || detectedMimeType !== null
      || fileSizeBytes !== null
      || digest !== null
      || scannedAt !== null
    )
  ) {
    reject(boundary, 'deleted_evidence_contract_invalid');
  }
  if (
    lifecycleStatus !== 'deleted'
    && (deletedAt !== null || scanStatus === 'deleted' || integrityStatus === 'deleted')
  ) {
    reject(boundary, 'active_evidence_contract_invalid');
  }
  if (
    integrityCheckedAt !== null
    && scannedAt !== null
    && Date.parse(integrityCheckedAt) < Date.parse(scannedAt)
  ) {
    reject(boundary, 'integrity_timestamp_order_invalid');
  }
  if (retentionUntil !== null && Date.parse(retentionUntil) < Date.parse(createdAt)) {
    reject(boundary, 'retention_timestamp_order_invalid');
  }

  return {
    id,
    deal_id: dealId,
    dispute_id: nullableUuid(source.dispute_id, boundary, 'dispute_id_invalid'),
    uploader_role: uploaderRole,
    evidence_type: evidenceType,
    file_name: fileName,
    mime_type: mimeType,
    detected_mime_type: detectedMimeType,
    file_size_bytes: fileSizeBytes,
    sha256: digest,
    scan_status: scanStatus,
    scanned_at: scannedAt,
    integrity_status: integrityStatus,
    integrity_checked_at: integrityCheckedAt,
    retention_class: retentionClass,
    retention_until: retentionUntil,
    lifecycle_status: lifecycleStatus,
    deleted_at: deletedAt,
    created_at: createdAt,
  };
}

export function parseEvidenceUploadIntakeResponse(
  value: unknown,
  expectedUserId: string,
  expectedDealId: string,
): EvidenceUploadIntakePayload {
  const boundary = 'evidence_upload_intake';
  const source = record(value, boundary, 'intake_not_object');
  const intakeId = uuid(source.intakeId, boundary, 'intake_id_invalid');
  const userId = uuid(expectedUserId, boundary, 'expected_user_id_invalid');
  const dealId = uuid(expectedDealId, boundary, 'expected_deal_id_invalid');
  const path = boundedString(source.path, boundary, 'path_invalid', 110, 160);
  const pathPattern = new RegExp(
    `^${userId}/${dealId}/${intakeId}\\.(webp|mp4|webm|mov)$`,
  );
  if (!pathPattern.test(path)) reject(boundary, 'path_invalid');
  if (source.bucket !== 'deal-evidence-quarantine') {
    reject(boundary, 'bucket_invalid');
  }
  const expiresAt = timestamp(source.expiresAt, boundary, 'expires_at_invalid');
  const expiry = Date.parse(expiresAt);
  if (expiry <= Date.now() || expiry > Date.now() + 20 * 60 * 1_000) {
    reject(boundary, 'expires_at_invalid');
  }
  return {
    intakeId,
    path,
    bucket: 'deal-evidence-quarantine',
    expiresAt,
  };
}

export function parseFinalizeEvidenceResponse(
  value: unknown,
  expectedDealId: string,
  expectedUploaderRole: 'seller' | 'buyer',
): { evidence: DealEvidencePayload } {
  const boundary = 'evidence_finalize';
  const source = record(value, boundary, 'finalize_not_object');
  return {
    evidence: parseDealEvidence(
      source.evidence,
      boundary,
      uuid(expectedDealId, boundary, 'expected_deal_id_invalid'),
      expectedUploaderRole,
    ),
  };
}

export function parseDealEvidenceRows(
  value: unknown,
  expectedDealId: string,
): DealEvidencePayload[] {
  const boundary = 'evidence_list';
  const dealId = uuid(expectedDealId, boundary, 'expected_deal_id_invalid');
  const seen = new Set<string>();
  return records(value, boundary, 'rows_invalid').map(row => {
    const evidence = parseDealEvidence(row, boundary, dealId);
    if (seen.has(evidence.id)) reject(boundary, 'duplicate_evidence_id');
    seen.add(evidence.id);
    return evidence;
  });
}

export function parseEvidenceSignedViewerResponse(
  value: unknown,
  expectedStorageOrigin: string,
): EvidenceSignedViewerPayload {
  const boundary = 'evidence_signed_viewer';
  const source = record(value, boundary, 'viewer_not_object');
  const expiresAt = timestamp(source.expiresAt, boundary, 'expires_at_invalid');
  const expiry = Date.parse(expiresAt);
  if (expiry <= Date.now() || expiry > Date.now() + 2 * 60 * 1_000) {
    reject(boundary, 'expires_at_invalid');
  }
  const mimeType = enumValue(
    source.mimeType,
    canonicalMimeTypes,
    boundary,
    'mime_type_invalid',
  );
  const fileName = nullableString(source.fileName, boundary, 'file_name_invalid', 160, 1);
  if (fileName !== null && /[/\\]/u.test(fileName)) reject(boundary, 'file_name_invalid');
  const scannedAt = timestamp(source.scannedAt, boundary, 'scanned_at_invalid');
  const integrityCheckedAt = timestamp(
    source.integrityCheckedAt,
    boundary,
    'integrity_checked_at_invalid',
  );
  if (Date.parse(integrityCheckedAt) < Date.parse(scannedAt)) {
    reject(boundary, 'integrity_timestamp_order_invalid');
  }
  if (source.scanStatus !== 'clean') reject(boundary, 'scan_status_invalid');
  if (source.integrityStatus !== 'verified') {
    reject(boundary, 'integrity_status_invalid');
  }
  const urlValue = boundedString(source.url, boundary, 'signed_url_invalid', 30, 4_096);
  let signedUrl: URL;
  let origin: URL;
  try {
    signedUrl = new URL(urlValue);
    origin = new URL(expectedStorageOrigin);
  } catch {
    reject(boundary, 'signed_url_invalid');
  }
  if (
    signedUrl.protocol !== 'https:'
    || origin.protocol !== 'https:'
    || signedUrl.origin !== origin.origin
    || signedUrl.username
    || signedUrl.password
    || signedUrl.hash
    || !signedUrl.pathname.startsWith('/storage/v1/object/sign/deal-evidence/')
  ) {
    reject(boundary, 'signed_url_invalid');
  }
  return {
    url: signedUrl.toString(),
    expiresAt,
    mimeType,
    fileName,
    fileSizeBytes: integer(
      source.fileSizeBytes,
      boundary,
      'file_size_invalid',
      1,
      maximumEvidenceBytes,
    ),
    sha256: sha256(source.sha256, boundary, 'sha256_invalid'),
    scanStatus: 'clean',
    scannedAt,
    integrityStatus: 'verified',
    integrityCheckedAt,
  };
}

function parseLifecycleJob(value: unknown): EvidenceLifecycleJobPayload {
  const boundary = 'evidence_lifecycle_snapshot';
  const source = record(value, boundary, 'job_not_object');
  const jobType = enumValue(
    source.jobType,
    new Set(['integrity_check', 'quarantine_cleanup', 'evidence_delete'] as const),
    boundary,
    'job_type_invalid',
  );
  const status = enumValue(
    source.status,
    new Set([
      'pending',
      'pending_review',
      'approved',
      'processing',
      'blocked',
      'failed',
    ] as const),
    boundary,
    'job_status_invalid',
  );
  const evidenceId = nullableUuid(source.evidenceId, boundary, 'evidence_id_invalid');
  const activeHold = boolean(source.activeHold, boundary, 'active_hold_invalid');
  const holdKey = nullableUuid(source.holdKey, boundary, 'hold_key_invalid');
  if (
    (jobType === 'quarantine_cleanup' && (evidenceId !== null || activeHold || holdKey !== null))
    || (jobType !== 'quarantine_cleanup' && evidenceId === null)
    || (activeHold !== (holdKey !== null))
  ) {
    reject(boundary, 'job_reference_contract_invalid');
  }
  const createdAt = timestamp(source.createdAt, boundary, 'job_created_at_invalid');
  const updatedAt = timestamp(source.updatedAt, boundary, 'job_updated_at_invalid');
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    reject(boundary, 'job_timestamp_order_invalid');
  }
  const reasonCode = boundedString(
    source.reasonCode,
    boundary,
    'reason_code_invalid',
    1,
    80,
  );
  if (!safeCodePattern.test(reasonCode)) reject(boundary, 'reason_code_invalid');
  const lastErrorCode = nullableString(
    source.lastErrorCode,
    boundary,
    'last_error_code_invalid',
    80,
    1,
  );
  if (lastErrorCode !== null && !safeCodePattern.test(lastErrorCode)) {
    reject(boundary, 'last_error_code_invalid');
  }
  const publicIdValue = source.publicId === null
    ? null
    : publicId(source.publicId, boundary, 'public_id_invalid');
  const retentionClass = source.retentionClass === null
    ? null
    : enumValue(
      source.retentionClass,
      new Set(['routine_evidence', 'dispute_evidence'] as const),
      boundary,
      'retention_class_invalid',
    );
  const lifecycleStatus = source.lifecycleStatus === null
    ? null
    : enumValue(
      source.lifecycleStatus,
      new Set([
        'retained',
        'deletion_review',
        'deletion_approved',
        'deletion_processing',
        'deleted',
      ] as const),
      boundary,
      'lifecycle_status_invalid',
    );
  if (
    jobType === 'quarantine_cleanup'
    && (
      publicIdValue !== null
      || source.title !== null
      || retentionClass !== null
      || source.retentionUntil !== null
      || lifecycleStatus !== null
    )
  ) {
    reject(boundary, 'quarantine_job_metadata_invalid');
  }
  return {
    jobId: uuid(source.jobId, boundary, 'job_id_invalid'),
    jobType,
    status,
    evidenceId,
    publicId: publicIdValue,
    title: nullableString(source.title, boundary, 'title_invalid', 240, 1),
    retentionClass,
    retentionUntil: nullableTimestamp(
      source.retentionUntil,
      boundary,
      'retention_until_invalid',
    ),
    lifecycleStatus,
    reasonCode,
    attempts: integer(source.attempts, boundary, 'attempts_invalid', 0, 20),
    lastErrorCode,
    createdAt,
    updatedAt,
    activeHold,
    holdKey,
  };
}

function parseLifecycleAlert(value: unknown): EvidenceLifecycleAlertPayload {
  const boundary = 'evidence_lifecycle_snapshot';
  const source = record(value, boundary, 'alert_not_object');
  return {
    alertId: uuid(source.alertId, boundary, 'alert_id_invalid'),
    alertType: enumValue(
      source.alertType,
      new Set([
        'deletion_review_required',
        'integrity_failure',
        'maintenance_failure',
        'legal_hold_block',
      ] as const),
      boundary,
      'alert_type_invalid',
    ),
    severity: enumValue(
      source.severity,
      new Set(['info', 'warning', 'critical'] as const),
      boundary,
      'alert_severity_invalid',
    ),
    ownerRole: enumValue(
      source.ownerRole,
      new Set(['admin', 'compliance'] as const),
      boundary,
      'alert_owner_invalid',
    ),
    status: enumValue(
      source.status,
      new Set(['open', 'acknowledged'] as const),
      boundary,
      'alert_status_invalid',
    ),
    summary: boundedString(source.summary, boundary, 'alert_summary_invalid', 5, 240),
    evidenceId: nullableUuid(source.evidenceId, boundary, 'alert_evidence_id_invalid'),
    jobId: nullableUuid(source.jobId, boundary, 'alert_job_id_invalid'),
    createdAt: timestamp(source.createdAt, boundary, 'alert_created_at_invalid'),
  };
}

export function parseEvidenceLifecycleSnapshotResponse(
  value: unknown,
): EvidenceLifecycleSnapshotPayload {
  const boundary = 'evidence_lifecycle_snapshot';
  const source = record(value, boundary, 'snapshot_not_object');
  const countsSource = record(source.counts, boundary, 'counts_not_object');
  const counts = {
    openAlerts: integer(countsSource.openAlerts, boundary, 'open_alerts_invalid', 0, 1_000_000_000),
    integrityQueued: integer(
      countsSource.integrityQueued,
      boundary,
      'integrity_queued_invalid',
      0,
      1_000_000_000,
    ),
    quarantineQueued: integer(
      countsSource.quarantineQueued,
      boundary,
      'quarantine_queued_invalid',
      0,
      1_000_000_000,
    ),
    deletionReviews: integer(
      countsSource.deletionReviews,
      boundary,
      'deletion_reviews_invalid',
      0,
      1_000_000_000,
    ),
    activeLegalHolds: integer(
      countsSource.activeLegalHolds,
      boundary,
      'active_holds_invalid',
      0,
      1_000_000_000,
    ),
  };
  const jobs = records(source.jobs, boundary, 'jobs_invalid', 100).map(parseLifecycleJob);
  const alerts = records(source.alerts, boundary, 'alerts_invalid', 100).map(
    parseLifecycleAlert,
  );
  if (
    new Set(jobs.map(job => job.jobId)).size !== jobs.length
    || new Set(alerts.map(alert => alert.alertId)).size !== alerts.length
    || counts.openAlerts < alerts.filter(alert => alert.status === 'open').length
    || counts.activeLegalHolds < jobs.filter(job => job.activeHold).length
  ) {
    reject(boundary, 'snapshot_collection_contract_invalid');
  }
  const generatedAt = timestamp(source.generatedAt, boundary, 'generated_at_invalid');
  if (Date.parse(generatedAt) > Date.now() + 5 * 60 * 1_000) {
    reject(boundary, 'generated_at_invalid');
  }
  return { generatedAt, counts, jobs, alerts };
}

export function parseEvidenceInventoryResponse(
  value: unknown,
): { inventory: EvidenceInventoryPayload } {
  const boundary = 'evidence_lifecycle_inventory';
  const source = record(value, boundary, 'inventory_response_not_object');
  const inventory = record(source.inventory, boundary, 'inventory_not_object');
  return {
    inventory: {
      expiredIntakes: integer(
        inventory.expiredIntakes,
        boundary,
        'expired_intakes_invalid',
        0,
        1_000_000_000,
      ),
      queuedQuarantineCleanup: integer(
        inventory.queuedQuarantineCleanup,
        boundary,
        'quarantine_cleanup_invalid',
        0,
        1_000_000_000,
      ),
      queuedIntegrityChecks: integer(
        inventory.queuedIntegrityChecks,
        boundary,
        'integrity_checks_invalid',
        0,
        1_000_000_000,
      ),
      classifiedEvidence: integer(
        inventory.classifiedEvidence,
        boundary,
        'classified_evidence_invalid',
        0,
        1_000_000_000,
      ),
      queuedDeletionReviews: integer(
        inventory.queuedDeletionReviews,
        boundary,
        'deletion_reviews_invalid',
        0,
        1_000_000_000,
      ),
      refreshedAt: timestamp(
        inventory.refreshedAt,
        boundary,
        'refreshed_at_invalid',
      ),
    },
  };
}

export function parseEvidenceJobIdResponse(value: unknown): { jobId: string } {
  const boundary = 'evidence_deletion_approval';
  const source = record(value, boundary, 'approval_not_object');
  return { jobId: uuid(source.jobId, boundary, 'job_id_invalid') };
}

export function parseEvidenceHoldKeyResponse(
  value: unknown,
  expectedHoldKey?: string,
): { holdKey: string } {
  const boundary = 'evidence_legal_hold';
  const source = record(value, boundary, 'hold_not_object');
  const holdKey = uuid(source.holdKey, boundary, 'hold_key_invalid');
  if (
    expectedHoldKey
    && holdKey !== uuid(expectedHoldKey, boundary, 'expected_hold_key_invalid')
  ) {
    reject(boundary, 'hold_key_mismatch');
  }
  return { holdKey };
}

export function parseEvidenceAlertAcknowledgementResponse(
  value: unknown,
): { acknowledged: true } {
  const boundary = 'evidence_alert_acknowledgement';
  const source = record(value, boundary, 'acknowledgement_not_object');
  if (source.acknowledged !== true) reject(boundary, 'acknowledged_invalid');
  return { acknowledged: true };
}

function parseAdminDispute(value: unknown): AdminDisputePayload {
  const boundary = 'admin_dispute_list';
  const source = record(value, boundary, 'dispute_not_object');
  const disputeStatus = enumValue(
    source.dispute_status,
    new Set([
      'open',
      'evidence_requested',
      'under_review',
      'resolved_buyer',
      'resolved_seller',
      'refunded',
      'cancelled',
    ] as const),
    boundary,
    'dispute_status_invalid',
  );
  const openedAt = timestamp(source.opened_at, boundary, 'opened_at_invalid');
  const responseDeadline = timestamp(
    source.response_deadline,
    boundary,
    'response_deadline_invalid',
  );
  if (Date.parse(responseDeadline) < Date.parse(openedAt)) {
    reject(boundary, 'dispute_timestamp_order_invalid');
  }
  const resolutionNote = nullableString(
    source.resolution_note,
    boundary,
    'resolution_note_invalid',
    1_000,
    3,
  );
  if (
    (openDisputeStatuses.has(disputeStatus) && resolutionNote !== null)
    || (!openDisputeStatuses.has(disputeStatus) && resolutionNote === null)
  ) {
    reject(boundary, 'resolution_status_contract_invalid');
  }
  const paymentStatus = enumValue(
    source.payment_status,
    paymentStates,
    boundary,
    'payment_status_invalid',
  );
  const currencyValue = enumValue(
    source.currency,
    currencies,
    boundary,
    'currency_invalid',
  );
  return {
    dispute_id: uuid(source.dispute_id, boundary, 'dispute_id_invalid'),
    deal_id: uuid(source.deal_id, boundary, 'deal_id_invalid'),
    public_id: publicId(source.public_id, boundary, 'public_id_invalid'),
    title: boundedString(source.title, boundary, 'title_invalid', 1, 240),
    reason: boundedString(source.reason, boundary, 'reason_invalid', 3, 1_000),
    dispute_status: disputeStatus,
    response_deadline: responseDeadline,
    opened_at: openedAt,
    opened_by_name: boundedString(
      source.opened_by_name,
      boundary,
      'opened_by_name_invalid',
      1,
      160,
    ),
    seller_name: boundedString(source.seller_name, boundary, 'seller_name_invalid', 1, 160),
    buyer_name: boundedString(source.buyer_name, boundary, 'buyer_name_invalid', 1, 160),
    payment_status: paymentStatus,
    item_amount_cents: integer(
      source.item_amount_cents,
      boundary,
      'item_amount_invalid',
      1,
      maximumAmountCents,
    ),
    currency: currencyValue,
    resolution_note: resolutionNote,
  };
}

export function parseAdminDisputeRows(value: unknown): AdminDisputePayload[] {
  const boundary = 'admin_dispute_list';
  const seen = new Set<string>();
  return records(value, boundary, 'rows_invalid', 200).map(row => {
    const dispute = parseAdminDispute(row);
    if (seen.has(dispute.dispute_id)) reject(boundary, 'duplicate_dispute_id');
    seen.add(dispute.dispute_id);
    return dispute;
  });
}
