import {
  prepareResponse,
  readJsonBody,
  requirePost,
  requireSameOrigin,
} from '../../server/authShared.mjs';
import { recordServerFailure } from '../../server/serverFailureReporter.mjs';
import { decodeVehicleVin } from '../../server/vehicleVinShared.mjs';

export default async function handler(request, response) {
  prepareResponse(response);
  if (
    !requirePost(request, response)
    || !requireSameOrigin(request, response, 'Cross-origin VIN checks are not allowed.')
  ) return;

  const body = readJsonBody(request);
  const vin = typeof body?.vin === 'string' ? body.vin : '';
  const modelYear = typeof body?.modelYear === 'string' || typeof body?.modelYear === 'number'
    ? body.modelYear
    : '';

  try {
    const vehicle = await decodeVehicleVin(vin, modelYear);
    response.status(200).json({ vehicle });
  } catch (error) {
    if (error?.code === 'INVALID_VIN' || error?.code === 'INVALID_MODEL_YEAR') {
      response.status(400).json({ error: error.message });
      return;
    }
    if (error?.code === 'VIN_NOT_FOUND') {
      response.status(422).json({
        error: 'We could not match this VIN. Review it or enter the vehicle details manually.',
      });
      return;
    }
    const issue = error?.code === 'VIN_PROVIDER_TIMEOUT'
      ? 'provider_timeout'
      : error?.code === 'VIN_PROVIDER_INVALID_RESPONSE'
        ? 'provider_response_invalid'
        : 'provider_unavailable';
    recordServerFailure({
      schema: 'dealivra.server-failure.v1',
      boundary: 'vehicle_vin_decode',
      issue,
    });
    response.status(503).json({
      error: 'VIN check is temporarily unavailable. Enter the vehicle details manually or try again.',
    });
  }
}
