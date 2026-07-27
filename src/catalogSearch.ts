import type { Deal, DealCategoryId, DealStatus } from './domain';

export const dealCategoryLabels: Record<DealCategoryId, string> = {
  phone: 'Phones',
  tablet: 'Tablets',
  laptop: 'Laptops',
  vehicle: 'Vehicles',
  watch: 'Luxury watches',
  camera: 'Cameras',
  gaming: 'Gaming',
  tools: 'Tools & equipment',
  business: 'Business equipment',
  jewelry: 'Jewelry',
  collectible: 'Collectibles',
  general: 'Other items',
};

export const dealCategoryIds = Object.keys(dealCategoryLabels) as DealCategoryId[];
export const searchableDealStatuses: DealStatus[] = [
  'draft',
  'published',
  'accepted',
  'completed',
  'cancelled',
  'disputed',
];

export interface CatalogSearchState {
  query: string;
  categoryId: 'all' | DealCategoryId;
  brandId: string;
  modelId: string;
  modelYear: number | null;
  status: 'all' | DealStatus;
}

export interface CatalogFacetOption {
  id: string;
  label: string;
  count: number;
}

export interface CatalogFacetOptions {
  categories: CatalogFacetOption[];
  brands: CatalogFacetOption[];
  models: CatalogFacetOption[];
  years: CatalogFacetOption[];
  statuses: CatalogFacetOption[];
}

export const emptyCatalogSearchState = (): CatalogSearchState => ({
  query: '',
  categoryId: 'all',
  brandId: '',
  modelId: '',
  modelYear: null,
  status: 'all',
});

const cleanParam = (value: string | null, maximum = 100) => (
  String(value || '').trim().slice(0, maximum)
);

export function readCatalogSearchState(search: string): CatalogSearchState {
  const params = new URLSearchParams(search);
  const category = cleanParam(params.get('category'), 30);
  const status = cleanParam(params.get('status'), 20);
  const parsedYear = Number(params.get('year'));

  return {
    query: cleanParam(params.get('q'), 100),
    categoryId: dealCategoryIds.includes(category as DealCategoryId)
      ? category as DealCategoryId
      : 'all',
    brandId: cleanParam(params.get('brand'), 80),
    modelId: cleanParam(params.get('model'), 80),
    modelYear: Number.isInteger(parsedYear) && parsedYear >= 1886 && parsedYear <= 2100
      ? parsedYear
      : null,
    status: searchableDealStatuses.includes(status as DealStatus)
      ? status as DealStatus
      : 'all',
  };
}

export function mergeCatalogSearchParams(
  search: string,
  state: CatalogSearchState,
): string {
  const params = new URLSearchParams(search);
  const setOrDelete = (key: string, value: string) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };

  setOrDelete('q', state.query.trim());
  setOrDelete('category', state.categoryId === 'all' ? '' : state.categoryId);
  setOrDelete('brand', state.brandId);
  setOrDelete('model', state.modelId);
  setOrDelete('year', state.modelYear ? String(state.modelYear) : '');
  setOrDelete('status', state.status === 'all' ? '' : state.status);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

const normalizedText = (value: unknown) => (
  String(value || '').normalize('NFKD').toLocaleLowerCase('en-US')
);

export function matchesCatalogSearch(deal: Deal, state: CatalogSearchState): boolean {
  const catalog = deal.catalog;
  if (state.categoryId !== 'all' && catalog?.categoryId !== state.categoryId) return false;
  if (state.brandId && catalog?.brandId !== state.brandId) return false;
  if (state.modelId && catalog?.modelId !== state.modelId) return false;
  if (state.modelYear && catalog?.modelYear !== state.modelYear) return false;
  if (state.status !== 'all' && deal.status !== state.status) return false;

  const tokens = normalizedText(state.query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizedText([
    deal.title,
    deal.publicId,
    catalog?.brandLabel,
    catalog?.modelLabel,
    catalog?.modelYear,
    catalog?.variantLabel,
  ].filter(Boolean).join(' '));
  return tokens.every(token => haystack.includes(token));
}

export function filterCatalogDeals(deals: Deal[], state: CatalogSearchState): Deal[] {
  return deals.filter(deal => matchesCatalogSearch(deal, state));
}

const addFacet = (
  target: Map<string, CatalogFacetOption>,
  id: string | undefined,
  label: string | undefined,
) => {
  if (!id || !label) return;
  const existing = target.get(id);
  target.set(id, {
    id,
    label,
    count: (existing?.count || 0) + 1,
  });
};

const sortedFacets = (source: Map<string, CatalogFacetOption>) => (
  [...source.values()].sort((left, right) => (
    left.label.localeCompare(right.label, 'en-US', { numeric: true })
  ))
);

export function getCatalogFacetOptions(
  deals: Deal[],
  state: CatalogSearchState,
): CatalogFacetOptions {
  const categories = new Map<string, CatalogFacetOption>();
  const brands = new Map<string, CatalogFacetOption>();
  const models = new Map<string, CatalogFacetOption>();
  const years = new Map<string, CatalogFacetOption>();
  const statuses = new Map<string, CatalogFacetOption>();

  deals.forEach(deal => {
    const catalog = deal.catalog;
    const categoryId = catalog?.categoryId || 'general';
    addFacet(categories, categoryId, dealCategoryLabels[categoryId]);
    addFacet(statuses, deal.status, deal.status);

    if (state.categoryId === 'all' || categoryId !== state.categoryId) return;
    addFacet(brands, catalog?.brandId, catalog?.brandLabel);

    if (!state.brandId || catalog?.brandId !== state.brandId) return;
    addFacet(models, catalog?.modelId, catalog?.modelLabel);
    if (catalog?.modelYear) {
      addFacet(years, String(catalog.modelYear), String(catalog.modelYear));
    }
  });

  return {
    categories: sortedFacets(categories),
    brands: sortedFacets(brands),
    models: sortedFacets(models),
    years: sortedFacets(years).sort((left, right) => Number(right.id) - Number(left.id)),
    statuses: searchableDealStatuses
      .map(status => statuses.get(status))
      .filter((option): option is CatalogFacetOption => Boolean(option)),
  };
}

export const hasCatalogSearchFilters = (state: CatalogSearchState) => (
  Boolean(
    state.query
    || state.categoryId !== 'all'
    || state.brandId
    || state.modelId
    || state.modelYear
    || state.status !== 'all'
  )
);
