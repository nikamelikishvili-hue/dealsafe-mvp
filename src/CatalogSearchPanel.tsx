import { Link2, Search, SlidersHorizontal, X } from 'lucide-react';
import { t } from './i18n';
import type { Deal } from './domain';
import {
  dealCategoryLabels,
  emptyCatalogSearchState,
  getCatalogFacetOptions,
  hasCatalogSearchFilters,
  type CatalogSearchState,
} from './catalogSearch';

interface CatalogSearchPanelProps {
  deals: Deal[];
  filteredCount: number;
  value: CatalogSearchState;
  onChange: (value: CatalogSearchState) => void;
}

export function CatalogSearchPanel({
  deals,
  filteredCount,
  value,
  onChange,
}: CatalogSearchPanelProps) {
  const facets = getCatalogFacetOptions(deals, value);
  const filtered = hasCatalogSearchFilters(value);
  const categoryLabel = value.categoryId === 'all'
    ? ''
    : dealCategoryLabels[value.categoryId];
  const brandLabel = facets.brands.find(option => option.id === value.brandId)?.label;
  const modelLabel = facets.models.find(option => option.id === value.modelId)?.label;
  const activeLabels = [
    categoryLabel,
    brandLabel,
    modelLabel,
    value.modelYear ? String(value.modelYear) : '',
    value.status === 'all' ? '' : value.status,
  ].filter(Boolean);

  const updateCategory = (categoryId: CatalogSearchState['categoryId']) => {
    onChange({
      ...value,
      categoryId,
      brandId: '',
      modelId: '',
      modelYear: null,
    });
  };

  const updateBrand = (brandId: string) => {
    onChange({
      ...value,
      brandId,
      modelId: '',
      modelYear: null,
    });
  };

  return (
    <section className="catalog-search-panel" aria-labelledby="catalog-search-title">
      <div className="catalog-search-heading">
        <span className="catalog-search-icon"><SlidersHorizontal /></span>
        <div>
          <p className="eyebrow">{t('Structured search')}</p>
          <h2 id="catalog-search-title">{t('Find the right deal faster')}</h2>
          <p>{t('Filter your private workspace and Watchlist by saved item details.')}</p>
        </div>
        <span className="catalog-search-url-note"><Link2 />{t('Filters stay in this URL')}</span>
      </div>

      <div className="catalog-search-controls">
        <label className="catalog-query-control">
          <span>{t('Search')}</span>
          <span className="catalog-query-input">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={value.query}
              maxLength={100}
              autoComplete="off"
              placeholder={t('Item, Deal ID, brand, or model')}
              onChange={event => onChange({ ...value, query: event.target.value })}
            />
          </span>
        </label>

        <label>
          <span>{t('Category')}</span>
          <select
            value={value.categoryId}
            onChange={event => updateCategory(event.target.value as CatalogSearchState['categoryId'])}
          >
            <option value="all">{t('All categories')} ({deals.length})</option>
            {facets.categories.map(option => (
              <option key={option.id} value={option.id}>
                {t(option.label)} ({option.count})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t(value.categoryId === 'vehicle' ? 'Make' : 'Brand')}</span>
          <select
            value={value.brandId}
            disabled={value.categoryId === 'all' || !facets.brands.length}
            onChange={event => updateBrand(event.target.value)}
          >
            <option value="">
              {t(value.categoryId === 'all' ? 'Choose category first' : 'All brands')}
            </option>
            {facets.brands.map(option => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t('Model')}</span>
          <select
            value={value.modelId}
            disabled={!value.brandId || !facets.models.length}
            onChange={event => onChange({
              ...value,
              modelId: event.target.value,
              modelYear: null,
            })}
          >
            <option value="">{t(value.brandId ? 'All models' : 'Choose brand first')}</option>
            {facets.models.map(option => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </label>

        {value.categoryId === 'vehicle' && (
          <label>
            <span>{t('Year')}</span>
            <select
              value={value.modelYear || ''}
              disabled={!value.brandId || !facets.years.length}
              onChange={event => onChange({
                ...value,
                modelYear: event.target.value ? Number(event.target.value) : null,
              })}
            >
              <option value="">{t('All years')}</option>
              {facets.years.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span>{t('Status')}</span>
          <select
            value={value.status}
            onChange={event => onChange({
              ...value,
              status: event.target.value as CatalogSearchState['status'],
            })}
          >
            <option value="all">{t('All statuses')}</option>
            {facets.statuses.map(option => (
              <option key={option.id} value={option.id}>
                {t(option.label)} ({option.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="catalog-search-summary" aria-live="polite">
        <span>
          <strong>{filteredCount}</strong>
          {' '}
          {t(filteredCount === 1 ? 'matching deal' : 'matching deals')}
          {activeLabels.length ? ` · ${activeLabels.join(' · ')}` : ''}
        </span>
        {filtered && (
          <button
            type="button"
            className="catalog-clear-filters"
            onClick={() => onChange(emptyCatalogSearchState())}
          >
            <X />{t('Clear filters')}
          </button>
        )}
      </div>
    </section>
  );
}
