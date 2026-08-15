import {
  authProviderCode,
  authPayload,
  clearRefreshCookie,
  decodeAccessTokenClaims,
  hasVerifiedMfaFactor,
  isAuthProviderRateLimited,
  logAuthFailure,
  logAuthRejection,
  prepareResponse,
  publicSession,
  readRefreshToken,
  requirePost,
  requireSameOrigin,
  respondAuthRateLimited,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response)) return;

  const refreshToken = readRefreshToken(request);
  if (!refreshToken) {
    clearRefreshCookie(response);
    response.status(401).json({ error: 'Your session expired. Please sign in again.' });
    return;
  }

  try {
    const upstream = await supabaseAuthRequest('token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }, request);
    const data = await authPayload(upstream);
    const session = publicSession(data);
    if (!upstream.ok || !session || !data.refresh_token) {
      const code = authProviderCode(data);
      logAuthRejection('refresh', upstream.status, code);
      if (isAuthProviderRateLimited(upstream, data)) {
        respondAuthRateLimited(
          response,
          upstream,
          'Too many session refresh requests were made. Wait briefly, then try again.',
        );
        return;
      }
      clearRefreshCookie(response);
      response.status(401).json({ error: 'Your session expired. Please sign in again.' });
      return;
    }

    const claims = decodeAccessTokenClaims(data.access_token);
    if (
      hasVerifiedMfaFactor(data.user)
      && claims.aal !== 'aal2'
    ) {
      clearRefreshCookie(response);
      response.status(401).json({ error: 'Verify your authenticator by signing in again.' });
      return;
    }

    setRefreshCookie(response, data.refresh_token);
    response.status(200).json(session);
  } catch (error) {
    logAuthFailure('refresh', error);
    response.status(503).json({ error: 'Session refresh is temporarily unavailable.' });
  }
}
