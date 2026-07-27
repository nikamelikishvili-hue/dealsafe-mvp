import {
  authPayload,
  clearRefreshCookie,
  prepareResponse,
  publicSession,
  readRefreshToken,
  requirePost,
  requireSameOrigin,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response)) return;

  const refreshToken = readRefreshToken(request);
  if (!refreshToken) {
    response.status(401).json({ error: 'Your session expired. Please sign in again.' });
    return;
  }

  try {
    const upstream = await supabaseAuthRequest('token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await authPayload(upstream);
    const session = publicSession(data);
    if (!upstream.ok || !session || !data.refresh_token) {
      clearRefreshCookie(response);
      response.status(401).json({ error: 'Your session expired. Please sign in again.' });
      return;
    }

    setRefreshCookie(response, data.refresh_token);
    response.status(200).json(session);
  } catch {
    response.status(503).json({ error: 'Session refresh is temporarily unavailable.' });
  }
}
