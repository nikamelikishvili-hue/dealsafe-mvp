import {
  authProviderCode,
  authPayload,
  clearRefreshCookie,
  hasVerifiedMfaFactor,
  isAuthProviderRateLimited,
  logAuthFailure,
  logAuthRejection,
  prepareResponse,
  publicSession,
  readJsonBody,
  requirePost,
  requireSameOrigin,
  respondAuthRateLimited,
  safeMfaFactors,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

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
    }, request);
    const data = await authPayload(upstream);
    const session = publicSession(data);
    if (!upstream.ok || !session || !data.refresh_token) {
      const code = authProviderCode(data);
      logAuthRejection('login', upstream.status, code);
      if (isAuthProviderRateLimited(upstream, data)) {
        respondAuthRateLimited(
          response,
          upstream,
          'Too many sign-in attempts were made. Wait at least one minute, then try again or securely reset your password.',
        );
        return;
      }
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
