import {
  authProviderCode,
  authPayload,
  clearRefreshCookie,
  isAuthProviderRateLimited,
  logAuthFailure,
  logAuthRejection,
  prepareResponse,
  readJsonBody,
  requireJsonContentType,
  requirePost,
  requireSameOrigin,
  respondAuthRateLimited,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response) || !requireJsonContentType(request, response)) return;

  const body = readJsonBody(request);
  const scope = body?.scope ?? 'local';
  if (!body || !['local', 'others', 'global'].includes(scope)) {
    response.status(400).json({ error: 'Sign-out scope is invalid.' });
    return;
  }
  const authorization = request.headers?.authorization;
  const hasAccessToken = typeof authorization === 'string' && authorization.startsWith('Bearer ');

  if (!hasAccessToken) {
    if (scope === 'local') {
      clearRefreshCookie(response);
      response.status(204).end();
      return;
    }
    response.status(401).json({ error: 'Your session could not be verified.' });
    return;
  }

  try {
    const upstream = await supabaseAuthRequest(`logout?scope=${scope}`, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: '{}',
    }, request);
    const data = await authPayload(upstream);

    if (!upstream.ok) {
      if (scope === 'local') {
        clearRefreshCookie(response);
        response.status(204).end();
        return;
      }
      const code = authProviderCode(data);
      logAuthRejection(`logout:${scope}`, upstream.status, code);
      if (isAuthProviderRateLimited(upstream, data)) {
        respondAuthRateLimited(
          response,
          upstream,
          'Too many session security requests were made. Wait briefly, then try again.',
        );
        return;
      }
      response.status(502).json({ error: 'Could not sign out the selected sessions. Please try again.' });
      return;
    }
  } catch (error) {
    logAuthFailure(`logout:${scope}`, error);
    if (scope !== 'local') {
      response.status(503).json({ error: 'Could not reach the account service. Please try again.' });
      return;
    }
    // A local sign-out still clears the browser-only refresh cookie. The
    // short-lived access JWT is removed from sessionStorage by the client.
  }

  if (scope === 'local' || scope === 'global') {
    clearRefreshCookie(response);
  }
  if (scope === 'global') {
    response.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  response.status(204).end();
}
