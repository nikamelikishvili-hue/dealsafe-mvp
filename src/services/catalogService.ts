import {
  getEmbeddedCatalogSnapshot,
  type CatalogBrand,
  type CatalogCategorySnapshot,
  type GuidedCatalogCategoryId,
} from '../smartCatalog';
import {
  fetchWithDeadline,
  readBoundedJson,
} from './browserResponseBoundary';

export interface CatalogLoadResult extends CatalogCategorySnapshot {
  delivery: 'server' | 'embedded-fallback';
}

export interface VehicleVinResult {
  vin: string;
  make: string;
  model: string;
  modelYear: string;
  vehicleType: string;
  bodyClass: string;
  source: 'NHTSA vPIC';
  verifiedAt: string;
}

const catalogMemory = new Map<GuidedCatalogCategoryId, CatalogLoadResult>();
const requestTimeoutMs = 4_500;

const safeText = (value: unknown, maximumLength: number): string => (
  typeof value === 'string' ? value.trim().slice(0, maximumLength) : ''
);

const validateBrands = (value: unknown): CatalogBrand[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const source = entry as Record<string, unknown>;
    const id = safeText(source.id, 60);
    const label = safeText(source.label, 80);
    const models = Array.isArray(source.models)
      ? source.models.slice(0, 250).map(model => safeText(model, 100)).filter(Boolean)
      : [];
    return id && label ? [{ id, label, models }] : [];
  });
};

const validateCatalogResponse = (
  value: unknown,
  category: GuidedCatalogCategoryId,
): CatalogCategorySnapshot => {
  if (!value || typeof value !== 'object') throw new Error('Catalog response was invalid.');
  const source = value as Record<string, unknown>;
  const brands = validateBrands(source.brands);
  if (source.category !== category || !brands.length) throw new Error('Catalog response was incomplete.');
  const readList = (entry: unknown, maximumItems: number, maximumLength: number) => (
    Array.isArray(entry)
      ? entry.slice(0, maximumItems).map(item => safeText(item, maximumLength)).filter(Boolean)
      : []
  );
  return {
    category,
    version: safeText(source.version, 40),
    market: safeText(source.market, 10),
    updatedAt: safeText(source.updatedAt, 20),
    source: safeText(source.source, 100),
    brands,
    variants: readList(source.variants, 30, 40),
    years: readList(source.years, 150, 4),
  };
};

export async function loadSmartCatalogCategory(
  category: GuidedCatalogCategoryId,
): Promise<CatalogLoadResult> {
  const cached = catalogMemory.get(category);
  if (cached) return cached;

  try {
    const response = await fetchWithDeadline(`/api/catalog?category=${encodeURIComponent(category)}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }, requestTimeoutMs);
    if (!response.ok) throw new Error('Catalog request failed.');
    const catalog = validateCatalogResponse(await readBoundedJson(response), category);
    const result: CatalogLoadResult = { ...catalog, delivery: 'server' };
    catalogMemory.set(category, result);
    return result;
  } catch {
    const result: CatalogLoadResult = {
      ...getEmbeddedCatalogSnapshot(category),
      delivery: 'embedded-fallback',
    };
    catalogMemory.set(category, result);
    return result;
  }
}

export async function decodeVehicleVin(vin: string, modelYear = ''): Promise<VehicleVinResult> {
  try {
    const response = await fetchWithDeadline('/api/vehicles/vin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vin, modelYear }),
    }, requestTimeoutMs + 1_000);
    const payload = await readBoundedJson(response) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(safeText(payload.error, 160) || 'VIN could not be checked.');
    }
    const result = payload.vehicle;
    if (!result || typeof result !== 'object') throw new Error('VIN response was incomplete.');
    const source = result as Record<string, unknown>;
    const normalized: VehicleVinResult = {
      vin: safeText(source.vin, 17),
      make: safeText(source.make, 80),
      model: safeText(source.model, 100),
      modelYear: safeText(source.modelYear, 4),
      vehicleType: safeText(source.vehicleType, 80),
      bodyClass: safeText(source.bodyClass, 100),
      source: 'NHTSA vPIC',
      verifiedAt: safeText(source.verifiedAt, 40),
    };
    if (!normalized.vin || (!normalized.make && !normalized.model && !normalized.modelYear)) {
      throw new Error('VIN response was incomplete.');
    }
    return normalized;
  } catch (error) {
    if (
      error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error('VIN check timed out. You can try again or enter the details manually.');
    }
    throw error;
  }
}
