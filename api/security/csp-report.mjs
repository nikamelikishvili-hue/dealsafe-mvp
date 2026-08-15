import { randomUUID } from 'node:crypto';

const maxBodyBytes = 16_384;
const maxReportsPerRequest = 20;
const allowedContentTypes = new Set([
  'application/csp-report',
  'application/json',
  'application/reports+json',
]);

function requestHeader(request, name) {
  if (typeof request.headers?.get === 'function') {
    return request.headers.get(name);
  }
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function jsonError(response, status, message) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json({ error: message });
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

async function readBody(request) {
  const declaredLength = Number(requestHeader(request, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return { error: 'too_large' };
  }

  if (
    request.body
    && typeof request.body === 'object'
    && !Buffer.isBuffer(request.body)
    && !(request.body instanceof Uint8Array)
  ) {
    try {
      const serialized = JSON.stringify(request.body);
      return byteLength(serialized) <= maxBodyBytes
        ? { value: request.body }
        : { error: 'too_large' };
    } catch {
      return { error: 'invalid' };
    }
  }

  let raw = '';
  if (typeof request.body === 'string') {
    raw = request.body;
  } else if (Buffer.isBuffer(request.body) || request.body instanceof Uint8Array) {
    raw = Buffer.from(request.body).toString('utf8');
  } else if (typeof request[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBodyBytes) return { error: 'too_large' };
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }

  if (!raw || byteLength(raw) > maxBodyBytes) {
    return { error: raw ? 'too_large' : 'invalid' };
  }

  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: 'invalid' };
  }
}

function safeText(value, maximumLength = 160) {
  if (typeof value !== 'string') return undefined;
  const text = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim();
  return text ? text.slice(0, maximumLength) : undefined;
}

function safeDirective(value) {
  const directive = safeText(value, 96)?.split(/\s+/, 1)[0].toLowerCase();
  return directive && /^[a-z][a-z0-9-]*$/.test(directive) ? directive : undefined;
}

function safeNumber(value, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > maximum) return undefined;
  return number;
}

function safeUrl(value) {
  const text = safeText(value, 2_048);
  if (!text) return undefined;

  const token = text.toLowerCase();
  if (['inline', 'eval', 'self'].includes(token)) return token;
  if (/^(about|blob|data):/i.test(text)) return `${text.split(':', 1)[0].toLowerCase()}:`;

  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return url.protocol;

    // Report URLs are attacker-controlled and paths can contain recovery
    // tokens, access codes, email addresses, or customer-generated slugs.
    // Keep only the origin and a fixed operational route class. This is
    // sufficient to distinguish asset/API/page violations without retaining
    // any raw path, query, or fragment material.
    const firstSegment = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    const pathname = firstSegment === 'assets'
      ? '/assets/:asset'
      : firstSegment === 'api'
        ? '/api/:endpoint'
        : firstSegment
          ? '/:page'
          : '/';
    return `${url.origin}${pathname}`.slice(0, 512);
  } catch {
    return 'invalid-url';
  }
}

function normalizeReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  if (typeof report.type === 'string' && report.type !== 'csp-violation') return null;

  const body = report['csp-report'] && typeof report['csp-report'] === 'object'
    ? report['csp-report']
    : report.body && typeof report.body === 'object'
      ? report.body
      : report;

  const effectiveDirective = safeDirective(
    body.effectiveDirective ?? body['effective-directive'],
  );
  const violatedDirective = safeDirective(
    body.violatedDirective ?? body['violated-directive'],
  );
  if (!effectiveDirective && !violatedDirective) return null;

  return {
    schema: 'dealivra.csp-violation.v1',
    report_id: randomUUID(),
    received_at: new Date().toISOString(),
    effective_directive: effectiveDirective,
    violated_directive: violatedDirective,
    disposition: ['enforce', 'report'].includes(body.disposition) ? body.disposition : undefined,
    status_code: safeNumber(body.statusCode ?? body['status-code'], 599),
    line_number: safeNumber(body.lineNumber ?? body['line-number'], 10_000_000),
    column_number: safeNumber(body.columnNumber ?? body['column-number'], 10_000_000),
    document_url: safeUrl(body.documentURL ?? body['document-uri']),
    blocked_url: safeUrl(body.blockedURL ?? body['blocked-uri']),
    source_url: safeUrl(body.sourceFile ?? body['source-file']),
  };
}

function reportsFromPayload(payload) {
  const reports = Array.isArray(payload) ? payload : [payload];
  return reports
    .slice(0, maxReportsPerRequest)
    .map(normalizeReport)
    .filter(Boolean);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    jsonError(response, 405, 'Method not allowed.');
    return;
  }

  const contentType = String(requestHeader(request, 'content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!allowedContentTypes.has(contentType)) {
    jsonError(response, 415, 'Unsupported report format.');
    return;
  }

  const parsed = await readBody(request);
  if (parsed.error === 'too_large') {
    jsonError(response, 413, 'Report is too large.');
    return;
  }
  if (parsed.error) {
    jsonError(response, 400, 'Report is invalid.');
    return;
  }

  for (const report of reportsFromPayload(parsed.value)) {
    // CSP reports are attacker-controlled. Only the allowlisted, bounded,
    // privacy-scrubbed fields above are written to observability logs.
    console.warn(JSON.stringify(report));
  }

  response.status(204).end();
}
