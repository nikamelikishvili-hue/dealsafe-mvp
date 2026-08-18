import { randomUUID } from 'node:crypto';
import {
  failReportingRequest,
  prepareReportingResponse,
  readBoundedJson,
  reportingRuntimeMetadata,
  validateReportingRequest,
} from '../../server/reportingRequestBoundary.mjs';

const maximumBodyBytes = 512;
const allowedEvents = new Set([
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

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    Object.keys(value).length !== 5
    || value.schema !== 'dealivra.web-vital.v1'
    || typeof value.metric !== 'string'
    || typeof value.rating !== 'string'
    || typeof value.bucket !== 'string'
    || !allowedEvents.has(`${value.metric}:${value.rating}:${value.bucket}`)
    || value.occurrence_count !== 1
  ) {
    return null;
  }
  return {
    event_schema: value.schema,
    metric: value.metric,
    rating: value.rating,
    bucket: value.bucket,
    occurrence_count: 1,
  };
}

export default async function handler(request, response) {
  prepareReportingResponse(response);
  if (!validateReportingRequest(request, response)) return;

  const mode = process.env.DEALIVRA_WEB_VITAL_MODE || 'staged';
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

  // Never add URL/route, referrer, headers, IP, user/session/device data,
  // exact timings, application state, or provider content to this contract.
  console.info(JSON.stringify({
    schema: 'dealivra.web-vital-monitor.v1',
    event_id: randomUUID(),
    received_at: new Date().toISOString(),
    ...reportingRuntimeMetadata(),
    ...event,
  }));
  response.status(204).end();
}
