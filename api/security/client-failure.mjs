import { randomUUID } from 'node:crypto';

const maximumBodyBytes = 512;
const allowedPairs = new Set([
  'application_render:react_render_failed',
  'application_bootstrap:bundle_load_failed',
  'application_bootstrap:localization_initialization_failed',
  'browser_runtime:window_error',
  'browser_runtime:unhandled_promise_rejection',
  'address_autocomplete:provider_load_failed',
  'address_autocomplete:suggestion_request_failed',
  'address_autocomplete:place_details_failed',
]);

function header(request, name) {
  if (typeof request.headers?.get === 'function') {
    return request.headers.get(name);
  }
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function prepare(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function fail(response, status, error) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json({ error });
}

function sameOrigin(request) {
  const origin = header(request, 'origin');
  const host = header(request, 'x-forwarded-host') || header(request, 'host');
  if (
    typeof origin !== 'string'
    || origin.length > 2_048
    || typeof host !== 'string'
    || host.length > 255
    || host.includes(',')
  ) {
    return false;
  }
  try {
    const parsed = new URL(origin);
    const local = parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1';
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

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

async function readBody(request) {
  const declaredLength = Number(header(request, 'content-length'));
  if (
    Number.isFinite(declaredLength)
    && declaredLength > maximumBodyBytes
  ) {
    return null;
  }

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
  } else if (
    Buffer.isBuffer(request.body)
    || request.body instanceof Uint8Array
  ) {
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

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    Object.keys(value).length !== 4
    || value.schema !== 'dealivra.client-failure.v1'
    || typeof value.boundary !== 'string'
    || typeof value.issue !== 'string'
    || !allowedPairs.has(`${value.boundary}:${value.issue}`)
    || !Number.isSafeInteger(value.occurrence_count)
    || value.occurrence_count < 1
    || value.occurrence_count > 100
  ) {
    return null;
  }
  return {
    event_schema: value.schema,
    boundary: value.boundary,
    issue: value.issue,
    occurrence_count: value.occurrence_count,
  };
}

function runtimeMetadata() {
  const environment = ['production', 'preview', 'development'].includes(
    process.env.VERCEL_ENV,
  )
    ? process.env.VERCEL_ENV
    : 'unknown';
  const commit = /^[a-f0-9]{40}$/i.test(
    process.env.VERCEL_GIT_COMMIT_SHA || '',
  )
    ? process.env.VERCEL_GIT_COMMIT_SHA.toLowerCase()
    : 'unknown';
  return { environment, release: commit };
}

export default async function handler(request, response) {
  prepare(response);
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    fail(response, 405, 'Method not allowed.');
    return;
  }
  if (!sameOrigin(request)) {
    fail(response, 403, 'Request origin could not be verified.');
    return;
  }
  const contentType = String(header(request, 'content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    fail(response, 415, 'Unsupported report format.');
    return;
  }

  const mode = process.env.DEALIVRA_CLIENT_FAILURE_MODE || 'staged';
  if (mode === 'staged') {
    response.status(204).end();
    return;
  }
  if (mode !== 'enforced') {
    fail(response, 503, 'Monitoring is unavailable.');
    return;
  }

  const event = normalize(await readBody(request));
  if (!event) {
    fail(response, 400, 'Report is invalid.');
    return;
  }

  // This is the complete log contract. Do not add URLs, request headers,
  // errors, stacks, browser state, identifiers, or provider content.
  console.warn(JSON.stringify({
    schema: 'dealivra.client-failure-monitor.v1',
    event_id: randomUUID(),
    received_at: new Date().toISOString(),
    ...runtimeMetadata(),
    ...event,
  }));
  response.status(204).end();
}
