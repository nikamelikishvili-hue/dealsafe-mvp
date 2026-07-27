import {
  authPayload,
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
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  if (!email || email.length > 320 || displayName.length < 2 || displayName.length > 80) {
    response.status(400).json({ error: 'Enter a valid name and email.' });
    return;
  }
  if (
    password.length < 12
    || password.length > 256
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/\d/.test(password)
  ) {
    response.status(400).json({ error: 'Use 12+ characters with uppercase, lowercase, and a number.' });
    return;
  }

  try {
    const upstream = await supabaseAuthRequest('signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: { display_name: displayName },
      }),
    });
    const data = await authPayload(upstream);
    if (!upstream.ok) {
      response.status(400).json({ error: 'Account creation could not be completed.' });
      return;
    }

    const session = publicSession(data);
    if (session && data.refresh_token) {
      setRefreshCookie(response, data.refresh_token);
      response.status(200).json({ session, needsEmailConfirmation: false });
      return;
    }
    response.status(202).json({ session: null, needsEmailConfirmation: true });
  } catch {
    response.status(503).json({ error: 'Account creation is temporarily unavailable.' });
  }
}
