import {
  currentUserAppRole,
  logAuthFailure,
  prepareResponse,
  readBearerToken,
  readJsonBody,
  requirePost,
  requireSameOrigin,
  supabaseRestRpcRequest,
} from '../../server/authShared.mjs';
import {
  hasRecentTotpAal2,
  parseRecoveryRequest,
  RecoveryRequestError,
} from '../../server/mfaRecoveryPolicy.mjs';

const privilegedRoles = new Set(['support', 'compliance', 'admin']);
const memberActions = new Set(['my_hold', 'assert_change_allowed']);

function recoveryFailure(response, providerBody, providerStatus) {
  const diagnostic = [
    providerBody?.code,
    providerBody?.message,
    providerBody?.details,
    providerBody?.hint,
  ].filter(value => typeof value === 'string').join(' ');

  if (/SECOND_REVIEWER_REQUIRED|reviewer must be different/i.test(diagnostic)) {
    response.status(409).json({
      error: 'A different authorized reviewer must approve this recovery case.',
    });
    return;
  }
  if (/RECOVERY_CASE_ALREADY_OPEN|duplicate key|unique constraint/i.test(diagnostic)) {
    response.status(409).json({
      error: 'An active recovery case already exists for this account or case reference.',
    });
    return;
  }
  if (/SENSITIVE_CHANGE_COOLDOWN/i.test(diagnostic)) {
    response.status(423).json({
      error: 'This account is in a security cooldown. The requested change is temporarily locked.',
    });
    return;
  }
  if (
    providerStatus === 401
    || providerStatus === 403
    || /AUTH_REQUIRED|ROLE_REQUIRED|AAL2_REQUIRED|RECENT_TOTP_REQUIRED/i.test(diagnostic)
  ) {
    response.status(403).json({
      error: 'Fresh multi-factor verification and an authorized security role are required.',
    });
    return;
  }

  response.status(503).json({
    error: 'The protected recovery workflow is temporarily unavailable.',
  });
}

export default async function handler(request, response) {
  prepareResponse(response);
  if (
    !requirePost(request, response)
    || !requireSameOrigin(request, response, 'Cross-origin recovery requests are not allowed.')
  ) {
    return;
  }

  const body = readJsonBody(request);
  const accessToken = readBearerToken(request);
  if (!body || !accessToken) {
    response.status(401).json({ error: 'Your session could not be verified.' });
    return;
  }

  let recoveryRequest;
  try {
    recoveryRequest = parseRecoveryRequest(body);
  } catch (error) {
    const message = error instanceof RecoveryRequestError
      ? error.message
      : 'The recovery request is invalid.';
    response.status(400).json({ error: message });
    return;
  }

  try {
    if (!memberActions.has(recoveryRequest.action)) {
      if (!hasRecentTotpAal2(accessToken)) {
        response.status(403).json({
          error: 'Verify a registered authenticator again before using the recovery workflow.',
        });
        return;
      }
      const applicationRole = await currentUserAppRole(accessToken);
      if (!privilegedRoles.has(applicationRole)) {
        response.status(403).json({ error: 'An authorized security role is required.' });
        return;
      }
    }

    const upstream = await supabaseRestRpcRequest(
      accessToken,
      recoveryRequest.rpc,
      recoveryRequest.parameters,
    );
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      recoveryFailure(response, data, upstream.status);
      return;
    }
    response.status(200).json({ result: data ?? null });
  } catch (error) {
    logAuthFailure(`mfa-recovery:${recoveryRequest.action}`, error);
    response.status(503).json({
      error: 'The protected recovery workflow is temporarily unavailable.',
    });
  }
}
