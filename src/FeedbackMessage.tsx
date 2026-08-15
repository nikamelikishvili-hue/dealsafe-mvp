import { AlertCircle, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import './feedback-message.css';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';
type FeedbackMessageProps = { children: ReactNode; tone?: FeedbackTone; className?: string };

const toneIcon = { info: Info, success: CheckCircle2, warning: CircleAlert, error: AlertCircle } as const;

export function FeedbackMessage({ children, tone = 'info', className = '' }: FeedbackMessageProps) {
  const Icon = toneIcon[tone];
  const urgent = tone === 'error';
  return (
    <div
      className={['feedback-message', tone, className].filter(Boolean).join(' ')}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
