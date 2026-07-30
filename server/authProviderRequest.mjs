const maximumRequestBytes = 16_384;
const factorIdPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const factorRoutePattern = new RegExp(`^factors/${factorIdPattern}(?:/(?:challenge|verify))?$`, 'i');
const factorDeletePattern = new RegExp(`^factors/${factorIdPattern}$`, 'i');

export class AuthProviderRequestBoundaryError extends Error {
  constructor() {
    super('Authentication provider request was rejected.');
    this.name = 'AuthProviderRequestBoundaryError';
    this.code = 'AUTH_PROVIDER_REQUEST_INVALID';
  }
}

function reject() {
  throw new AuthProviderRequestBoundaryError();
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requestRoute(path, method, expectedOrigin) {
  if (path === 'signup' && method === 'POST') return { authenticated: false, body: true };
  if (path === 'token?grant_type=password' && method === 'POST') {
    return { authenticated: false, body: true };
  }
  if (path === 'token?grant_type=refresh_token' && method === 'POST') {
    return { authenticated: false, body: true };
  }
  if (
    typeof expectedOrigin === 'string'
    && path === `recover?redirect_to=${encodeURIComponent(expectedOrigin)}`
    && method === 'POST'
  ) {
    return { authenticated: false, body: true };
  }
  if (path === 'user' && method === 'GET') return { authenticated: true, body: false };
  if (path === 'user' && method === 'PUT') return { authenticated: true, body: true };
  if (path === 'factors' && method === 'POST') return { authenticated: true, body: true };
  if (factorRoutePattern.test(path) && method === 'POST') {
    return { authenticated: true, body: true };
  }
  if (factorDeletePattern.test(path) && method === 'DELETE') {
    return { authenticated: true, body: false };
  }
  if (/^logout\?scope=(?:local|others|global)$/.test(path) && method === 'POST') {
    return { authenticated: true, body: true };
  }
  reject();
}

function validateHeaders(headers, authenticated) {
  if (headers === undefined) {
    if (authenticated) reject();
    return;
  }
  if (!isPlainObject(headers)) reject();
  const keys = Object.keys(headers);
  if (authenticated) {
    if (keys.length !== 1 || keys[0] !== 'Authorization') reject();
    const authorization = headers.Authorization;
    if (
      typeof authorization !== 'string'
      || !authorization.startsWith('Bearer ')
      || authorization.length < 8
      || authorization.length > 8_199
      || /[\r\n]/.test(authorization)
    ) {
      reject();
    }
    return;
  }
  if (keys.length !== 0) reject();
}

export function serializeBoundedAuthProviderJson(value) {
  if (!isPlainObject(value)) reject();
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    reject();
  }
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes < 2 || bytes > maximumRequestBytes) reject();
  return serialized;
}

export function validateAuthProviderRequest(path, init, expectedOrigin = null) {
  if (
    typeof path !== 'string'
    || path.length < 1
    || path.length > 2_048
    || !isPlainObject(init)
  ) {
    reject();
  }
  const keys = Object.keys(init);
  if (
    keys.some(key => !['method', 'headers', 'body'].includes(key))
    || typeof init.method !== 'string'
  ) {
    reject();
  }

  const route = requestRoute(path, init.method, expectedOrigin);
  validateHeaders(init.headers, route.authenticated);

  if (!route.body) {
    if ('body' in init && init.body !== undefined) reject();
    return;
  }
  if (typeof init.body !== 'string') reject();
  let body;
  try {
    body = JSON.parse(init.body);
  } catch {
    reject();
  }
  serializeBoundedAuthProviderJson(body);
}
