import { Inbox, LoaderCircle, RotateCcw } from 'lucide-react';
import { t } from './i18n';
import './async-state-panel.css';

type AsyncStatePanelProps = {
  state: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function AsyncStatePanel({
  state,
  title,
  message,
  actionLabel = 'Try again',
  onAction,
}: AsyncStatePanelProps) {
  const urgent = state === 'error';
  const Icon = state === 'loading' ? LoaderCircle : state === 'error' ? RotateCcw : Inbox;

  return (
    <div
      className={`async-state-panel ${state}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-busy={state === 'loading' || undefined}
    >
      <Icon className={state === 'loading' ? 'is-spinning' : undefined} aria-hidden="true" />
      <div>
        <strong>{t(title)}</strong>
        {message && <p>{t(message)}</p>}
      </div>
      {state === 'error' && onAction && (
        <button type="button" className="secondary" onClick={onAction}>
          {t(actionLabel)}
        </button>
      )}
    </div>
  );
}
