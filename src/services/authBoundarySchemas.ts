import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AuthRequestBoundary =
  | 'auth_signup_request'
  | 'auth_login_request'
  | 'auth_refresh_request'
  | 'auth_recover_request'
  | 'auth_password_request'
  | 'auth_logout_request'
  | 'auth_mfa_request';

export type AuthErrorBoundary =
  | 'auth_signup_error'
  | 'auth_login_error'
  | 'auth_refresh_error'
  | 'auth_recover_error'
  | 'auth_password_error'
  | 'auth_logout_error'
  | 'auth_mfa_error';

export type AuthBoundary = AuthRequestBoundary | AuthErrorBoundary;

export interface AuthSignupRequestPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthLoginRequestPayload {
  email: string;
  password: string;
}

export interface AuthRecoverRequestPayload {
  email: string;
}

export type AuthPasswordRequestPayload =
  | {
      action: 'recovery';
      newPassword: string;
    }
  | {
      action: 'change';
      currentPassword: string;
      newPassword: string;
    };

export interface AuthLogoutRequestPayload {
  scope: 'local' | 'others' | 'global';
}

export type AuthMfaRequestPayload =
  | { action: 'list' }
  | { action: 'enroll'; friendlyName: string }
  | {
      action: 'challenge_and_verify';
      purpose: 'login' | 'enrollment' | 'step_up';
      factorId: string;
      code: string;
    }
  | { action: 'unenroll'; factorId: string }
  | { action: 'cancel_enrollment'; factorId: string };

export interface AuthErrorEnvelopePayload {
  error: string;
  code: string | null;
  retryAfter: number | null;
}

const safeMessages: Partial<Record<string, string>> = {
  display_name_invalid: 'Name must contain 2 to 80 characters.',
  email_invalid: 'Enter a valid email address.',
  current_password_invalid: 'Enter your current password.',
  password_too_short: 'Password must contain at least 12 characters.',
  password_too_long: 'Password must contain no more than 256 characters.',
  password_complexity_invalid:
    'Password must include uppercase, lowercase, a number, and a symbol.',
  password_reuse_invalid: 'Choose a new password that is different from your current password.',
  mfa_code_invalid: 'Enter the current 6-digit authenticator code.',
  mfa_name_invalid: 'Authenticator name must contain 2 to 48 characters.',
  factor_id_invalid: 'The selected authenticator is invalid. Refresh and try again.',
  access_token_invalid: 'Your session expired. Please sign in again.',
};

export class AuthBoundaryValidationError extends Error {
  readonly boundary: AuthBoundary;
  readonly issue: string;

  constructor(boundary: AuthBoundary, issue: string) {
    super(
      safeMessages[issue]
      ?? 'The account request could not be processed safely. Please try again.',
    );
    this.name = 'AuthBoundaryValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(boundary: AuthBoundary, issue: string): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.auth.boundary-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AuthBoundaryValidationError(boundary, safeIssue);
}

function exactRecord(
  value: unknown,
  boundary: AuthBoundary,
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
  boundary: AuthBoundary,
  issue: string,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  ) {
    reject(boundary, issue);
  }
  return value;
}

function email(
  value: unknown,
  boundary: AuthRequestBoundary,
): string {
  const result = boundedString(value, boundary, 'email_invalid', 3, 320)
    .trim()
    .toLowerCase();
  if (
    result.includes(' ')
    || result.indexOf('@') <= 0
    || result.lastIndexOf('@') !== result.indexOf('@')
    || result.endsWith('@')
  ) {
    reject(boundary, 'email_invalid');
  }
  return result;
}

function loginPassword(
  value: unknown,
  boundary: AuthRequestBoundary,
  issue = 'password_invalid',
): string {
  return boundedString(value, boundary, issue, 1, 256);
}

function strongPassword(
  value: unknown,
  boundary: AuthRequestBoundary,
): string {
  if (typeof value !== 'string' || value.length < 12) {
    reject(boundary, 'password_too_short');
  }
  if (value.length > 256) reject(boundary, 'password_too_long');
  if (
    !/[a-z]/.test(value)
    || !/[A-Z]/.test(value)
    || !/\d/.test(value)
    || !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/.test(value)
  ) {
    reject(boundary, 'password_complexity_invalid');
  }
  return value;
}

function accessToken(
  value: unknown,
  boundary: AuthRequestBoundary,
): string {
  const token = boundedString(value, boundary, 'access_token_invalid', 16, 8_192);
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    reject(boundary, 'access_token_invalid');
  }
  return token;
}

function factorId(
  value: unknown,
  boundary: Extract<AuthRequestBoundary, 'auth_mfa_request'>,
): string {
  const result = boundedString(value, boundary, 'factor_id_invalid', 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)
  ) {
    reject(boundary, 'factor_id_invalid');
  }
  return result;
}

export function parseAuthBearerToken(
  value: unknown,
  boundary: Extract<
    AuthRequestBoundary,
    'auth_logout_request' | 'auth_password_request' | 'auth_mfa_request'
  >,
): string {
  return accessToken(value, boundary);
}

export function parseAuthSignupRequest(
  value: unknown,
): AuthSignupRequestPayload {
  const boundary = 'auth_signup_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['email', 'password', 'displayName'],
  );
  const displayName = boundedString(
    source.displayName,
    boundary,
    'display_name_invalid',
    2,
    80,
  ).trim();
  if (displayName.length < 2) reject(boundary, 'display_name_invalid');
  return {
    email: email(source.email, boundary),
    password: strongPassword(source.password, boundary),
    displayName,
  };
}

export function parseAuthLoginRequest(
  value: unknown,
): AuthLoginRequestPayload {
  const boundary = 'auth_login_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['email', 'password'],
  );
  return {
    email: email(source.email, boundary),
    password: loginPassword(source.password, boundary),
  };
}

export function parseAuthRefreshRequest(value: unknown): Record<string, never> {
  exactRecord(value, 'auth_refresh_request', 'request_shape_invalid', []);
  return {};
}

export function parseAuthRecoverRequest(
  value: unknown,
): AuthRecoverRequestPayload {
  const boundary = 'auth_recover_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['email'],
  );
  return { email: email(source.email, boundary) };
}

export function parseAuthPasswordRequest(
  value: unknown,
): AuthPasswordRequestPayload {
  const boundary = 'auth_password_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['action', 'newPassword'],
    ['currentPassword'],
  );
  const newPassword = strongPassword(source.newPassword, boundary);
  if (source.action === 'recovery') {
    if ('currentPassword' in source) reject(boundary, 'request_shape_invalid');
    return { action: 'recovery', newPassword };
  }
  if (source.action !== 'change' || !('currentPassword' in source)) {
    reject(boundary, 'request_shape_invalid');
  }
  const currentPassword = loginPassword(
    source.currentPassword,
    boundary,
    'current_password_invalid',
  );
  if (currentPassword === newPassword) reject(boundary, 'password_reuse_invalid');
  return { action: 'change', currentPassword, newPassword };
}

export function parseAuthLogoutRequest(
  value: unknown,
): AuthLogoutRequestPayload {
  const boundary = 'auth_logout_request';
  const source = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['scope'],
  );
  if (
    source.scope !== 'local'
    && source.scope !== 'others'
    && source.scope !== 'global'
  ) {
    reject(boundary, 'request_shape_invalid');
  }
  return { scope: source.scope };
}

export function parseAuthMfaRequest(value: unknown): AuthMfaRequestPayload {
  const boundary = 'auth_mfa_request';
  const actionSource = exactRecord(
    value,
    boundary,
    'request_shape_invalid',
    ['action'],
    ['friendlyName', 'purpose', 'factorId', 'code'],
  );
  if (actionSource.action === 'list') {
    exactRecord(value, boundary, 'request_shape_invalid', ['action']);
    return { action: 'list' };
  }
  if (actionSource.action === 'enroll') {
    const source = exactRecord(
      value,
      boundary,
      'request_shape_invalid',
      ['action', 'friendlyName'],
    );
    const friendlyName = boundedString(
      source.friendlyName,
      boundary,
      'mfa_name_invalid',
      2,
      48,
    ).trim();
    if (friendlyName.length < 2) reject(boundary, 'mfa_name_invalid');
    return { action: 'enroll', friendlyName };
  }
  if (actionSource.action === 'challenge_and_verify') {
    const source = exactRecord(
      value,
      boundary,
      'request_shape_invalid',
      ['action', 'purpose', 'factorId', 'code'],
    );
    if (
      source.purpose !== 'login'
      && source.purpose !== 'enrollment'
      && source.purpose !== 'step_up'
    ) {
      reject(boundary, 'request_shape_invalid');
    }
    const code = boundedString(
      source.code,
      boundary,
      'mfa_code_invalid',
      6,
      6,
    ).trim();
    if (!/^\d{6}$/.test(code)) reject(boundary, 'mfa_code_invalid');
    return {
      action: 'challenge_and_verify',
      purpose: source.purpose,
      factorId: factorId(source.factorId, boundary),
      code,
    };
  }
  if (
    actionSource.action === 'unenroll'
    || actionSource.action === 'cancel_enrollment'
  ) {
    const source = exactRecord(
      value,
      boundary,
      'request_shape_invalid',
      ['action', 'factorId'],
    );
    return {
      action: actionSource.action,
      factorId: factorId(source.factorId, boundary),
    };
  }
  reject(boundary, 'request_shape_invalid');
}

export function parseAuthErrorEnvelope(
  value: unknown,
  status: number,
  retryAfterHeader: string | null,
  boundary: AuthErrorBoundary,
): AuthErrorEnvelopePayload {
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
    ['error'],
    ['code', 'retryAfter'],
  );
  const error = boundedString(
    source.error,
    boundary,
    'error_message_invalid',
    1,
    512,
  ).trim();
  if (!error) reject(boundary, 'error_message_invalid');

  let code: string | null = null;
  if ('code' in source) {
    code = boundedString(source.code, boundary, 'error_code_invalid', 1, 64);
    if (!/^[a-z0-9_]+$/i.test(code)) reject(boundary, 'error_code_invalid');
  }

  const bodyRetryAfter = 'retryAfter' in source
    ? source.retryAfter
    : null;
  if (
    bodyRetryAfter !== null
    && (
      typeof bodyRetryAfter !== 'number'
      || !Number.isSafeInteger(bodyRetryAfter)
      || bodyRetryAfter < 1
      || bodyRetryAfter > 300
    )
  ) {
    reject(boundary, 'retry_after_invalid');
  }
  const headerRetryAfter = retryAfterHeader === null
    ? null
    : /^\d{1,3}$/.test(retryAfterHeader)
      ? Number(retryAfterHeader)
      : Number.NaN;
  if (
    headerRetryAfter !== null
    && (
      !Number.isSafeInteger(headerRetryAfter)
      || headerRetryAfter < 1
      || headerRetryAfter > 300
    )
  ) {
    reject(boundary, 'retry_after_invalid');
  }
  if (status !== 429 && (bodyRetryAfter !== null || headerRetryAfter !== null)) {
    reject(boundary, 'retry_after_status_conflict');
  }
  if (
    status === 429
    && bodyRetryAfter !== null
    && headerRetryAfter !== null
    && bodyRetryAfter !== headerRetryAfter
  ) {
    reject(boundary, 'retry_after_conflict');
  }
  const retryAfter = status === 429
    ? bodyRetryAfter ?? headerRetryAfter
    : null;
  if (status === 429 && retryAfter === null) {
    reject(boundary, 'retry_after_missing');
  }

  return { error, code, retryAfter };
}
