import catalogData from '../src/catalog.v1.json' with { type: 'json' };

const supportedCategories = new Set([
  'phone',
  'tablet',
  'laptop',
  'vehicle',
  'watch',
  'camera',
  'gaming',
  'tools',
]);
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeText(value, maximumLength) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function safeBrands(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const id = safeText(entry.id, 60);
    const label = safeText(entry.label, 80);
    if (!identifierPattern.test(id) || !label) return [];
    const models = Array.isArray(entry.models)
      ? entry.models
        .slice(0, 250)
        .map(model => safeText(model, 100))
        .filter(Boolean)
      : [];
    return [{ id, label, models }];
  });
}

function yearsDescending(minimum, maximum) {
  const currentYear = new Date().getFullYear();
  const safeMinimum = Math.max(1886, Math.trunc(Number(minimum)));
  const safeMaximum = Math.min(currentYear + 2, Math.trunc(Number(maximum)));
  if (!Number.isFinite(safeMinimum) || !Number.isFinite(safeMaximum) || safeMaximum < safeMinimum) return [];
  return Array.from({ length: safeMaximum - safeMinimum + 1 }, (_, index) => String(safeMaximum - index));
}

export function getCatalogCategory(category) {
  if (!supportedCategories.has(category)) {
    const error = new Error('Unsupported catalog category.');
    error.code = 'UNSUPPORTED_CATALOG_CATEGORY';
    throw error;
  }

  const source = catalogData.categories[category];
  const brands = safeBrands(source?.brands);
  if (!brands.length) {
    const error = new Error('Catalog data is unavailable.');
    error.code = 'CATALOG_DATA_UNAVAILABLE';
    throw error;
  }

  return {
    schemaVersion: 1,
    version: safeText(catalogData.catalogVersion, 40),
    market: safeText(catalogData.market, 10),
    updatedAt: safeText(catalogData.updatedAt, 20),
    source: safeText(catalogData.source, 100),
    category,
    brands,
    variants: Array.isArray(source.variants)
      ? source.variants.slice(0, 30).map(value => safeText(value, 40)).filter(Boolean)
      : [],
    years: Number.isFinite(source.yearMin) && Number.isFinite(source.yearMax)
      ? yearsDescending(source.yearMin, source.yearMax)
      : [],
  };
}
