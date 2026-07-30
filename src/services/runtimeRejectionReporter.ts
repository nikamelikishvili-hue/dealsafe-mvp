import { sendBoundedDiagnostic } from './diagnosticTransport.ts';

export interface RuntimeRejectionEvent {
  schema: string;
  boundary: string;
  issue: string;
}

const schemaPattern =
  /^dealivra\.[a-z0-9]+(?:-[a-z0-9]+)*\.(?:boundary|response)-rejection\.v1$/;
const dimensionPattern = /^[a-z0-9_]{1,96}$/;
const signatureCooldownMs = 30_000;
const maximumTransportsPerMinute = 20;
const sentAtBySignature = new Map<string, number>();
let transportWindowStartedAt = 0;
let transportCount = 0;

export function normalizeRuntimeRejection(
  value: unknown,
): RuntimeRejectionEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== 3
    || typeof source.schema !== 'string'
    || typeof source.boundary !== 'string'
    || typeof source.issue !== 'string'
    || !schemaPattern.test(source.schema)
    || !dimensionPattern.test(source.boundary)
    || !dimensionPattern.test(source.issue)
  ) {
    return null;
  }
  return {
    schema: source.schema,
    boundary: source.boundary,
    issue: source.issue,
  };
}

function reserveTransport(event: RuntimeRejectionEvent): boolean {
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
  const signature = `${event.schema}:${event.boundary}:${event.issue}`;
  const previous = sentAtBySignature.get(signature);
  if (previous !== undefined && now - previous < signatureCooldownMs) {
    return false;
  }
  sentAtBySignature.set(signature, now);
  transportCount += 1;
  return true;
}

export function reportRuntimeRejection(value: unknown): void {
  const event = normalizeRuntimeRejection(value);
  if (!event) return;

  // This local diagnostic intentionally contains the same three allowlisted
  // dimensions as the transport and never includes the rejected payload.
  console.error('[dealivra-runtime-rejection]', event);

  if (
    import.meta.env?.PROD !== true
    || typeof window === 'undefined'
    || !reserveTransport(event)
  ) {
    return;
  }

  sendBoundedDiagnostic('/api/security/runtime-rejection', {
    ...event,
    occurrence_count: 1,
  });
}
