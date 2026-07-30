import { randomUUID } from 'node:crypto';

const dimensionPattern = /^[a-z][a-z0-9_]{1,95}$/;
const allowedIssues = new Set([
  'configuration_missing',
  'configuration_invalid',
  'provider_unavailable',
  'provider_timeout',
  'provider_response_invalid',
  'catalog_unavailable',
  'unexpected_failure',
]);

export function normalizeServerFailure(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    Object.keys(value).length !== 3
    || value.schema !== 'dealivra.server-failure.v1'
    || typeof value.boundary !== 'string'
    || typeof value.issue !== 'string'
    || !dimensionPattern.test(value.boundary)
    || !allowedIssues.has(value.issue)
  ) {
    return null;
  }
  return {
    event_schema: value.schema,
    boundary: value.boundary,
    issue: value.issue,
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

export function recordServerFailure(value) {
  const event = normalizeServerFailure(value);
  if (!event) return false;

  // This is the complete server-failure log contract. Callers must classify
  // failures before this boundary and must never pass Error/provider objects.
  console.error(JSON.stringify({
    schema: 'dealivra.server-failure-monitor.v1',
    event_id: randomUUID(),
    occurred_at: new Date().toISOString(),
    ...runtimeMetadata(),
    ...event,
  }));
  return true;
}
