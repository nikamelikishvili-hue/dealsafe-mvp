import { useRef, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Clock3,
  Fingerprint,
  LockKeyhole,
  ShieldAlert,
  X,
} from 'lucide-react';
import { FieldError } from './FieldError';
import { getAppLanguage, t } from './i18n';
import { dealPath } from './navigation';
import {
  verifyAgreementRecord,
  type AgreementVerificationResult,
} from './services/supabaseRest';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

function AgreementVerifier() {
  const [dealId, setDealId] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AgreementVerificationResult | false | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const dealIdRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const cleanId = dealId.replace(/^deal\s+/i, '').trim();
  const cleanCode = code.replace(/\s/g, '').trim();
  const validationVisible = message === 'Review the highlighted fields.';
  const dealIdInvalid = validationVisible && cleanId.length < 4;
  const codeInvalid =
    validationVisible && !/^[a-f0-9]{64}$/i.test(cleanCode);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (checkingRef.current) return;
    setMessage('');
    setResult(null);
    if (cleanId.length < 4 || !/^[a-f0-9]{64}$/i.test(cleanCode)) {
      setMessage('Review the highlighted fields.');
      window.requestAnimationFrame(() => {
        if (cleanId.length < 4) dealIdRef.current?.focus();
        else codeRef.current?.focus();
      });
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      const match = await verifyAgreementRecord(cleanId, cleanCode);
      setResult(match || false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Agreement verification is unavailable',
      );
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  return (
    <section className="agreement-verifier">
      <div className="agreement-verifier-copy">
        <Fingerprint aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Independent check')}</p>
          <h2>{t('Check agreement code')}</h2>
          <p>{t('Compare a saved Dealivra agreement without signing in.')}</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate aria-busy={checking}>
        <label>
          {t('Deal ID')}
          <input
            ref={dealIdRef}
            required
            minLength={4}
            maxLength={30}
            autoCapitalize="characters"
            spellCheck={false}
            value={dealId}
            onChange={event => {
              setDealId(event.target.value.toUpperCase());
              if (validationVisible) setMessage('');
            }}
            placeholder="1089BDF0"
            aria-invalid={dealIdInvalid}
            aria-describedby={dealIdInvalid ? 'deal-id-error' : undefined}
          />
          {dealIdInvalid && (
            <FieldError id="deal-id-error">
              {t('Enter at least 4 characters from the Deal ID.')}
            </FieldError>
          )}
        </label>
        <label>
          {t('Agreement code')}
          <input
            ref={codeRef}
            className="agreement-verifier-code"
            required
            minLength={64}
            maxLength={80}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={event => {
              setCode(event.target.value);
              if (validationVisible) setMessage('');
            }}
            placeholder="SHA-256"
            aria-invalid={codeInvalid}
            aria-describedby={codeInvalid ? 'agreement-code-error' : undefined}
          />
          {codeInvalid && (
            <FieldError id="agreement-code-error">
              {t('Enter the full 64-character SHA-256 code.')}
            </FieldError>
          )}
        </label>
        <button type="submit" className="primary" disabled={checking}>
          {t(checking ? 'Checking…' : 'Check code')}
        </button>
        {result && (
          <div
            className={`agreement-verifier-result ${
              result.is_current ? 'success' : 'warning'
            }`}
            role="status"
            aria-live="polite"
          >
            {result.is_current ? (
              <BadgeCheck aria-hidden="true" />
            ) : (
              <Clock3 aria-hidden="true" />
            )}
            <div>
              <b>
                {t(
                  result.is_current
                    ? 'Match confirmed'
                    : 'Matches a previous version',
                )}
              </b>
              <span>
                {t('Version')} {result.version} ·{' '}
                {formatDateTime(result.created_at)}
              </span>
              <a href={dealPath(result.public_id)}>
                {t('Open Deal Link')} →
              </a>
            </div>
          </div>
        )}
        {result === false && (
          <div className="agreement-verifier-result error" role="alert">
            <X aria-hidden="true" />
            <div>
              <b>{t('No match found')}</b>
            </div>
          </div>
        )}
        {message && (
          <div className="agreement-verifier-result error" role="alert">
            <ShieldAlert aria-hidden="true" />
            <div>
              <b>{t(message)}</b>
            </div>
          </div>
        )}
        <small className="agreement-verifier-note">
          <LockKeyhole size={15} aria-hidden="true" />
          {t(
            'A match confirms only the stored agreement record, not the item or payment.',
          )}
        </small>
      </form>
    </section>
  );
}

export function AgreementVerificationPage({ onBack }: { onBack: () => void }) {
  return (
    <section className="agreement-verifier-page">
      <button type="button" className="back" onClick={onBack}>
        ← {t('Back to home')}
      </button>
      <p className="eyebrow">{t('Agreement verification')}</p>
      <h1>{t('Verify an agreement')}</h1>
      <p className="lede small">
        {t('Use the Deal ID and SHA-256 agreement code saved with the record.')}
      </p>
      <AgreementVerifier />
    </section>
  );
}
