import {
  authPayload,
  logAuthFailure,
  prepareResponse,
  publicSession,
  readJsonBody,
  requirePost,
  requireSameOrigin,
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
    });
    const data = await authPayload(upstream);
    const session = publicSession(data);
    if (!upstream.ok || !session || !data.refresh_token) {
      response.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    setRefreshCookie(response, data.refresh_token);
    response.status(200).json(session);
  } catch (error) {
    logAuthFailure('login', error);
    response.status(503).json({ error: 'Authentication is temporarily unavailable.' });
  }
}
