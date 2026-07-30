import React, { useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Boxes,
  Camera,
  Car,
  Check,
  ChevronDown,
  Clock3,
  FileSignature,
  Gamepad2,
  Gem,
  ImagePlus,
  Laptop,
  Package,
  PackageCheck,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Watch,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { SmartCatalogFields } from './SmartCatalogFields';
import { currencyStep } from './currency';
import type { DealDraft } from './domain';
import { t } from './i18n';
import {
  isGuidedCatalogCategory,
  type SmartCatalogCategoryId,
  type SmartCatalogSelection,
} from './smartCatalog';
import type { VehicleVinResult } from './services/catalogService';

export type DealTemplateId = SmartCatalogCategoryId;
export type CreateFlowStep = 1 | 2 | 3 | 4;

export type DealTemplate = {
  id: DealTemplateId;
  label: string;
  titlePlaceholder: string;
  descriptionPrompt: string;
  photoPrompt: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierHelp: string;
  identifierPattern: string;
  icon: LucideIcon;
};

export type CreateFieldError = {
  fieldId: string;
  message: string;
};

export type VehicleVinLookupState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  result?: VehicleVinResult;
};

export const dealTemplates: DealTemplate[] = [
  {
    id: 'phone',
    label: 'Phone',
    titlePlaceholder: 'iPhone 15 Pro · 256 GB',
    descriptionPrompt:
      'Include the model, storage, battery health, lock status, repairs, damage, and accessories.',
    photoPrompt:
      'Photograph the front, back, sides, powered-on screen, serial or IMEI label, damage, and accessories.',
    identifierLabel: 'Serial or IMEI (optional)',
    identifierPlaceholder: '15-digit IMEI or manufacturer serial',
    identifierHelp:
      'Enter a 15-digit IMEI or a manufacturer serial number with 6 to 30 characters.',
    identifierPattern: '(?:[0-9]{15}|[A-Za-z0-9-]{6,30})',
    icon: Smartphone,
  },
  {
    id: 'laptop',
    label: 'Laptop',
    titlePlaceholder: 'MacBook Pro 14 · M3 · 512 GB',
    descriptionPrompt:
      'Include the processor, memory, storage, battery condition, screen condition, repairs, and charger.',
    photoPrompt:
      'Photograph the lid, powered-on screen, keyboard, ports, bottom serial label, charger, and damage.',
    identifierLabel: 'Serial number (optional)',
    identifierPlaceholder: 'Manufacturer serial number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Laptop,
  },
  {
    id: 'tablet',
    label: 'Tablet',
    titlePlaceholder: 'Apple iPad Pro 11 · 256 GB',
    descriptionPrompt:
      'Include the model, storage, connectivity, battery condition, screen condition, repairs, and accessories.',
    photoPrompt:
      'Photograph the front, back, sides, powered-on screen, serial label, damage, and accessories.',
    identifierLabel: 'Serial or IMEI (optional)',
    identifierPlaceholder: 'Serial number or IMEI',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Tablet,
  },
  {
    id: 'vehicle',
    label: 'Vehicle',
    titlePlaceholder: '2021 BMW X5 · 42,000 miles',
    descriptionPrompt:
      'Include the mileage, title status, accident history, service history, warning lights, and known defects.',
    photoPrompt:
      'Photograph the front, rear, both sides, interior, odometer, VIN label, tires, and known defects.',
    identifierLabel: 'VIN (optional)',
    identifierPlaceholder: '17-character VIN',
    identifierHelp:
      'A VIN must contain exactly 17 letters or numbers and cannot use I, O, or Q.',
    identifierPattern: '[A-HJ-NPR-Z0-9]{17}',
    icon: Car,
  },
  {
    id: 'watch',
    label: 'Luxury watch',
    titlePlaceholder: 'Rolex Submariner · Reference 126610LN',
    descriptionPrompt:
      'Include the reference number, authenticity evidence, service history, condition, box, papers, and accessories.',
    photoPrompt:
      'Photograph the dial, caseback, crown, bracelet, serial or reference, box, papers, and visible wear.',
    identifierLabel: 'Reference or serial number (optional)',
    identifierPlaceholder: 'Reference or serial number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Watch,
  },
  {
    id: 'camera',
    label: 'Camera',
    titlePlaceholder: 'Sony Alpha a7 IV · Body only',
    descriptionPrompt:
      'Include shutter count, sensor and body condition, repairs, included lenses, batteries, and accessories.',
    photoPrompt:
      'Photograph the front, back, sensor or lens mount, powered-on screen, serial label, accessories, and damage.',
    identifierLabel: 'Serial number (optional)',
    identifierPlaceholder: 'Manufacturer serial number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Camera,
  },
  {
    id: 'gaming',
    label: 'Gaming',
    titlePlaceholder: 'Sony PlayStation 5 · Disc edition',
    descriptionPrompt:
      'Include the exact model, storage, controller count, account or lock status, repairs, and accessories.',
    photoPrompt:
      'Photograph every side, powered-on screen, serial label, controllers, cables, games, and damage.',
    identifierLabel: 'Serial number (optional)',
    identifierPlaceholder: 'Manufacturer serial number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Gamepad2,
  },
  {
    id: 'tools',
    label: 'Tools & equipment',
    titlePlaceholder: 'DeWalt 20V MAX drill kit',
    descriptionPrompt:
      'Include the model, hours or usage, power source, operational condition, repairs, batteries, and attachments.',
    photoPrompt:
      'Photograph all sides, model plate, operating controls, batteries, attachments, and wear or damage.',
    identifierLabel: 'Serial or equipment number (optional)',
    identifierPlaceholder: 'Serial or equipment number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Wrench,
  },
  {
    id: 'business',
    label: 'Business equipment',
    titlePlaceholder: 'Commercial equipment brand and model',
    descriptionPrompt:
      'Include the manufacturer, model, age, hours or usage, service history, defects, and included components.',
    photoPrompt:
      'Photograph all sides, data plate, controls, powered-on state, accessories, and wear or damage.',
    identifierLabel: 'Serial or asset number (optional)',
    identifierPlaceholder: 'Serial or asset number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Briefcase,
  },
  {
    id: 'jewelry',
    label: 'Jewelry',
    titlePlaceholder: '18K gold diamond ring · Size 7',
    descriptionPrompt:
      'Include the material, weight, stones, measurements, hallmark, appraisal, repairs, and condition.',
    photoPrompt:
      'Photograph all angles, hallmark, clasp or setting, appraisal or certificate, packaging, and visible wear.',
    identifierLabel: 'Certificate or reference (optional)',
    identifierPlaceholder: 'Certificate or reference number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Gem,
  },
  {
    id: 'collectible',
    label: 'Collectibles',
    titlePlaceholder: 'Item name · Edition or year',
    descriptionPrompt:
      'Include the creator or brand, edition, year, provenance, grading, restoration, defects, and packaging.',
    photoPrompt:
      'Photograph the front, back, markings, certificate or grading label, packaging, and every defect.',
    identifierLabel: 'Certificate or reference (optional)',
    identifierPlaceholder: 'Certificate or reference number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Boxes,
  },
  {
    id: 'general',
    label: 'Other item',
    titlePlaceholder: 'Item brand and model',
    descriptionPrompt:
      'Include the brand, model, age, usage, known defects, repairs, and included parts or accessories.',
    photoPrompt:
      'Photograph the front, back, multiple angles, serial or reference label, defects, and included parts.',
    identifierLabel: 'Serial or reference number (optional)',
    identifierPlaceholder: 'Serial or reference number',
    identifierHelp: 'Enter at least 3 characters.',
    identifierPattern: '.{3,40}',
    icon: Package,
  },
];

const createFlowSteps = [
  { number: 1 as const, label: 'Item', detail: 'Category, title, and price', icon: Package },
  { number: 2 as const, label: 'Terms', detail: 'Condition and handoff', icon: FileSignature },
  { number: 3 as const, label: 'Photos', detail: 'Optional evidence', icon: ImagePlus },
  { number: 4 as const, label: 'Review', detail: 'Confirm and publish', icon: BadgeCheck },
];

const createStepMeta = {
  1: {
    eyebrow: 'STEP 1 OF 4',
    title: 'What are you selling?',
    description: 'Choose the closest category, then add a clear title and price.',
    action: 'Continue to terms',
    dock: 'Item and price',
  },
  2: {
    eyebrow: 'STEP 2 OF 4',
    title: 'Set the deal terms.',
    description: 'Record the condition, important disclosures, and how the item will be handed over.',
    action: 'Continue to photos',
    dock: 'Condition and handoff',
  },
  3: {
    eyebrow: 'STEP 3 OF 4',
    title: 'Add visual evidence.',
    description: 'Photos are optional in this beta, but clear evidence helps both parties understand the item.',
    action: 'Review deal',
    dock: 'Photos and evidence',
  },
  4: {
    eyebrow: 'FINAL STEP',
    title: 'Review and publish.',
    description: 'Confirm the shared record before creating the Deal Link.',
    action: 'Confirm and publish',
    dock: 'Final review',
  },
} satisfies Record<
  CreateFlowStep,
  { eyebrow: string; title: string; description: string; action: string; dock: string }
>;

function DealTemplatePicker({
  templates,
  selected,
  onSelect,
}: {
  templates: readonly DealTemplate[];
  selected: DealTemplateId;
  onSelect: (id: DealTemplateId) => void;
}) {
  const featuredIds: DealTemplateId[] = ['phone', 'vehicle', 'laptop', 'tablet', 'watch'];
  const [expanded, setExpanded] = useState(false);
  const template = templates.find(item => item.id === selected) || templates[0];
  const visibleTemplates = expanded
    ? templates
    : templates.filter(item => featuredIds.includes(item.id) || item.id === selected);

  return (
    <section className="deal-template-picker no-print">
      <div className="deal-template-heading">
        <PackageCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Start with a template')}</p>
          <h2>{t('Choose an item category')}</h2>
          <p>{t('Select the closest category to get a safer description checklist.')}</p>
        </div>
      </div>
      <div className="deal-template-grid">
        {visibleTemplates.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={selected === item.id ? 'selected' : ''}
              aria-pressed={selected === item.id}
              onClick={() => onSelect(item.id)}
            >
              <Icon aria-hidden="true" />
              <span>{t(item.label)}</span>
              {selected === item.id && <Check aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="catalog-category-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        {t(expanded ? 'Show fewer categories' : 'More categories')}
        <ChevronDown className={expanded ? 'is-open' : ''} aria-hidden="true" />
      </button>
      <div className="deal-template-guidance">
        <ShieldCheck aria-hidden="true" />
        <div>
          <b>{t('Include these details')}</b>
          <span>{t(template.descriptionPrompt)}</span>
        </div>
      </div>
    </section>
  );
}

function CreateDealProgress({
  current,
  available,
  onSelect,
}: {
  current: CreateFlowStep;
  available: CreateFlowStep;
  onSelect: (step: CreateFlowStep) => void;
}) {
  return (
    <nav className="create-flow-progress" aria-label={t('Create deal progress')}>
      {createFlowSteps.map(item => {
        const Icon = item.icon;
        const completed = item.number < current;
        const disabled = item.number > available;
        return (
          <button
            key={item.number}
            type="button"
            className={`${item.number === current ? 'is-current ' : ''}${completed ? 'is-complete' : ''}`}
            aria-current={item.number === current ? 'step' : undefined}
            disabled={disabled}
            onClick={() => onSelect(item.number)}
          >
            <span className="create-flow-step-icon">
              {completed ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
            </span>
            <span>
              <small>{t(`Step ${item.number}`)}</small>
              <strong>{t(item.label)}</strong>
              <em>{t(item.detail)}</em>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function CreateValidationSummary({
  errors,
  onSelect,
}: {
  errors: CreateFieldError[];
  onSelect: (fieldId: string) => void;
}) {
  return (
    <section
      id="create-validation-summary"
      className="create-validation-summary"
      role="alert"
      aria-labelledby="create-validation-title"
      tabIndex={-1}
    >
      <span className="create-validation-icon">
        <ShieldAlert aria-hidden="true" />
      </span>
      <div>
        <p className="eyebrow">{t('Needs attention')}</p>
        <h2 id="create-validation-title">
          {t(errors.length === 1 ? 'Check 1 detail before continuing' : `Check ${errors.length} details before continuing`)}
        </h2>
        <p>{t('Choose an item below to jump directly to the field.')}</p>
        <ul>
          {errors.map(error => (
            <li key={error.fieldId}>
              <button type="button" onClick={() => onSelect(error.fieldId)}>
                {t(error.message)}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DealPhotoGuide({ template, count }: { template: DealTemplate; count: number }) {
  const goal = 6;
  const progress = Math.min(100, Math.round((count / goal) * 100));
  const enough = count >= 4;

  return (
    <section className={`deal-photo-guide no-print ${enough ? 'ready' : ''}`}>
      <div className="deal-photo-guide-title">
        <ImagePlus aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Photo evidence')}</p>
          <h3>{t('Recommended photo set')}</h3>
        </div>
        <strong>
          {count}/{goal}
        </strong>
      </div>
      <p>{t(template.photoPrompt)}</p>
      <div
        className="deal-photo-progress"
        role="progressbar"
        aria-label={t('Recommended photo set')}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(count, goal)}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>
        {t(
          enough
            ? 'Good coverage. Add more angles if they show important condition details.'
            : 'Add at least 4 clear photos before publishing.',
        )}
      </small>
    </section>
  );
}

const isVideoFile = (file: File) =>
  file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);

function FilePreview({ file, alt }: { file: File; alt: string }) {
  const [source, setSource] = useState('');

  useEffect(() => {
    const nextSource = URL.createObjectURL(file);
    setSource(nextSource);
    return () => URL.revokeObjectURL(nextSource);
  }, [file]);

  if (!source) return null;
  return isVideoFile(file) ? (
    <video src={source} controls muted playsInline preload="metadata" aria-label={alt} />
  ) : (
    <img src={source} alt={alt} />
  );
}

interface DealCreationWorkspaceProps {
  currentStep: CreateFlowStep;
  availableStep: CreateFlowStep;
  reviewingDraft: boolean;
  draftRecoveryVisible: boolean;
  draftRecovered: boolean;
  draftRecoveryTime: string;
  dashboardAvailable: boolean;
  templates: readonly DealTemplate[];
  templateId: DealTemplateId;
  selectedTemplate: DealTemplate;
  catalogSelection: SmartCatalogSelection;
  draft: DealDraft;
  errors: CreateFieldError[];
  identifierEntered: boolean;
  identifierValid: boolean;
  vehicleVinLookup: VehicleVinLookupState;
  photos: File[];
  reviewContent: ReactNode;
  onSelectStep: (step: CreateFlowStep) => void;
  onReset: () => void;
  onBack: () => void;
  onFocusError: (fieldId: string) => void;
  onSelectTemplate: (template: DealTemplateId) => void;
  onCatalogSelectionChange: (selection: Partial<SmartCatalogSelection>) => void;
  onDraftChange: (draft: DealDraft) => void;
  onClearVinLookup: () => void;
  onCheckVehicleVin: () => void;
  onPhotosChange: Dispatch<SetStateAction<File[]>>;
  onReviewDraft: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitStep: (step: CreateFlowStep) => void;
}

export function DealCreationWorkspace({
  currentStep,
  availableStep,
  reviewingDraft,
  draftRecoveryVisible,
  draftRecovered,
  draftRecoveryTime,
  dashboardAvailable,
  templates,
  templateId,
  selectedTemplate,
  catalogSelection,
  draft,
  errors,
  identifierEntered,
  identifierValid,
  vehicleVinLookup,
  photos,
  reviewContent,
  onSelectStep,
  onReset,
  onBack,
  onFocusError,
  onSelectTemplate,
  onCatalogSelectionChange,
  onDraftChange,
  onClearVinLookup,
  onCheckVehicleVin,
  onPhotosChange,
  onReviewDraft,
  onSubmitStep,
}: DealCreationWorkspaceProps) {
  const hasError = (fieldId: string) => errors.some(error => error.fieldId === fieldId);
  const errorMessage = (fieldId: string) => errors.find(error => error.fieldId === fieldId)?.message;
  const updateDraft = (patch: Partial<DealDraft>) => onDraftChange({ ...draft, ...patch });

  const addPhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(event.target.files || []);
    onPhotosChange(previous => {
      const combined = [...previous, ...added]
        .filter(
          (file, index, all) =>
            all.findIndex(other => other.name === file.name && other.size === file.size) === index,
        )
        .slice(0, 6);
      let videoSeen = false;
      return combined.filter(file => !isVideoFile(file) || (!videoSeen && (videoSeen = true)));
    });
    event.currentTarget.value = '';
  };

  return (
    <section id="create-deal-flow" className="create-flow-shell">
      <CreateDealProgress
        current={reviewingDraft ? 4 : currentStep}
        available={availableStep}
        onSelect={onSelectStep}
      />

      {draftRecoveryVisible && (
        <section
          className={`create-draft-recovery ${draftRecovered ? 'is-recovered' : ''}`}
          aria-label={t('Draft recovery')}
        >
          <span className="create-draft-recovery-icon">
            <Clock3 aria-hidden="true" />
          </span>
          <div>
            <strong>{t(draftRecovered ? 'Draft recovered' : 'Draft recovery is on')}</strong>
            <span aria-live="polite">
              {t(
                draftRecovered
                  ? 'Your item and terms were restored from this device. Review them before publishing.'
                  : `Saved privately on this device · ${draftRecoveryTime}`,
              )}
            </span>
            <small>
              {t('Photos, files, identifiers, and seller confirmations are never stored in browser recovery.')}
            </small>
          </div>
          <button type="button" onClick={onReset}>
            <Trash2 size={15} aria-hidden="true" />
            {t('Start over')}
          </button>
        </section>
      )}

      {!reviewingDraft && (
        <header className="create-flow-heading">
          <button className="back" onClick={onBack}>
            ← {t(dashboardAvailable ? 'Dashboard' : 'Home')}
          </button>
          <p className="eyebrow">{t(createStepMeta[currentStep].eyebrow)}</p>
          <h1>{t(createStepMeta[currentStep].title)}</h1>
          <p className="lede small">{t(createStepMeta[currentStep].description)}</p>
        </header>
      )}

      {!reviewingDraft && errors.length > 0 && (
        <CreateValidationSummary errors={errors} onSelect={onFocusError} />
      )}

      {!reviewingDraft && currentStep === 1 && (
        <div className="create-step-layout">
          <DealTemplatePicker templates={templates} selected={templateId} onSelect={onSelectTemplate} />
          <section className="form-wrap create-step-card">
            <form
              id="create-step-1"
              noValidate
              onSubmit={event => {
                event.preventDefault();
                onSubmitStep(1);
              }}
            >
              <SmartCatalogFields
                category={templateId}
                value={catalogSelection}
                onChange={onCatalogSelectionChange}
              />
              <label>
                {t('Item title')}
                <input
                  id="create-item-title"
                  required
                  minLength={3}
                  maxLength={120}
                  aria-invalid={hasError('create-item-title')}
                  aria-describedby="create-item-title-help"
                  placeholder={selectedTemplate.titlePlaceholder}
                  value={draft.title}
                  onChange={event => updateDraft({ title: event.target.value })}
                />
                <small
                  id="create-item-title-help"
                  className={hasError('create-item-title') ? 'field-help invalid' : 'field-help'}
                >
                  {t(
                    errorMessage('create-item-title') ||
                      (isGuidedCatalogCategory(templateId)
                        ? 'Auto-filled from your choices; edit it if needed.'
                        : 'Use the brand, model, and one detail that helps identify the item.'),
                  )}
                </small>
              </label>
              <div className="two">
                <label>
                  {t('Price')}
                  <span className="price-currency-controls">
                    <input
                      id="create-item-price"
                      required
                      min={currencyStep(draft.currency)}
                      step={currencyStep(draft.currency)}
                      type="number"
                      aria-invalid={hasError('create-item-price')}
                      aria-describedby="create-item-price-help"
                      placeholder="780"
                      value={draft.price}
                      onChange={event => updateDraft({ price: event.target.value })}
                    />
                    <span className="currency-label">USD</span>
                  </span>
                  <small
                    id="create-item-price-help"
                    className={hasError('create-item-price') ? 'field-help invalid' : 'field-help'}
                  >
                    {t(
                      errorMessage('create-item-price') ||
                        'Enter the agreed item price before fees or shipping.',
                    )}
                  </small>
                </label>
                <label>
                  {t('Condition')}
                  <select
                    value={draft.condition}
                    onChange={event =>
                      updateDraft({ condition: event.target.value as DealDraft['condition'] })
                    }
                  >
                    <option value="Like new">{t('Like new')}</option>
                    <option value="Good">{t('Good')}</option>
                    <option value="Fair">{t('Fair')}</option>
                  </select>
                </label>
              </div>
            </form>
          </section>
        </div>
      )}

      {!reviewingDraft && currentStep === 2 && (
        <section className="form-wrap create-step-card">
          <form
            id="create-step-2"
            noValidate
            onSubmit={event => {
              event.preventDefault();
              onSubmitStep(2);
            }}
          >
            <div className="create-step-guidance">
              <ShieldCheck aria-hidden="true" />
              <div>
                <b>{t('What the buyer needs to know')}</b>
                <span>{t(selectedTemplate.descriptionPrompt)}</span>
              </div>
            </div>
            <label>
              {t('Known condition and defects')}
              <textarea
                id="create-item-description"
                required
                minLength={20}
                maxLength={10000}
                aria-invalid={hasError('create-item-description')}
                aria-describedby="create-item-description-help"
                placeholder={t(selectedTemplate.descriptionPrompt)}
                value={draft.description}
                onChange={event => updateDraft({ description: event.target.value })}
              />
              <small
                id="create-item-description-help"
                className={hasError('create-item-description') ? 'field-help invalid' : 'field-help'}
              >
                {t(
                  errorMessage('create-item-description') ||
                    `${draft.description.trim().length}/20 · Describe wear, repairs, or defects.`,
                )}
              </small>
            </label>
            <div className={`identifier-field ${templateId === 'vehicle' ? 'is-vin' : ''}`}>
              <label htmlFor="create-item-identifier">{t(selectedTemplate.identifierLabel)}</label>
              <div className="identifier-input-action">
                <input
                  id="create-item-identifier"
                  maxLength={templateId === 'vehicle' ? 17 : 40}
                  pattern={selectedTemplate.identifierPattern}
                  title={t(selectedTemplate.identifierHelp)}
                  aria-describedby="create-item-identifier-help"
                  placeholder={t(selectedTemplate.identifierPlaceholder)}
                  spellCheck={false}
                  aria-invalid={identifierEntered && !identifierValid}
                  value={draft.serialNumber}
                  onChange={event => {
                    updateDraft({
                      serialNumber:
                        templateId === 'vehicle'
                          ? event.target.value.toUpperCase()
                          : event.target.value,
                    });
                    onClearVinLookup();
                  }}
                />
                {templateId === 'vehicle' && (
                  <button
                    type="button"
                    className="vin-check-button"
                    disabled={
                      !identifierEntered ||
                      !identifierValid ||
                      vehicleVinLookup.status === 'loading'
                    }
                    onClick={onCheckVehicleVin}
                  >
                    <ScanSearch aria-hidden="true" />
                    {t(vehicleVinLookup.status === 'loading' ? 'Checking…' : 'Check VIN')}
                  </button>
                )}
              </div>
              <small
                id="create-item-identifier-help"
                className={`identifier-feedback ${
                  identifierEntered ? (identifierValid ? 'valid' : 'invalid') : ''
                }`}
              >
                {t(
                  identifierEntered
                    ? identifierValid
                      ? templateId === 'vehicle'
                        ? 'Format is ready for an NHTSA VIN check.'
                        : 'Format looks correct. This checks format only, not ownership or authenticity.'
                      : selectedTemplate.identifierHelp
                    : 'Stored privately; only last characters shown',
                )}
              </small>
            </div>

            {templateId === 'vehicle' && vehicleVinLookup.status !== 'idle' && (
              <div
                className={`vin-lookup-status is-${vehicleVinLookup.status}`}
                role="status"
                aria-live="polite"
              >
                {vehicleVinLookup.status === 'success' ? (
                  <BadgeCheck aria-hidden="true" />
                ) : vehicleVinLookup.status === 'error' ? (
                  <ShieldAlert aria-hidden="true" />
                ) : (
                  <Clock3 aria-hidden="true" />
                )}
                <span>
                  <b>
                    {t(
                      vehicleVinLookup.status === 'success'
                        ? 'VIN details found'
                        : vehicleVinLookup.status === 'error'
                          ? 'VIN check unavailable'
                          : 'Checking VIN',
                    )}
                  </b>
                  <small>{t(vehicleVinLookup.message)}</small>
                  {vehicleVinLookup.result && (
                    <em>
                      {[
                        vehicleVinLookup.result.vehicleType,
                        vehicleVinLookup.result.bodyClass,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </em>
                  )}
                </span>
              </div>
            )}

            {templateId === 'vehicle' && (
              <p className="vin-lookup-disclaimer">
                <ShieldCheck aria-hidden="true" />
                {t(
                  'NHTSA decoding helps identify manufacturer data. It does not prove ownership, title status, condition, or authenticity.',
                )}
              </p>
            )}

            <div className="two">
              <label>
                {t('Handoff')}
                <select
                  value={draft.deliveryMethod}
                  onChange={event =>
                    updateDraft({
                      deliveryMethod: event.target.value as DealDraft['deliveryMethod'],
                    })
                  }
                >
                  <option value="Meet in person">{t('Meet in person')}</option>
                  <option value="Ship to buyer">{t('Ship to buyer')}</option>
                </select>
              </label>
              <label>
                {t('Offer valid for')}
                <select
                  value={draft.expiresInDays || 7}
                  onChange={event => updateDraft({ expiresInDays: Number(event.target.value) })}
                >
                  <option value={1}>{t('1 day')}</option>
                  <option value={3}>{t('3 days')}</option>
                  <option value={7}>{t('7 days')}</option>
                  <option value={14}>{t('14 days')}</option>
                  <option value={30}>{t('30 days')}</option>
                </select>
              </label>
            </div>
            <div className="notice">
              <ShieldCheck aria-hidden="true" />
              <span>{t('The Deal Link is not public until you confirm.')}</span>
            </div>
          </form>
        </section>
      )}

      {!reviewingDraft && currentStep === 3 && (
        <form id="create-step-3" className="create-media-step" onSubmit={onReviewDraft}>
          <section className="media-picker">
            <label>
              {t('Item photos or video')}
              <input
                className="file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm"
                multiple
                onChange={addPhotos}
              />
              <small>
                {t('Choose photos together or add them one at a time')} · {photos.length}{' '}
                {t('of 6')} {t('selected')}
              </small>
            </label>
            <p className="media-privacy">
              <ShieldCheck aria-hidden="true" />
              {t('Photo privacy: location and camera metadata are removed before upload.')}
            </p>
            {photos.length > 0 && (
              <div className="photo-previews">
                {photos.map((file, index) => (
                  <div key={`${file.name}-${index}`}>
                    <FilePreview file={file} alt={`${t('Preview')} ${index + 1}`} />
                    <span>
                      {t(isVideoFile(file) ? 'Item video' : index === 0 ? 'Main photo' : 'Photo')}{' '}
                      {index > 0 && !isVideoFile(file) ? index + 1 : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <DealPhotoGuide
            template={selectedTemplate}
            count={photos.filter(file => !file.type.startsWith('video/')).length}
          />
          <p className="create-media-optional">
            <ImagePlus aria-hidden="true" />
            <span>
              <b>{t('Photos are recommended, not required')}</b>
              <small>{t('You can continue to review now and add more media before publishing.')}</small>
            </span>
          </p>
        </form>
      )}

      {reviewingDraft && reviewContent}

      {!reviewingDraft && (
        <div
          className={`create-action-dock ${errors.length ? 'has-errors' : ''}`}
          role="region"
          aria-label={t('Create deal action')}
        >
          <div>
            <small>{t(errors.length ? 'Needs attention' : createStepMeta[currentStep].eyebrow)}</small>
            <strong>
              {t(
                errors.length
                  ? errors.length === 1
                    ? '1 detail needs attention'
                    : `${errors.length} details need attention`
                  : createStepMeta[currentStep].dock,
              )}
            </strong>
            <span>
              {t(
                errors.length
                  ? 'Review the highlighted fields before continuing.'
                  : currentStep === 3
                    ? 'Photos are optional. Continue when the record looks clear.'
                    : 'Your progress stays here while you complete the next short step.',
              )}
            </span>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (errors.length) {
                document.getElementById('create-validation-summary')?.focus();
                return;
              }
              const form = document.getElementById(
                `create-step-${currentStep}`,
              ) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {t(errors.length ? 'Review details' : createStepMeta[currentStep].action)}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
