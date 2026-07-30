import { sendBoundedDiagnostic } from './diagnosticTransport.ts';

export type ClientFailureEvent =
  | {
      schema: 'dealivra.client-failure.v1';
      boundary: 'application_render';
      issue: 'react_render_failed';
    }
  | {
      schema: 'dealivra.client-failure.v1';
      boundary: 'application_bootstrap';
      issue: 'bundle_load_failed' | 'localization_initialization_failed';
    }
  | {
      schema: 'dealivra.client-failure.v1';
      boundary: 'browser_runtime';
      issue: 'window_error' | 'unhandled_promise_rejection';
    };

const allowedPairs = new Set([
  'application_render:react_render_failed',
  'application_bootstrap:bundle_load_failed',
  'application_bootstrap:localization_initialization_failed',
  'browser_runtime:window_error',
  'browser_runtime:unhandled_promise_rejection',
]);
const signatureCooldownMs = 30_000;
const maximumTransportsPerMinute = 10;
const sentAtBySignature = new Map<string, number>();
let transportWindowStartedAt = 0;
let transportCount = 0;

export function normalizeClientFailure(
  value: unknown,
): ClientFailureEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== 3
    || source.schema !== 'dealivra.client-failure.v1'
    || typeof source.boundary !== 'string'
    || typeof source.issue !== 'string'
    || !allowedPairs.has(`${source.boundary}:${source.issue}`)
  ) {
    return null;
  }
  return source as ClientFailureEvent;
}

function reserveTransport(event: ClientFailureEvent): boolean {
  const now = Date.now();
  if (now - transportWindowStartedAt >= 60_000) {
    transportWindowStartedAt = now;
    transportCount = 0;
    for (const [signature, sentAt] of sentAtBySignature) {
      if (now - sentAt >= signatureCooldownMs) {
        sentAtBySignature.delete(signature);
      }
    }
  }
  if (transportCount >= maximumTransportsPerMinute) return false;
  const signature = `${event.boundary}:${event.issue}`;
  const previous = sentAtBySignature.get(signature);
  if (previous !== undefined && now - previous < signatureCooldownMs) {
    return false;
  }
  sentAtBySignature.set(signature, now);
  transportCount += 1;
  return true;
}

export function reportClientFailure(value: unknown): void {
  const event = normalizeClientFailure(value);
  if (!event) return;

  // Error objects, messages, stacks, locations, and application state are
  // intentionally excluded from both the local diagnostic and transport.
  console.error('[dealivra-client-failure]', event);

  if (
    import.meta.env?.PROD !== true
    || typeof window === 'undefined'
    || !reserveTransport(event)
  ) {
    return;
  }

  sendBoundedDiagnostic('/api/security/client-failure', {
    ...event,
    occurrence_count: 1,
  });
}
