import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BadgeCheck, LockKeyhole, Package, ShieldCheck } from 'lucide-react';
import { evidenceInputAccept } from '../supabase/functions/_shared/evidence-policy';
import type { Deal } from './domain';
import { EvidenceViewer } from './EvidenceViewer';
import { FeedbackMessage } from './FeedbackMessage';
import { getAppLanguage, t } from './i18n';
import {
  listDealEvidence,
  uploadDealEvidence,
  type DealEvidence,
  type EvidenceType,
  type StoredSession,
} from './services/supabaseRest';
import { ValidationSummary, type ValidationSummaryItem } from './ValidationSummary';

export const evidenceLabels: Record<string, string> = {
  seller_packing_video: 'Packing video',
  seller_item_photo: 'Item condition photo',
  seller_serial_number: 'Serial / IMEI photo',
  seller_package_weight: 'Package weight photo',
  buyer_unboxing_video: 'Unboxing video',
  buyer_received_photo: 'Received item photo',
  buyer_damage_photo: 'Damage or missing-item photo',
  other: 'Other evidence',
};

const sellerOptions: EvidenceType[] = [
  'seller_packing_video',
  'seller_item_photo',
  'seller_serial_number',
  'seller_package_weight',
];

const buyerOptions: EvidenceType[] = ['buyer_unboxing_video', 'buyer_received_photo', 'buyer_damage_photo', 'other'];

const formatDateTime = (value: string) => new Date(value).toLocaleString(getAppLanguage());

export const evidenceUploadValidationErrors = (fileCount: number): ValidationSummaryItem[] =>
  fileCount > 0
    ? []
    : [
        {
          fieldId: 'evidence-files',
          message: 'Choose at least one photo or video.',
        },
      ];

export function DealEvidenceWorkspace({
  deal,
  session,
  onChanged,
}: {
  deal: Deal;
  session: StoredSession;
  onChanged?: () => void;
}) {
  const role = deal.viewerRole === 'buyer' ? 'buyer' : 'seller';
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(
    role === 'seller' ? 'seller_packing_video' : 'buyer_unboxing_video',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<DealEvidence[]>([]);
  const [selected, setSelected] = useState<DealEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const [message, setMessage] = useState('');
  const [messageFailed, setMessageFailed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationSummaryItem[]>([]);
  const validationSummaryId = 'evidence-validation-summary';

  const load = async () => {
    const request = ++loadSequenceRef.current;
    try {
      const next = await listDealEvidence(session, deal.id);
      if (request === loadSequenceRef.current) {
        setItems(next);
        setMessageFailed(false);
      }
    } catch (error) {
      if (request === loadSequenceRef.current) {
        setMessageFailed(true);
        setMessage(error instanceof Error ? error.message : 'Could not load evidence');
      }
    }
  };

  useEffect(() => {
    setEvidenceType(role === 'seller' ? 'seller_packing_video' : 'buyer_unboxing_video');
    setFiles([]);
    setSelected(null);
    setMessage('');
    setMessageFailed(false);
    setValidationErrors([]);
    void load();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [deal.id, session.accessToken, role]);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (busyRef.current) return;
    const nextValidationErrors = evidenceUploadValidationErrors(files.length);
    if (nextValidationErrors.length) {
      setValidationErrors(nextValidationErrors);
      setMessage('');
      setMessageFailed(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(validationSummaryId)?.focus();
        });
      });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    setMessageFailed(false);
    setValidationErrors([]);
    try {
      for (const file of files) {
        await uploadDealEvidence(session, deal.id, role, evidenceType, file);
      }
      setFiles([]);
      form.reset();
      await load();
      onChanged?.();
      setMessageFailed(false);
      setMessage('Security scan passed. Evidence was saved privately to this deal record.');
    } catch (error) {
      setMessageFailed(true);
      setMessage(error instanceof Error ? error.message : 'Could not upload evidence');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const verified = (id: string, checkedAt: string) => {
    setItems(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              integrity_status: 'verified',
              integrity_checked_at: checkedAt,
            }
          : item,
      ),
    );
  };

  const options = role === 'seller' ? sellerOptions : buyerOptions;
  const acceptedFiles = evidenceInputAccept(role, evidenceType);

  return (
    <section id="deal-evidence-vault" className="evidence-panel no-print" aria-labelledby="deal-evidence-title">
      <div className="evidence-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Evidence vault')}</p>
          <h2 id="deal-evidence-title">
            {t(role === 'seller' ? 'Document the package before shipping' : 'Document the item when it arrives')}
          </h2>
          <span>
            {t(
              role === 'seller'
                ? 'Record the item, serial number, and sealed package.'
                : 'Record the delivery, packaging, and unboxing before using the item.',
            )}
          </span>
        </div>
      </div>
      <form className="evidence-form" onSubmit={upload} aria-busy={busy} noValidate>
        {validationErrors.length > 0 && (
          <ValidationSummary
            id={validationSummaryId}
            className="workflow-validation-summary evidence-validation-summary"
            title="Check the evidence files"
            errors={validationErrors}
          />
        )}
        <label htmlFor="evidence-type">
          {t('Evidence type')}
          <select
            id="evidence-type"
            name="evidence-type"
            value={evidenceType}
            onChange={event => {
              setEvidenceType(event.target.value as EvidenceType);
              setFiles([]);
              setValidationErrors([]);
            }}
          >
            {options.map(option => (
              <option key={option} value={option}>
                {t(evidenceLabels[option])}
              </option>
            ))}
          </select>
        </label>
        <label className="evidence-picker" htmlFor="evidence-files">
          {t('Choose photos or video')}
          <input
            id="evidence-files"
            name="evidence-files"
            type="file"
            required
            accept={acceptedFiles}
            multiple
            aria-invalid={validationErrors.some(error => error.fieldId === 'evidence-files')}
            aria-describedby="evidence-files-help"
            onChange={event => {
              setFiles(Array.from(event.target.files || []));
              setValidationErrors([]);
            }}
          />
          <small id="evidence-files-help">
            {files.length
              ? `${files.length} ${t(files.length === 1 ? 'file selected' : 'files selected')}`
              : t('Photos up to 10 MB; videos up to 50 MB')}
          </small>
        </label>
        {files.length > 0 && (
          <div className="evidence-file-list">
            {files.map((file, index) => (
              <span key={`${file.name}-${index}`}>
                <Package size={15} aria-hidden="true" />
                {file.name}
                <small>{Math.ceil(file.size / 1024 / 1024)} MB</small>
              </span>
            ))}
          </div>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('Scanning and saving…') : t('Scan and save evidence')}
        </button>
      </form>
      <p className="evidence-scan-note">
        <ShieldCheck size={15} aria-hidden="true" />
        {t('Files enter an isolated quarantine and are available only after type, size, and malware checks pass.')}
      </p>
      {message && (
        <FeedbackMessage tone={messageFailed ? 'error' : 'success'} className="evidence-feedback">
          {t(message)}
        </FeedbackMessage>
      )}
      <div className="evidence-list">
        <div className="evidence-list-heading">
          <b>{t('Saved evidence')}</b>
          <span>
            {items.length} {t(items.length === 1 ? 'file' : 'files')} · {t('Private to the deal participants')}
          </span>
        </div>
        {items.length ? (
          items.map(item => (
            <article key={item.id}>
              <BadgeCheck size={17} aria-hidden="true" />
              <div>
                <b>{t(evidenceLabels[item.evidence_type] || 'Other evidence')}</b>
                <span>
                  {item.file_name || t('Uploaded file')} · {formatDateTime(item.created_at)}
                </span>
                <span>
                  {item.sha256 ? `SHA-256 ${item.sha256.slice(0, 12)}…` : t('Fingerprint unavailable')} ·{' '}
                  {t(
                    item.integrity_status === 'verified'
                      ? 'Integrity verified'
                      : item.integrity_status === 'unverified'
                        ? 'Integrity check required'
                        : 'File blocked',
                  )}
                </span>
              </div>
              <em
                className={
                  item.scan_status === 'clean' &&
                  item.integrity_status !== 'missing' &&
                  item.integrity_status !== 'mismatch' &&
                  item.integrity_status !== 'invalid'
                    ? 'is-clean'
                    : 'needs-review'
                }
              >
                {t(
                  item.scan_status !== 'clean'
                    ? 'Security review required'
                    : item.integrity_status === 'verified'
                      ? 'Verified'
                      : 'Recheck on open',
                )}
              </em>
              {item.scan_status === 'clean' && (
                <button type="button" className="secondary evidence-open" onClick={() => setSelected(item)}>
                  {t('Verify and open')}
                </button>
              )}
            </article>
          ))
        ) : (
          <p>{t('No evidence uploaded yet.')}</p>
        )}
      </div>
      <p className="evidence-note">
        <LockKeyhole size={15} aria-hidden="true" />
        {t('Evidence is append-only, access is logged, and each viewing link expires after 60 seconds.')}
      </p>
      {selected && (
        <EvidenceViewer
          item={selected}
          label={evidenceLabels[selected.evidence_type] || 'Other evidence'}
          session={session}
          onClose={() => setSelected(null)}
          onVerified={checkedAt => verified(selected.id, checkedAt)}
        />
      )}
    </section>
  );
}
