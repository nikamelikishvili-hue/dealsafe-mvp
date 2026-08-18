function header(request, name) {
  if (typeof request.headers?.get === 'function') return request.headers.get(name);
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function prepareReportingResponse(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

export function failReportingRequest(response, status, error) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json({ error });
}

function hasCanonicalSameOrigin(request) {
  const origin = header(request, 'origin');
  const host = header(request, 'x-forwarded-host') || header(request, 'host');
  if (
    typeof origin !== 'string'
    || origin.length > 2_048
    || typeof host !== 'string'
    || host.length > 255
    || host.includes(',')
  ) return false;

  try {
    const parsed = new URL(origin);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return (
      (parsed.protocol === 'https:' || (local && parsed.protocol === 'http:'))
      && !parsed.username
      && !parsed.password
      && parsed.pathname === '/'
      && !parsed.search
      && !parsed.hash
      && parsed.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}

export function validateReportingRequest(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    failReportingRequest(response, 405, 'Method not allowed.');
    return false;
  }
  if (!hasCanonicalSameOrigin(request)) {
    failReportingRequest(response, 403, 'Request origin could not be verified.');
    return false;
  }
  const contentType = String(header(request, 'content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    failReportingRequest(response, 415, 'Unsupported report format.');
    return false;
  }
  return true;
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export async function readBoundedJson(request, maximumBodyBytes) {
  const declaredLength = Number(header(request, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBodyBytes) return null;

  if (
    request.body
    && typeof request.body === 'object'
    && !Buffer.isBuffer(request.body)
    && !(request.body instanceof Uint8Array)
  ) {
    try {
      return byteLength(JSON.stringify(request.body)) <= maximumBodyBytes
        ? request.body
        : null;
    } catch {
      return null;
    }
  }

  let raw = '';
  if (typeof request.body === 'string') {
    raw = request.body;
  } else if (Buffer.isBuffer(request.body) || request.body instanceof Uint8Array) {
    raw = Buffer.from(request.body).toString('utf8');
  } else if (typeof request[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.byteLength;
      if (length > maximumBodyBytes) return null;
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (!raw || byteLength(raw) > maximumBodyBytes) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function reportingRuntimeMetadata() {
  const environment = ['production', 'preview', 'development'].includes(process.env.VERCEL_ENV)
    ? process.env.VERCEL_ENV
    : 'unknown';
  const commit = /^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA || '')
    ? process.env.VERCEL_GIT_COMMIT_SHA.toLowerCase()
    : 'unknown';
  return { environment, release: commit };
}
