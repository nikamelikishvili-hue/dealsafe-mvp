import catalogData from './catalog.v1.json';

export type SmartCatalogCategoryId =
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'vehicle'
  | 'watch'
  | 'camera'
  | 'gaming'
  | 'tools'
  | 'business'
  | 'jewelry'
  | 'collectible'
  | 'general';

export type GuidedCatalogCategoryId = 'phone' | 'vehicle';

export interface SmartCatalogSelection {
  brand: string;
  model: string;
  year: string;
  variant: string;
  customBrand: string;
  customModel: string;
}

export interface CatalogBrand {
  id: string;
  label: string;
  models: readonly string[];
}

export interface CatalogCategorySnapshot {
  category: GuidedCatalogCategoryId;
  version: string;
  market: string;
  updatedAt: string;
  source: string;
  brands: readonly CatalogBrand[];
  variants: readonly string[];
  years: readonly string[];
}

export const OTHER_CATALOG_VALUE = '__other__';
export const smartCatalogVersion = catalogData.catalogVersion;

export const emptySmartCatalogSelection = (): SmartCatalogSelection => ({
  brand: '',
  model: '',
  year: '',
  variant: '',
  customBrand: '',
  customModel: '',
});

const yearsDescending = (minimum: number, maximum: number): string[] => {
  const safeMinimum = Math.max(1886, Math.trunc(minimum));
  const safeMaximum = Math.min(new Date().getFullYear() + 2, Math.trunc(maximum));
  return Array.from(
    { length: Math.max(0, safeMaximum - safeMinimum + 1) },
    (_, index) => String(safeMaximum - index),
  );
};

export const phoneCatalog: readonly CatalogBrand[] = catalogData.categories.phone.brands;
export const phoneStorageOptions: readonly string[] = catalogData.categories.phone.variants;
export const vehicleCatalog: readonly CatalogBrand[] = catalogData.categories.vehicle.brands;
export const vehicleYears = yearsDescending(
  catalogData.categories.vehicle.yearMin,
  catalogData.categories.vehicle.yearMax,
);

export function getEmbeddedCatalogSnapshot(category: GuidedCatalogCategoryId): CatalogCategorySnapshot {
  return {
    category,
    version: catalogData.catalogVersion,
    market: catalogData.market,
    updatedAt: catalogData.updatedAt,
    source: catalogData.source,
    brands: category === 'phone' ? phoneCatalog : vehicleCatalog,
    variants: category === 'phone' ? phoneStorageOptions : [],
    years: category === 'vehicle' ? vehicleYears : [],
  };
}

export function getCatalogModels(
  category: SmartCatalogCategoryId,
  brand: string,
  catalog?: readonly CatalogBrand[],
): readonly string[] {
  const source = catalog ?? (category === 'phone' ? phoneCatalog : category === 'vehicle' ? vehicleCatalog : []);
  return source.find(item => item.label === brand)?.models ?? [];
}

export function matchCatalogValue(values: readonly string[], candidate: string): string {
  const normalizedCandidate = candidate.trim().toLocaleLowerCase('en-US');
  return values.find(value => value.toLocaleLowerCase('en-US') === normalizedCandidate) ?? '';
}

export function buildSmartCatalogTitle(
  category: SmartCatalogCategoryId,
  selection: SmartCatalogSelection,
): string {
  const brand = selection.brand === OTHER_CATALOG_VALUE ? selection.customBrand.trim() : selection.brand;
  const model = selection.brand === OTHER_CATALOG_VALUE || selection.model === OTHER_CATALOG_VALUE
    ? selection.customModel.trim()
    : selection.model;

  if (category === 'phone') {
    const identity = [brand, model].filter(Boolean).join(' ');
    return [identity, selection.variant].filter(Boolean).join(' · ');
  }

  if (category === 'vehicle') {
    return [selection.year, brand, model].filter(Boolean).join(' ');
  }

  return '';
}

export function sanitizeSmartCatalogSelection(value: unknown): SmartCatalogSelection {
  if (!value || typeof value !== 'object') return emptySmartCatalogSelection();
  const source = value as Partial<Record<keyof SmartCatalogSelection, unknown>>;
  const read = (key: keyof SmartCatalogSelection) => typeof source[key] === 'string'
    ? String(source[key]).slice(0, 80)
    : '';

  return {
    brand: read('brand'),
    model: read('model'),
    year: read('year'),
    variant: read('variant'),
    customBrand: read('customBrand'),
    customModel: read('customModel'),
  };
}
