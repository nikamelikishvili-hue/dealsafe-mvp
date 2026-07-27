import {
  authPayload,
  clearRefreshCookie,
  prepareResponse,
  requirePost,
  requireSameOrigin,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response)) return;
  clearRefreshCookie(response);

  const authorization = request.headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    try {
      const upstream = await supabaseAuthRequest('logout', {
        method: 'POST',
        headers: { Authorization: authorization },
        body: '{}',
      });
      await authPayload(upstream);
    } catch {
      // The local cookie is still cleared. The access JWT remains short-lived.
    }
  }

  response.status(204).end();
}
