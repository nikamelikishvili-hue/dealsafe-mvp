import {
  authProviderCode,
  authPayload,
  isStrongPassword,
  isAuthProviderRateLimited,
  logAuthFailure,
  logAuthRejection,
  prepareResponse,
  publicSession,
  readJsonBody,
  requireJsonContentType,
  requirePost,
  requireSameOrigin,
  respondAuthRateLimited,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

function signupRejection(code) {
  if (code === 'email_address_invalid' || code === 'email_address_not_authorized') {
    return {
      status: 400,
      error: 'This email address could not be used. Check the spelling or use another email address.',
    };
  }
  if (code === 'signup_disabled') {
    return {
      status: 503,
      error: 'New account creation is temporarily unavailable. Please try again later.',
    };
  }
  return {
    status: 400,
    error: 'We could not create this account. If you have used this email before, sign in or choose Forgot password. Otherwise, wait one minute and try again.',
  };
}

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response) || !requireJsonContentType(request, response)) return;

  const body = readJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  if (!email || email.length > 320 || displayName.length < 2 || displayName.length > 80) {
    response.status(400).json({ error: 'Enter a valid name and email.' });
    return;
  }
  if (!isStrongPassword(password)) {
    response.status(400).json({
      error: 'Use 12+ characters with uppercase, lowercase, a number, and a symbol.',
    });
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
    }, request);
    const data = await authPayload(upstream);
    if (!upstream.ok) {
      const code = authProviderCode(data);
      logAuthRejection('signup', upstream.status, code);
      if (isAuthProviderRateLimited(upstream, data)) {
        respondAuthRateLimited(
          response,
          upstream,
          'Too many account requests were made. Wait at least one minute, then try again. If you have used this email before, sign in or reset your password.',
        );
        return;
      }
      const rejection = signupRejection(code);
      response.status(rejection.status).json({ error: rejection.error });
      return;
    }

    const session = publicSession(data);
    const hasSessionMaterial = data.access_token !== undefined || data.refresh_token !== undefined;
    if (hasSessionMaterial && (!session || !data.refresh_token)) {
      throw new Error('Authentication provider response was rejected.');
    }
    if (session && data.refresh_token) {
      setRefreshCookie(response, data.refresh_token);
      response.status(200).json({ session, needsEmailConfirmation: false });
      return;
    }
    response.status(202).json({ session: null, needsEmailConfirmation: true });
  } catch (error) {
    logAuthFailure('signup', error);
    response.status(503).json({ error: 'Account creation is temporarily unavailable.' });
  }
}
