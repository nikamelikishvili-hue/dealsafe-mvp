import { CircleAlert } from 'lucide-react';
import { t } from './i18n';
import './field-error.css';

export function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <small id={id} className="field-error" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{t(children)}</span>
    </small>
  );
}
