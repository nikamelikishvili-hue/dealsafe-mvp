const refreshCookieName = '__Host-dealivra-refresh';
const refreshCookiePath = '/api/auth';
const refreshMaxAgeSeconds = 8 * 60 * 60;

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function configuredSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')
    .replace(/\s+/g, '');
  if (!url || !key) throw new Error('Authentication service is not configured.');

  try {
    const parsedUrl = new URL(url);
    const isLocalDevelopment = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    if (parsedUrl.protocol !== 'https:' && !(isLocalDevelopment && parsedUrl.protocol === 'http:')) {
      throw new Error('Unsupported authentication service protocol.');
    }
  } catch {
    throw new Error('Authentication service URL is invalid.');
  }

  return { url, key };
}

function providerFailureCode(error) {
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

export function requireSameOrigin(request, response) {
  const origin = header(request, 'origin');
  const forwardedHost = header(request, 'x-forwarded-host');
  const host = forwardedHost || header(request, 'host');
  if (!origin || !host) {
    response.status(403).json({ error: 'Request origin could not be verified.' });
    return false;
  }

  try {
    if (new URL(origin).host !== host) {
      response.status(403).json({ error: 'Cross-origin authentication is not allowed.' });
      return false;
    }
  } catch {
    response.status(403).json({ error: 'Request origin could not be verified.' });
    return false;
  }
  return true;
}

export function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string' && request.body.length <= 16_384) {
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }
  return null;
}

export function readRefreshToken(request) {
  const cookie = header(request, 'cookie') || '';
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === refreshCookieName) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setRefreshCookie(response, refreshToken) {
  response.setHeader(
    'Set-Cookie',
    `${refreshCookieName}=${encodeURIComponent(refreshToken)}; Path=${refreshCookiePath}; Max-Age=${refreshMaxAgeSeconds}; HttpOnly; Secure; SameSite=Strict; Priority=High`,
  );
}

export function clearRefreshCookie(response) {
  response.setHeader(
    'Set-Cookie',
    `${refreshCookieName}=; Path=${refreshCookiePath}; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Priority=High`,
  );
}

export async function supabaseAuthRequest(path, init) {
  const { url, key } = configuredSupabase();
  try {
    return await fetch(`${url}/auth/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    const providerError = new Error('Authentication provider request failed.', { cause: error });
    providerError.code = providerFailureCode(error);
    throw providerError;
  }
}

export async function authPayload(upstream) {
  const data = await upstream.json().catch(() => null);
  return data && typeof data === 'object' ? data : {};
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
  const safeMessage = message === 'Authentication service is not configured.'
    ? message
    : /invalid url|failed to parse url|service url is invalid/i.test(message)
      ? 'Authentication service URL is invalid.'
      : /fetch failed|network|provider request failed/i.test(message)
        ? 'Authentication provider request failed.'
        : 'Unexpected authentication service error.';
  const diagnosticTokens = [];
  const pending = [error];
  const visited = new Set();

  while (pending.length > 0 && diagnosticTokens.length < 8) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    for (const property of ['name', 'code']) {
      const value = current[property];
      if (
        (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(value))
        || (typeof value === 'number' && Number.isFinite(value))
      ) {
        diagnosticTokens.push(`${property}:${value}`);
      }
    }

    if ('cause' in current) pending.push(current.cause);
    if ('errors' in current && Array.isArray(current.errors)) {
      pending.push(...current.errors.slice(0, 3));
    }
  }

  console.error('[dealivra-auth]', {
    operation,
    error: safeMessage,
    ...(diagnosticTokens.length > 0 ? { diagnostics: diagnosticTokens } : {}),
  });
}
