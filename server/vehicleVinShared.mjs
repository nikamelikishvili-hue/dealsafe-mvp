import { createHash } from 'node:crypto';
import {
  readBoundedResponseText,
  ResponseBodyBoundaryError,
} from './responseBodyBoundary.mjs';

const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;
const providerTimeoutMs = 4_500;
const cacheTtlMs = 24 * 60 * 60 * 1_000;
const maximumCacheEntries = 250;
const maximumProviderBytes = 256_000;
const vinCache = new Map();

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeText(value, maximumLength) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().slice(0, maximumLength)
    : '';
}

export function normalizeVin(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function normalizeModelYear(value) {
  if (value === undefined || value === null || value === '') return '';
  const year = Number(value);
  const maximum = new Date().getFullYear() + 2;
  return Number.isInteger(year) && year >= 1981 && year <= maximum ? String(year) : '';
}

function readCached(key) {
  const cached = vinCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    vinCache.delete(key);
    return null;
  }
  vinCache.delete(key);
  vinCache.set(key, cached);
  return cached.value;
}

function writeCached(key, value) {
  vinCache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
  while (vinCache.size > maximumCacheEntries) {
    const oldestKey = vinCache.keys().next().value;
    if (oldestKey === undefined) break;
    vinCache.delete(oldestKey);
  }
}

function parseProviderPayload(payload, vin) {
  const record = Array.isArray(payload?.Results) ? payload.Results[0] : null;
  if (!record || typeof record !== 'object') {
    throw codedError('VIN_NOT_FOUND', 'The VIN could not be decoded.');
  }

  const vehicle = {
    vin,
    make: safeText(record.Make, 80),
    model: safeText(record.Model, 100),
    modelYear: safeText(record.ModelYear, 4),
    vehicleType: safeText(record.VehicleType, 80),
    bodyClass: safeText(record.BodyClass, 100),
    source: 'NHTSA vPIC',
    verifiedAt: new Date().toISOString(),
  };
  if (!vehicle.make && !vehicle.model && !vehicle.modelYear) {
    throw codedError('VIN_NOT_FOUND', 'The VIN did not return enough vehicle details.');
  }
  return vehicle;
}

export async function decodeVehicleVin(vinValue, modelYearValue = '', options = {}) {
  const vin = normalizeVin(vinValue);
  if (!vinPattern.test(vin)) {
    throw codedError('INVALID_VIN', 'Enter a valid 17-character VIN without I, O, or Q.');
  }
  const modelYear = normalizeModelYear(modelYearValue);
  if (modelYearValue !== undefined && modelYearValue !== null && modelYearValue !== '' && !modelYear) {
    throw codedError('INVALID_MODEL_YEAR', 'Choose a valid model year.');
  }

  const cacheKey = createHash('sha256')
    .update(`${vin}:${modelYear || '-'}`)
    .digest('hex');
  const cached = readCached(cacheKey);
  if (cached) return { vin, ...cached };

  const endpoint = new URL(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}`);
  endpoint.searchParams.set('format', 'json');
  if (modelYear) endpoint.searchParams.set('modelyear', modelYear);

  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.min(providerTimeoutMs, options.timeoutMs))
    : providerTimeoutMs;
  const request = typeof options.fetchImplementation === 'function'
    ? options.fetchImplementation
    : fetch;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await request(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Dealivra-VIN-Decoder/0.1 (+https://dealivra.com)',
      },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      throw codedError('VIN_PROVIDER_UNAVAILABLE', 'The VIN provider is temporarily unavailable.');
    }
    const text = await readBoundedResponseText(upstream, maximumProviderBytes);
    const payload = JSON.parse(text);
    const vehicle = parseProviderPayload(payload, vin);
    const { vin: _uncachedVin, ...cacheValue } = vehicle;
    writeCached(cacheKey, cacheValue);
    return vehicle;
  } catch (error) {
    if (error instanceof ResponseBodyBoundaryError) {
      throw codedError('VIN_PROVIDER_INVALID_RESPONSE', 'The VIN provider returned an invalid response.');
    }
    if (error?.code) throw error;
    if (error?.name === 'AbortError') {
      throw codedError('VIN_PROVIDER_TIMEOUT', 'The VIN provider took too long to respond.');
    }
    throw codedError('VIN_PROVIDER_UNAVAILABLE', 'The VIN provider is temporarily unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}

export function resetVehicleVinCacheForTests() {
  vinCache.clear();
}
