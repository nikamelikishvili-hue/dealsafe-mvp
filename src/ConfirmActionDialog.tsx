import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import './confirm-action-dialog.css';

type ConfirmActionOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function useConfirmAction(): {
  confirmAction: (options: ConfirmActionOptions) => Promise<boolean>;
  confirmDialog: ReactNode;
} {
  const [pending, setPending] = useState<ConfirmActionOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const answer = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const confirmAction = useCallback(
    (options: ConfirmActionOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setPending(options);
      }),
    [],
  );

  useEffect(() => {
    if (!pending) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previousFocusRef.current?.focus();
    };
  }, [pending]);

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      answer(false);
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    if (!focusable.length) return;
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

  return {
    confirmAction,
    confirmDialog: pending ? (
      <div
        className="confirm-action-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) answer(false);
        }}
      >
        <div
          ref={dialogRef}
          className={`confirm-action-dialog ${pending.tone === 'danger' ? 'danger' : ''}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onKeyDown={onKeyDown}
        >
          <div className="confirm-action-icon" aria-hidden="true">
            {pending.tone === 'danger' ? <AlertTriangle /> : <ShieldCheck />}
          </div>
          <button
            type="button"
            className="confirm-action-close"
            aria-label="Close confirmation"
            onClick={() => answer(false)}
          >
            <X size={19} aria-hidden="true" />
          </button>
          <div className="confirm-action-copy">
            <h2 id={titleId}>{pending.title}</h2>
            <p id={descriptionId}>{pending.description}</p>
          </div>
          <div className="confirm-action-buttons">
            <button
              ref={cancelRef}
              type="button"
              className="secondary"
              onClick={() => answer(false)}
            >
              {pending.cancelLabel || 'Go back'}
            </button>
            <button
              type="button"
              className={pending.tone === 'danger' ? 'danger-action' : 'primary'}
              onClick={() => answer(true)}
            >
              {pending.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    ) : null,
  };
}
