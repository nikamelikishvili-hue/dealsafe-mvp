import { randomBytes } from 'node:crypto';
import {
  authPayload,
  clearRefreshCookie,
  decodeAccessTokenClaims,
  hasVerifiedMfaFactor,
  logAuthFailure,
  publicSession,
  readRefreshToken,
  setRefreshCookie,
  supabaseAuthRequest,
} from '../../server/authShared.mjs';
import {
  architecturePocEnabled,
  prepareArchitecturePocResponse,
  renderArchitecturePocPage,
} from '../../server/architecturePoc.mjs';

function redirectToSignIn(response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Location', '/signin?returnTo=%2F__architecture%2Fprotected');
  response.status(307).end();
}

export default async function handler(request, response) {
  if (!architecturePocEnabled()) {
    response.status(404).end();
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).end();
    return;
  }

  const refreshToken = readRefreshToken(request);
  if (!refreshToken) {
    clearRefreshCookie(response);
    redirectToSignIn(response);
    return;
  }

  try {
    const upstream = await supabaseAuthRequest('token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }, request);
    const data = await authPayload(upstream);
    const session = publicSession(data);
    const claims = session ? decodeAccessTokenClaims(session.access_token) : {};
    if (
      !upstream.ok
      || !session
      || typeof data.refresh_token !== 'string'
      || (hasVerifiedMfaFactor(data.user) && claims.aal !== 'aal2')
    ) {
      clearRefreshCookie(response);
      redirectToSignIn(response);
      return;
    }

    setRefreshCookie(response, data.refresh_token);
    const nonce = randomBytes(18).toString('base64url');
    prepareArchitecturePocResponse(response, nonce);
    response.status(200).send(renderArchitecturePocPage({
      nonce,
      protectedRoute: true,
      displayName: session.user.user_metadata.display_name || 'Verified member',
    }));
  } catch (error) {
    logAuthFailure('architecture_poc', error);
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.status(503).send('The protected Preview route is temporarily unavailable.');
  }
}
