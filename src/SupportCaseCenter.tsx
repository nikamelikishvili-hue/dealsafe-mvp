import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Clock3,
  Headphones,
  LockKeyhole,
  MessageSquareText,
  Plus,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { getAppLanguage, t } from './i18n';
import {
  createSupportCase,
  getMySupportCases,
  getSupportCase,
  replySupportCase,
  type StoredSession,
  type SupportCaseCategory,
  type SupportCaseDetail,
  type SupportCaseSummary,
} from './services/supabaseRest';

const categoryOptions: Array<{
  value: SupportCaseCategory;
  label: string;
}> = [
  { value: 'account_access', label: 'Account access' },
  { value: 'deal_help', label: 'Deal help' },
  { value: 'payment_question', label: 'Payment question' },
  { value: 'delivery_issue', label: 'Delivery issue' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'technical_issue', label: 'Technical issue' },
  { value: 'other', label: 'Other' },
];

const statusLabels: Record<SupportCaseSummary['status'], string> = {
  open: 'Open',
  waiting_customer: 'Waiting for you',
  waiting_support: 'Waiting for support',
  resolved: 'Resolved',
  closed: 'Closed',
};

const categoryLabel = (category: SupportCaseCategory) =>
  categoryOptions.find(option => option.value === category)?.label ?? 'Other';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function SupportCaseCenter({ session }: { session: StoredSession }) {
  const [cases, setCases] = useState<SupportCaseSummary[]>([]);
  const [selected, setSelected] = useState<SupportCaseDetail | null>(null);
  const [selectedReference, setSelectedReference] = useState('');
  const [creating, setCreating] = useState(false);
  const [category, setCategory] =
    useState<SupportCaseCategory>('deal_help');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestRef = useRef(0);
  const lifecycleRef = useRef(0);

  const loadCases = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setFeedback('');
    try {
      const next = await getMySupportCases(session);
      if (request !== requestRef.current) return;
      setCases(next);
    } catch (error) {
      if (request !== requestRef.current) return;
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Could not load your support cases.',
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const lifecycle = ++lifecycleRef.current;
    void loadCases();
    return () => {
      requestRef.current += 1;
      if (lifecycle === lifecycleRef.current) lifecycleRef.current += 1;
    };
  }, [loadCases]);

  const openCase = async (publicReference: string) => {
    const request = ++requestRef.current;
    setSelectedReference(publicReference);
    setSelected(null);
    setFeedback('');
    setLoading(true);
    try {
      const detail = await getSupportCase(session, publicReference);
      if (request !== requestRef.current) return;
      if (!detail) {
        setFeedback('This support case is unavailable.');
        setSelectedReference('');
        return;
      }
      setSelected(detail);
    } catch (error) {
      if (request !== requestRef.current) return;
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Could not load this support case.',
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };

  const submitCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    const lifecycle = lifecycleRef.current;
    setSaving(true);
    setFeedback('');
    try {
      const reference = await createSupportCase(session, {
        category,
        subject,
        message,
      });
      if (lifecycle !== lifecycleRef.current) return;
      setCategory('deal_help');
      setSubject('');
      setMessage('');
      setCreating(false);
      const next = await getMySupportCases(session);
      if (lifecycle !== lifecycleRef.current) return;
      setCases(next);
      await openCase(reference);
    } catch (error) {
      if (lifecycle !== lifecycleRef.current) return;
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Could not open a support case.',
      );
    } finally {
      savingRef.current = false;
      if (lifecycle === lifecycleRef.current) setSaving(false);
    }
  };

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || savingRef.current) return;
    savingRef.current = true;
    const lifecycle = lifecycleRef.current;
    setSaving(true);
    setFeedback('');
    try {
      await replySupportCase(session, selected.public_reference, reply);
      if (lifecycle !== lifecycleRef.current) return;
      setReply('');
      const detail = await getSupportCase(
        session,
        selected.public_reference,
      );
      if (lifecycle !== lifecycleRef.current) return;
      setSelected(detail);
      const next = await getMySupportCases(session);
      if (lifecycle !== lifecycleRef.current) return;
      setCases(next);
    } catch (error) {
      if (lifecycle !== lifecycleRef.current) return;
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Could not send your support reply.',
      );
    } finally {
      savingRef.current = false;
      if (lifecycle === lifecycleRef.current) setSaving(false);
    }
  };

  const closeDetail = () => {
    requestRef.current += 1;
    setSelected(null);
    setSelectedReference('');
    setReply('');
    setFeedback('');
    setLoading(false);
  };

  const activeCase =
    selected && !['resolved', 'closed'].includes(selected.status);

  return (
    <section className="support-case-center no-print" aria-labelledby="support-title">
      <div className="support-case-heading">
        <div className="support-case-icon" aria-hidden="true">
          <Headphones />
        </div>
        <div>
          <p className="eyebrow">{t('Private support')}</p>
          <h2 id="support-title">{t('Support center')}</h2>
          <p>
            {t(
              'Open a private case, keep every reply together, and follow its status.',
            )}
          </p>
        </div>
        {!creating && !selectedReference ? (
          <button
            className="primary"
            type="button"
            onClick={() => {
              setCreating(true);
              setFeedback('');
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {t('New support case')}
          </button>
        ) : null}
      </div>

      <div className="support-privacy-note">
        <LockKeyhole size={17} aria-hidden="true" />
        <span>
          {t(
            'Never include passwords, authenticator codes, full card numbers, or government identity numbers.',
          )}
        </span>
      </div>

      {feedback ? (
        <div className="notice" role="alert">
          {t(feedback)}
        </div>
      ) : null}

      {creating ? (
        <form className="support-case-form" onSubmit={submitCase}>
          <div className="support-form-title">
            <div>
              <p className="eyebrow">{t('New case')}</p>
              <h3>{t('How can we help?')}</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={t('Close')}
              disabled={saving}
              onClick={() => setCreating(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="support-form-grid">
            <label>
              {t('Category')}
              <select
                value={category}
                onChange={event =>
                  setCategory(event.target.value as SupportCaseCategory)}
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Subject')}
              <input
                required
                minLength={5}
                maxLength={120}
                value={subject}
                onChange={event => setSubject(event.target.value)}
                placeholder={t('Briefly describe what you need')}
              />
            </label>
          </div>
          <label>
            {t('Message')}
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder={t(
                'Describe the issue, what you already tried, and the outcome you need.',
              )}
            />
            <small>{message.trim().length}/2000</small>
          </label>
          {category === 'safety_concern' ? (
            <div className="support-priority-note">
              <ShieldAlert aria-hidden="true" />
              <span>
                {t(
                  'Safety concerns receive the shortest response target. Do not use support chat for an immediate emergency.',
                )}
              </span>
            </div>
          ) : null}
          <div className="support-form-actions">
            <button
              className="secondary"
              type="button"
              disabled={saving}
              onClick={() => setCreating(false)}
            >
              {t('Cancel')}
            </button>
            <button
              className="primary"
              type="submit"
              aria-busy={saving}
              disabled={saving}
            >
              {t(saving ? 'Opening…' : 'Open case')}
            </button>
          </div>
        </form>
      ) : selectedReference ? (
        <div className="support-case-detail">
          <div className="support-detail-bar">
            <button
              className="secondary"
              type="button"
              onClick={closeDetail}
            >
              {t('Back to cases')}
            </button>
            <span>{selectedReference}</span>
            <button
              className="icon-button"
              type="button"
              aria-label={t('Close')}
              onClick={closeDetail}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          {loading || !selected ? (
            <div className="support-loading" role="status">
              {t('Loading support case…')}
            </div>
          ) : (
            <>
              <div className="support-detail-summary">
                <div>
                  <span className={`support-priority ${selected.priority}`}>
                    {t(selected.priority)}
                  </span>
                  <span>{t(categoryLabel(selected.category))}</span>
                  <span>{t(statusLabels[selected.status])}</span>
                </div>
                <h3>{selected.subject}</h3>
                <p>
                  <Clock3 size={16} aria-hidden="true" />
                  {t('Response target')}: {' '}
                  {formatDateTime(selected.first_response_due_at)}
                </p>
              </div>
              <div
                className="support-message-list"
                aria-live="polite"
                aria-label={t('Support conversation')}
              >
                {selected.messages.map(caseMessage => (
                  <article
                    key={caseMessage.id}
                    className={caseMessage.is_mine ? 'mine' : 'support'}
                  >
                    <small>
                      {t(
                        caseMessage.is_mine
                          ? 'You'
                          : 'Dealivra support',
                      )}
                    </small>
                    <p>{caseMessage.body}</p>
                    <time>{formatDateTime(caseMessage.created_at)}</time>
                  </article>
                ))}
              </div>
              {activeCase ? (
                <form className="support-reply-form" onSubmit={submitReply}>
                  <label>
                    {t('Reply')}
                    <textarea
                      required
                      minLength={10}
                      maxLength={2000}
                      value={reply}
                      onChange={event => setReply(event.target.value)}
                      placeholder={t('Add information to this case')}
                    />
                  </label>
                  <button
                    className="primary"
                    type="submit"
                    aria-busy={saving}
                    disabled={saving}
                  >
                    <Send size={17} aria-hidden="true" />
                    {t(saving ? 'Sending…' : 'Send reply')}
                  </button>
                </form>
              ) : (
                <div className="support-case-finished" role="status">
                  {t(
                    'This case is finished. Open a new case if you need different help.',
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="support-case-list">
          {loading ? (
            <div className="support-loading" role="status">
              {t('Loading support cases…')}
            </div>
          ) : cases.length ? (
            cases.map(supportCase => (
              <button
                key={supportCase.public_reference}
                type="button"
                onClick={() => void openCase(supportCase.public_reference)}
              >
                <MessageSquareText aria-hidden="true" />
                <span>
                  <b>{supportCase.subject}</b>
                  <small>
                    {supportCase.public_reference} ·{' '}
                    {t(categoryLabel(supportCase.category))}
                  </small>
                </span>
                <span
                  className={`support-status ${supportCase.status}`}
                >
                  {t(statusLabels[supportCase.status])}
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))
          ) : (
            <div className="support-empty">
              <MessageSquareText aria-hidden="true" />
              <div>
                <b>{t('No support cases')}</b>
                <span>
                  {t(
                    'When you need help, open a private case and track every reply here.',
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
