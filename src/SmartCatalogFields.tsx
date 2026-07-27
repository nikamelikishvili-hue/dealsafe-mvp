import { useEffect, useState } from 'react';
import { BadgeCheck, ScanSearch, ShieldCheck } from 'lucide-react';
import { t } from './i18n';
import {
  OTHER_CATALOG_VALUE,
  buildSmartCatalogTitle,
  getCatalogModels,
  getEmbeddedCatalogSnapshot,
  getSmartCatalogGuide,
  isGuidedCatalogCategory,
  type SmartCatalogCategoryId,
  type SmartCatalogSelection,
} from './smartCatalog';
import { loadSmartCatalogCategory } from './services/catalogService';

interface SmartCatalogFieldsProps {
  category: SmartCatalogCategoryId;
  value: SmartCatalogSelection;
  onChange: (patch: Partial<SmartCatalogSelection>) => void;
}

export function SmartCatalogFields({
  category,
  value,
  onChange,
}: SmartCatalogFieldsProps) {
  const isGuided = isGuidedCatalogCategory(category);
  const guidedCategory = isGuided ? category : 'phone';
  const [snapshot, setSnapshot] = useState(() => getEmbeddedCatalogSnapshot(guidedCategory));

  useEffect(() => {
    if (!isGuided) return undefined;
    let current = true;
    setSnapshot(getEmbeddedCatalogSnapshot(guidedCategory));
    loadSmartCatalogCategory(guidedCategory).then(result => {
      if (current) setSnapshot(result);
    });
    return () => {
      current = false;
    };
  }, [guidedCategory, isGuided]);

  if (!isGuided) return null;

  const guide = getSmartCatalogGuide(guidedCategory);
  const catalog = snapshot.brands;
  const models = getCatalogModels(guidedCategory, value.brand, catalog);
  const title = buildSmartCatalogTitle(guidedCategory, value);
  const isOtherBrand = value.brand === OTHER_CATALOG_VALUE;
  const isOtherModel = value.model === OTHER_CATALOG_VALUE;
  const update = (patch: Partial<SmartCatalogSelection>) => onChange(patch);
  const changeBrand = (brand: string) => update({
    brand,
    model: '',
    customBrand: '',
    customModel: '',
  });
  const changeModel = (model: string) => update({ model, customModel: '' });

  return (
    <fieldset className="smart-catalog-fields">
      <legend>
        <ScanSearch />
        <span>
          <b>{t(guide.finderTitle)}</b>
          <small>{t('Choose known details and Dealivra will build the item title for you.')}</small>
        </span>
      </legend>
      <div className={`smart-catalog-grid is-${guidedCategory}`}>
        {guidedCategory === 'vehicle' && (
          <label>
            {t('Year')}
            <select value={value.year} onChange={event => update({ year: event.target.value })}>
              <option value="">{t('Choose year')}</option>
              {snapshot.years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        )}
        <label>
          {t(guide.identityLabel)}
          <select value={value.brand} onChange={event => changeBrand(event.target.value)}>
            <option value="">{t(guide.chooseIdentity)}</option>
            {catalog.map(item => <option key={item.id} value={item.label}>{item.label}</option>)}
            <option value={OTHER_CATALOG_VALUE}>{t('Not listed')}</option>
          </select>
        </label>
        {!isOtherBrand && (
          <label>
            {t('Model')}
            <select
              value={value.model}
              disabled={!value.brand}
              onChange={event => changeModel(event.target.value)}
            >
              <option value="">
                {t(value.brand ? 'Choose model' : guide.chooseModelBeforeIdentity)}
              </option>
              {models.map(model => <option key={model} value={model}>{model}</option>)}
              {value.brand && <option value={OTHER_CATALOG_VALUE}>{t('Not listed')}</option>}
            </select>
          </label>
        )}
        {snapshot.variants.length > 0 && (
          <label>
            {t(guide.variantLabel)} <span className="optional-label">{t('Optional')}</span>
            <select value={value.variant} onChange={event => update({ variant: event.target.value })}>
              <option value="">{t(guide.chooseVariant)}</option>
              {snapshot.variants.map(variant => (
                <option key={variant} value={variant}>{variant}</option>
              ))}
            </select>
          </label>
        )}
        {isOtherBrand && (
          <>
            <label>
              {t(guide.identityNameLabel)}
              <input
                maxLength={60}
                placeholder={t(guide.enterIdentity)}
                value={value.customBrand}
                onChange={event => update({ customBrand: event.target.value })}
              />
            </label>
            <label>
              {t('Model name')}
              <input
                maxLength={80}
                placeholder={t('Enter model')}
                value={value.customModel}
                onChange={event => update({ customModel: event.target.value })}
              />
            </label>
          </>
        )}
        {isOtherModel && (
          <label>
            {t('Model name')}
            <input
              maxLength={80}
              placeholder={t('Enter model')}
              value={value.customModel}
              onChange={event => update({ customModel: event.target.value })}
            />
          </label>
        )}
      </div>
      <p
        className={`smart-catalog-preview ${title ? 'has-title' : ''}`}
        aria-live="polite"
      >
        <BadgeCheck />
        <span>
          <small>{t('Suggested title')}</small>
          <b>{title || t('Choose details above')}</b>
        </span>
      </p>
      <p className="smart-catalog-source">
        <ShieldCheck />
        {t('Curated for the U.S. launch. Manual entry is always available.')}
      </p>
    </fieldset>
  );
}
