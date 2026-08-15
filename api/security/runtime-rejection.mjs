import { randomUUID } from 'node:crypto';
import {
  failReportingRequest,
  prepareReportingResponse,
  readBoundedJson,
  reportingRuntimeMetadata,
  validateReportingRequest,
} from '../../server/reportingRequestBoundary.mjs';

const maximumBodyBytes = 1_024;
const allowedSchemas = new Set([
  'dealivra.account-activity.boundary-rejection.v1',
  'dealivra.account-activity.response-rejection.v1',
  'dealivra.account-mutation.boundary-rejection.v1',
  'dealivra.admin.boundary-rejection.v1',
  'dealivra.admin.response-rejection.v1',
  'dealivra.agreement.boundary-rejection.v1',
  'dealivra.agreement.response-rejection.v1',
  'dealivra.auth.boundary-rejection.v1',
  'dealivra.auth.response-rejection.v1',
  'dealivra.deal-mutation.boundary-rejection.v1',
  'dealivra.deal-mutation.response-rejection.v1',
  'dealivra.delivery.boundary-rejection.v1',
  'dealivra.delivery.response-rejection.v1',
  'dealivra.evidence.boundary-rejection.v1',
  'dealivra.evidence.response-rejection.v1',
  'dealivra.interaction.boundary-rejection.v1',
  'dealivra.interaction.response-rejection.v1',
  'dealivra.legacy-payment.boundary-rejection.v1',
  'dealivra.legacy-payment.response-rejection.v1',
  'dealivra.payment.boundary-rejection.v1',
  'dealivra.payment.response-rejection.v1',
  'dealivra.service.response-rejection.v1',
  'dealivra.support.boundary-rejection.v1',
  'dealivra.support.response-rejection.v1',
  'dealivra.trust.boundary-rejection.v1',
  'dealivra.trust.response-rejection.v1',
]);
const dimensionPattern = /^[a-z0-9_]{1,96}$/;

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    Object.keys(value).length !== 4
    || !allowedSchemas.has(value.schema)
    || typeof value.boundary !== 'string'
    || typeof value.issue !== 'string'
    || !dimensionPattern.test(value.boundary)
    || !dimensionPattern.test(value.issue)
    || !Number.isSafeInteger(value.occurrence_count)
    || value.occurrence_count < 1
    || value.occurrence_count > 100
  ) {
    return null;
  }
  return {
    schema: value.schema,
    boundary: value.boundary,
    issue: value.issue,
    occurrence_count: value.occurrence_count,
  };
}

export default async function handler(request, response) {
  prepareReportingResponse(response);
  if (!validateReportingRequest(request, response)) return;

  const mode = process.env.DEALIVRA_RUNTIME_REJECTION_MODE || 'staged';
  if (mode === 'staged') {
    response.status(204).end();
    return;
  }
  if (mode !== 'enforced') {
    failReportingRequest(response, 503, 'Monitoring is unavailable.');
    return;
  }

  const event = normalize(await readBoundedJson(request, maximumBodyBytes));
  if (!event) {
    failReportingRequest(response, 400, 'Report is invalid.');
    return;
  }
  const {
    schema: eventSchema,
    boundary,
    issue,
    occurrence_count: occurrenceCount,
  } = event;

  // This is the complete log contract. Do not add URLs, request headers,
  // cookies, identifiers, rejected payloads, or provider response content.
  console.warn(JSON.stringify({
    schema: 'dealivra.runtime-rejection-monitor.v1',
    event_id: randomUUID(),
    received_at: new Date().toISOString(),
    ...reportingRuntimeMetadata(),
    event_schema: eventSchema,
    boundary,
    issue,
    occurrence_count: occurrenceCount,
  }));
  response.status(204).end();
}
