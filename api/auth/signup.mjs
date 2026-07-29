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

function providerCode(data) {
  const value = typeof data?.code === 'string' ? data.code : '';
  return /^[a-z0-9_]{1,64}$/.test(value) ? value : 'unknown';
}

function signupRejection(upstream, data) {
  const code = providerCode(data);
  console.warn('[dealivra-auth-rejection]', {
    operation: 'signup',
    status: upstream.status,
    code,
  });

  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return {
      status: 429,
      error: 'Too many account requests were made. Wait at least one minute, then try again. If you have used this email before, sign in or reset your password.',
    };
  }
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
    || !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/.test(password)
  ) {
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
    });
    const data = await authPayload(upstream);
    if (!upstream.ok) {
      const rejection = signupRejection(upstream, data);
      response.status(rejection.status).json({ error: rejection.error });
      return;
    }

    const session = publicSession(data);
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
