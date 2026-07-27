const refreshCookieName = '__Host-dealivra-refresh';
const refreshCookiePath = '/api/auth';
const refreshMaxAgeSeconds = 8 * 60 * 60;

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function configuredSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!url || !key) throw new Error('Authentication service is not configured.');
  return { url, key };
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
    if (name === refreshCookieName) return decodeURIComponent(value.join('='));
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
  return fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
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
