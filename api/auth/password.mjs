import {
  authPayload,
  authProviderCode,
  clearRefreshCookie,
  isAuthProviderRateLimited,
  isStrongPassword,
  logAuthFailure,
  logAuthRejection,
  prepareResponse,
  readBearerToken,
  readJsonBody,
  requireJsonContentType,
  requirePost,
  requireSameOrigin,
  respondAuthRateLimited,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';

function currentPasswordMode() {
  const mode = (process.env.DEALIVRA_CURRENT_PASSWORD_MODE || 'staged')
    .trim()
    .toLowerCase();
  if (!['staged', 'enforced'].includes(mode)) {
    throw new Error('Current-password verification mode is invalid.');
  }
  return mode;
}

export default async function handler(request, response) {
  prepareResponse(response);
  if (!requirePost(request, response) || !requireSameOrigin(request, response) || !requireJsonContentType(request, response)) return;

  const body = readJsonBody(request);
  const action = typeof body?.action === 'string' ? body.action : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const accessToken = readBearerToken(request);

  if (
    !body
    || !accessToken
    || !['change', 'recovery'].includes(action)
    || !isStrongPassword(newPassword)
    || (action === 'change' && (!currentPassword || currentPassword.length > 256))
    || (action === 'recovery' && currentPassword)
  ) {
    response.status(400).json({
      error: 'Enter a valid password using 12+ characters, uppercase, lowercase, a number, and a symbol.',
    });
    return;
  }

  try {
    if (action === 'change' && currentPasswordMode() !== 'enforced') {
      response.status(503).json({
        error: 'Signed-in password changes are temporarily unavailable while additional verification is being activated. Password recovery remains available.',
      });
      return;
    }

    const upstream = await supabaseAuthRequest('user', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        password: newPassword,
        ...(action === 'change' ? { current_password: currentPassword } : {}),
      }),
    }, request);
    const data = await authPayload(upstream);
    if (!upstream.ok || !data?.id) {
      const code = authProviderCode(data);
      logAuthRejection(`password:${action}`, upstream.status, code);
      if (isAuthProviderRateLimited(upstream, data)) {
        respondAuthRateLimited(
          response,
          upstream,
          'Too many password security requests were made. Wait briefly, then try again.',
        );
        return;
      }
      if (upstream.status === 401 || upstream.status === 403) {
        clearRefreshCookie(response);
        response.status(401).json({
          error: action === 'recovery'
            ? 'This password reset link is invalid or expired. Request a new link.'
            : 'Your session expired. Sign in again before changing your password.',
        });
        return;
      }
      response.status(400).json({
        error: action === 'recovery'
          ? 'The new password was not accepted. Request a new reset link if this one has expired.'
          : 'The current password could not be verified or the new password was not accepted.',
      });
      return;
    }

    clearRefreshCookie(response);
    response.status(204).end();
  } catch (error) {
    logAuthFailure(`password:${action}`, error);
    response.status(503).json({
      error: 'Password security is temporarily unavailable. Please try again later.',
    });
  }
}
