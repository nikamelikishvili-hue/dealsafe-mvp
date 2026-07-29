import {
  authPayload,
  clearRefreshCookie,
  hasVerifiedMfaFactor,
  logAuthFailure,
  prepareResponse,
  publicSession,
  readJsonBody,
  requirePost,
  requireSameOrigin,
  safeMfaFactors,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

function providerCode(data) {
  const value = typeof data?.code === 'string' ? data.code : '';
  return /^[a-z0-9_]{1,64}$/.test(value) ? value : 'unknown';
}

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response)) return;

  const body = readJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password || email.length > 320 || password.length > 256) {
    response.status(400).json({ error: 'Enter a valid email and password.' });
    return;
  }

  try {
    const upstream = await supabaseAuthRequest('token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await authPayload(upstream);
    const session = publicSession(data);
    if (!upstream.ok || !session || !data.refresh_token) {
      console.warn('[dealivra-auth-rejection]', {
        operation: 'login',
        status: upstream.status,
        code: providerCode(data),
      });
      response.status(401).json({
        error: 'We could not sign you in. Check your email and password, or choose Forgot password to securely reset it.',
      });
      return;
    }

    const factors = safeMfaFactors(data.user);
    if (hasVerifiedMfaFactor(data.user) && factors.length === 0) {
      clearRefreshCookie(response);
      response.status(403).json({
        error: 'This account uses an unsupported authenticator method. Contact Dealivra support without sharing any verification code.',
      });
      return;
    }
    if (factors.length > 0) {
      clearRefreshCookie(response);
      response.status(200).json({
        mfa_required: true,
        pending_access_token: data.access_token,
        expires_in: data.expires_in,
        factors,
      });
      return;
    }

    setRefreshCookie(response, data.refresh_token);
    response.status(200).json(session);
  } catch (error) {
    logAuthFailure('login', error);
    response.status(503).json({ error: 'Authentication is temporarily unavailable.' });
  }
}
