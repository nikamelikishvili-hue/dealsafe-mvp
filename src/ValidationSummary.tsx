import type { ReactNode } from 'react';
import { t } from './i18n';
import './validation-summary.css';

export type ValidationSummaryItem = {
  fieldId: string;
  message: string;
};

type ValidationSummaryProps = {
  id: string;
  title: string;
  errors: ValidationSummaryItem[];
  className?: string;
  eyebrow?: string;
  message?: string;
  headingLevel?: 2 | 3;
  icon?: ReactNode;
  onSelect?: (fieldId: string) => void;
};

export function ValidationSummary({
  id,
  title,
  errors,
  className = 'workflow-validation-summary',
  eyebrow,
  message,
  headingLevel = 3,
  icon,
  onSelect,
}: ValidationSummaryProps) {
  const titleId = `${id}-title`;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const selectError = (fieldId: string) => {
    if (onSelect) {
      onSelect(fieldId);
      return;
    }
    document.getElementById(fieldId)?.focus();
  };

  return (
    <section
      id={id}
      className={`validation-summary ${className}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      {icon ? (
        <span className="create-validation-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div>
        {eyebrow ? <p className="eyebrow">{t(eyebrow)}</p> : null}
        <Heading id={titleId}>{t(title)}</Heading>
        {message ? <p>{t(message)}</p> : null}
        <ul>
          {errors.map((error) => (
            <li key={error.fieldId}>
              <button type="button" onClick={() => selectError(error.fieldId)}>
                {t(error.message)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
