import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BadgeCheck, LockKeyhole, Package, ShieldCheck } from 'lucide-react';
import { evidenceInputAccept } from '../supabase/functions/_shared/evidence-policy';
import type { Deal } from './domain';
import { EvidenceViewer } from './EvidenceViewer';
import { getAppLanguage, t } from './i18n';
import {
  listDealEvidence,
  uploadDealEvidence,
  type DealEvidence,
  type EvidenceType,
  type StoredSession,
} from './services/supabaseRest';

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

const buyerOptions: EvidenceType[] = [
  'buyer_unboxing_video',
  'buyer_received_photo',
  'buyer_damage_photo',
  'other',
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

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

  const load = async () => {
    const request = ++loadSequenceRef.current;
    try {
      const next = await listDealEvidence(session, deal.id);
      if (request === loadSequenceRef.current) setItems(next);
    } catch (error) {
      if (request === loadSequenceRef.current) setMessage(
        error instanceof Error ? error.message : 'Could not load evidence',
      );
    }
  };

  useEffect(() => {
    setEvidenceType(
      role === 'seller' ? 'seller_packing_video' : 'buyer_unboxing_video',
    );
    setFiles([]);
    setSelected(null);
    setMessage('');
    void load();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [deal.id, session.accessToken, role]);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      for (const file of files) {
        await uploadDealEvidence(
          session,
          deal.id,
          role,
          evidenceType,
          file,
        );
      }
      setFiles([]);
      await load();
      onChanged?.();
      setMessage(
        'Security scan passed. Evidence was saved privately to this deal record.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not upload evidence',
      );
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
    <section
      id="deal-evidence-vault"
      className="evidence-panel no-print"
    >
      <div className="evidence-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">{t('Evidence vault')}</p>
          <h2>
            {t(
              role === 'seller'
                ? 'Document the package before shipping'
                : 'Document the item when it arrives',
            )}
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
      <form className="evidence-form" onSubmit={upload} aria-busy={busy}>
        <label>
          {t('Evidence type')}
          <select
            value={evidenceType}
            onChange={event => {
              setEvidenceType(event.target.value as EvidenceType);
              setFiles([]);
            }}
          >
            {options.map(option => (
              <option key={option} value={option}>
                {t(evidenceLabels[option])}
              </option>
            ))}
          </select>
        </label>
        <label className="evidence-picker">
          {t('Choose photos or video')}
          <input
            type="file"
            accept={acceptedFiles}
            multiple
            onChange={event => {
              setFiles(Array.from(event.target.files || []));
              event.currentTarget.value = '';
            }}
          />
          <small>
            {files.length
              ? `${files.length} ${t(
                  files.length === 1 ? 'file selected' : 'files selected',
                )}`
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
        <button type="submit" className="primary" disabled={busy || !files.length}>
          {busy ? t('Scanning and saving…') : t('Scan and save evidence')}
        </button>
      </form>
      <p className="evidence-scan-note">
        <ShieldCheck size={15} aria-hidden="true" />
        {t(
          'Files enter an isolated quarantine and are available only after type, size, and malware checks pass.',
        )}
      </p>
      {message && (
        <div className="notice" role="status" aria-live="polite">
          {t(message)}
        </div>
      )}
      <div className="evidence-list">
        <div className="evidence-list-heading">
          <b>{t('Saved evidence')}</b>
          <span>
            {items.length} {t(items.length === 1 ? 'file' : 'files')} ·{' '}
            {t('Private to the deal participants')}
          </span>
        </div>
        {items.length ? (
          items.map(item => (
            <article key={item.id}>
              <BadgeCheck size={17} aria-hidden="true" />
              <div>
                <b>
                  {t(evidenceLabels[item.evidence_type] || 'Other evidence')}
                </b>
                <span>
                  {item.file_name || t('Uploaded file')} ·{' '}
                  {formatDateTime(item.created_at)}
                </span>
                <span>
                  {item.sha256
                    ? `SHA-256 ${item.sha256.slice(0, 12)}…`
                    : t('Fingerprint unavailable')}{' '}
                  ·{' '}
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
                <button
                  type="button"
                  className="secondary evidence-open"
                  onClick={() => setSelected(item)}
                >
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
        {t(
          'Evidence is append-only, access is logged, and each viewing link expires after 60 seconds.',
        )}
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
