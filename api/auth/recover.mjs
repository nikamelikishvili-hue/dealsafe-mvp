import {
  authPayload,
  authProviderCode,
  isAuthProviderRateLimited,
  logAuthFailure,
  logAuthRejection,
  prepareResponse,
  readJsonBody,
  requestOrigin,
  requirePost,
  requireSameOrigin,
  respondAuthRateLimited,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

const recoveryAccepted = {
  message: 'If an account exists for this email, a password reset link has been sent.',
};

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response)) return;

  const body = readJsonBody(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const redirectOrigin = requestOrigin(request);
  if (
    !redirectOrigin
    || !email
    || email.length > 320
    || email.includes('\r')
    || email.includes('\n')
    || !email.includes('@')
  ) {
    response.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }

  try {
    const upstream = await supabaseAuthRequest(
      `recover?redirect_to=${encodeURIComponent(redirectOrigin)}`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      request,
    );
    const data = await authPayload(upstream);
    if (!upstream.ok) {
      const code = authProviderCode(data);
      logAuthRejection('recover', upstream.status, code);
      if (isAuthProviderRateLimited(upstream, data)) {
        respondAuthRateLimited(
          response,
          upstream,
          'Too many password reset requests were made. Wait at least one minute, then try again.',
        );
        return;
      }
      if (upstream.status >= 500) {
        response.status(503).json({
          error: 'Password recovery is temporarily unavailable.',
        });
        return;
      }
    }

    response.status(202).json(recoveryAccepted);
  } catch (error) {
    logAuthFailure('recover', error);
    response.status(503).json({
      error: 'Password recovery is temporarily unavailable.',
    });
  }
}
