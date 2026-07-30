import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AccountMutationBoundary =
  | 'account_name_request'
  | 'account_name_auth_error'
  | 'account_name_profile_error';

export interface AccountNameUpdatePayload {
  userId: string;
  displayName: string;
  authBody: {
    data: {
      display_name: string;
    };
  };
  profileBody: {
    display_name: string;
  };
}

export interface AccountMutationErrorEnvelopePayload {
  code: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u001f\u007f]/u;

const safeMessages: Partial<Record<string, string>> = {
  user_id_invalid: 'Your account could not be verified. Sign in again.',
  display_name_invalid: 'Name must contain 2 to 80 characters.',
};

export class AccountMutationBoundaryValidationError extends Error {
  readonly boundary: AccountMutationBoundary;
  readonly issue: string;

  constructor(boundary: AccountMutationBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The account request could not be processed safely. Please try again.',
    );
    this.name = 'AccountMutationBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: AccountMutationBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.account-mutation.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AccountMutationBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: AccountMutationBoundary,
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
  boundary: AccountMutationBoundary,
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

function displayName(
  value: unknown,
  boundary: AccountMutationBoundary,
): string {
  const result = boundedString(
    value,
    boundary,
    'display_name_invalid',
    2,
    336,
  ).trim();
  if (result.length < 2 || result.length > 80) {
    reject(boundary, 'display_name_invalid');
  }
  return result;
}

function userId(
  value: unknown,
  boundary: AccountMutationBoundary,
): string {
  const result = boundedString(
    value,
    boundary,
    'user_id_invalid',
    36,
    36,
  );
  if (!uuidPattern.test(result)) reject(boundary, 'user_id_invalid');
  return result.toLowerCase();
}

export function parseAccountNameUpdateRequest(
  value: unknown,
): AccountNameUpdatePayload {
  const boundary = 'account_name_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['userId', 'displayName'],
  );
  const name = displayName(source.displayName, boundary);
  return {
    userId: userId(source.userId, boundary),
    displayName: name,
    authBody: { data: { display_name: name } },
    profileBody: { display_name: name },
  };
}

function optionalMachineCode(
  value: unknown,
  boundary: AccountMutationBoundary,
): string | null {
  if (value === null || value === undefined) return null;
  const code = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value)
    : boundedString(value, boundary, 'error_code_invalid', 1, 64);
  if (!/^[a-z0-9_.-]+$/i.test(code)) {
    reject(boundary, 'error_code_invalid');
  }
  return code;
}

export function parseAccountAuthErrorEnvelope(
  value: unknown,
  status: number,
): AccountMutationErrorEnvelopePayload {
  const boundary = 'account_name_auth_error';
  if (!Number.isSafeInteger(status) || status < 400 || status > 599) {
    reject(boundary, 'status_invalid');
  }
  const source = exactRecord(
    value,
    boundary,
    'error_shape_invalid',
    [],
    ['code', 'error_code', 'msg', 'message', 'error', 'error_description'],
  );
  const messageKeys = [
    'msg',
    'message',
    'error',
    'error_description',
  ] as const;
  const messages = messageKeys
    .filter(key => key in source)
    .map(key => boundedString(
      source[key],
      boundary,
      'error_message_invalid',
      1,
      512,
    ).trim());
  if (!messages.length || messages.some(message => !message)) {
    reject(boundary, 'error_message_invalid');
  }
  return {
    code: optionalMachineCode(
      source.error_code ?? source.code,
      boundary,
    ),
  };
}

export function parseAccountProfileErrorEnvelope(
  value: unknown,
  status: number,
): AccountMutationErrorEnvelopePayload {
  const boundary = 'account_name_profile_error';
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
  return {
    code: optionalMachineCode(source.code, boundary),
  };
}
