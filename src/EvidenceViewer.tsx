import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileCheck2, ShieldCheck, X } from 'lucide-react';
import { copyTextToClipboard } from './clipboard';
import { t } from './i18n';
import {
  loadDealEvidenceViewer,
  type DealEvidence,
  type DealEvidenceViewer as LoadedEvidenceViewer,
  type StoredSession,
} from './services/supabaseRest';

type EvidenceViewerProps = {
  item: DealEvidence;
  label: string;
  session: StoredSession;
  onClose: () => void;
  onVerified?: (checkedAt: string) => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function EvidenceViewer({
  item,
  label,
  session,
  onClose,
  onVerified,
}: EvidenceViewerProps) {
  const [viewer, setViewer] = useState<LoadedEvidenceViewer | null>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const copyResetTimer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const onVerifiedRef = useRef(onVerified);
  onCloseRef.current = onClose;
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    let current = true;
    let objectUrl = '';
    setViewer(null);
    setMessage('');
    setCopied(false);
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) {
        event.preventDefault();
        closeButton.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keydown);

    void loadDealEvidenceViewer(session, item.id)
      .then((loaded) => {
        objectUrl = loaded.objectUrl;
        if (!current) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setViewer(loaded);
        onVerifiedRef.current?.(loaded.integrityCheckedAt);
      })
      .catch((error) => {
        if (current) {
          setMessage(error instanceof Error
            ? error.message
            : 'The verified evidence file could not be loaded.');
        }
      });

    return () => {
      current = false;
      window.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      previousFocus?.focus();
    };
  }, [item.id, session.accessToken]);

  const copyHash = async () => {
    if (!viewer) return;
    try {
      await copyTextToClipboard(viewer.sha256);
      setCopied(true);
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => {
        setCopied(false);
        copyResetTimer.current = null;
      }, 1800);
    } catch {
      setMessage('The SHA-256 fingerprint could not be copied.');
    }
  };

  return (
    <div
      className="evidence-viewer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="evidence-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-viewer-title"
        aria-describedby="evidence-viewer-description"
      >
        <header className="evidence-viewer-header">
          <div>
            <p className="eyebrow">{t('Verified evidence')}</p>
            <h2 id="evidence-viewer-title">{t(label)}</h2>
            <p id="evidence-viewer-description">
              {t('The private file was rechecked before this viewer opened.')}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="evidence-viewer-close"
            onClick={onClose}
            aria-label={t('Close evidence viewer')}
          >
            <X size={22} />
          </button>
        </header>

        {message ? (
          <div className="evidence-viewer-error" role="alert">
            <ShieldCheck size={24} />
            <div>
              <b>{t('File blocked')}</b>
              <span>{t(message)}</span>
            </div>
          </div>
        ) : !viewer ? (
          <div className="evidence-viewer-loading" role="status" aria-live="polite">
            <FileCheck2 size={28} />
            <div>
              <b>{t('Rechecking file integrity…')}</b>
              <span>{t('Comparing the file bytes, type, size, and SHA-256 fingerprint.')}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="evidence-viewer-media">
              {viewer.mimeType === 'image/webp' ? (
                <img
                  src={viewer.objectUrl}
                  alt={item.file_name || t(label)}
                  draggable={false}
                />
              ) : (
                <video
                  src={viewer.objectUrl}
                  controls
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  controlsList="nodownload noremoteplayback"
                  aria-label={item.file_name || t(label)}
                />
              )}
            </div>

            <div className="evidence-viewer-status" role="status">
              <span><Check size={16} />{t('Malware scan passed')}</span>
              <span><Check size={16} />{t('Integrity verified now')}</span>
              <span><Check size={16} />{t('Private access logged')}</span>
            </div>

            <dl className="evidence-viewer-facts">
              <div>
                <dt>{t('File')}</dt>
                <dd>{viewer.fileName}</dd>
              </div>
              <div>
                <dt>{t('Size and type')}</dt>
                <dd>{formatBytes(viewer.fileSizeBytes)} · {viewer.mimeType}</dd>
              </div>
              <div>
                <dt>{t('Security scan')}</dt>
                <dd>{formatTimestamp(viewer.scannedAt)}</dd>
              </div>
              <div>
                <dt>{t('Integrity check')}</dt>
                <dd>{formatTimestamp(viewer.integrityCheckedAt)}</dd>
              </div>
            </dl>

            <div className="evidence-viewer-hash">
              <div>
                <span>{t('SHA-256 fingerprint')}</span>
                <code>{viewer.sha256}</code>
              </div>
              <button type="button" className="secondary" onClick={() => void copyHash()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {t(copied ? 'Copied' : 'Copy')}
              </button>
            </div>

            <footer className="evidence-viewer-footer">
              <p>
                <ShieldCheck size={16} />
                {t('This viewer uses a local safe-media copy. The signed source link expires after 60 seconds.')}
              </p>
              <a
                className="secondary"
                href={viewer.objectUrl}
                download={viewer.fileName}
              >
                <Download size={16} />
                {t('Download verified file')}
              </a>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
