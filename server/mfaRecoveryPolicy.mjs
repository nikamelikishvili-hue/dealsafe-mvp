const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const caseReferencePattern = /^[A-Z0-9][A-Z0-9._/-]{7,63}$/i;
const safeReferencePattern = /^[A-Z0-9][A-Z0-9 ._:/-]{7,119}$/i;
const forbiddenReferencePattern = /\b(password|passcode|token|secret|otp|totp|recovery code|private key|seed phrase)\b/i;

const recoveryReasons = new Set([
  'lost_all_factors',
  'suspected_factor_compromise',
  'device_loss',
]);
const proofMethods = new Set([
  'government_id_plus_live_check',
  'provider_assisted_reproof',
  'document_and_video_review',
]);
const reviewDecisions = new Set(['approve', 'reject']);
const sensitiveChangeScopes = new Set(['payout', 'email', 'mfa']);

export class RecoveryRequestError extends Error {
  constructor(message = 'The recovery request is invalid.') {
    super(message);
    this.name = 'RecoveryRequestError';
  }
}

function requiredString(value, minimum, maximum) {
  if (typeof value !== 'string') throw new RecoveryRequestError();
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new RecoveryRequestError();
  }
  return normalized;
}

function safeReference(value, minimum = 8, maximum = 120) {
  const normalized = requiredString(value, minimum, maximum);
  if (
    !safeReferencePattern.test(normalized)
    || forbiddenReferencePattern.test(normalized)
    || /[=@]/.test(normalized)
  ) {
    throw new RecoveryRequestError(
      'Use a non-secret internal reference. Never enter a password, code, token, email address, or authenticator secret.',
    );
  }
  return normalized;
}

function uuid(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new RecoveryRequestError();
  }
  return value.toLowerCase();
}

export function parseRecoveryRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RecoveryRequestError();
  }
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'list') {
    const status = body.status === undefined || body.status === null || body.status === ''
      ? null
      : requiredString(body.status, 4, 32);
    if (status && ![
      'open',
      'identity_verified',
      'approved',
      'rejected',
      'completed',
      'cancelled',
    ].includes(status)) {
      throw new RecoveryRequestError();
    }
    return { action, rpc: 'get_privileged_mfa_recovery_cases', parameters: { p_status: status } };
  }

  if (action === 'open') {
    const caseReference = requiredString(body.caseReference, 8, 64);
    if (!caseReferencePattern.test(caseReference) || forbiddenReferencePattern.test(caseReference)) {
      throw new RecoveryRequestError();
    }
    const reasonCode = requiredString(body.reasonCode, 4, 48);
    if (!recoveryReasons.has(reasonCode)) throw new RecoveryRequestError();
    return {
      action,
      rpc: 'open_privileged_mfa_recovery_case',
      parameters: {
        p_target_user_id: uuid(body.targetUserId),
        p_case_reference: caseReference.toUpperCase(),
        p_reason_code: reasonCode,
        p_evidence_reference: safeReference(body.evidenceReference),
      },
    };
  }

  if (action === 'record_identity_proof') {
    const proofMethod = requiredString(body.proofMethod, 4, 64);
    if (!proofMethods.has(proofMethod)) throw new RecoveryRequestError();
    return {
      action,
      rpc: 'record_privileged_recovery_identity_proof',
      parameters: {
        p_case_id: uuid(body.caseId),
        p_proof_method: proofMethod,
        p_evidence_reference: safeReference(body.evidenceReference),
      },
    };
  }

  if (action === 'review') {
    const decision = requiredString(body.decision, 4, 16);
    if (!reviewDecisions.has(decision)) throw new RecoveryRequestError();
    return {
      action,
      rpc: 'review_privileged_mfa_recovery_case',
      parameters: {
        p_case_id: uuid(body.caseId),
        p_decision: decision,
        p_review_note: safeReference(body.reviewNote, 12, 120),
      },
    };
  }

  if (action === 'my_hold') {
    return {
      action,
      rpc: 'get_my_sensitive_change_holds',
      parameters: {},
    };
  }

  if (action === 'assert_change_allowed') {
    const scope = requiredString(body.scope, 3, 16);
    if (!sensitiveChangeScopes.has(scope)) throw new RecoveryRequestError();
    return {
      action,
      rpc: 'assert_my_sensitive_change_allowed',
      parameters: { p_scope: scope },
    };
  }

  throw new RecoveryRequestError();
}

export function hasRecentTotpAal2(accessToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const encoded = accessToken.split('.')[1];
    if (!encoded) return false;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(Buffer.from(
      normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='),
      'base64',
    ).toString('utf8'));
    if (claims?.aal !== 'aal2' || !Array.isArray(claims.amr)) return false;
    return claims.amr.some((method) => {
      const timestamp = Number(method?.timestamp);
      return method?.method === 'totp'
        && Number.isFinite(timestamp)
        && timestamp <= nowSeconds + 60
        && nowSeconds - timestamp <= 10 * 60;
    });
  } catch {
    return false;
  }
}
