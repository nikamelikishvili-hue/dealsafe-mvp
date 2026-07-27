import catalogData from './catalog.v1.json';
import type { DealCatalogIdentity } from './domain';

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

export const guidedCatalogCategoryIds = [
  'phone',
  'tablet',
  'laptop',
  'vehicle',
  'watch',
  'camera',
  'gaming',
  'tools',
] as const;

export type GuidedCatalogCategoryId = typeof guidedCatalogCategoryIds[number];

export interface SmartCatalogGuide {
  finderTitle: string;
  identityLabel: string;
  identityNameLabel: string;
  chooseIdentity: string;
  enterIdentity: string;
  chooseModelBeforeIdentity: string;
  variantLabel: string;
  chooseVariant: string;
}

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

export function toCatalogValueId(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const smartCatalogGuides: Record<GuidedCatalogCategoryId, SmartCatalogGuide> = {
  phone: {
    finderTitle: 'Find your phone',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Storage',
    chooseVariant: 'Choose storage',
  },
  tablet: {
    finderTitle: 'Find your tablet',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Storage',
    chooseVariant: 'Choose storage',
  },
  laptop: {
    finderTitle: 'Find your laptop',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Storage',
    chooseVariant: 'Choose storage',
  },
  vehicle: {
    finderTitle: 'Find your vehicle',
    identityLabel: 'Make',
    identityNameLabel: 'Make name',
    chooseIdentity: 'Choose make',
    enterIdentity: 'Enter make',
    chooseModelBeforeIdentity: 'Choose a make first',
    variantLabel: '',
    chooseVariant: '',
  },
  watch: {
    finderTitle: 'Find your watch',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Case size',
    chooseVariant: 'Choose case size',
  },
  camera: {
    finderTitle: 'Find your camera',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Package',
    chooseVariant: 'Choose body or kit',
  },
  gaming: {
    finderTitle: 'Find your gaming device',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Storage',
    chooseVariant: 'Choose storage',
  },
  tools: {
    finderTitle: 'Find your tool or equipment',
    identityLabel: 'Brand',
    identityNameLabel: 'Brand name',
    chooseIdentity: 'Choose brand',
    enterIdentity: 'Enter brand',
    chooseModelBeforeIdentity: 'Choose a brand first',
    variantLabel: 'Package',
    chooseVariant: 'Choose package type',
  },
};

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

interface RawCatalogCategory {
  brands: readonly CatalogBrand[];
  variants?: readonly string[];
  yearMin?: number;
  yearMax?: number;
}

const embeddedCategories = catalogData.categories as Record<GuidedCatalogCategoryId, RawCatalogCategory>;

export function isGuidedCatalogCategory(
  category: SmartCatalogCategoryId,
): category is GuidedCatalogCategoryId {
  return guidedCatalogCategoryIds.some(value => value === category);
}

export function getSmartCatalogGuide(category: GuidedCatalogCategoryId): SmartCatalogGuide {
  return smartCatalogGuides[category];
}

export function getEmbeddedCatalogSnapshot(category: GuidedCatalogCategoryId): CatalogCategorySnapshot {
  const source = embeddedCategories[category];
  return {
    category,
    version: catalogData.catalogVersion,
    market: catalogData.market,
    updatedAt: catalogData.updatedAt,
    source: catalogData.source,
    brands: source.brands,
    variants: source.variants ?? [],
    years: typeof source.yearMin === 'number' && typeof source.yearMax === 'number'
      ? yearsDescending(source.yearMin, source.yearMax)
      : [],
  };
}

export function getCatalogModels(
  category: SmartCatalogCategoryId,
  brand: string,
  catalog?: readonly CatalogBrand[],
): readonly string[] {
  const source = catalog ?? (isGuidedCatalogCategory(category) ? embeddedCategories[category].brands : []);
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

  if (isGuidedCatalogCategory(category) && category !== 'vehicle') {
    const identity = [brand, model].filter(Boolean).join(' ');
    return identity ? [identity, selection.variant].filter(Boolean).join(' · ') : '';
  }

  if (category === 'vehicle') {
    const identity = [brand, model].filter(Boolean).join(' ');
    return identity ? [selection.year, identity].filter(Boolean).join(' ') : '';
  }

  return '';
}

export function buildDealCatalogIdentity(
  category: SmartCatalogCategoryId,
  selection: SmartCatalogSelection,
): DealCatalogIdentity {
  const guided = isGuidedCatalogCategory(category);
  const snapshot = guided ? getEmbeddedCatalogSnapshot(category) : null;
  const selectedBrand = snapshot?.brands.find(item => item.label === selection.brand);
  const brandLabel = selection.brand === OTHER_CATALOG_VALUE
    ? selection.customBrand.trim()
    : selection.brand.trim();
  const modelLabel = selection.brand === OTHER_CATALOG_VALUE || selection.model === OTHER_CATALOG_VALUE
    ? selection.customModel.trim()
    : selection.model.trim();
  const variantLabel = selection.variant.trim();
  const parsedYear = /^\d{4}$/.test(selection.year) ? Number(selection.year) : undefined;

  return {
    categoryId: category,
    catalogVersion: smartCatalogVersion,
    brandId: brandLabel
      ? (selection.brand === OTHER_CATALOG_VALUE ? 'other' : selectedBrand?.id || toCatalogValueId(brandLabel))
      : undefined,
    brandLabel: brandLabel || undefined,
    modelId: modelLabel
      ? (selection.model === OTHER_CATALOG_VALUE || selection.brand === OTHER_CATALOG_VALUE
        ? 'other'
        : toCatalogValueId(modelLabel))
      : undefined,
    modelLabel: modelLabel || undefined,
    modelYear: parsedYear,
    variantId: variantLabel ? toCatalogValueId(variantLabel) : undefined,
    variantLabel: variantLabel || undefined,
  };
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
