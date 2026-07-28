import {
  authPayload,
  currentUserAppRole,
  decodeAccessTokenClaims,
  hasVerifiedMfaFactor,
  logAuthFailure,
  prepareResponse,
  publicSession,
  readBearerToken,
  readJsonBody,
  readRefreshToken,
  requirePost,
  requireSameOrigin,
  safeMfaFactors,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const totpPattern = /^\d{6}$/;
const privilegedRoles = new Set(['support', 'compliance', 'admin']);
const sensitiveChangeFreshnessSeconds = 10 * 60;

function invalidRequest(response) {
  response.status(400).json({ error: 'The authenticator request is invalid.' });
}

async function loadAccount(accessToken) {
  const upstream = await supabaseAuthRequest('user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const account = await authPayload(upstream);
  return { upstream, account };
}

async function refreshAfterFactorChange(request, response) {
  const refreshToken = readRefreshToken(request);
  if (!refreshToken) {
    response.status(401).json({ error: 'Sign in again to finish updating account security.' });
    return;
  }
  const upstream = await supabaseAuthRequest('token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await authPayload(upstream);
  const session = publicSession(data);
  if (!upstream.ok || !session || !data.refresh_token) {
    response.status(401).json({ error: 'Sign in again to finish updating account security.' });
    return;
  }
  setRefreshCookie(response, data.refresh_token);
  response.status(200).json(session);
}

function rawFactor(account, factorId) {
  return Array.isArray(account?.factors)
    ? account.factors.find((factor) => factor?.id === factorId)
    : undefined;
}

function hasFreshAal2(accessToken) {
  const claims = decodeAccessTokenClaims(accessToken);
  const currentTime = Math.floor(Date.now() / 1000);
  const hasRecentTotpVerification = Array.isArray(claims.amr)
    && claims.amr.some((method) => {
      const verifiedAt = Number(method?.timestamp);
      return method?.method === 'totp'
        && Number.isFinite(verifiedAt)
        && verifiedAt <= currentTime + 60
        && currentTime - verifiedAt <= sensitiveChangeFreshnessSeconds;
    });
  return claims.aal === 'aal2'
    && hasRecentTotpVerification;
}

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response)) return;

  const body = readJsonBody(request);
  const action = typeof body?.action === 'string' ? body.action : '';
  const accessToken = readBearerToken(request);
  if (!body || !accessToken) {
    response.status(401).json({ error: 'Your session could not be verified.' });
    return;
  }

  try {
    if (action === 'list') {
      const { upstream, account } = await loadAccount(accessToken);
      if (!upstream.ok || !account?.id) {
        response.status(401).json({ error: 'Your session could not be verified.' });
        return;
      }
      const claims = decodeAccessTokenClaims(accessToken);
      const factors = safeMfaFactors(account);
      const applicationRole = await currentUserAppRole(accessToken);
      const minimumVerifiedFactors = privilegedRoles.has(applicationRole) ? 2 : 0;
      response.status(200).json({
        assuranceLevel: claims.aal === 'aal2' ? 'aal2' : 'aal1',
        factors,
        minimumVerifiedFactors,
        canRemoveVerifiedFactor: factors.length > minimumVerifiedFactors,
        unsupportedVerifiedFactor: hasVerifiedMfaFactor(account) && factors.length === 0,
      });
      return;
    }

    if (action === 'enroll') {
      const friendlyName = typeof body.friendlyName === 'string' ? body.friendlyName.trim() : '';
      if (friendlyName.length < 2 || friendlyName.length > 48) {
        invalidRequest(response);
        return;
      }
      const upstream = await supabaseAuthRequest('factors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          factor_type: 'totp',
          friendly_name: friendlyName,
          issuer: 'Dealivra',
        }),
      });
      const data = await authPayload(upstream);
      if (
        !upstream.ok
        || typeof data.id !== 'string'
        || data.type !== 'totp'
        || typeof data.totp?.qr_code !== 'string'
        || typeof data.totp?.secret !== 'string'
      ) {
        response.status(400).json({
          error: 'Authenticator setup could not start. Remove an unfinished setup or use a different device name.',
        });
        return;
      }
      response.status(200).json({
        factorId: data.id,
        friendlyName,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: typeof data.totp.uri === 'string' ? data.totp.uri : null,
      });
      return;
    }

    if (action === 'challenge_and_verify') {
      const factorId = typeof body.factorId === 'string' ? body.factorId : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!uuidPattern.test(factorId) || !totpPattern.test(code)) {
        invalidRequest(response);
        return;
      }
      const challengeUpstream = await supabaseAuthRequest(`factors/${factorId}/challenge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: '{}',
      });
      const challenge = await authPayload(challengeUpstream);
      if (!challengeUpstream.ok || typeof challenge.id !== 'string') {
        response.status(400).json({ error: 'A new authenticator challenge could not be created. Try again.' });
        return;
      }
      const verifyUpstream = await supabaseAuthRequest(`factors/${factorId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ challenge_id: challenge.id, code }),
      });
      const verified = await authPayload(verifyUpstream);
      const session = publicSession(verified);
      if (!verifyUpstream.ok || !session || !verified.refresh_token) {
        response.status(400).json({
          error: 'The authenticator code was not accepted. Wait for a new code and try again.',
        });
        return;
      }
      const claims = decodeAccessTokenClaims(verified.access_token);
      if (claims.aal !== 'aal2') {
        response.status(403).json({ error: 'Multi-factor verification did not reach the required security level.' });
        return;
      }
      setRefreshCookie(response, verified.refresh_token);
      response.status(200).json(session);
      return;
    }

    if (action === 'cancel_enrollment') {
      const factorId = typeof body.factorId === 'string' ? body.factorId : '';
      if (!uuidPattern.test(factorId)) {
        invalidRequest(response);
        return;
      }
      const { upstream: accountUpstream, account } = await loadAccount(accessToken);
      if (!accountUpstream.ok || !account?.id) {
        response.status(401).json({ error: 'Your session could not be verified.' });
        return;
      }
      if (rawFactor(account, factorId)?.status !== 'unverified') {
        response.status(409).json({
          error: 'Only an unfinished authenticator setup can be cancelled here.',
        });
        return;
      }
      const upstream = await supabaseAuthRequest(`factors/${factorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await authPayload(upstream);
      if (!upstream.ok) {
        response.status(400).json({
          error: 'The unfinished authenticator setup could not be removed.',
        });
        return;
      }
      await refreshAfterFactorChange(request, response);
      return;
    }

    if (action === 'unenroll') {
      const factorId = typeof body.factorId === 'string' ? body.factorId : '';
      if (!uuidPattern.test(factorId)) {
        invalidRequest(response);
        return;
      }
      const { upstream: accountUpstream, account } = await loadAccount(accessToken);
      if (!accountUpstream.ok || !account?.id) {
        response.status(401).json({ error: 'Your session could not be verified.' });
        return;
      }
      const factor = rawFactor(account, factorId);
      if (factor?.status !== 'verified' || factor.factor_type !== 'totp') {
        response.status(409).json({
          error: 'This verified authenticator could not be confirmed for removal.',
        });
        return;
      }
      if (!hasFreshAal2(accessToken)) {
        response.status(403).json({
          error: 'Sign in again and verify an authenticator before removing a sign-in method.',
        });
        return;
      }
      const factors = safeMfaFactors(account);
      const applicationRole = await currentUserAppRole(accessToken);
      const minimumVerifiedFactors = privilegedRoles.has(applicationRole) ? 2 : 0;
      if (factors.length <= minimumVerifiedFactors) {
        response.status(409).json({
          error: 'Add and verify another authenticator before removing this one.',
        });
        return;
      }
      const upstream = await supabaseAuthRequest(`factors/${factorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await authPayload(upstream);
      if (!upstream.ok) {
        response.status(403).json({
          error: 'Verify with your authenticator before removing this sign-in method.',
        });
        return;
      }
      await refreshAfterFactorChange(request, response);
      return;
    }

    invalidRequest(response);
  } catch (error) {
    logAuthFailure(`mfa:${action || 'unknown'}`, error);
    response.status(503).json({ error: 'Authenticator security is temporarily unavailable.' });
  }
}
