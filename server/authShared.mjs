import { isIP } from 'node:net';
import {
  serializeBoundedAuthProviderJson,
  validateAuthProviderRequest,
} from './authProviderRequest.mjs';
import {
  AuthProviderResponseBoundaryError,
  readBoundedAuthProviderJson,
} from './authProviderResponse.mjs';
import { recordServerFailure } from './serverFailureReporter.mjs';

const refreshCookieName = '__Host-dealivra-refresh';
// The __Host- prefix is accepted by browsers only when Path is exactly "/"
// and no Domain attribute is present.
const refreshCookiePath = '/';
const refreshMaxAgeSeconds = 8 * 60 * 60;
const maxRefreshCookieValueLength = 3800;
const maxJsonBodyBytes = 16_384;
const authProviderTimeoutMs = 10_000;

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
}

export function requestOrigin(request) {
  const value = header(request, 'origin');
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    const isLocalDevelopment = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (
      (parsed.protocol !== 'https:' && !(isLocalDevelopment && parsed.protocol === 'http:'))
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function configuredSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')
    .replace(/\s+/g, '');
  if (!url || !key) throw new Error('Authentication service is not configured.');
  if (/^sb_secret_/i.test(key)) {
    throw new Error('Authentication service publishable key is invalid.');
  }

  try {
    const parsedUrl = new URL(url);
    const isLocalDevelopment = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    if (parsedUrl.protocol !== 'https:' && !(isLocalDevelopment && parsedUrl.protocol === 'http:')) {
      throw new Error('Unsupported authentication service protocol.');
    }
    if (
      parsedUrl.username
      || parsedUrl.password
      || parsedUrl.search
      || parsedUrl.hash
      || (parsedUrl.pathname !== '' && parsedUrl.pathname !== '/')
    ) {
      throw new Error('Authentication service URL must contain only the project origin.');
    }
  } catch {
    throw new Error('Authentication service URL is invalid.');
  }

  return { url, key };
}

function configuredAuthProvider(request) {
  const configured = configuredSupabase();
  const mode = (process.env.DEALIVRA_AUTH_IP_FORWARDING_MODE || 'disabled')
    .trim()
    .toLowerCase();
  if (mode === 'disabled') {
    return { ...configured, forwardedIp: null };
  }
  if (mode !== 'enforced') {
    throw new Error('Authentication IP forwarding mode is invalid.');
  }

  const secretKey = (process.env.SUPABASE_AUTH_SECRET_KEY || '').trim();
  if (
    !secretKey.startsWith('sb_secret_')
    || secretKey.length < 32
    || secretKey.length > 512
    || /\s/.test(secretKey)
  ) {
    throw new Error('Authentication IP forwarding is not configured.');
  }

  const forwardedIp = header(request, 'x-vercel-forwarded-for');
  if (
    typeof forwardedIp !== 'string'
    || forwardedIp.length > 64
    || forwardedIp !== forwardedIp.trim()
    || forwardedIp.includes(',')
    || isIP(forwardedIp) === 0
  ) {
    throw new Error('Authentication client address could not be verified.');
  }

  return {
    url: configured.url,
    key: secretKey,
    forwardedIp,
  };
}

function providerFailureCode(error) {
  if (error instanceof AuthProviderResponseBoundaryError) {
    return 'PROVIDER_RESPONSE_INVALID';
  }
  if (
    error instanceof DOMException
    && (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return 'PROVIDER_TIMEOUT';
  }
  const message = error instanceof Error ? error.message : '';
  if (/invalid character|invalid header|header value|headers/i.test(message)) {
    return 'INVALID_HEADER_VALUE';
  }
  if (/failed to parse url|invalid url|unsupported protocol/i.test(message)) {
    return 'INVALID_ENDPOINT_URL';
  }
  if (/fetch is not defined|fetch is not a function/i.test(message)) {
    return 'FETCH_UNAVAILABLE';
  }
  if (/fetch failed|network|socket|connect|timeout/i.test(message)) {
    return 'NETWORK_REQUEST_FAILED';
  }
  if (error instanceof TypeError) return 'PROVIDER_TYPE_ERROR';
  return 'PROVIDER_REQUEST_FAILED';
}

export function prepareResponse(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

export function requirePost(request, response) {
  if (request.method === 'POST') return true;
  response.setHeader('Allow', 'POST');
  response.status(405).json({ error: 'Method not allowed.' });
  return false;
}

export function requireJsonContentType(request, response) {
  const contentType = String(header(request, 'content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType === 'application/json') return true;
  response.status(415).json({ error: 'Content-Type must be application/json.' });
  return false;
}

export function requireSameOrigin(
  request,
  response,
  crossOriginMessage = 'Cross-origin authentication is not allowed.',
) {
  const origin = requestOrigin(request);
  const forwardedHost = header(request, 'x-forwarded-host');
  const host = forwardedHost || header(request, 'host');
  if (!origin || !host) {
    response.status(403).json({ error: 'Request origin could not be verified.' });
    return false;
  }

  try {
    if (
      typeof host !== 'string'
      || host.length > 255
      || host !== host.trim()
      || host.includes(',')
      || host.includes('/')
      || host.includes('\\')
      || new URL(`https://${host}`).host !== host
      || new URL(origin).host !== host
    ) {
      response.status(403).json({ error: crossOriginMessage });
      return false;
    }
  } catch {
    response.status(403).json({ error: 'Request origin could not be verified.' });
    return false;
  }
  return true;
}

export function readJsonBody(request) {
  const declaredLength = Number(header(request, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxJsonBodyBytes) return null;

  if (request.body && typeof request.body === 'object') {
    try {
      const serialized = JSON.stringify(request.body);
      if (new TextEncoder().encode(serialized).byteLength > maxJsonBodyBytes) return null;
      return request.body;
    } catch {
      return null;
    }
  }

  if (typeof request.body === 'string') {
    try {
      if (new TextEncoder().encode(request.body).byteLength > maxJsonBodyBytes) return null;
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }
  return null;
}

export function readRefreshToken(request) {
  const cookie = header(request, 'cookie') || '';
  if (typeof cookie !== 'string' || cookie.length > 16_384) return null;
  let encodedToken = null;
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === refreshCookieName) {
      if (encodedToken !== null) return null;
      encodedToken = value.join('=');
    }
  }
  if (!encodedToken || encodedToken.length > maxRefreshCookieValueLength) return null;
  try {
    const token = decodeURIComponent(encodedToken);
    return token && token.length <= maxRefreshCookieValueLength ? token : null;
  } catch {
    return null;
  }
}

export function readBearerToken(request) {
  const authorization = header(request, 'authorization');
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token && token.length <= 8192 ? token : null;
}

export function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && password.length <= 256
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/.test(password);
}

export function decodeAccessTokenClaims(accessToken) {
  try {
    const encoded = accessToken.split('.')[1];
    if (!encoded) return {};
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(
      normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='),
      'base64',
    ).toString('utf8');
    const claims = JSON.parse(decoded);
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : {};
  } catch {
    return {};
  }
}

export function safeMfaFactors(user) {
  if (!Array.isArray(user?.factors)) return [];
  return user.factors
    .filter((factor) => (
      factor
      && factor.status === 'verified'
      && factor.factor_type === 'totp'
      && typeof factor.id === 'string'
    ))
    .map((factor) => ({
      id: factor.id,
      factorType: 'totp',
      friendlyName: typeof factor.friendly_name === 'string' && factor.friendly_name.trim()
        ? factor.friendly_name.trim().slice(0, 80)
        : 'Authenticator app',
      createdAt: typeof factor.created_at === 'string' ? factor.created_at : null,
      updatedAt: typeof factor.updated_at === 'string' ? factor.updated_at : null,
    }));
}

export function hasVerifiedMfaFactor(user) {
  return Array.isArray(user?.factors)
    && user.factors.some((factor) => factor?.status === 'verified');
}

export function setRefreshCookie(response, refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new Error('Authentication provider returned an invalid refresh credential.');
  }
  const encodedToken = encodeURIComponent(refreshToken);
  if (encodedToken.length > maxRefreshCookieValueLength) {
    throw new Error('Authentication provider returned an invalid refresh credential.');
  }
  response.setHeader(
    'Set-Cookie',
    `${refreshCookieName}=${encodedToken}; Path=${refreshCookiePath}; Max-Age=${refreshMaxAgeSeconds}; HttpOnly; Secure; SameSite=Strict; Priority=High`,
  );
}

export function clearRefreshCookie(response) {
  response.setHeader(
    'Set-Cookie',
    `${refreshCookieName}=; Path=${refreshCookiePath}; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Priority=High`,
  );
}

export async function supabaseAuthRequest(path, init, request) {
  validateAuthProviderRequest(
    path,
    init,
    request && typeof request === 'object' ? requestOrigin(request) : null,
  );
  const { url, key, forwardedIp } = configuredAuthProvider(request);
  try {
    return await fetch(`${url}/auth/v1/${path}`, {
      ...init,
      signal: AbortSignal.timeout(authProviderTimeoutMs),
      headers: {
        ...(init?.headers || {}),
        apikey: key,
        'Content-Type': 'application/json',
        ...(forwardedIp ? { 'Sb-Forwarded-For': forwardedIp } : {}),
      },
    });
  } catch (error) {
    const providerError = new Error('Authentication provider request failed.', { cause: error });
    providerError.code = providerFailureCode(error);
    throw providerError;
  }
}

export async function currentUserAppRole(accessToken) {
  const { url, key } = configuredSupabase();
  try {
    const upstream = await fetch(`${url}/rest/v1/rpc/current_user_app_role`, {
      method: 'POST',
      signal: AbortSignal.timeout(authProviderTimeoutMs),
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const role = await readBoundedAuthProviderJson(upstream);
    if (
      !upstream.ok
      || typeof role !== 'string'
      || !['member', 'support', 'compliance', 'admin'].includes(role)
    ) {
      throw new Error('Application role could not be verified.');
    }
    return role;
  } catch (error) {
    if (error instanceof Error && error.message === 'Application role could not be verified.') {
      throw error;
    }
    const providerError = new Error('Application role provider request failed.', { cause: error });
    providerError.code = providerFailureCode(error);
    throw providerError;
  }
}

export async function supabaseRestRpcRequest(accessToken, functionName, parameters = {}) {
  if (
    typeof accessToken !== 'string'
    || !accessToken
    || typeof functionName !== 'string'
    || !/^[a-z][a-z0-9_]{2,95}$/.test(functionName)
    || !parameters
    || typeof parameters !== 'object'
    || Array.isArray(parameters)
  ) {
    throw new Error('Database function request is invalid.');
  }

  const { url, key } = configuredSupabase();
  const body = serializeBoundedAuthProviderJson(parameters);
  try {
    return await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      signal: AbortSignal.timeout(authProviderTimeoutMs),
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
  } catch (error) {
    const providerError = new Error('Database function provider request failed.', { cause: error });
    providerError.code = providerFailureCode(error);
    throw providerError;
  }
}

export async function authProviderPayload(upstream) {
  return readBoundedAuthProviderJson(upstream, {
    allowEmpty: upstream?.status === 204,
  });
}

export async function authPayload(upstream) {
  const data = await authProviderPayload(upstream);
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

export function authProviderCode(data) {
  const value = typeof data?.code === 'string' ? data.code : '';
  return /^[a-z0-9_]{1,64}$/.test(value) ? value : 'unknown';
}

export function isAuthProviderRateLimited(upstream, data) {
  const code = authProviderCode(data);
  return upstream?.status === 429
    || code === 'over_email_send_rate_limit'
    || code === 'over_request_rate_limit';
}

export function respondAuthRateLimited(
  response,
  upstream,
  message = 'Too many authentication requests were made. Wait at least one minute, then try again.',
) {
  const retryHeader = upstream?.headers?.get?.('retry-after');
  const parsedRetryAfter = typeof retryHeader === 'string' && /^\d{1,10}$/.test(retryHeader.trim())
    ? Number(retryHeader)
    : Number.NaN;
  const retryAfter = Number.isInteger(parsedRetryAfter)
    ? Math.min(Math.max(parsedRetryAfter, 1), 300)
    : 60;
  response.setHeader('Retry-After', String(retryAfter));
  response.status(429).json({ error: message, retryAfter });
}

export function logAuthRejection(operation, status, code) {
  const safeOperation = typeof operation === 'string' && /^[a-z][a-z0-9:_-]{1,63}$/.test(operation)
    ? operation
    : 'unknown';
  const safeStatus = Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
  const safeCode = typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)
    ? code
    : 'unknown';
  console.warn('[dealivra-auth-rejection]', {
    schema: 'dealivra.auth.rejection.v1',
    operation: safeOperation,
    status: safeStatus,
    code: safeCode,
  });
}

export function publicSession(data) {
  if (!data.access_token || !data.user?.id || !data.user?.email) return null;
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at || null,
      user_metadata: {
        display_name: data.user.user_metadata?.display_name || null,
      },
    },
  };
}

export function logAuthFailure(operation, error) {
  const message = error instanceof Error ? error.message : '';
  const issue = message === 'Authentication service is not configured.'
    ? 'configuration_missing'
    : /invalid url|failed to parse url|service url is invalid/i.test(message)
      ? 'configuration_invalid'
      : /fetch failed|network|provider request failed|provider response was rejected/i.test(message)
        ? 'provider_unavailable'
        : 'unexpected_failure';
  const boundary = `auth_${String(operation || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90) || 'unknown'}`;
  recordServerFailure({
    schema: 'dealivra.server-failure.v1',
    boundary,
    issue,
  });
}
