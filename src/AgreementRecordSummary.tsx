import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Clock3,
  Copy,
  Eye,
  FileDown,
  FileSignature,
  Fingerprint,
  LockKeyhole,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { formatMoney } from './currency';
import { copyTextToClipboard } from './clipboard';
import type { Deal } from './domain';
import { getAppLanguage, t } from './i18n';
import { DEMO_DEAL_PUBLIC_ID } from './services/demoRepository';
import {
  getPublicAgreementDocument,
  getPublicAgreementHistory,
  isSupabaseConfigured,
  type AgreementDocumentSnapshot,
  type AgreementHistoryVersion,
} from './services/supabaseRest';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

export function useStoredAgreementDocument(deal: Deal) {
  const [record, setRecord] = useState<AgreementDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setRecord(null);
    if (deal.publicId === DEMO_DEAL_PUBLIC_ID) {
      setLoading(false);
      return;
    }
    getPublicAgreementDocument(deal.publicId, deal.agreementVersion)
      .then(value => {
        if (current) setRecord(value);
      })
      .catch(cause => {
        if (current) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'The stored agreement document is unavailable',
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [deal.publicId, deal.agreementVersion]);

  return { record, loading, error };
}

export function AgreementExport({ deal }: { deal: Deal }) {
  const [message, setMessage] = useState('');
  const [messageFailed, setMessageFailed] = useState(false);
  const { record, loading, error } = useStoredAgreementDocument(deal);
  const url = `${location.origin}/?deal=${deal.publicId}`;

  const share = async () => {
    setMessage('');
    setMessageFailed(false);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Dealivra agreement: ${deal.title}`,
          text: `Review Dealivra agreement ${deal.publicId}`,
          url,
        });
        setMessage('Agreement shared.');
      } else {
        await copyTextToClipboard(url);
        setMessage('Deal Link copied.');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setMessage('Could not share this link.');
        setMessageFailed(true);
      }
    }
  };

  const preview = () => {
    setMessage('');
    setMessageFailed(false);
    const popup = window.open(
      `${url}&document=1`,
      '_blank',
    );
    if (!popup) {
      setMessage('Allow pop-ups to preview the agreement document.');
      setMessageFailed(true);
    } else {
      popup.opener = null;
    }
  };

  return (
    <section className="agreement-export no-print">
      <div className="agreement-export-icon">
        <FileSignature aria-hidden="true" />
      </div>
      <div className="agreement-export-copy">
        <p className="eyebrow">{t('Agreement document')}</p>
        <h2>{t('Professional agreement copy')}</h2>
        <p>
          {t(
            'A clean, dated PDF with the parties, item terms, agreement version, and verification code.',
          )}
        </p>
        <div className="agreement-export-meta">
          <span>
            <b>{t('Deal ID')}</b>
            {deal.publicId}
          </span>
          <span>
            <b>{t('Version')}</b>
            {deal.agreementVersion}
          </span>
          <span>
            <b>{t('Stored record')}</b>
            {record
              ? `${record.content_hash.slice(0, 12).toUpperCase()}…`
              : loading
                ? t('Checking…')
                : t('Unavailable')}
          </span>
        </div>
      </div>
      <div className="agreement-export-actions">
        <button
          type="button"
          className="primary"
          disabled={!record}
          onClick={() => window.print()}
        >
          <FileDown size={17} aria-hidden="true" />
          {t('Download agreement PDF')}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!record}
          onClick={preview}
        >
          <Eye size={17} aria-hidden="true" />
          {t('Preview document')}
        </button>
        <button type="button" className="secondary" onClick={share}>
          <Share2 size={17} aria-hidden="true" />
          {t('Share Deal Link')}
        </button>
      </div>
      {(message || error) && (
        <div
          className={`notice ${error || messageFailed ? 'agreement-record-error' : ''}`}
          role={error || messageFailed ? 'alert' : 'status'}
          aria-live={error || messageFailed ? 'assertive' : 'polite'}
        >
          {t(message || error)}
        </div>
      )}
    </section>
  );
}

export function AgreementFingerprint({ deal }: { deal: Deal }) {
  const [fingerprint, setFingerprint] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    let current = true;
    setFingerprint('');
    setLoadError('');
    if (deal.publicId === DEMO_DEAL_PUBLIC_ID) {
      setFingerprint('—');
      return;
    }
    getPublicAgreementDocument(deal.publicId, deal.agreementVersion)
      .then(record => {
        if (current) {
          setFingerprint(record.content_hash.toUpperCase());
          setLoadError('');
        }
      })
      .catch(() => {
        if (current) {
          setFingerprint('—');
          setLoadError('Agreement fingerprint is temporarily unavailable.');
        }
      });
    return () => {
      current = false;
    };
  }, [deal.publicId, deal.agreementVersion, loadVersion]);

  const copy = async () => {
    if (!fingerprint || fingerprint === '—') return;
    try {
      await copyTextToClipboard(fingerprint);
      setCopyError('');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError('Fingerprint could not be copied. Select it and copy it manually.');
    }
  };

  return (
    <section className="agreement-fingerprint">
      <div className="fingerprint-heading">
        <Fingerprint aria-hidden="true" />
        <div>
          <p className="eyebrow">SERVER-RECORDED SHA-256</p>
          <h2>{t('Agreement fingerprint')}</h2>
          <span>
            {t('Version')} {deal.agreementVersion}
          </span>
        </div>
      </div>
      <code>{fingerprint || 'Checking stored record…'}</code>
      {loadError && (
        <div className="notice agreement-record-error" role="alert">
          <span>{t(loadError)}</span>
          <button
            type="button"
            className="secondary no-print"
            onClick={() => setLoadVersion(version => version + 1)}
          >
            {t('Try again')}
          </button>
        </div>
      )}
      <div className="fingerprint-footer">
        <p>
          <ShieldCheck aria-hidden="true" />
          {t(
            'This code is generated from the immutable stored agreement version shown in the PDF. It is not a qualified electronic signature.',
          )}
        </p>
        <button
          type="button"
          className="secondary no-print"
          onClick={copy}
          disabled={!fingerprint || fingerprint === '—'}
        >
          <Copy size={16} aria-hidden="true" />
          {t(copied ? 'Fingerprint copied.' : 'Copy fingerprint')}
        </button>
      </div>
      {copyError && <div className="notice" role="alert">{t(copyError)}</div>}
    </section>
  );
}

export function AgreementHistory({ deal }: { deal: Deal }) {
  const [versions, setVersions] = useState<AgreementHistoryVersion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setLoaded(false);
    setLoadError('');
    if (deal.publicId === DEMO_DEAL_PUBLIC_ID) {
      setVersions([]);
      setLoaded(true);
      return;
    }
    getPublicAgreementHistory(deal.publicId)
      .then(items => {
        if (current) {
          setVersions(items);
          setLoaded(true);
          setLoadError('');
        }
      })
      .catch(() => {
        if (current) {
          setVersions([]);
          setLoaded(true);
          setLoadError('Agreement history is temporarily unavailable.');
        }
      });
    return () => {
      current = false;
    };
  }, [deal.publicId, deal.agreementVersion, loadVersion]);

  if (!isSupabaseConfigured || !loaded) return null;
  if (loadError) {
    return (
      <section className="agreement-history">
        <div className="notice agreement-record-error" role="alert">
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
  if (!versions.length) return null;

  const acceptanceLabel = (count: number) =>
    count >= 2
      ? 'Accepted by both parties'
      : count === 1
        ? 'Accepted by one party'
        : 'No recorded acceptance';

  return (
    <section className="agreement-history">
      <div className="agreement-history-heading">
        <FileSignature aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Published versions')}</p>
          <h2>{t('Agreement history')}</h2>
          <span>{t('Privacy-safe record of published agreement changes.')}</span>
        </div>
      </div>
      <div className="agreement-history-list">
        {versions.map(item => {
          const accepted = Number(item.acceptance_count) || 0;
          return (
            <details key={item.version} open={item.is_current}>
              <summary>
                <span className="agreement-history-version">
                  <strong>
                    {t('Version')} {item.version}
                  </strong>
                  {item.is_current && <em>{t('Current version')}</em>}
                </span>
                <time>{formatDateTime(item.created_at)}</time>
              </summary>
              <div className="agreement-history-body">
                <div className="agreement-history-facts">
                  <div>
                    <span>{t('Price')}</span>
                    <b>
                      {formatMoney(
                        Number(item.price_cents),
                        item.currency,
                        getAppLanguage(),
                      )}
                    </b>
                  </div>
                  <div>
                    <span>{t('Condition')}</span>
                    <b>{t(item.condition)}</b>
                  </div>
                  <div>
                    <span>{t('Handoff')}</span>
                    <b>{t(item.delivery_method)}</b>
                  </div>
                </div>
                <p
                  className={`agreement-history-acceptance ${
                    accepted ? '' : 'pending'
                  }`}
                >
                  {accepted ? (
                    <BadgeCheck size={18} aria-hidden="true" />
                  ) : (
                    <Clock3 size={18} aria-hidden="true" />
                  )}{' '}
                  {t(acceptanceLabel(accepted))}
                </p>
                <span className="eyebrow">{t('Agreement code')}</span>
                <code className="agreement-history-code">
                  {item.content_hash.toUpperCase()}
                </code>
              </div>
            </details>
          );
        })}
      </div>
      <p className="agreement-history-note">
        <LockKeyhole size={16} aria-hidden="true" />
        {t('This history does not reveal names, contact details, or signatures.')}
      </p>
    </section>
  );
}
