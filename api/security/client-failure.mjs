import { randomUUID } from 'node:crypto';
import {
  failReportingRequest,
  prepareReportingResponse,
  readBoundedJson,
  reportingRuntimeMetadata,
  validateReportingRequest,
} from '../../server/reportingRequestBoundary.mjs';

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

export default async function handler(request, response) {
  prepareReportingResponse(response);
  if (!validateReportingRequest(request, response)) return;

  const mode = process.env.DEALIVRA_CLIENT_FAILURE_MODE || 'staged';
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

  // This is the complete log contract. Do not add URLs, request headers,
  // errors, stacks, browser state, identifiers, or provider content.
  console.warn(JSON.stringify({
    schema: 'dealivra.client-failure-monitor.v1',
    event_id: randomUUID(),
    received_at: new Date().toISOString(),
    ...reportingRuntimeMetadata(),
    ...event,
  }));
  response.status(204).end();
}
