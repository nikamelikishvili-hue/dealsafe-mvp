import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Check,
  Flag,
  LockKeyhole,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { useConfirmAction } from './ConfirmActionDialog';
import type { Deal } from './domain';
import { getAppLanguage, t } from './i18n';
import {
  cancelDeal,
  getDealMessages,
  getProtectedPaymentStatus,
  openDealDispute,
  reportPublicDeal,
  sendDealMessage,
  submitRating,
  type DealMessage,
  type ProtectedPaymentState,
  type StoredSession,
} from './services/supabaseRest';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

interface RatingPanelProps {
  deal: Deal;
  session: StoredSession;
}

export function RatingPanel({ deal, session }: RatingPanelProps) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    try {
      await submitRating(session, deal.id, stars, comment);
      setMessage('Thank you. Your rating was saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save rating');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="rating-panel">
      <Star />
      <div>
        <p className="eyebrow">{t('Deal completed')}</p>
        <h2>{t('Rate the other party')}</h2>
        <form onSubmit={send}>
          <label>
            {t('Rating')}
            <select
              value={stars}
              onChange={(event) => setStars(Number(event.target.value))}
            >
              <option value="5">{t('5 — Excellent')}</option>
              <option value="4">{t('4 — Good')}</option>
              <option value="3">{t('3 — Okay')}</option>
              <option value="2">{t('2 — Poor')}</option>
              <option value="1">{t('1 — Very poor')}</option>
            </select>
          </label>
          <label>
            {t('Comment')}
            <textarea
              maxLength={500}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('What went well?')}
            />
          </label>
          <button className="primary" type="submit" disabled={saving}>
            {t(saving ? 'Saving…' : 'Submit rating')}
          </button>
        </form>
        {message && (
          <div className="notice" role="status" aria-live="polite">
            {t(message)}
          </div>
        )}
      </div>
    </section>
  );
}

interface DealSafetyActionsProps {
  deal: Deal;
  session: StoredSession;
  onStatus: (status: Deal['status']) => void;
}

export function DealSafetyActions({
  deal,
  session,
  onStatus,
}: DealSafetyActionsProps) {
  const [mode, setMode] = useState<'cancel' | 'dispute' | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [paymentState, setPaymentState] =
    useState<ProtectedPaymentState | null>(null);
  const [paymentStateError, setPaymentStateError] = useState('');
  const [paymentStateVersion, setPaymentStateVersion] = useState(0);
  const { confirmAction, confirmDialog } = useConfirmAction();

  useEffect(() => {
    if (deal.status !== 'completed') {
      setPaymentState(null);
      setPaymentStateError('');
      return;
    }
    let current = true;
    setPaymentStateError('');
    void getProtectedPaymentStatus(session, deal.id)
      .then((payment) => {
        if (current) {
          setPaymentState(payment.status);
          setPaymentStateError('');
        }
      })
      .catch(() => {
        if (current) {
          setPaymentState(null);
          setPaymentStateError(
            'Payment status could not be checked. Dispute eligibility is temporarily unavailable.',
          );
        }
      });
    return () => {
      current = false;
    };
  }, [deal.id, deal.status, session.accessToken, paymentStateVersion]);

  const closeForm = () => {
    if (saving) return;
    setMode(null);
    setReason('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode || savingRef.current) return;
    savingRef.current = true;

    const confirmed = await confirmAction({
      title: t(mode === 'cancel' ? 'Cancel this deal?' : 'Open a dispute?'),
      description: t(
        mode === 'cancel'
          ? 'This action cannot be undone. The cancellation reason will remain in the private deal history.'
          : 'The deal and handoff will be paused while the report is reviewed.',
      ),
      confirmLabel: t(mode === 'cancel' ? 'Cancel deal' : 'Open dispute'),
      tone: 'danger',
    });
    if (!confirmed) {
      savingRef.current = false;
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      if (mode === 'cancel') {
        await cancelDeal(session, deal.id, reason);
        onStatus('cancelled');
        setMessage('Deal cancelled.');
      } else {
        await openDealDispute(session, deal.id, reason);
        onStatus('disputed');
        setMessage('Problem reported. The deal is now disputed.');
      }
      setMode(null);
      setReason('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (deal.status === 'cancelled' || deal.status === 'disputed') {
    return (
      <section className={`deal-alert ${deal.status}`}>
        <ShieldCheck />
        <div>
          <b>{t(deal.status === 'cancelled' ? 'Deal cancelled' : 'Deal disputed')}</b>
          <span>
            {t(
              deal.status === 'cancelled'
                ? 'No further handoff actions are available.'
                : 'The handoff is paused while the report is reviewed.',
            )}
          </span>
        </div>
      </section>
    );
  }

  const canDispute =
    deal.status === 'accepted' ||
    (deal.status === 'completed' &&
      paymentState !== null &&
      ![
        'released',
        'release_pending',
        'refund_pending',
        'refunded',
      ].includes(paymentState));

  return (
    <>
    <section className="deal-safety-actions">
      <div>
        <p className="eyebrow">{t('Safety controls')}</p>
        <h2>{t('Need to stop or report this deal?')}</h2>
        <p>{t('Reasons are recorded in the private audit history.')}</p>
      </div>
      <div className="safety-buttons">
        {deal.viewerRole === 'seller' && (
          <button
            className="secondary danger"
            type="button"
            disabled={saving}
            onClick={() => setMode('cancel')}
          >
            {t('Cancel deal')}
          </button>
        )}
        {canDispute && (
          <button
            className="secondary"
            type="button"
            disabled={saving}
            onClick={() => setMode('dispute')}
          >
            {t('Report a problem')}
          </button>
        )}
      </div>
      {paymentStateError && (
        <div className="notice" role="alert">
          <span>{t(paymentStateError)}</span>
          <button
            type="button"
            className="secondary"
            onClick={() => setPaymentStateVersion(version => version + 1)}
          >
            {t('Try again')}
          </button>
        </div>
      )}
      {mode && (
        <form onSubmit={submit}>
          <label>
            {t(mode === 'cancel' ? 'Why are you cancelling?' : 'Describe the problem')}
            <textarea
              required
              minLength={mode === 'cancel' ? 5 : 10}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t(
                mode === 'cancel'
                  ? 'Example: Item is no longer available'
                  : 'Include what happened and what outcome you expect',
              )}
            />
          </label>
          <div>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={closeForm}
            >
              {t('Go back')}
            </button>
            <button className="primary" type="submit" disabled={saving}>
              {t(
                saving
                  ? 'Saving…'
                  : mode === 'cancel'
                    ? 'Confirm cancellation'
                    : 'Open dispute',
              )}
            </button>
          </div>
        </form>
      )}
      {message && (
        <div className="notice" role="status" aria-live="polite">
          {t(message)}
        </div>
      )}
    </section>
    {confirmDialog}
    </>
  );
}

interface ReportDealPanelProps {
  deal: Deal;
  session: StoredSession | null;
  onSignIn: () => void;
}

export function ReportDealPanel({
  deal,
  session,
  onSignIn,
}: ReportDealPanelProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('Suspected fraud');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || sendingRef.current || details.trim().length < 10) return;
    sendingRef.current = true;
    setSending(true);
    setMessage('');
    try {
      await reportPublicDeal(session, deal.publicId, category, details);
      setSubmitted(true);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit report');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <section className={`report-deal no-print ${submitted ? 'submitted' : ''}`}>
      <div className="report-heading">
        <Flag />
        <div>
          <p className="eyebrow">{t('Trust and safety')}</p>
          <h2>{t('Report suspicious deal')}</h2>
          <span>
            {t(
              'Help Dealivra review possible fraud, prohibited goods, or misleading information.',
            )}
          </span>
        </div>
      </div>
      {submitted ? (
        <div className="report-success" role="status" aria-live="polite">
          <Check />
          <div>
            <b>{t('Report submitted')}</b>
            <span>{t('Thank you. The report was recorded for review.')}</span>
          </div>
        </div>
      ) : (
        <>
          {!open ? (
            <button
              className="secondary danger"
              type="button"
              onClick={() => setOpen(true)}
            >
              <Flag size={16} />
              {t('Report suspicious deal')}
            </button>
          ) : session ? (
            <form onSubmit={submit}>
              <label>
                {t('Report category')}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="Suspected fraud">{t('Suspected fraud')}</option>
                  <option value="Prohibited item">{t('Prohibited item')}</option>
                  <option value="Misleading information">
                    {t('Misleading information')}
                  </option>
                  <option value="Duplicate or stolen photos">
                    {t('Duplicate or stolen photos')}
                  </option>
                  <option value="Other">{t('Other')}</option>
                </select>
              </label>
              <label>
                {t('Details')}
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder={t(
                    'Describe what you noticed without sharing passwords or financial information.',
                  )}
                />
                <small>{details.trim().length}/1000</small>
              </label>
              {message && (
                <div className="notice" role="alert">
                  {t(message)}
                </div>
              )}
              <div className="report-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={sending}
                  onClick={() => setOpen(false)}
                >
                  {t('Go back')}
                </button>
                <button
                  className="primary"
                  type="submit"
                  disabled={sending}
                >
                  {t(sending ? 'Sending…' : 'Submit report')}
                </button>
              </div>
            </form>
          ) : (
            <div className="report-signin">
              <LockKeyhole />
              <span>
                {t('Sign in so the report can be recorded and protected from abuse.')}
              </span>
              <button className="primary" type="button" onClick={onSignIn}>
                {t('Sign in to report')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface DealChatProps {
  deal: Deal;
  session: StoredSession;
}

export function DealChat({ deal, session }: DealChatProps) {
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef(false);
  const loadedRef = useRef(false);
  const lastSeenRef = useRef<string | undefined>(undefined);
  const requestRef = useRef(0);
  const contextRef = useRef('');
  contextRef.current = `${deal.id}:${session.accessToken}`;

  const setChatOpen = (value: boolean) => {
    openRef.current = value;
    setOpen(value);
    if (value) {
      setUnread(0);
      const latest = messages[messages.length - 1]?.created_at;
      if (latest) lastSeenRef.current = latest;
    }
  };

  const closeChat = (restoreFocus = false) => {
    setChatOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => launcherRef.current?.focus());
    }
  };

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const next = await getDealMessages(session, deal.id);
      if (request !== requestRef.current) return;
      setMessages(next);
      setError('');
      const latest = next[next.length - 1]?.created_at;
      if (!loadedRef.current) {
        loadedRef.current = true;
        lastSeenRef.current = latest;
      } else if (openRef.current) {
        setUnread(0);
        if (latest) lastSeenRef.current = latest;
      } else {
        const seen = lastSeenRef.current
          ? new Date(lastSeenRef.current).getTime()
          : 0;
        setUnread(
          next.filter(
            (message) =>
              !message.is_mine &&
              new Date(message.created_at).getTime() > seen,
          ).length,
        );
      }
    } catch (loadError) {
      if (request !== requestRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load messages',
      );
    }
  }, [deal.id, session]);

  useEffect(() => {
    requestRef.current += 1;
    loadedRef.current = false;
    lastSeenRef.current = undefined;
    openRef.current = false;
    setOpen(false);
    setMessages([]);
    setUnread(0);
    setError('');
  }, [deal.id, session.accessToken]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => composerRef.current?.focus());
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    const closeFromOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !launcherRef.current?.contains(event.target)
      ) {
        closeChat(false);
      }
    };
    document.addEventListener('pointerdown', closeFromOutside);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('pointerdown', closeFromOutside);
      requestRef.current += 1;
    };
  }, [load, open]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() || sendingRef.current) return;
    sendingRef.current = true;
    const context = contextRef.current;
    setSending(true);
    setError('');
    try {
      await sendDealMessage(session, deal.id, body);
      if (context !== contextRef.current) return;
      setBody('');
      await load();
    } catch (sendError) {
      if (context !== contextRef.current) return;
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Could not send message',
      );
    } finally {
      sendingRef.current = false;
      if (context === contextRef.current) setSending(false);
    }
  };

  return (
    <div
      className={`deal-chat-float ${open ? 'open' : ''}`}
    >
      <button
        ref={launcherRef}
        type="button"
        className="deal-chat-launcher"
        aria-expanded={open}
        aria-controls="deal-chat-panel"
        aria-label={t('Deal chat')}
        onClick={() => setChatOpen(!open)}
      >
        <MessageCircle size={19} />
        <span>{t('Deal chat')}</span>
        {unread > 0 && (
          <b aria-label={`${unread} ${t('Unread')}`}>{unread > 9 ? '9+' : unread}</b>
        )}
      </button>
      {open && (
        <section
          ref={panelRef}
          id="deal-chat-panel"
          className="deal-chat deal-chat-panel no-print"
          role="region"
          aria-labelledby="deal-chat-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeChat(true);
            }
          }}
        >
          <div className="chat-heading">
            <MessageCircle />
            <div>
              <p className="eyebrow">{t('Private conversation')}</p>
              <h2 id="deal-chat-title">{t('Deal chat')}</h2>
            </div>
            <button
              type="button"
              className="chat-close"
              aria-label={t('Close chat')}
              onClick={() => closeChat(true)}
            >
              <X aria-hidden="true" size={19} />
            </button>
          </div>
          <div className="chat-messages" aria-live="polite">
            {messages.length ? (
              messages.map((message) => (
                <article key={message.id} className={message.is_mine ? 'mine' : ''}>
                  <small>{message.is_mine ? t('You') : message.sender_name}</small>
                  <p>{message.body}</p>
                  <time>{formatDateTime(message.created_at)}</time>
                </article>
              ))
            ) : (
              <div className="chat-empty">
                {t('No messages yet. Keep important deal details here.')}
              </div>
            )}
          </div>
          {error && (
            <div className="notice" role="alert">
              {t(error)}
            </div>
          )}
          <form onSubmit={send}>
            <textarea
              ref={composerRef}
              required
              aria-label={t('Deal chat message')}
              maxLength={1000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t('Write a message about this deal…')}
            />
            <button
              className="primary"
              type="submit"
              disabled={!body.trim() || sending}
              aria-busy={sending}
            >
              <Send size={17} />
              {t(sending ? 'Sending…' : 'Send')}
            </button>
          </form>
          <small className="chat-note">
            <LockKeyhole />{' '}
            {t('Never share passwords, payment codes, or full financial information.')}
          </small>
        </section>
      )}
    </div>
  );
}
