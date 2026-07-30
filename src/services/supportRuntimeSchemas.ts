import type { SupportCategory } from './supportBoundarySchemas';
import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type SupportCaseStatus =
  | 'open'
  | 'waiting_customer'
  | 'waiting_support'
  | 'resolved'
  | 'closed';

export type SupportCasePriority = 'normal' | 'urgent';

export interface SupportCaseSummaryPayload {
  public_reference: string;
  deal_public_id: string | null;
  category: SupportCategory;
  subject: string;
  status: SupportCaseStatus;
  priority: SupportCasePriority;
  first_response_due_at: string;
  resolution_due_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportCaseMessagePayload {
  id: string;
  body: string;
  author: 'requester' | 'dealivra_support';
  is_mine: boolean;
  created_at: string;
}

export interface SupportCaseDetailPayload extends SupportCaseSummaryPayload {
  messages: SupportCaseMessagePayload[];
}

export interface SupportQueueItemPayload {
  public_reference: string;
  category: SupportCategory;
  priority: SupportCasePriority;
  status: Exclude<SupportCaseStatus, 'resolved' | 'closed'>;
  assignment_state: 'unassigned' | 'mine' | 'assigned';
  first_response_due_at: string;
  resolution_due_at: string;
  created_at: string;
  updated_at: string;
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
const statuses = new Set<SupportCaseStatus>([
  'open',
  'waiting_customer',
  'waiting_support',
  'resolved',
  'closed',
]);
const priorities = new Set<SupportCasePriority>(['normal', 'urgent']);
const referencePattern = /^SC-[0-9A-F]{12}$/;
const dealPublicIdPattern = /^[A-Z0-9]{8}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const controlPattern = /[\u0000-\u001f\u007f]/u;
const maximumClockSkewMs = 5 * 60_000;

export class SupportResponseValidationError extends Error {
  readonly boundary: 'support_case_create' | 'support_case_list' |
    'support_case_detail' | 'support_queue' | 'support_case_mutation';
  readonly issue: string;

  constructor(
    boundary: SupportResponseValidationError['boundary'],
    issue: string,
  ) {
    super('The support service returned an invalid response.');
    this.name = 'SupportResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(
  boundary: SupportResponseValidationError['boundary'],
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.support.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new SupportResponseValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
  issue: string,
  keys: readonly string[],
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  const source = value as JsonRecord;
  if (
    keys.some(key => !Object.prototype.hasOwnProperty.call(source, key))
    || Object.keys(source).some(key => !keys.includes(key))
  ) {
    reject(boundary, issue);
  }
  return source;
}

function boundedText(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
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

function reference(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
): string {
  const result = boundedText(
    value,
    boundary,
    'reference_invalid',
    15,
    15,
  );
  if (!referencePattern.test(result)) reject(boundary, 'reference_invalid');
  return result;
}

function timestamp(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
  issue: string,
): string {
  const result = boundedText(value, boundary, issue, 20, 35);
  const parsed = new Date(result);
  if (
    !Number.isFinite(parsed.getTime())
    || parsed.getTime() > Date.now() + maximumClockSkewMs
  ) {
    reject(boundary, issue);
  }
  return result;
}

function futureTimestamp(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
  issue: string,
): string {
  const result = boundedText(value, boundary, issue, 20, 35);
  if (!Number.isFinite(new Date(result).getTime())) reject(boundary, issue);
  return result;
}

function category(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
): SupportCategory {
  if (
    typeof value !== 'string'
    || !categories.has(value as SupportCategory)
  ) {
    reject(boundary, 'category_invalid');
  }
  return value as SupportCategory;
}

function status(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
): SupportCaseStatus {
  if (
    typeof value !== 'string'
    || !statuses.has(value as SupportCaseStatus)
  ) {
    reject(boundary, 'status_invalid');
  }
  return value as SupportCaseStatus;
}

function priority(
  value: unknown,
  boundary: SupportResponseValidationError['boundary'],
): SupportCasePriority {
  if (
    typeof value !== 'string'
    || !priorities.has(value as SupportCasePriority)
  ) {
    reject(boundary, 'priority_invalid');
  }
  return value as SupportCasePriority;
}

const summaryKeys = [
  'public_reference',
  'deal_public_id',
  'category',
  'subject',
  'status',
  'priority',
  'first_response_due_at',
  'resolution_due_at',
  'created_at',
  'updated_at',
] as const;

function summary(
  source: JsonRecord,
  boundary: SupportResponseValidationError['boundary'],
): SupportCaseSummaryPayload {
  const caseReference = reference(source.public_reference, boundary);
  let dealPublicId: string | null = null;
  if (source.deal_public_id !== null) {
    dealPublicId = boundedText(
      source.deal_public_id,
      boundary,
      'deal_public_id_invalid',
      8,
      8,
    );
    if (!dealPublicIdPattern.test(dealPublicId)) {
      reject(boundary, 'deal_public_id_invalid');
    }
  }
  const createdAt = timestamp(
    source.created_at,
    boundary,
    'created_at_invalid',
  );
  const updatedAt = timestamp(
    source.updated_at,
    boundary,
    'updated_at_invalid',
  );
  const firstResponseDueAt = futureTimestamp(
    source.first_response_due_at,
    boundary,
    'first_response_due_at_invalid',
  );
  const resolutionDueAt = futureTimestamp(
    source.resolution_due_at,
    boundary,
    'resolution_due_at_invalid',
  );
  if (
    Date.parse(updatedAt) < Date.parse(createdAt)
    || Date.parse(firstResponseDueAt) < Date.parse(createdAt)
    || Date.parse(resolutionDueAt) < Date.parse(firstResponseDueAt)
  ) {
    reject(boundary, 'case_timeline_invalid');
  }
  return {
    public_reference: caseReference,
    deal_public_id: dealPublicId,
    category: category(source.category, boundary),
    subject: boundedText(source.subject, boundary, 'subject_invalid', 5, 120),
    status: status(source.status, boundary),
    priority: priority(source.priority, boundary),
    first_response_due_at: firstResponseDueAt,
    resolution_due_at: resolutionDueAt,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function parseSupportReferenceResponse(value: unknown): string {
  return reference(value, 'support_case_create');
}

export function parseSupportMutationResponse(value: unknown): void {
  if (value !== null) reject('support_case_mutation', 'response_invalid');
}

export function parseSupportCaseSummaryRows(
  value: unknown,
): SupportCaseSummaryPayload[] {
  const boundary = 'support_case_list';
  if (!Array.isArray(value) || value.length > 100) {
    reject(boundary, 'rows_invalid');
  }
  const results = value.map(row => summary(
    exactRecord(row, boundary, 'record_shape_invalid', summaryKeys),
    boundary,
  ));
  const references = new Set(results.map(row => row.public_reference));
  if (
    references.size !== results.length
    || results.some((row, index) =>
      index > 0
      && Date.parse(row.created_at) > Date.parse(results[index - 1].created_at)
    )
  ) {
    reject(boundary, 'rows_order_invalid');
  }
  return results;
}

export function parseSupportCaseDetailRows(
  value: unknown,
): SupportCaseDetailPayload | null {
  const boundary = 'support_case_detail';
  if (!Array.isArray(value) || value.length > 500) {
    reject(boundary, 'rows_invalid');
  }
  if (!value.length) return null;
  const detailKeys = [
    ...summaryKeys,
    'message_id',
    'message_body',
    'message_author',
    'message_is_mine',
    'message_created_at',
  ] as const;
  const parsedRows = value.map(row =>
    exactRecord(row, boundary, 'record_shape_invalid', detailKeys));
  const firstSummary = summary(parsedRows[0], boundary);
  const messages = parsedRows.map<SupportCaseMessagePayload>((row, index) => {
    const rowSummary = summary(row, boundary);
    if (
      JSON.stringify(rowSummary) !== JSON.stringify(firstSummary)
    ) {
      reject(boundary, 'case_summary_conflict');
    }
    const id = boundedText(
      row.message_id,
      boundary,
      'message_id_invalid',
      36,
      36,
    );
    if (!uuidPattern.test(id)) reject(boundary, 'message_id_invalid');
    const author = row.message_author;
    if (author !== 'requester' && author !== 'dealivra_support') {
      reject(boundary, 'message_author_invalid');
    }
    if (typeof row.message_is_mine !== 'boolean') {
      reject(boundary, 'message_is_mine_invalid');
    }
    const createdAt = timestamp(
      row.message_created_at,
      boundary,
      'message_created_at_invalid',
    );
    if (
      Date.parse(createdAt) < Date.parse(firstSummary.created_at)
      || (
        index > 0
        && Date.parse(createdAt) <
          Date.parse(
            parsedRows[index - 1].message_created_at as string,
          )
      )
    ) {
      reject(boundary, 'message_order_invalid');
    }
    return {
      id,
      body: boundedText(
        row.message_body,
        boundary,
        'message_body_invalid',
        10,
        2_000,
      ),
      author,
      is_mine: row.message_is_mine,
      created_at: createdAt,
    };
  });
  if (new Set(messages.map(message => message.id)).size !== messages.length) {
    reject(boundary, 'message_duplicate');
  }
  return { ...firstSummary, messages };
}

export function parseSupportQueueRows(
  value: unknown,
): SupportQueueItemPayload[] {
  const boundary = 'support_queue';
  if (!Array.isArray(value) || value.length > 200) {
    reject(boundary, 'rows_invalid');
  }
  const keys = [
    'public_reference',
    'category',
    'priority',
    'status',
    'assignment_state',
    'first_response_due_at',
    'resolution_due_at',
    'created_at',
    'updated_at',
  ] as const;
  const results = value.map<SupportQueueItemPayload>(row => {
    const source = exactRecord(row, boundary, 'record_shape_invalid', keys);
    const rowStatus = status(source.status, boundary);
    if (rowStatus === 'resolved' || rowStatus === 'closed') {
      reject(boundary, 'status_invalid');
    }
    if (
      source.assignment_state !== 'unassigned'
      && source.assignment_state !== 'mine'
      && source.assignment_state !== 'assigned'
    ) {
      reject(boundary, 'assignment_state_invalid');
    }
    const createdAt = timestamp(
      source.created_at,
      boundary,
      'created_at_invalid',
    );
    const updatedAt = timestamp(
      source.updated_at,
      boundary,
      'updated_at_invalid',
    );
    const firstResponseDueAt = futureTimestamp(
      source.first_response_due_at,
      boundary,
      'first_response_due_at_invalid',
    );
    const resolutionDueAt = futureTimestamp(
      source.resolution_due_at,
      boundary,
      'resolution_due_at_invalid',
    );
    if (
      Date.parse(updatedAt) < Date.parse(createdAt)
      || Date.parse(firstResponseDueAt) < Date.parse(createdAt)
      || Date.parse(resolutionDueAt) < Date.parse(firstResponseDueAt)
    ) {
      reject(boundary, 'case_timeline_invalid');
    }
    return {
      public_reference: reference(source.public_reference, boundary),
      category: category(source.category, boundary),
      priority: priority(source.priority, boundary),
      status: rowStatus,
      assignment_state: source.assignment_state,
      first_response_due_at: firstResponseDueAt,
      resolution_due_at: resolutionDueAt,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  });
  if (
    new Set(results.map(row => row.public_reference)).size !== results.length
    || results.some((row, index) =>
      index > 0
      && (
        (results[index - 1].priority === 'normal' && row.priority === 'urgent')
        || (
          results[index - 1].priority === row.priority
          && Date.parse(row.first_response_due_at) <
            Date.parse(results[index - 1].first_response_due_at)
        )
      )
    )
  ) {
    reject(boundary, 'rows_order_invalid');
  }
  return results;
}
