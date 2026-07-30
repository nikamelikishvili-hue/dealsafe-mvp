import { reportRuntimeRejection } from './runtimeRejectionReporter.ts';

type JsonRecord = Record<string, unknown>;

export type AuthResponseBoundary =
  | 'auth_signup'
  | 'auth_login'
  | 'auth_refresh'
  | 'mfa_status'
  | 'mfa_enrollment'
  | 'mfa_session';

export interface AuthSessionPayload {
  access_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    user_metadata: {
      display_name: string | null;
    };
  };
}

export interface MfaFactorPayload {
  id: string;
  factorType: 'totp';
  friendlyName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MfaLoginChallengePayload {
  mfa_required: true;
  pending_access_token: string;
  expires_in: number;
  factors: MfaFactorPayload[];
}

export interface MfaStatusPayload {
  assuranceLevel: 'aal1' | 'aal2';
  factors: MfaFactorPayload[];
  minimumVerifiedFactors: number;
  canRemoveVerifiedFactor: boolean;
  unsupportedVerifiedFactor: boolean;
}

export interface MfaEnrollmentPayload {
  factorId: string;
  friendlyName: string;
  qrCodeSvg: string;
  secret: string;
  uri: string | null;
}

export type AuthLoginPayload = AuthSessionPayload | MfaLoginChallengePayload;

export type AuthSignupPayload =
  | {
      session: AuthSessionPayload;
      needsEmailConfirmation: false;
    }
  | {
      session: null;
      needsEmailConfirmation: true;
    };

export class AuthResponseValidationError extends Error {
  readonly boundary: AuthResponseBoundary;
  readonly issue: string;

  constructor(boundary: AuthResponseBoundary, issue: string) {
    super('The account service returned an invalid response. Please try again later.');
    this.name = 'AuthResponseValidationError';
    this.boundary = boundary;
    this.issue = issue;
  }
}

function reject(
  boundary: AuthResponseBoundary,
  issue: string,
): never {
  const safeIssue = /^[a-z0-9_]{1,96}$/.test(issue)
    ? issue
    : 'invalid_payload';
  reportRuntimeRejection({
    schema: 'dealivra.auth.response-rejection.v1',
    boundary,
    issue: safeIssue,
  });
  throw new AuthResponseValidationError(boundary, safeIssue);
}

function record(
  value: unknown,
  boundary: AuthResponseBoundary,
  issue: string,
): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(boundary, issue);
  }
  return value as JsonRecord;
}

function boundedString(
  value: unknown,
  boundary: AuthResponseBoundary,
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

function integer(
  value: unknown,
  boundary: AuthResponseBoundary,
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

function boolean(
  value: unknown,
  boundary: AuthResponseBoundary,
  issue: string,
): boolean {
  if (typeof value !== 'boolean') reject(boundary, issue);
  return value;
}

function timestampOrNull(
  value: unknown,
  boundary: AuthResponseBoundary,
  issue: string,
): string | null {
  if (value === null) return null;
  const result = boundedString(value, boundary, issue, 20, 40);
  if (!Number.isFinite(Date.parse(result))) reject(boundary, issue);
  return result;
}

function assertNoRefreshToken(
  value: JsonRecord,
  boundary: AuthResponseBoundary,
): void {
  if ('refresh_token' in value) reject(boundary, 'refresh_token_exposed');
}

function jwt(
  value: unknown,
  boundary: AuthResponseBoundary,
  issue: string,
): string {
  const token = boundedString(value, boundary, issue, 16, 16_384);
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    reject(boundary, issue);
  }
  return token;
}

function uuid(
  value: unknown,
  boundary: AuthResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)
  ) {
    reject(boundary, issue);
  }
  return result;
}

function email(
  value: unknown,
  boundary: AuthResponseBoundary,
  issue: string,
): string {
  const result = boundedString(value, boundary, issue, 3, 320);
  if (
    result !== result.trim()
    || result.includes(' ')
    || result.indexOf('@') <= 0
    || result.lastIndexOf('@') !== result.indexOf('@')
    || result.endsWith('@')
  ) {
    reject(boundary, issue);
  }
  return result;
}

function mfaFactor(
  value: unknown,
  boundary: AuthResponseBoundary,
  index: number,
): MfaFactorPayload {
  const source = record(value, boundary, `factor_${index}_not_object`);
  const factorType = boundedString(
    source.factorType,
    boundary,
    `factor_${index}_type_invalid`,
    4,
    16,
  );
  if (factorType !== 'totp') reject(boundary, `factor_${index}_type_invalid`);
  return {
    id: uuid(source.id, boundary, `factor_${index}_id_invalid`),
    factorType,
    friendlyName: boundedString(
      source.friendlyName,
      boundary,
      `factor_${index}_name_invalid`,
      1,
      80,
    ),
    createdAt: timestampOrNull(
      source.createdAt,
      boundary,
      `factor_${index}_created_at_invalid`,
    ),
    updatedAt: timestampOrNull(
      source.updatedAt,
      boundary,
      `factor_${index}_updated_at_invalid`,
    ),
  };
}

function mfaFactors(
  value: unknown,
  boundary: AuthResponseBoundary,
  requireOne: boolean,
): MfaFactorPayload[] {
  if (
    !Array.isArray(value)
    || value.length > 16
    || (requireOne && value.length === 0)
  ) {
    reject(boundary, 'factors_invalid');
  }
  const factors = value.map((factor, index) => mfaFactor(factor, boundary, index));
  if (new Set(factors.map(factor => factor.id)).size !== factors.length) {
    reject(boundary, 'factor_ids_not_unique');
  }
  return factors;
}

export function parseAuthSession(
  value: unknown,
  boundary: Extract<AuthResponseBoundary, 'auth_signup' | 'auth_login' | 'auth_refresh' | 'mfa_session'>,
): AuthSessionPayload {
  const source = record(value, boundary, 'session_not_object');
  assertNoRefreshToken(source, boundary);
  const user = record(source.user, boundary, 'user_not_object');
  assertNoRefreshToken(user, boundary);
  const metadata = record(
    user.user_metadata,
    boundary,
    'user_metadata_not_object',
  );
  const displayName = metadata.display_name === null
    ? null
    : boundedString(
        metadata.display_name,
        boundary,
        'display_name_invalid',
        1,
        80,
      );
  return {
    access_token: jwt(source.access_token, boundary, 'access_token_invalid'),
    expires_in: integer(source.expires_in, boundary, 'expires_in_invalid', 1, 604_800),
    user: {
      id: uuid(user.id, boundary, 'user_id_invalid'),
      email: email(user.email, boundary, 'user_email_invalid'),
      email_confirmed_at: timestampOrNull(
        user.email_confirmed_at,
        boundary,
        'email_confirmed_at_invalid',
      ),
      user_metadata: {
        display_name: displayName,
      },
    },
  };
}

export function parseSignupResponse(value: unknown): AuthSignupPayload {
  const boundary = 'auth_signup';
  const source = record(value, boundary, 'signup_not_object');
  assertNoRefreshToken(source, boundary);
  const needsEmailConfirmation = boolean(
    source.needsEmailConfirmation,
    boundary,
    'confirmation_flag_invalid',
  );
  if (source.session === null) {
    if (!needsEmailConfirmation) reject(boundary, 'confirmation_state_conflict');
    return { session: null, needsEmailConfirmation: true };
  }
  if (needsEmailConfirmation) reject(boundary, 'confirmation_state_conflict');
  return {
    session: parseAuthSession(source.session, boundary),
    needsEmailConfirmation: false,
  };
}

export function parseLoginResponse(value: unknown): AuthLoginPayload {
  const boundary = 'auth_login';
  const source = record(value, boundary, 'login_not_object');
  assertNoRefreshToken(source, boundary);
  if (source.mfa_required === true) {
    return {
      mfa_required: true,
      pending_access_token: jwt(
        source.pending_access_token,
        boundary,
        'pending_access_token_invalid',
      ),
      expires_in: integer(source.expires_in, boundary, 'expires_in_invalid', 1, 900),
      factors: mfaFactors(source.factors, boundary, true),
    };
  }
  if ('mfa_required' in source) reject(boundary, 'mfa_required_invalid');
  return parseAuthSession(source, boundary);
}

export function parseMfaStatusResponse(value: unknown): MfaStatusPayload {
  const boundary = 'mfa_status';
  const source = record(value, boundary, 'status_not_object');
  assertNoRefreshToken(source, boundary);
  const assuranceLevel = boundedString(
    source.assuranceLevel,
    boundary,
    'assurance_level_invalid',
    4,
    4,
  );
  if (assuranceLevel !== 'aal1' && assuranceLevel !== 'aal2') {
    reject(boundary, 'assurance_level_invalid');
  }
  const factors = mfaFactors(source.factors, boundary, false);
  const minimumVerifiedFactors = integer(
    source.minimumVerifiedFactors,
    boundary,
    'minimum_factors_invalid',
    0,
    2,
  );
  const canRemoveVerifiedFactor = boolean(
    source.canRemoveVerifiedFactor,
    boundary,
    'remove_permission_invalid',
  );
  const unsupportedVerifiedFactor = boolean(
    source.unsupportedVerifiedFactor,
    boundary,
    'unsupported_factor_flag_invalid',
  );
  if (minimumVerifiedFactors > factors.length && canRemoveVerifiedFactor) {
    reject(boundary, 'remove_permission_conflict');
  }
  if (
    canRemoveVerifiedFactor
    !== (factors.length > minimumVerifiedFactors)
  ) {
    reject(boundary, 'remove_permission_conflict');
  }
  if (unsupportedVerifiedFactor && factors.length > 0) {
    reject(boundary, 'unsupported_factor_conflict');
  }
  return {
    assuranceLevel,
    factors,
    minimumVerifiedFactors,
    canRemoveVerifiedFactor,
    unsupportedVerifiedFactor,
  };
}

export function parseMfaEnrollmentResponse(value: unknown): MfaEnrollmentPayload {
  const boundary = 'mfa_enrollment';
  const source = record(value, boundary, 'enrollment_not_object');
  assertNoRefreshToken(source, boundary);
  const qrCodeSvg = boundedString(
    source.qrCodeSvg,
    boundary,
    'qr_code_invalid',
    32,
    65_536,
  );
  if (
    !/^\s*<svg(?:\s|>)/i.test(qrCodeSvg)
    || /<(?:script|foreignObject)\b/i.test(qrCodeSvg)
    || /\son[a-z]+\s*=/i.test(qrCodeSvg)
    || /<!DOCTYPE|<!ENTITY/i.test(qrCodeSvg)
    || /\s(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(qrCodeSvg)
  ) {
    reject(boundary, 'qr_code_invalid');
  }
  const secret = boundedString(
    source.secret,
    boundary,
    'totp_secret_invalid',
    16,
    256,
  );
  if (!/^[A-Z2-7]+=*$/i.test(secret)) reject(boundary, 'totp_secret_invalid');
  const uri = source.uri === null
    ? null
    : boundedString(source.uri, boundary, 'totp_uri_invalid', 16, 2_048);
  if (uri !== null && !uri.startsWith('otpauth://totp/')) {
    reject(boundary, 'totp_uri_invalid');
  }
  return {
    factorId: uuid(source.factorId, boundary, 'factor_id_invalid'),
    friendlyName: boundedString(
      source.friendlyName,
      boundary,
      'friendly_name_invalid',
      2,
      48,
    ),
    qrCodeSvg,
    secret,
    uri,
  };
}
