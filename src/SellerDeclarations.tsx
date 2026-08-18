import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Clock3,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { Deal } from './domain';
import { getAppLanguage, t } from './i18n';
import {
  getPublicSellerDeclaration,
  type SellerDeclarationRecord,
} from './services/supabaseRest';

export interface SellerDeclarations {
  authority: boolean;
  lawful: boolean;
  disclosure: boolean;
}

export const emptySellerDeclarations: SellerDeclarations = {
  authority: false,
  lawful: false,
  disclosure: false,
};

const sellerDeclarationItems = [
  {
    key: 'authority' as const,
    label: 'I confirm I own this item or have authority to sell it.',
  },
  {
    key: 'lawful' as const,
    label:
      'I confirm this item is not stolen, counterfeit, or prohibited by law.',
  },
  {
    key: 'disclosure' as const,
    label:
      'I confirm the description includes all known defects and material facts.',
  },
];

const recordedDeclarationItems = [
  'Ownership or authority to sell declared',
  'Item declared not stolen, counterfeit, or prohibited',
  'Known defects and material facts declared',
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

export function SellerDeclarationChecklist({
  value,
  onChange,
  id,
}: {
  value: SellerDeclarations;
  onChange: (next: SellerDeclarations) => void;
  id?: string;
}) {
  return (
    <fieldset id={id} className="seller-declarations">
      <legend>
        <ShieldCheck aria-hidden="true" />
        {t('Seller declaration')}
      </legend>
      {sellerDeclarationItems.map(item => (
        <label key={item.key} className={value[item.key] ? 'checked' : ''}>
          <input
            type="checkbox"
            checked={value[item.key]}
            onChange={event =>
              onChange({ ...value, [item.key]: event.target.checked })
            }
          />
          <span>{t(item.label)}</span>
        </label>
      ))}
      <small>
        <LockKeyhole aria-hidden="true" />
        {t('These confirmations are recorded when the Deal Link is published.')}
      </small>
    </fieldset>
  );
}

export function PublicSellerDeclaration({ deal }: { deal: Deal }) {
  const [record, setRecord] = useState<SellerDeclarationRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setLoaded(false);
    setLoadError('');
    getPublicSellerDeclaration(deal.publicId)
      .then(value => {
        if (current) {
          setRecord(value);
          setLoaded(true);
          setLoadError('');
        }
      })
      .catch(() => {
        if (current) {
          setRecord(null);
          setLoaded(true);
          setLoadError('Seller declaration status is temporarily unavailable.');
        }
      });
    return () => {
      current = false;
    };
  }, [deal.publicId, loadVersion]);

  if (!loaded) return null;
  if (loadError) {
    return (
      <section className="seller-declaration-status missing no-print">
        <div className="notice" role="alert">
          <span>{t(loadError)}</span>
          <button
            type="button"
            className="secondary"
            onClick={() => setLoadVersion(version => version + 1)}
          >
            {t('Try again')}
          </button>
        </div>
      </section>
    );
  }
  if (!record) return null;

  if (!record.attested) {
    return (
      <section className="seller-declaration-status missing no-print">
        <div className="seller-declaration-heading">
          <ShieldAlert aria-hidden="true" />
          <div>
            <p className="eyebrow">{t('Seller declaration')}</p>
            <h2>{t('No recorded seller declaration')}</h2>
          </div>
        </div>
        <p className="seller-declaration-note">
          <Clock3 aria-hidden="true" />
          {t(
            'This Deal Link may have been published before seller declarations were required.',
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="seller-declaration-status no-print">
      <div className="seller-declaration-heading">
        <BadgeCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Recorded statement')}</p>
          <h2>{t('Seller declarations recorded')}</h2>
        </div>
      </div>
      <ul>
        {recordedDeclarationItems.map(item => (
          <li key={item}>
            <Check aria-hidden="true" />
            <span>{t(item)}</span>
          </li>
        ))}
      </ul>
      {record.attested_at && (
        <p className="seller-declaration-meta">
          {t('Recorded')} · {formatDateTime(record.attested_at)}
        </p>
      )}
      <p className="seller-declaration-note">
        <ShieldCheck aria-hidden="true" />
        {t(
          "This records the seller's statements. It does not verify ownership or authenticity.",
        )}
      </p>
    </section>
  );
}
