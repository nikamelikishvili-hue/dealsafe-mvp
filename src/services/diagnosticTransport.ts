export type DiagnosticEndpoint =
  | '/api/security/client-failure'
  | '/api/security/runtime-rejection'
  | '/api/security/web-vital';

const maximumBytesByEndpoint = new Map<DiagnosticEndpoint, number>([
  ['/api/security/client-failure', 512],
  ['/api/security/runtime-rejection', 1_024],
  ['/api/security/web-vital', 512],
]);
const diagnosticTimeoutMs = 5_000;
const clientFailurePairs = new Set([
  'application_render:react_render_failed',
  'application_bootstrap:bundle_load_failed',
  'application_bootstrap:localization_initialization_failed',
  'browser_runtime:window_error',
  'browser_runtime:unhandled_promise_rejection',
]);
const runtimeSchemaPattern =
  /^dealivra\.[a-z0-9]+(?:-[a-z0-9]+)*\.(?:boundary|response)-rejection\.v1$/;
const runtimeDimensionPattern = /^[a-z0-9_]{1,96}$/;
const webVitalEvents = new Set([
  'lcp:good:under_2500',
  'lcp:needs_improvement:2500_4000',
  'lcp:poor:over_4000',
  'cls:good:under_0_1',
  'cls:needs_improvement:0_1_0_25',
  'cls:poor:over_0_25',
  'inp:good:under_200',
  'inp:needs_improvement:200_500',
  'inp:poor:over_500',
]);

function hasExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length
    && expectedKeys.every(key => Object.hasOwn(value, key))
  );
}

function isAllowedDiagnosticPayload(
  endpoint: DiagnosticEndpoint,
  value: unknown,
): boolean {
  if (endpoint === '/api/security/client-failure') {
    return (
      hasExactKeys(
        value,
        ['schema', 'boundary', 'issue', 'occurrence_count'],
      )
      && value.schema === 'dealivra.client-failure.v1'
      && typeof value.boundary === 'string'
      && typeof value.issue === 'string'
      && clientFailurePairs.has(`${value.boundary}:${value.issue}`)
      && value.occurrence_count === 1
    );
  }
  if (endpoint === '/api/security/runtime-rejection') {
    return (
      hasExactKeys(
        value,
        ['schema', 'boundary', 'issue', 'occurrence_count'],
      )
      && typeof value.schema === 'string'
      && typeof value.boundary === 'string'
      && typeof value.issue === 'string'
      && runtimeSchemaPattern.test(value.schema)
      && runtimeDimensionPattern.test(value.boundary)
      && runtimeDimensionPattern.test(value.issue)
      && value.occurrence_count === 1
    );
  }
  return (
    hasExactKeys(
      value,
      ['schema', 'metric', 'rating', 'bucket', 'occurrence_count'],
    )
    && value.schema === 'dealivra.web-vital.v1'
    && typeof value.metric === 'string'
    && typeof value.rating === 'string'
    && typeof value.bucket === 'string'
    && webVitalEvents.has(`${value.metric}:${value.rating}:${value.bucket}`)
    && value.occurrence_count === 1
  );
}

export function prepareDiagnosticRequest(
  endpoint: DiagnosticEndpoint,
  value: unknown,
) {
  const maximumBytes = maximumBytesByEndpoint.get(endpoint);
  if (!maximumBytes || !isAllowedDiagnosticPayload(endpoint, value)) {
    return null;
  }

  let body: string;
  try {
    body = JSON.stringify(value);
  } catch {
    return null;
  }
  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength < 2 || byteLength > maximumBytes) return null;
  return { endpoint, body };
}

export function sendBoundedDiagnostic(
  endpoint: DiagnosticEndpoint,
  value: unknown,
): boolean {
  const prepared = prepareDiagnosticRequest(endpoint, value);
  if (
    !prepared
    || typeof window === 'undefined'
    || typeof window.fetch !== 'function'
  ) {
    return false;
  }

  void window.fetch(prepared.endpoint, {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
    signal: AbortSignal.timeout(diagnosticTimeoutMs),
    headers: {
      'Content-Type': 'application/json',
    },
    body: prepared.body,
  }).catch(() => {
    // Diagnostics are bounded, best-effort, and never retry customer work.
  });
  return true;
}
