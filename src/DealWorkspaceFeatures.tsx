import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheckBig,
  Clock3,
  Copy,
  CreditCard,
  FileCheck2,
  FileDown,
  FileSignature,
  ImagePlus,
  LockKeyhole,
  MailCheck,
  MapPinned,
  MessageCircle,
  Package,
  PackageCheck,
  Pencil,
  QrCode,
  Route,
  ScanSearch,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Star,
  Smartphone,
  Trash2,
  Truck,
  X,
  ZoomIn,
} from 'lucide-react';
import { focusPageDestination } from './accessibleNavigation';
import { copyTextToClipboard } from './clipboard';
import { AsyncStatePanel } from './AsyncStatePanel';
import { useConfirmAction } from './ConfirmActionDialog';
import { DEMO_DEAL_PUBLIC_ID } from './services/demoRepository';
import type { Deal, DealDraft } from './domain';
import {
  amountForInput,
  currencyStep,
  formatMoney,
  toMinorUnits,
} from './currency';
import { getAppLanguage, t } from './i18n';
import {
  askDealQuestion,
  configureBuyerAccessCode,
  deleteDealMedia,
  getDealActionPlan,
  getDealInquiries,
  getDealOffers,
  getDealParticipants,
  getDealPaymentRecord,
  getDealRiskAssessment,
  getDealTimeline,
  getPublicSellerTrustProfile,
  isCurrentUserDealSeller,
  isDealSaved,
  isSupabaseConfigured,
  makeDealOffer,
  publishUserDealDraft,
  renewDealLink,
  reorderDealMedia,
  replyDealInquiry,
  respondToOffer,
  setDealSaved,
  updatePublishedDeal,
  updateUserDealDraft,
  uploadDealPhotos,
  type DealActionPlan,
  type DealInquiry,
  type DealOffer,
  type DealParticipants,
  type DealPaymentMethod,
  type DealPaymentRecord,
  type PublicTrustProfile,
  type RiskAssessment,
  type StoredSession,
  type TimelineEvent,
} from './services/supabaseRest';
import {
  emptySellerDeclarations,
  SellerDeclarationChecklist,
  type SellerDeclarations,
} from './SellerDeclarations';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(getAppLanguage());
export const dealPrice = (
  deal: Pick<Deal, 'priceCents' | 'currency'>,
) => formatMoney(deal.priceCents, deal.currency, getAppLanguage());
export const isDealExpired = (deal: Deal, now = Date.now()) =>
  deal.status === 'published' &&
  Boolean(deal.expiresAt) &&
  new Date(deal.expiresAt!).getTime() <= now;
const relativeExpiry = (expiresAt: string, now: number) => {
  const difference = new Date(expiresAt).getTime() - now;
  const absolute = Math.abs(difference);
  const [amount, unit] =
    absolute >= 24 * 60 * 60 * 1000
      ? [Math.ceil(difference / (24 * 60 * 60 * 1000)), 'day' as const]
      : absolute >= 60 * 60 * 1000
        ? [Math.ceil(difference / (60 * 60 * 1000)), 'hour' as const]
        : [Math.ceil(difference / (60 * 1000)), 'minute' as const];
  return new Intl.RelativeTimeFormat(getAppLanguage(), {
    numeric: 'auto',
  }).format(amount, unit);
};

export function DealReadiness({
  deal,
  onOpenProfile,
  onEditDetails,
}: {
  deal: Deal;
  onOpenProfile?: () => void;
  onEditDetails?: () => void;
}) {
  const contactVerified = deal.sellerContactVerified === true;
  const sellerVerified = deal.sellerVerification === 'verified';
  const descriptionCharacters = deal.description.trim().length;
  const descriptionReady = descriptionCharacters >= 20;
  const checks = [
    {
      label: 'Seller contact verification',
      complete: contactVerified,
      status: contactVerified ? 'Completed' : 'Verification pending',
    },
    {
      label: 'Seller identity verification',
      complete: sellerVerified,
      status: sellerVerified ? 'Completed' : 'Verification pending',
    },
    {
      label: 'Item photos or video',
      complete: Boolean(deal.mediaUrls?.length),
      status: deal.mediaUrls?.length ? 'Completed' : 'pending',
    },
    {
      label: 'Known condition and defects',
      complete: descriptionReady,
      status: descriptionReady ? 'Completed' : 'Minimum 20 characters required',
    },
    {
      label: 'Serial or IMEI (optional)',
      complete: Boolean(deal.serialNumber),
      status: deal.serialNumber ? 'Completed' : 'pending',
    },
    {
      label: 'Shared terms',
      complete: deal.agreementVersion >= 1,
      status: deal.agreementVersion >= 1 ? 'Completed' : 'pending',
    },
    {
      label: 'Offer active',
      complete: !isDealExpired(deal),
      status: !isDealExpired(deal) ? 'Completed' : 'pending',
    },
    {
      label: 'Recorded consent',
      complete: !['draft', 'published'].includes(deal.status),
      status: !['draft', 'published'].includes(deal.status)
        ? 'Completed'
        : 'pending',
    },
    {
      label: 'Handoff',
      complete: Boolean(deal.deliveryMethod),
      status: deal.deliveryMethod ? 'Completed' : 'pending',
    },
  ];
  const completed = checks.filter((check) => check.complete).length;
  const percentage = Math.round((completed / checks.length) * 100);
  const riskScore = Math.min(
    100,
    (contactVerified ? 0 : 10) +
      (sellerVerified ? 0 : 15) +
      (deal.mediaUrls?.length ? 0 : 20) +
      (descriptionReady ? 0 : 15) +
      (deal.serialNumber ? 0 : 5) +
      (deal.agreementVersion >= 1 ? 0 : 15) +
      (['draft', 'published'].includes(deal.status) ? 10 : 0) +
      (isDealExpired(deal) ? 35 : 0) +
      (deal.status === 'disputed' ? 35 : 0) +
      (deal.status === 'cancelled' ? 15 : 0),
  );
  const riskLevel =
    riskScore <= 20
      ? 'Low concern'
      : riskScore <= 45
        ? 'Review recommended'
        : 'Caution';
  const riskClass =
    riskScore <= 20 ? 'low' : riskScore <= 45 ? 'review' : 'caution';

  return (
    <section className="deal-readiness no-print">
      <div className="readiness-heading">
        <span className="workflow-icon">
          <ShieldCheck />
        </span>
        <div>
          <p className="eyebrow">{t('Safety controls')}</p>
          <h2>{t('Deal safety check')}</h2>
          <span className="readiness-summary">
            {completed}/{checks.length} {t('checks recorded')}
          </span>
        </div>
        <div className={`readiness-score risk-${riskClass}`}>
          <strong>{riskScore}</strong>
          <small>{t('Risk score')}</small>
        </div>
      </div>
      <div className="readiness-status-row">
        <span className={`risk-level ${riskClass}`}>{t(riskLevel)}</span>
        <div
          className="readiness-progress"
          role="progressbar"
          aria-label={t('Deal safety check')}
          aria-valuemin={0}
          aria-valuemax={checks.length}
          aria-valuenow={completed}
        >
          <span style={{ width: `${percentage}%` }} />
        </div>
        <strong>{percentage}%</strong>
      </div>
      {(!contactVerified || !sellerVerified || !descriptionReady) && (
        <div className="readiness-guidance">
          {!contactVerified && (
            <article>
              <p>
                <MailCheck />
                {t(
                  'Confirm the email address from the message sent during account registration.',
                )}
              </p>
              {onOpenProfile && (
                <button type="button" onClick={onOpenProfile}>
                  {t('Open verification center')}
                </button>
              )}
            </article>
          )}
          {!sellerVerified && (
            <article>
              <p>
                <BadgeCheck />
                {t(
                  'Complete identity verification from Profile → Verification & Security Center.',
                )}
              </p>
              {onOpenProfile && (
                <button type="button" onClick={onOpenProfile}>
                  {t('Open verification center')}
                </button>
              )}
            </article>
          )}
          {!descriptionReady && (
            <article>
              <p>
                <Pencil />
                <span>
                  {t('Description progress')}: {descriptionCharacters}/20 ·{' '}
                  {t('Describe wear, repairs, or defects.')}
                </span>
              </p>
              {onEditDetails && (
                <button type="button" onClick={onEditDetails}>
                  {t('Edit description')}
                </button>
              )}
            </article>
          )}
        </div>
      )}
      <details className="readiness-details">
        <summary>
          <span>{t('Review all safety signals')}</span>
          <ChevronDown />
        </summary>
        <div className="readiness-grid">
          {checks.map((check) => (
            <article
              key={check.label}
              className={check.complete ? 'complete' : ''}
            >
              {check.complete ? <Check /> : <Clock3 />}
              <span>{t(check.label)}</span>
              <small>{t(check.status)}</small>
            </article>
          ))}
        </div>
        <div className="readiness-notes">
          <p className="readiness-note">
            <ShieldCheck />
            {t(
              'This automated check uses only the details in this Dealivra record. It is not an accusation, guarantee, or market-price check.',
            )}
          </p>
          <p className="readiness-note">
            <LockKeyhole />
            {t(
              'Dealivra does not hold or insure payments in this beta. Never send deposits outside the agreed process.',
            )}
          </p>
        </div>
      </details>
    </section>
  );
}

export function SaveDealButton({
  deal,
  session,
  onSignIn,
  onChanged,
}: {
  deal: Deal;
  session: StoredSession | null;
  onSignIn: () => void;
  onChanged: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(Boolean(session));
  const mutationRef = useRef(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    if (!session) {
      setSaved(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void isDealSaved(session, deal.publicId)
      .then((value) => {
        if (current) {
          setSaved(value);
          setMessage('');
        }
      })
      .catch(() => {
        if (current) {
          setSaved(false);
          setMessage('Could not check whether this deal is saved. Try again.');
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [deal.publicId, session?.accessToken]);

  const toggle = async () => {
    if (!session) {
      onSignIn();
      return;
    }
    if (mutationRef.current) return;
    mutationRef.current = true;
    setLoading(true);
    setMessage('');
    try {
      const next = await setDealSaved(session, deal.publicId, !saved);
      setSaved(next);
      setMessage(
        next
          ? 'Deal Link saved to your Watchlist.'
          : 'Deal Link removed from your Watchlist.',
      );
      onChanged();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update saved deal',
      );
    } finally {
      mutationRef.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="save-deal no-print">
      <div>
        <Bookmark fill={saved ? 'currentColor' : 'none'} />
        <span>
          <b>{t(saved ? 'Saved to Watchlist' : 'Save this Deal Link')}</b>
          <small>
            {t(
              saved
                ? 'You can find it on your Dashboard.'
                : 'Keep this deal in your private account list.',
            )}
          </small>
        </span>
      </div>
      <button
        type="button"
        className={saved ? 'secondary' : 'primary'}
        disabled={loading}
        onClick={() => void toggle()}
      >
        <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
        {t(
          session
            ? saved
              ? 'Remove saved deal'
              : 'Save Deal Link'
            : 'Sign in to save',
        )}
      </button>
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
    </section>
  );
}

const eventLabels: Record<string, string> = {
  deal_published: 'Deal Link published',
  deal_accepted: 'Terms accepted',
  buyer_accepted: 'Terms accepted',
  deal_renewed: 'Deal Link extended.',
  deal_updated: 'Deal details updated',
  question_asked: 'Buyer question received',
  question_answered: 'Seller replied to question',
  offer_made: 'Offer sent',
  offer_declined: 'Offer declined',
  offer_accepted: 'Offer accepted',
  buyer_access_protection_enabled: 'Buyer access protection enabled',
  buyer_access_protection_disabled: 'Buyer access protection disabled',
  buyer_access_code_verified: 'Buyer access code verified',
  meeting_proposed: 'Meeting proposed',
  meeting_confirmed: 'Meeting confirmed',
  participant_arrived: 'Arrival recorded',
  handoff_pin_generated: 'Handoff PIN generated',
  delivery_address_saved: 'Delivery address saved',
  payment_method_recorded: 'Payment method recorded',
  payment_method_confirmed: 'Payment method confirmed',
  payment_marked_sent: 'Buyer marked payment sent',
  payment_received: 'Seller confirmed payment received',
  item_inspected: 'Buyer inspection recorded',
  item_shipped: 'Item shipped',
  shipment_delivered: 'Delivery confirmed',
  media_reordered: 'Photo order updated',
  seller_declaration_recorded: 'Seller declaration recorded',
  deal_reported: 'Deal reported',
  deal_hidden: 'Deal hidden from public access',
  deal_restored: 'Deal restored to public access',
  deal_completed: 'Deal completed',
  deal_cancelled: 'Deal cancelled',
  dispute_opened: 'Problem reported',
};
const friendlyEvent = (type: string) =>
  t(eventLabels[type] || type.replaceAll('_', ' '));

export function TimelinePanel({
  deal,
  session,
}: {
  deal: Deal;
  session: StoredSession;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState('');
  const loadRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      const request = ++loadRequestRef.current;
      return (
      getDealTimeline(session, deal.id)
        .then((items) => {
          if (active && request === loadRequestRef.current) {
            setEvents(items);
            setError('');
          }
        })
        .catch((loadError) => {
          if (active && request === loadRequestRef.current) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not load timeline',
            );
          }
        })
      );
    };
    void load();
    const timer = window.setInterval(load, 15_000);
    const visible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      loadRequestRef.current += 1;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [deal.id, deal.status, session.accessToken]);

  const share = async () => {
    const history = [
      `Dealivra · ${deal.publicId}`,
      deal.title,
      dealPrice(deal),
      '',
      ...events
        .slice()
        .reverse()
        .map(
          (event) =>
            `${formatDateTime(event.created_at)} · ${friendlyEvent(
              event.event_type,
            )} · ${t(event.is_mine ? 'By you' : 'By the other party')}`,
        ),
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Dealivra · ${deal.publicId}`,
          text: history,
          url: `${location.origin}/?deal=${deal.publicId}`,
        });
      } else {
        await copyTextToClipboard(history);
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name !== 'AbortError') {
        setError('Could not share this link.');
      }
    }
  };

  return (
    <section className="timeline-panel">
      <div className="timeline-heading">
        <Clock3 />
        <div>
          <p className="eyebrow">{t('Recorded history')}</p>
          <h2>{t('Deal timeline')}</h2>
        </div>
        <div className="timeline-actions no-print">
          <button
            type="button"
            className="secondary"
            onClick={() => window.print()}
          >
            <FileDown size={16} />
            {t('Print / Save PDF')}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void share()}
          >
            <Share2 size={16} />
            {t('Share')}
          </button>
        </div>
      </div>
      {error && <div className="notice" role="alert">{t(error)}</div>}
      <div className="timeline-list">
        {events.length ? (
          events.map((event) => (
            <article key={event.id}>
              <span />
              <div>
                <b>{friendlyEvent(event.event_type)}</b>
                <small>
                  {t(event.is_mine ? 'By you' : 'By the other party')} ·{' '}
                  {formatDateTime(event.created_at)}
                </small>
              </div>
            </article>
          ))
        ) : (
          <p>{t('No deal activity yet.')}</p>
        )}
      </div>
    </section>
  );
}

const paymentMethodLabels: Record<DealPaymentMethod, string> = {
  cash_at_handoff: 'Cash at handoff',
  bank_transfer: 'Bank transfer',
  payment_app: 'Payment app',
  card_invoice: 'Card invoice',
  other: 'Other agreed method',
};

export function CompletionReceipt({
  deal,
  session,
}: {
  deal: Deal;
  session: StoredSession;
}) {
  const [completedAt, setCompletedAt] = useState('');
  const [payment, setPayment] = useState<DealPaymentRecord | null>(null);
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    let current = true;
    void Promise.allSettled([
      getDealTimeline(session, deal.id),
      getDealPaymentRecord(session, deal.id),
    ]).then(([timelineResult, paymentResult]) => {
      if (!current) return;
      if (timelineResult.status === 'fulfilled') {
        setCompletedAt(
          timelineResult.value.find(
            (event) => event.event_type === 'deal_completed',
          )?.created_at || '',
        );
      }
      if (paymentResult.status === 'fulfilled') {
        setPayment(paymentResult.value);
      }
    });
    return () => {
      current = false;
    };
  }, [deal.id, session.accessToken]);

  const link = `${location.origin}/?deal=${deal.publicId}`;
  const share = async () => {
    setShareMessage('');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Dealivra · ${t('Deal completed')}`,
          text: `${deal.title} · ${deal.publicId}`,
          url: link,
        });
      } else {
        await copyTextToClipboard(link);
        setShareMessage('Deal Link copied.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareMessage(
        'Could not share this receipt. Copy the Deal Link manually.',
      );
    }
  };

  return (
    <section className="completion-receipt">
      <div className="receipt-heading">
        <PackageCheck />
        <div>
          <p className="eyebrow">{t('Agreement copy')}</p>
          <h2>{t('Deal completed')}</h2>
        </div>
        <span className="receipt-stamp">
          <Check size={15} />
          {t('Completed')}
        </span>
      </div>
      <div className="receipt-grid">
        <div>
          <span>{t('Deal')}</span>
          <strong>{deal.publicId}</strong>
        </div>
        <div>
          <span>{t('Item details')}</span>
          <strong>{deal.title}</strong>
        </div>
        <div>
          <span>{t('Price')}</span>
          <strong>{dealPrice(deal)}</strong>
        </div>
        <div>
          <span>{t('Seller contact')}</span>
          <strong>{deal.sellerName}</strong>
        </div>
        <div>
          <span>{t('Buyer')}</span>
          <strong>{deal.buyerName || t('Not provided')}</strong>
        </div>
        <div>
          <span>{t('Version')}</span>
          <strong>{deal.agreementVersion}</strong>
        </div>
        <div>
          <span>{t('Handoff')}</span>
          <strong>{t(deal.deliveryMethod)}</strong>
        </div>
        <div>
          <span>{t('Condition')}</span>
          <strong>{t(deal.condition)}</strong>
        </div>
        <div>
          <span>{t('Agreed payment method')}</span>
          <strong>
            {payment
              ? t(paymentMethodLabels[payment.method])
              : t('Not provided')}
          </strong>
        </div>
        <div>
          <span>{t('Payment status')}</span>
          <strong>
            {payment?.seller_marked_received_at
              ? t('Seller confirmed receipt')
              : t('Not provided')}
          </strong>
        </div>
        <div>
          <span>{t('Completed')}</span>
          <strong>{completedAt ? formatDateTime(completedAt) : '—'}</strong>
        </div>
      </div>
      <div className="receipt-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => window.print()}
        >
          <FileDown size={17} />
          {t('Print / Save PDF')}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void share()}
        >
          <Share2 size={17} />
          {t('Share')}
        </button>
      </div>
      <p className="receipt-note">
        <ShieldCheck />
        {t(
          'Use your browser’s print screen to save a PDF copy. The live Deal Link remains the current record.',
        )}
      </p>
      {shareMessage && (
        <div className="notice" role="status">
          {t(shareMessage)}
        </div>
      )}
    </section>
  );
}

export function BuyerInvitePanel({ deal }: { deal: Deal }) {
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<number | undefined>(undefined);
  const link = `${location.origin}/?deal=${deal.publicId}`;
  const message = `${t('Review agreement')}: ${deal.title} · ${dealPrice(
    deal,
  )} · ${link}`;

  useEffect(
    () => () => window.clearTimeout(noticeTimer.current),
    [],
  );
  const flash = (text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2200);
  };
  const copy = async () => {
    try {
      await copyTextToClipboard(link);
      flash('Deal Link copied.');
    } catch {
      flash('Could not copy automatically. Select the Deal Link and copy it.');
    }
  };
  const sms = async () => {
    try {
      await copyTextToClipboard(message);
      flash('Message copied. Paste it into SMS if needed.');
    } catch {
      flash('SMS is opening. Copy the invitation manually if the message is empty.');
    }
    window.location.href = /Android/i.test(navigator.userAgent)
      ? `sms:?body=${encodeURIComponent(message)}`
      : 'sms:';
  };
  const more = async () => {
    try {
      if (!navigator.share) throw new Error('share-unavailable');
      await navigator.share({
        title: `Dealivra · ${deal.title}`,
        text: message,
        url: link,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      try {
        await copyTextToClipboard(message);
        flash('Sharing is not available. Message copied.');
      } catch {
        flash('Sharing and automatic copy are unavailable. Copy the invitation manually.');
      }
    }
  };

  return (
    <section className="buyer-invite no-print">
      <div className="invite-heading">
        <Send />
        <div>
          <p className="eyebrow">{t('Share')}</p>
          <h2>{t('Invite buyer')}</h2>
          <p>{t('Share this Deal Link directly with the intended buyer.')}</p>
        </div>
      </div>
      <div className="invite-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => void copy()}
        >
          <Copy size={16} />
          {t('Copy Deal Link')}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(
            link,
          )}&text=${encodeURIComponent(
            `${t('Review agreement')}: ${deal.title}`,
          )}`}
          target="_blank"
          rel="noreferrer"
        >
          Telegram
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(
            `Dealivra · ${deal.title}`,
          )}&body=${encodeURIComponent(message)}`}
        >
          {t('Email')}
        </a>
        <button
          type="button"
          className="secondary"
          onClick={() => void sms()}
        >
          <MessageCircle size={16} />
          {t('SMS')}
        </button>
        <button
          type="button"
          className="secondary invite-more"
          onClick={() => void more()}
        >
          <Share2 size={16} />
          {t('More apps')}
        </button>
      </div>
      {notice && (
        <div className="notice" role="status">
          {t(notice)}
        </div>
      )}
    </section>
  );
}

export function BuyerAccessCodeManager({
  deal,
  session,
  enabled,
  onChanged,
}: {
  deal: Deal;
  session: StoredSession;
  enabled: boolean;
  onChanged: (enabled: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const { confirmAction, confirmDialog } = useConfirmAction();

  useEffect(
    () => () => window.clearTimeout(copiedTimer.current),
    [],
  );
  const generate = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    setCode('');
    try {
      const next = await configureBuyerAccessCode(session, deal.id, true);
      if (!next) throw new Error('Could not update buyer access');
      setCode(next);
      onChanged(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update buyer access',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const disable = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const confirmed = await confirmAction({
      title: t('Turn off buyer code protection?'),
      description: t(
        'Anyone with the Deal Link will be able to open and accept the agreement without the private code.',
      ),
      confirmLabel: t('Turn off code'),
      tone: 'danger',
    });
    if (!confirmed) {
      busyRef.current = false;
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await configureBuyerAccessCode(session, deal.id, false);
      setCode('');
      onChanged(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update buyer access',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!code) return;
    try {
      await copyTextToClipboard(code);
      setMessage('');
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setMessage('Buyer access code could not be copied. Select and copy it manually.');
    }
  };

  return (
    <>
    <section
      className={`buyer-access-manager no-print ${enabled ? 'enabled' : ''}`}
    >
      <div className="buyer-access-heading">
        <LockKeyhole />
        <div>
          <p className="eyebrow">{t('Protected acceptance')}</p>
          <h2>{t('Buyer access code')}</h2>
          <span>
            {t(
              'Require a private code before a buyer can accept this Deal Link.',
            )}
          </span>
        </div>
        <em>
          {t(
            enabled
              ? 'Acceptance code required'
              : 'Anyone with the Deal Link can accept',
          )}
        </em>
      </div>
      {code && (
        <div className="buyer-access-code">
          <span>{t('One-time code')}</span>
          <strong>{code}</strong>
          <button
            type="button"
            className="secondary"
            onClick={() => void copy()}
          >
            <Copy size={16} />
            {t(copied ? 'Code copied.' : 'Copy code')}
          </button>
          <small>
            {t(
              'Share this code privately with the intended buyer. It is shown only once.',
            )}
          </small>
        </div>
      )}
      <div className="buyer-access-actions">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void generate()}
        >
          {t(enabled ? 'Generate new code' : 'Generate access code')}
        </button>
        {enabled && (
          <button
            type="button"
            className="secondary danger"
            disabled={busy}
            onClick={() => void disable()}
          >
            {t('Turn off code')}
          </button>
        )}
      </div>
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
    </section>
    {confirmDialog}
    </>
  );
}

export function BuyerAccessCodeEntry({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="buyer-access-entry no-print">
      <LockKeyhole />
      <div>
        <p className="eyebrow">{t('Protected acceptance')}</p>
        <h2>{t('Acceptance code required')}</h2>
        <span>
          {t('This Deal Link requires the private code from the seller.')}
        </span>
        <label>
          {t('Enter 6-digit buyer code')}
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={value}
            onChange={(event) =>
              onChange(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="000000"
          />
        </label>
      </div>
    </section>
  );
}

export function DealExpiry({
  deal,
  now,
}: {
  deal: Deal;
  now: number;
}) {
  if (deal.status !== 'published' || !deal.expiresAt) return null;
  const expired = isDealExpired(deal, now);
  return (
    <section className={`deal-expiry ${expired ? 'expired' : ''}`}>
      <Clock3 />
      <div>
        <p className="eyebrow">{t(expired ? 'Expired' : 'Offer active')}</p>
        <h2>
          {t(expired ? 'Deal Link expired' : 'Offer expires')}{' '}
          {expired ? '' : relativeExpiry(deal.expiresAt, now)}
        </h2>
        <span>
          {new Date(deal.expiresAt).toLocaleString(getAppLanguage())} ·{' '}
          {t(
            expired
              ? 'This Deal Link can no longer be accepted.'
              : 'Buyer must accept before this time.',
          )}
        </span>
      </div>
    </section>
  );
}

export function DealRenewalPanel({
  deal,
  session,
  onRenewed,
}: {
  deal: Deal;
  session: StoredSession;
  onRenewed: (agreementVersion: number, expiresAt: string) => void;
}) {
  const expired = isDealExpired(deal);
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    setNewExpiry('');
    try {
      const result = await renewDealLink(session, deal.id, days);
      onRenewed(result.agreement_version, result.expires_at);
      setNewExpiry(result.expires_at);
    } catch {
      setMessage('Could not renew Deal Link');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className={`deal-renewal no-print ${expired ? 'expired' : ''}`}>
      <div className="deal-renewal-heading">
        <CalendarDays />
        <div>
          <p className="eyebrow">{t('Seller controls')}</p>
          <h2>{t(expired ? 'Renew expired Deal Link' : 'Extend Deal Link')}</h2>
          <span>
            {t(
              'A new expiration date and agreement version will be recorded.',
            )}
          </span>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          {t('Offer valid for')}
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={1}>{t('1 day')}</option>
            <option value={3}>{t('3 days')}</option>
            <option value={7}>{t('7 days')}</option>
            <option value={14}>{t('14 days')}</option>
            <option value={30}>{t('30 days')}</option>
          </select>
        </label>
        <button type="submit" className="primary" disabled={saving}>
          {t(saving ? 'Updating…' : expired ? 'Renew link' : 'Extend offer')}
        </button>
      </form>
      {newExpiry && (
        <div className="deal-renewal-success">
          <BadgeCheck />
          {t('Deal Link extended.')} {t('New expiration')}:{' '}
          {formatDateTime(newExpiry)}
        </div>
      )}
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
    </section>
  );
}

const riskSignalCopy: Record<string, string> = {
  unverified_seller: 'Seller identity verification is not complete.',
  new_account: 'Seller account was created recently.',
  limited_history: 'Seller account has limited history.',
  no_photos: 'No item photos were provided.',
  single_photo: 'Only one item photo was provided.',
  missing_serial:
    'No serial or IMEI ending was recorded for this electronic item.',
  payment_language:
    'The description contains language associated with higher-risk payment requests.',
  community_reports: 'This deal has unresolved community reports.',
  no_flags: 'No elevated risk signals were found in the available data.',
};

export function DealRiskCheck({ deal }: { deal: Deal }) {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setUnavailable(false);
    void getDealRiskAssessment(deal.publicId)
      .then((result) => {
        if (current) setAssessment(result);
      })
      .catch(() => {
        if (current) setUnavailable(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [deal.publicId, loadVersion]);

  if (!isSupabaseConfigured) return null;
  if (unavailable) {
    return (
      <section className="risk-check unavailable">
        <ShieldAlert aria-hidden="true" />
        <div>
          <b>{t('Safety check temporarily unavailable')}</b>
          <span>{t('Do not treat a missing risk result as approval. Try again before proceeding.')}</span>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setLoadVersion(version => version + 1)}
        >
          {t('Try again')}
        </button>
      </section>
    );
  }
  if (loading) {
    return (
      <section className="risk-check loading">
        <ShieldCheck />
        <span>{t('Checking visible risk signals…')}</span>
      </section>
    );
  }
  if (!assessment) return null;
  const levelTitle =
    assessment.risk_level === 'high'
      ? 'High risk signals'
      : assessment.risk_level === 'medium'
        ? 'Medium risk signals'
        : 'Low risk signals';
  return (
    <section className={`risk-check risk-${assessment.risk_level}`}>
      <div className="risk-heading">
        <ShieldAlert />
        <div>
          <p className="eyebrow">{t('Automated Risk Check')}</p>
          <h2>{t(levelTitle)}</h2>
        </div>
        <div className="risk-score">
          <strong>{assessment.risk_score}</strong>
          <small>/100</small>
        </div>
      </div>
      <div
        className="risk-meter"
        aria-label={`${t('Risk score')} ${assessment.risk_score} ${t(
          'out of 100',
        )}`}
      >
        <span style={{ width: `${assessment.risk_score}%` }} />
      </div>
      <ul>
        {assessment.signals.map((signal) => (
          <li key={signal}>
            <span>
              {signal === 'no_flags' ? (
                <Check size={17} />
              ) : (
                <ShieldAlert size={17} />
              )}
            </span>
            {t(riskSignalCopy[signal] || signal)}
          </li>
        ))}
      </ul>
      <div className="risk-disclaimer">
        <b>{t('Risk signals, not a verdict')}</b>
        <span>
          {t(
            'This automated check uses available Dealivra data and cannot guarantee that a deal or person is safe.',
          )}
        </span>
      </div>
    </section>
  );
}

export function DealParticipantsCard({
  deal,
  session,
  onLoaded,
}: {
  deal: Deal;
  session: StoredSession;
  onLoaded: (participants: DealParticipants) => void;
}) {
  const [participants, setParticipants] = useState<DealParticipants | null>(
    null,
  );
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let current = true;
    setParticipants(null);
    setLoadError('');
    void getDealParticipants(session, deal.id)
      .then((record) => {
        if (!current || !record) return;
        setParticipants(record);
        setLoadError('');
        onLoaded(record);
      })
      .catch(() => {
        if (current) setLoadError('Could not load the private participant record.');
      });
    return () => {
      current = false;
    };
  }, [deal.id, deal.status, session.accessToken]);

  if (!participants) {
    return loadError ? (
      <section className="participants-card compact-record-error notice" role="alert">
        <ShieldAlert aria-hidden="true" />
        <span>{t(loadError)}</span>
      </section>
    ) : null;
  }
  const verification = (
    status: DealParticipants['seller_verification'],
  ) =>
    status === 'verified'
      ? 'Identity verified'
      : status === 'pending'
        ? 'Verification pending'
        : status === 'failed'
          ? 'Verification failed'
          : 'Not verified';
  const card = (
    role: 'Seller' | 'Buyer',
    name: string,
    status: DealParticipants['seller_verification'],
  ) => (
    <article className="participant-card">
      <span className="participant-avatar">{name.slice(0, 1) || '?'}</span>
      <div>
        <span className="participant-role">
          {t(role)}
          {participants.viewer_role === role.toLowerCase()
            ? ` · ${t('You')}`
            : ''}
        </span>
        <strong>{name}</strong>
        <span className={`participant-verification ${status}`}>
          <BadgeCheck size={16} />
          {t(verification(status))}
        </span>
      </div>
    </article>
  );
  return (
    <section className="deal-participants">
      <div className="participant-heading">
        <span className="workflow-icon">
          <ShieldCheck />
        </span>
        <div>
          <p className="eyebrow">{t('Verified parties')}</p>
          <h2>{t('Deal participants')}</h2>
        </div>
        <span className="participant-private">
          <LockKeyhole size={14} />
          {t('Private')}
        </span>
      </div>
      <div className="participant-grid">
        {card(
          'Seller',
          participants.seller_name,
          participants.seller_verification,
        )}
        {card(
          'Buyer',
          participants.buyer_name,
          participants.buyer_verification,
        )}
      </div>
      <div className="participant-meta">
        {participants.accepted_at && (
          <span>
            <Clock3 size={15} />
            {t('Accepted on')} {formatDateTime(participants.accepted_at)}
          </span>
        )}
        <span>
          <ShieldCheck size={15} />
          {t('Identity details stay private')}
        </span>
      </div>
    </section>
  );
}

export function DealActionPlanCard({
  deal,
  session,
  onSync,
}: {
  deal: Deal;
  session: StoredSession;
  onSync: (plan: DealActionPlan) => void;
}) {
  const [plan, setPlan] = useState<DealActionPlan | null>(null);
  const loadRequestRef = useRef(0);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    let current = true;
    const load = () => {
      const request = ++loadRequestRef.current;
      setLoading(true);
      return (
      getDealActionPlan(session, deal.id)
        .then((record) => {
          if (!current || request !== loadRequestRef.current || !record) return;
          setPlan(record);
          setLoadError('');
          onSync(record);
        })
        .catch(() => {
          if (current && request === loadRequestRef.current) {
            setLoadError('Could not refresh the deal action plan.');
          }
        })
        .finally(() => {
          if (current && request === loadRequestRef.current) setLoading(false);
        })
      );
    };
    void load();
    const timer = window.setInterval(load, 12_000);
    return () => {
      current = false;
      loadRequestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [deal.id, deal.status, deal.viewerRole, session.accessToken, loadRevision]);

  if (!plan) {
    return (
      <section className="deal-action-plan-card compact-record-error no-print">
        <AsyncStatePanel
          state={loadError ? 'error' : 'loading'}
          title={loadError ? 'Deal progress unavailable' : 'Loading deal progress'}
          message={loadError || 'Checking the latest shared milestones.'}
          actionLabel="Retry progress"
          onAction={loadError ? () => setLoadRevision((revision) => revision + 1) : undefined}
        />
      </section>
    );
  }
  const completed = plan.deal_status === 'completed';
  const handoffReady =
    deal.deliveryMethod === 'Meet in person'
      ? plan.meeting_status === 'confirmed'
      : Boolean(plan.shipment_status);
  const steps = [
    { label: 'Terms accepted', done: true, icon: FileCheck2 },
    {
      label: 'Payment acknowledged',
      done: plan.payment_received || completed,
      icon: CreditCard,
    },
    {
      label:
        deal.deliveryMethod === 'Meet in person'
          ? 'Meeting confirmed'
          : 'Shipped',
      done: handoffReady,
      icon: deal.deliveryMethod === 'Meet in person' ? MapPinned : Truck,
    },
    {
      label: 'Buyer inspection recorded',
      done: plan.inspection_recorded,
      icon: ScanSearch,
    },
    { label: 'Deal completed', done: completed, icon: CircleCheckBig },
    { label: 'Rating submitted', done: plan.rating_submitted, icon: Star },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section id="deal-action-plan" className="deal-action-plan no-print">
      {loadError && (
        <AsyncStatePanel
          state="error"
          title="Deal progress could not refresh"
          message="Showing the previously loaded milestones. Retry before relying on the next step."
          actionLabel="Retry progress"
          onAction={() => setLoadRevision((revision) => revision + 1)}
        />
      )}
      {loading && !loadError && (
        <div className="sr-only" role="status" aria-live="polite">
          {t('Refreshing deal progress')}
        </div>
      )}
      <div className="action-plan-heading">
        <div className="action-plan-title">
          <span className="workflow-icon">
            <Route />
          </span>
          <div>
            <p className="eyebrow">{t('Live deal status')}</p>
            <h2>{t('Deal progress')}</h2>
            <p>
              {t('Milestones update automatically from the shared record.')}
            </p>
          </div>
        </div>
        <div
          className="action-plan-score"
          aria-label={`${doneCount} ${t('of')} ${steps.length} ${t(
            'steps complete',
          )}`}
        >
          <strong>{doneCount}</strong>
          <span>/ {steps.length}</span>
        </div>
      </div>
      <div
        className="action-plan-progress"
        role="progressbar"
        aria-label={t('Deal progress')}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="action-plan-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const state = step.done
            ? 'done'
            : index === currentIndex
              ? 'current'
              : 'upcoming';
          return (
            <li
              key={step.label}
              className={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="action-plan-step-icon">
                {step.done ? <Check size={18} /> : <Icon size={18} />}
              </span>
              <span>
                <b>{t(step.label)}</b>
                <small>
                  {t(
                    step.done
                      ? 'Done'
                      : index === currentIndex
                        ? 'In progress'
                        : 'Upcoming',
                  )}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="action-plan-note">
        <ShieldCheck size={16} />
        {t('Progress updates automatically from the protected deal record.')}
      </p>
    </section>
  );
}

export function SellerTrustProfile({ deal }: { deal: Deal }) {
  const [profile, setProfile] = useState<PublicTrustProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setUnavailable(false);
    void getPublicSellerTrustProfile(deal.publicId)
      .then((result) => {
        if (current) setProfile(result);
      })
      .catch(() => {
        if (current) setUnavailable(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [deal.publicId]);

  if (!isSupabaseConfigured || unavailable) return null;
  if (loading) {
    return (
      <section className="seller-trust loading">
        <BadgeCheck />
        <span>{t('Loading seller trust profile…')}</span>
      </section>
    );
  }
  if (!profile) return null;
  return (
    <section className="seller-trust">
      <div className="seller-trust-heading">
        <span className="seller-avatar">
          {profile.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="eyebrow">{t('Seller Trust Profile')}</p>
          <h2>{profile.display_name}</h2>
          <span
            className={`seller-verification ${
              profile.verification_status === 'verified' ? 'verified' : ''
            }`}
          >
            <BadgeCheck size={16} />
            {t(
              profile.verification_status === 'verified'
                ? 'Identity verified'
                : 'Verification pending',
            )}
          </span>
        </div>
      </div>
      <div className="seller-trust-stats">
        <article>
          <strong>{profile.completed_sales}</strong>
          <span>{t('Completed sales')}</span>
        </article>
        <article>
          <strong>
            {profile.average_rating ?? '—'} <Star size={18} />
          </strong>
          <span>
            {profile.rating_count} {t('ratings')}
          </span>
        </article>
        <article>
          <strong>
            {new Date(profile.member_since).toLocaleDateString(
              getAppLanguage(),
              { month: 'short', year: 'numeric' },
            )}
          </strong>
          <span>{t('Member since')}</span>
        </article>
      </div>
      <p className="seller-trust-note">
        <LockKeyhole size={15} />
        {t('Public profile excludes contact and identity details.')}
      </p>
    </section>
  );
}

export function AgreementExpiredNotice() {
  return (
    <div className="expired-agreement">
      <Clock3 />
      <div>
        <b>{t('Deal Link expired')}</b>
        <span>{t('This Deal Link can no longer be accepted.')}</span>
      </div>
    </div>
  );
}

export function DealCopyLinkButton({ deal }: { deal: Deal }) {
  const [state, setState] = useState<
    'idle' | 'copying' | 'copied' | 'error'
  >('idle');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => window.clearTimeout(resetTimer.current),
    [],
  );
  const copy = async () => {
    setState('copying');
    try {
      await copyTextToClipboard(`${location.origin}/?deal=${deal.publicId}`);
      setState('copied');
    } catch {
      setState('error');
    }
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState('idle'), 2600);
  };
  const label =
    state === 'copying'
      ? 'Copying…'
      : state === 'copied'
        ? 'Deal Link copied'
        : state === 'error'
          ? 'Try copying again'
          : 'Copy Deal Link';
  return (
    <div className={`copy-deal-link-action ${state}`}>
      <button
        type="button"
        className="copy no-print"
        disabled={state === 'copying'}
        onClick={() => void copy()}
      >
        {state === 'copied' ? <Check size={17} /> : <Copy size={17} />}
        {t(label)}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied'
          ? t('Deal Link copied to clipboard.')
          : state === 'error'
            ? t(
                'Could not copy the Deal Link. Try again or copy the browser address.',
              )
            : ''}
      </span>
    </div>
  );
}

export function DealQrCode({ deal }: { deal: Deal }) {
  const [open, setOpen] = useState(false);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const image = `/api/deal-qr?deal=${encodeURIComponent(deal.publicId)}`;

  return (
    <div className="deal-qr">
      <button
        type="button"
        className="copy no-print"
        onClick={() => setOpen((value) => !value)}
      >
        <QrCode size={17} />
        {t(open ? 'Hide QR Code' : 'Show QR Code')}
      </button>
      {open && (
        <div className="qr-panel no-print">
          <img
            src={image}
            alt={`${t('QR code for deal')} ${deal.publicId}`}
            hidden={imageState !== 'ready'}
            onLoad={() => setImageState('ready')}
            onError={() => setImageState('error')}
          />
          {imageState === 'ready' ? (
            <>
              <p>{t('Scan to open this Deal Link on another phone.')}</p>
              <a
                className="secondary"
                href={image}
                download={`Dealivra-${deal.publicId}-QR.png`}
              >
                {t('Download QR')}
              </a>
            </>
          ) : imageState === 'error' ? (
            <p role="alert">{t('QR code could not be prepared. Try again.')}</p>
          ) : (
            <p role="status">{t('Preparing QR Code…')}</p>
          )}
        </div>
      )}
      <div className="print-qr">
        <img src={image} alt={t('Deal Link QR code')} />
        <div>
          <b>{t('Live Deal Link')}</b>
          <small>{t('Scan to open the current Dealivra record.')}</small>
          <span>{deal.publicId}</span>
        </div>
      </div>
    </div>
  );
}

export function DealInquiries({
  deal,
  session,
  onSignIn,
}: {
  deal: Deal;
  session: StoredSession | null;
  onSignIn: () => void;
}) {
  const [items, setItems] = useState<DealInquiry[]>([]);
  const [question, setQuestion] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [messageFailed, setMessageFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const requestInFlight = useRef(false);
  const loadRequestRef = useRef(0);
  const [sellerAccess, setSellerAccess] = useState(
    deal.viewerRole === 'seller',
  );
  const isSeller = sellerAccess;
  const expired = isDealExpired(deal);

  const load = useCallback(async () => {
    if (!session) return;
    const request = ++loadRequestRef.current;
    try {
      const next = await getDealInquiries(session, deal.id);
      if (request === loadRequestRef.current) setItems(next);
    } catch {
      if (request === loadRequestRef.current) {
        setMessageFailed(true);
        setMessage('Could not load questions');
      }
    }
  }, [deal.id, session?.accessToken]);

  useEffect(() => {
    let current = true;
    setSellerAccess(deal.viewerRole === 'seller');
    if (session) {
      void isCurrentUserDealSeller(session, deal.id).then((value) => {
        if (current) setSellerAccess(value);
      });
    }
    return () => {
      current = false;
    };
  }, [deal.id, deal.viewerRole, session?.accessToken]);
  useEffect(() => {
    if (!session) {
      setItems([]);
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      loadRequestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [load, session?.accessToken]);

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !session ||
      question.trim().length < 5 ||
      busy ||
      requestInFlight.current
    )
      return;
    requestInFlight.current = true;
    setBusy('ask');
    setMessage('');
    setMessageFailed(false);
    try {
      await askDealQuestion(session, deal.publicId, question);
      setQuestion('');
      setMessage('Question sent.');
      await load();
    } catch (error) {
      setMessageFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not send question',
      );
    } finally {
      requestInFlight.current = false;
      setBusy('');
    }
  };
  const reply = async (
    event: React.FormEvent,
    inquiry: DealInquiry,
  ) => {
    event.preventDefault();
    const text = replies[inquiry.id]?.trim() || '';
    if (!session || text.length < 2 || busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(inquiry.id);
    setMessage('');
    setMessageFailed(false);
    try {
      await replyDealInquiry(session, inquiry.id, text);
      setReplies((current) => ({ ...current, [inquiry.id]: '' }));
      setMessage('Reply sent.');
      await load();
    } catch (error) {
      setMessageFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not send reply',
      );
    } finally {
      requestInFlight.current = false;
      setBusy('');
    }
  };

  return (
    <section className="deal-inquiries no-print">
      <div className="inquiry-heading">
        <MessageCircle />
        <div>
          <p className="eyebrow">{t('Questions before accepting')}</p>
          <h2>{t(isSeller ? 'Buyer questions' : 'Ask the seller')}</h2>
          <span>
            {t('Keep important item questions inside the Dealivra record.')}
          </span>
        </div>
      </div>
      {!session ? (
        <div className="inquiry-signin">
          <span>{t('Sign in to ask seller')}</span>
          <button type="button" className="primary" onClick={onSignIn}>
            {t('Sign in')}
          </button>
        </div>
      ) : (
        !isSeller &&
        !expired && (
          <form className="inquiry-form" onSubmit={ask}>
            <label>
              {t('Your question')}
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>
            <button type="submit" className="primary" disabled={busy === 'ask'}>
              <Send size={17} />
              {t('Ask question')}
            </button>
          </form>
        )
      )}
      {session && items.length === 0 && (
        <div className="inquiry-empty">
          <MessageCircle size={17} />
          {t('No questions yet.')}
        </div>
      )}
      <div className="inquiry-list">
        {items.map((inquiry) => (
          <article className="inquiry-card" key={inquiry.id}>
            <div className="inquiry-question">
              <span className="inquiry-avatar">
                {inquiry.buyer_name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <b>{isSeller ? inquiry.buyer_name : t('Your question')}</b>
                <time>{formatDateTime(inquiry.created_at)}</time>
              </div>
              <p>{inquiry.body}</p>
            </div>
            {inquiry.seller_reply ? (
              <div className="inquiry-answer">
                <b>{t('Seller reply')}</b>
                <p>{inquiry.seller_reply}</p>
                {inquiry.replied_at && (
                  <time>{formatDateTime(inquiry.replied_at)}</time>
                )}
              </div>
            ) : isSeller ? (
              <form
                className="inquiry-reply-form"
                onSubmit={(event) => void reply(event, inquiry)}
              >
                <label>
                  {t('Reply')}
                  <textarea
                    required
                    minLength={2}
                    maxLength={1000}
                    value={replies[inquiry.id] || ''}
                    onChange={(event) =>
                      setReplies((current) => ({
                        ...current,
                        [inquiry.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  type="submit"
                  className="primary"
                  disabled={busy === inquiry.id}
                >
                  <Send size={16} />
                  {t('Send reply')}
                </button>
              </form>
            ) : (
              <div className="inquiry-waiting">
                <Clock3 size={15} />
                {t('Waiting for seller reply.')}
              </div>
            )}
          </article>
        ))}
      </div>
      {message && (
        <div
          className="notice"
          role={messageFailed ? 'alert' : 'status'}
          aria-live={messageFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      <p className="inquiry-privacy">
        <LockKeyhole size={14} />
        {t('Only the questioner and seller can see each conversation.')}
      </p>
    </section>
  );
}

export function OfferPanel({
  deal,
  session,
  onAccepted,
}: {
  deal: Deal;
  session: StoredSession;
  onAccepted: (amount: number) => void;
}) {
  const [offers, setOffers] = useState<DealOffer[]>([]);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState(session.user.displayName);
  const [message, setMessage] = useState('');
  const [messageFailed, setMessageFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const requestInFlight = useRef(false);
  const loadSequenceRef = useRef(0);

  const load = useCallback(
    async () => {
      const request = ++loadSequenceRef.current;
      try {
        const next = await getDealOffers(session, deal.id);
        if (request === loadSequenceRef.current) setOffers(next);
      } catch {
        // Keep the last known offer list when a background refresh fails.
        if (request === loadSequenceRef.current) {
          setMessageFailed(true);
          setMessage('Could not refresh offers. Showing the last known list.');
        }
      }
    },
    [deal.id, session.accessToken],
  );
  useEffect(() => {
    void load();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy('submit');
    setMessage('');
    setMessageFailed(false);
    try {
      await makeDealOffer(
        session,
        deal.publicId,
        toMinorUnits(amount, deal.currency),
        name,
      );
      setAmount('');
      setMessage('Your offer was sent to the seller.');
      await load();
    } catch (error) {
      setMessageFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not send offer',
      );
    } finally {
      requestInFlight.current = false;
      setBusy('');
    }
  };
  const respond = async (offer: DealOffer, accept: boolean) => {
    if (busy || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(offer.id);
    setMessage('');
    setMessageFailed(false);
    try {
      await respondToOffer(session, offer.id, accept);
      setMessage(
        accept
          ? 'Offer accepted. The agreement price has been updated.'
          : 'Offer declined.',
      );
      await load();
      if (accept) onAccepted(offer.amount_cents);
    } catch (error) {
      setMessageFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Could not respond',
      );
    } finally {
      requestInFlight.current = false;
      setBusy('');
    }
  };

  return (
    <section className="offer-panel no-print">
      <div className="offer-heading">
        <BadgeDollarSign />
        <div>
          <p className="eyebrow">{t('Price negotiation')}</p>
          <h2>{t(deal.viewerRole === 'seller' ? 'Buyer offers' : 'Make an offer')}</h2>
        </div>
      </div>
      {deal.viewerRole !== 'seller' && (
        <form onSubmit={submit}>
          <label>
            {t('Your offer')} ({deal.currency})
            <input
              required
              type="number"
              min={currencyStep(deal.currency)}
              step={currencyStep(deal.currency)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={amountForInput(deal.priceCents, deal.currency)}
            />
          </label>
          <label>
            {t('Your full name')}
            <input
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" className="primary" disabled={Boolean(busy)}>
            {t('Send offer')}
          </button>
        </form>
      )}
      <div className="offer-list">
        {offers.map((offer) => (
          <article key={offer.id}>
            <div>
              <strong>
                {formatMoney(
                  offer.amount_cents,
                  deal.currency,
                  getAppLanguage(),
                )}
              </strong>
              <span>
                {offer.is_mine ? t('Your offer') : offer.buyer_name} ·{' '}
                {formatDate(offer.created_at)}
              </span>
            </div>
            <em className={offer.status}>{t(offer.status)}</em>
            {deal.viewerRole === 'seller' &&
              offer.status === 'pending' && (
                <div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={Boolean(busy)}
                    onClick={() => void respond(offer, false)}
                  >
                    {t('Decline')}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={Boolean(busy)}
                    onClick={() => void respond(offer, true)}
                  >
                    {t('Accept')}
                  </button>
                </div>
              )}
          </article>
        ))}
      </div>
      {message && (
        <div
          className="notice"
          role={messageFailed ? 'alert' : 'status'}
          aria-live={messageFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      <small className="offer-note">
        {t(
          'An accepted offer creates a new agreement version at the accepted price.',
        )}
      </small>
    </section>
  );
}

const isVideoSource = (source: string) =>
  /\.(mp4|webm)(?:$|\?)/i.test(source);
const acceptedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);
const acceptedVideoTypes = new Set(['video/mp4', 'video/webm']);
const mediaFileKind = (file: File): 'image' | 'video' | null => {
  const type = file.type.toLowerCase();
  if (acceptedImageTypes.has(type)) return 'image';
  if (acceptedVideoTypes.has(type)) return 'video';
  if (!type && /\.(jpe?g|png|webp|heic)$/i.test(file.name)) return 'image';
  if (!type && /\.(mp4|webm)$/i.test(file.name)) return 'video';
  return null;
};
const isVideoFile = (file: File) => mediaFileKind(file) === 'video';

export function MediaPreview({
  source,
  className,
  alt,
}: {
  source: string;
  className?: string;
  alt: string;
}) {
  return isVideoSource(source) ? (
    <video
      className={className}
      src={source}
      controls
      playsInline
      preload="metadata"
      aria-label={alt}
    />
  ) : (
    <img className={className} src={source} alt={alt} />
  );
}

function MediaLightbox({
  source,
  alt,
  onClose,
}: {
  source: string;
  alt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
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
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);
  return (
    <div
      className="media-lightbox"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="media-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={alt}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="media-lightbox-close"
          onClick={onClose}
          aria-label={t('Close image preview')}
        >
          <X aria-hidden="true" size={20} />
        </button>
        <img className="media-lightbox-content" src={source} alt={alt} />
      </div>
    </div>
  );
}

function ZoomableMedia({
  source,
  className,
  alt,
  onOpen,
}: {
  source: string;
  className?: string;
  alt: string;
  onOpen: () => void;
}) {
  if (isVideoSource(source)) {
    return <MediaPreview className={className} source={source} alt={alt} />;
  }
  return (
    <button
      type="button"
      className="media-zoom-button"
      onClick={onOpen}
      aria-label={`${t('Zoom image')}: ${alt}`}
    >
      <MediaPreview className={className} source={source} alt={alt} />
      <span className="media-zoom-indicator" aria-hidden="true">
        <ZoomIn size={20} />
      </span>
    </button>
  );
}

export function DealMedia({ deal }: { deal: Deal }) {
  const media = deal.mediaUrls || [];
  const cover = media[0];
  const printable = media.filter((url) => !isVideoSource(url));
  const [lightboxSource, setLightboxSource] = useState<string | null>(null);

  if (!cover) {
    const ArtIcon =
      deal.publicId === DEMO_DEAL_PUBLIC_ID ? Smartphone : Package;
    return (
      <div className="product-art product-art-empty">
        <ArtIcon />
        <span>{deal.title}</span>
        <small>
          {t(
            deal.publicId === DEMO_DEAL_PUBLIC_ID
              ? 'Sample item preview'
              : 'No item photos added',
          )}
        </small>
      </div>
    );
  }
  return (
    <>
      <div className="screen-media-gallery">
        <ZoomableMedia
          className={`product-media${
            isVideoSource(cover) ? ' video-cover' : ''
          }`}
          source={cover}
          alt={`${deal.title} ${t('cover')}`}
          onOpen={() => setLightboxSource(cover)}
        />
        {media.length > 1 && (
          <div className="deal-gallery supporting-gallery">
            {media.slice(1).map((url, index) => (
              <ZoomableMedia
                key={url}
                source={url}
                alt={`${deal.title} ${t('media')} ${index + 2}`}
                onOpen={() => setLightboxSource(url)}
              />
            ))}
          </div>
        )}
      </div>
      <div
        className="print-media-gallery"
        aria-label={t('Printable item photos')}
      >
        {printable.length > 0 ? (
          printable.map((url, index) => (
            <img
              key={url}
              className="print-photo"
              src={url}
              alt={`${deal.title} ${t('printable item')} ${index + 1}`}
            />
          ))
        ) : (
          <div className="product-art print-video-note">
            {t('Item video is attached to the live Deal Link')}
          </div>
        )}
      </div>
      {lightboxSource && (
        <MediaLightbox
          source={lightboxSource}
          alt={`${deal.title} ${t('image preview')}`}
          onClose={() => setLightboxSource(null)}
        />
      )}
    </>
  );
}

export function FilePreview({
  file,
  alt,
}: {
  file: File;
  alt: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kind = mediaFileKind(file);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>(
    kind === 'image' ? 'loading' : 'ready',
  );
  useEffect(() => {
    if (kind !== 'image') return;
    if (typeof createImageBitmap !== 'function') {
      setImageState('error');
      return;
    }
    let active = true;
    setImageState('loading');
    void createImageBitmap(file).then((bitmap) => {
      if (!active) {
        bitmap.close();
        return;
      }
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        bitmap.close();
        setImageState('error');
        return;
      }
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setImageState('ready');
    }).catch(() => {
      if (active) setImageState('error');
    });
    return () => {
      active = false;
    };
  }, [file, kind]);
  if (kind === 'image') {
    return (
      <div className="local-media-preview">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={alt}
          hidden={imageState !== 'ready'}
        />
        {imageState !== 'ready' && (
          <span role="status">
            <ImagePlus aria-hidden="true" />
            {t(imageState === 'error' ? 'Preview unavailable' : 'Preparing preview…')}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="local-media-preview video-file-selected" role="status">
      <PackageCheck aria-hidden="true" />
      <span>{t('Video selected')}</span>
    </div>
  );
}

export function SavedDraftPanel({
  deal,
  session,
  onUpdated,
}: {
  deal: Deal;
  session: StoredSession;
  onUpdated: (deal: Deal) => void;
}) {
  const remainingDays = deal.expiresAt
    ? Math.max(
        1,
        Math.round(
          (new Date(deal.expiresAt).getTime() -
            new Date(deal.createdAt).getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : 7;
  const makeEdit = (): DealDraft => ({
    title: deal.title,
    description: deal.description,
    price: amountForInput(deal.priceCents, deal.currency),
    currency: deal.currency,
    condition: deal.condition,
    serialNumber: deal.serialNumber?.slice(-4) || '',
    deliveryMethod: deal.deliveryMethod,
    expiresInDays: remainingDays,
    catalog: deal.catalog,
  });
  const [edit, setEdit] = useState<DealDraft>(makeEdit);
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [message, setMessage] = useState('');
  const [declarations, setDeclarations] = useState<SellerDeclarations>(
    emptySellerDeclarations,
  );
  const declarationsComplete = Object.values(declarations).every(Boolean);

  useEffect(() => {
    setEdit(makeEdit());
  }, [deal.id]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const action =
      (
        (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null
      )?.value || 'save';
    if (busy || mutationInFlight.current) return;
    if (action === 'publish' && !declarationsComplete) {
      setMessage('Confirm all declarations before publishing.');
      return;
    }
    mutationInFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const updated =
        action === 'publish'
          ? await publishUserDealDraft(session, deal.id, edit)
          : await updateUserDealDraft(session, deal.id, edit);
      onUpdated({ ...updated, mediaUrls: deal.mediaUrls });
      setMessage(
        action === 'publish' ? 'Deal Link published.' : 'Draft saved.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update draft',
      );
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="saved-draft no-print">
      <div className="saved-draft-heading">
        <LockKeyhole />
        <div>
          <p className="eyebrow">{t('Private draft')}</p>
          <h2>{t('Edit details')}</h2>
          <span>
            {t(
              'This draft is not shared through a Deal Link until you publish it.',
            )}
          </span>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          {t('Item title')}
          <input
            required
            minLength={3}
            maxLength={120}
            value={edit.title}
            onChange={(event) =>
              setEdit((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
        </label>
        <div className="two">
          <label>
            {t('Price')}
            <span className="price-currency-controls">
              <input
                required
                min={currencyStep(edit.currency)}
                step={currencyStep(edit.currency)}
                type="number"
                value={edit.price}
                onChange={(event) =>
                  setEdit((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
              <span className="currency-label">USD</span>
            </span>
          </label>
          <label>
            {t('Condition')}
            <select
              value={edit.condition}
              onChange={(event) =>
                setEdit((current) => ({
                  ...current,
                  condition: event.target.value as DealDraft['condition'],
                }))
              }
            >
              <option value="Like new">{t('Like new')}</option>
              <option value="Good">{t('Good')}</option>
              <option value="Fair">{t('Fair')}</option>
            </select>
          </label>
        </div>
        <label>
          {t('Known condition and defects')}
          <textarea
            required
            minLength={20}
            value={edit.description}
            onChange={(event) =>
              setEdit((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <small>
            {edit.description.trim().length}/20 ·{' '}
            {t('Describe wear, repairs, or defects.')}
          </small>
        </label>
        <div className="two">
          <label>
            {t('Handoff')}
            <select
              value={edit.deliveryMethod}
              onChange={(event) =>
                setEdit((current) => ({
                  ...current,
                  deliveryMethod: event.target
                    .value as DealDraft['deliveryMethod'],
                }))
              }
            >
              <option value="Meet in person">{t('Meet in person')}</option>
              <option value="Ship to buyer">{t('Ship to buyer')}</option>
            </select>
          </label>
          <label>
            {t('Offer valid for')}
            <select
              value={edit.expiresInDays || 7}
              onChange={(event) =>
                setEdit((current) => ({
                  ...current,
                  expiresInDays: Number(event.target.value),
                }))
              }
            >
              <option value={1}>{t('1 day')}</option>
              <option value={3}>{t('3 days')}</option>
              <option value={7}>{t('7 days')}</option>
              <option value={14}>{t('14 days')}</option>
              <option value={30}>{t('30 days')}</option>
            </select>
          </label>
        </div>
        <SellerDeclarationChecklist
          value={declarations}
          onChange={setDeclarations}
        />
        {!declarationsComplete && (
          <small className="declaration-required">
            {t('Confirm all declarations before publishing.')}
          </small>
        )}
        {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
        <div className="saved-draft-actions">
          <button
            type="submit"
            className="secondary"
            name="action"
            value="save"
            disabled={busy}
          >
            {t(busy ? 'Saving…' : 'Save changes')}
          </button>
          <button
            type="submit"
            className="primary"
            name="action"
            value="publish"
            disabled={busy || !declarationsComplete}
          >
            {t('Publish Deal Link')}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}

export function PhotoManager({
  deal,
  session,
  onAdded,
}: {
  deal: Deal;
  session: StoredSession;
  onAdded: (urls: string[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const remaining = Math.max(0, 6 - (deal.mediaUrls?.length || 0));
  const hasVideo = (deal.mediaUrls || []).some(isVideoSource);

  const choose = (selected: File[]) => {
    setMessage('');
    const unsupported = selected.find((file) => mediaFileKind(file) === null);
    if (unsupported) {
      setMessage(`${unsupported.name} ${t('is not a supported media file.')}`);
      return;
    }
    const combined = [...files, ...selected]
      .filter(
        (file, index, all) =>
          all.findIndex(
            (other) =>
              other.name === file.name && other.size === file.size,
          ) === index,
      )
      .slice(0, remaining);
    const videos = combined.filter(isVideoFile);
    const invalid = combined.find(
      (file) => file.size > (isVideoFile(file) ? 25 : 20) * 1024 * 1024,
    );
    if (invalid || videos.length + (hasVideo ? 1 : 0) > 1) {
      setMessage(
        invalid
          ? `${invalid.name} ${t('is too large.')}`
          : 'Only one item video is allowed per deal.',
      );
      return;
    }
    setFiles(combined);
  };
  const upload = async () => {
    if (!files.length || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setMessage('');
    try {
      const urls = await uploadDealPhotos(
        session,
        deal.id,
        files,
        deal.mediaUrls?.length || 0,
      );
      onAdded(urls);
      setFiles([]);
      setMessage('Media added successfully.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not upload media',
      );
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  return (
    <section className="photo-manager no-print">
      <div>
        <ImagePlus />
        <span>
          <b>{t('Add photos or video')}</b>
          <small>
            {remaining} {t('of 6 spaces available')} · {files.length}{' '}
            {t('selected')}
          </small>
        </span>
      </div>
      <p className="media-privacy">
        <ShieldCheck />
        {t(
          'Photo privacy: location and camera metadata are removed before upload.',
        )}
      </p>
      {remaining > files.length && (
        <label className="secondary">
          {t('Choose more media')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm"
            multiple
            onChange={(event) => {
              choose(Array.from(event.target.files || []));
              event.currentTarget.value = '';
            }}
          />
        </label>
      )}
      {files.length > 0 && (
        <div className="manager-previews">
          {files.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              alt={t('Upload preview')}
            />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <button
          type="button"
          className="primary"
          disabled={uploading}
          aria-busy={uploading}
          onClick={() => void upload()}
        >
          {uploading
            ? t('Preparing and uploading…')
            : `${t('Upload')} ${files.length} ${t(
                files.length > 1 ? 'files' : 'file',
              )}`}
        </button>
      )}
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
    </section>
  );
}

export function ExistingMediaManager({
  deal,
  session,
  onRemoved,
}: {
  deal: Deal;
  session: StoredSession;
  onRemoved: (url: string) => void;
}) {
  const [removing, setRemoving] = useState('');
  const removingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const { confirmAction, confirmDialog } = useConfirmAction();

  const remove = async (url: string) => {
    if (removingRef.current) return;
    removingRef.current = true;
    const confirmed = await confirmAction({
      title: t('Remove this media?'),
      description: t(
        'This photo or video will no longer appear on the Deal Link. This action cannot be undone.',
      ),
      confirmLabel: t('Remove media'),
      tone: 'danger',
    });
    if (!confirmed) {
      removingRef.current = false;
      return;
    }
    setRemoving(url);
    setMessage('');
    try {
      await deleteDealMedia(session, deal.id, url);
      onRemoved(url);
      setMessage('Media removed.');
      if (previewSource === url) setPreviewSource(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not remove media',
      );
    } finally {
      removingRef.current = false;
      setRemoving('');
    }
  };

  if (!deal.mediaUrls?.length) return null;
  return (
    <>
    <section className="existing-media no-print">
      <div>
        <p className="eyebrow">{t('Published media')}</p>
        <h2>{t('Manage photos and video')}</h2>
      </div>
      <div className="existing-media-grid">
        {deal.mediaUrls.map((url, index) => (
          <article key={url}>
            <ZoomableMedia
              source={url}
              alt={`${deal.title} ${t('media')} ${index + 1}`}
              onOpen={() => setPreviewSource(url)}
            />
            <button
              type="button"
              aria-label={`${t('Remove media')} ${index + 1}`}
              disabled={Boolean(removing)}
              onClick={() => void remove(url)}
            >
              <Trash2 size={16} />
              {t(removing === url ? 'Removing…' : 'Remove')}
            </button>
          </article>
        ))}
      </div>
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
      {previewSource && (
        <MediaLightbox
          source={previewSource}
          alt={`${deal.title} ${t('image preview')}`}
          onClose={() => setPreviewSource(null)}
        />
      )}
    </section>
    {confirmDialog}
    </>
  );
}

export function CoverSelector({
  deal,
  session,
  onReordered,
}: {
  deal: Deal;
  session: StoredSession;
  onReordered: (urls: string[]) => void;
}) {
  const urls = deal.mediaUrls || [];
  const [selected, setSelected] = useState(urls[0] || '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => setSelected(urls[0] || ''), [urls[0]]);
  if (urls.length < 2) return null;
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const ordered = [selected, ...urls.filter((url) => url !== selected)];
    setSaving(true);
    setMessage('');
    try {
      await reorderDealMedia(session, deal.id, ordered);
      onReordered(ordered);
      setMessage('Cover media updated.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update cover',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <section className="cover-selector no-print">
      <div>
        <p className="eyebrow">{t('Deal Link cover')}</p>
        <h2>{t('Choose the first photo')}</h2>
        <span>
          {t('The selected file appears first and at the largest size.')}
        </span>
      </div>
      <div className="cover-options">
        {urls.map((url, index) => (
          <button
            type="button"
            key={url}
            className={selected === url ? 'selected' : ''}
            onClick={() => setSelected(url)}
          >
            <MediaPreview
              source={url}
              alt={`${t('Cover option')} ${index + 1}`}
            />
            <span>
              {selected === url ? (
                <>
                  <Star size={14} />
                  {t('Selected')}
                </>
              ) : (
                `${t('Media')} ${index + 1}`
              )}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="primary"
        disabled={saving || selected === urls[0]}
        aria-busy={saving}
        onClick={() => void save()}
      >
        {t(saving ? 'Saving…' : 'Set as cover')}
      </button>
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
    </section>
  );
}

export function DealEditor({
  deal,
  session,
  onSaved,
  openRequestedAt = 0,
}: {
  deal: Deal;
  session: StoredSession;
  onSaved: (deal: Deal) => void;
  openRequestedAt?: number;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [edit, setEdit] = useState<DealDraft>({
    title: deal.title,
    description: deal.description,
    price: amountForInput(deal.priceCents, deal.currency),
    currency: deal.currency,
    condition: deal.condition,
    serialNumber: '',
    deliveryMethod: deal.deliveryMethod,
    catalog: deal.catalog,
  });

  useEffect(() => {
    if (!openRequestedAt) return;
    setOpen(true);
    window.requestAnimationFrame(() => focusPageDestination('deal-editor'));
  }, [openRequestedAt]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    try {
      const version = await updatePublishedDeal(
        session,
        deal.id,
        edit,
      );
      onSaved({
        ...deal,
        title: edit.title,
        description: edit.description,
        priceCents: toMinorUnits(edit.price, edit.currency),
        condition: edit.condition,
        deliveryMethod: edit.deliveryMethod,
        agreementVersion: version,
      });
      setMessage(`${t('Changes published as agreement version')} ${version}.`);
      setOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update deal',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="deal-editor"
      className="deal-editor no-print"
    >
      <div>
        <Pencil />
        <span>
          <b>{t('Edit published deal')}</b>
          <small>{t('Changes create a new agreement version.')}</small>
        </span>
      </div>
      <button
        id="deal-editor-toggle"
        type="button"
        className="secondary"
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? 'Close editor' : 'Edit details')}
      </button>
      {open && (
        <form onSubmit={save}>
          <label>
            {t('Item title')}
            <input
              required
              minLength={3}
              maxLength={120}
              value={edit.title}
              onChange={(event) =>
                setEdit((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <div className="edit-two">
            <label>
              {t('Price')} ({edit.currency})
              <input
                required
                type="number"
                min={currencyStep(edit.currency)}
                step={currencyStep(edit.currency)}
                value={edit.price}
                onChange={(event) =>
                  setEdit((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              {t('Condition')}
              <select
                value={edit.condition}
                onChange={(event) =>
                  setEdit((current) => ({
                    ...current,
                    condition: event.target.value as DealDraft['condition'],
                  }))
                }
              >
                <option value="Like new">{t('Like new')}</option>
                <option value="Good">{t('Good')}</option>
                <option value="Fair">{t('Fair')}</option>
              </select>
            </label>
          </div>
          <label>
            {t('Description and defects')}
            <textarea
              required
              minLength={20}
              value={edit.description}
              onChange={(event) =>
                setEdit((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
            <small>
              {edit.description.trim().length}/20 ·{' '}
              {t('Describe wear, repairs, or defects.')}
            </small>
          </label>
          <label>
            {t('Handoff')}
            <select
              value={edit.deliveryMethod}
              onChange={(event) =>
                setEdit((current) => ({
                  ...current,
                  deliveryMethod: event.target
                    .value as DealDraft['deliveryMethod'],
                }))
              }
            >
              <option value="Meet in person">{t('Meet in person')}</option>
              <option value="Ship to buyer">{t('Ship to buyer')}</option>
            </select>
          </label>
          <button type="submit" className="primary full" disabled={saving}>
            {t(saving ? 'Publishing…' : 'Publish changes')}
          </button>
        </form>
      )}
      {message && <div className="notice" role="status" aria-live="polite">{t(message)}</div>}
    </section>
  );
}

export function DemoAgreementComplete({
  buyerName,
  onStart,
  onReviewAgain,
}: {
  buyerName: string;
  onStart: () => void;
  onReviewAgain: () => void;
}) {
  return (
    <section
      className="demo-agreement-complete"
      role="status"
      aria-live="polite"
    >
      <div className="demo-complete-heading">
        <span>
          <BadgeCheck />
        </span>
        <div>
          <p className="eyebrow">{t('Sample complete')}</p>
          <h3>{t('You completed the buyer review.')}</h3>
          <p>
            {t(
              `${
                buyerName || 'Buyer'
              } reviewed the shared terms. No agreement, payment, or account was created.`,
            )}
          </p>
        </div>
      </div>
      <div
        className="demo-complete-next"
        aria-label={t('What happens next in a live deal')}
      >
        <p>
          {t(
            'In a live deal, both parties continue in the same private record:',
          )}
        </p>
        <ul>
          <li>
            <CreditCard />
            <span>
              <b>{t('Payment status')}</b>
              <small>{t('Both sides see when payment is ready.')}</small>
            </span>
          </li>
          <li>
            <Truck />
            <span>
              <b>{t('Delivery evidence')}</b>
              <small>
                {t('Shipping or handoff proof stays with the deal.')}
              </small>
            </span>
          </li>
          <li>
            <PackageCheck />
            <span>
              <b>{t('Completion record')}</b>
              <small>{t('Inspection and receipt close the transaction.')}</small>
            </span>
          </li>
        </ul>
      </div>
      <div className="demo-complete-actions">
        <button type="button" className="primary" onClick={onStart}>
          {t('Start your own deal')}
          <ArrowRight size={16} />
        </button>
        <button type="button" className="secondary" onClick={onReviewAgain}>
          {t('Review sample again')}
        </button>
      </div>
    </section>
  );
}

export function DealProgressStrip({
  deal,
  paymentReady,
}: {
  deal: Deal;
  paymentReady: boolean;
}) {
  const complete = deal.status === 'completed';
  const currentStage = complete
    ? 3
    : deal.status === 'accepted' && paymentReady
      ? 2
      : (['accepted', 'disputed'] as Deal['status'][]).includes(deal.status)
        ? 1
        : 0;
  const steps = [
    { label: 'Terms', icon: FileSignature },
    { label: 'Pay', icon: BadgeDollarSign },
    { label: 'Delivery', icon: Truck },
    { label: 'Done', icon: PackageCheck },
  ];
  return (
    <ol className="deal-progress-strip" aria-label={t('Deal progress')}>
      {steps.map((step, index) => {
        const state =
          complete || index < currentStage
            ? 'complete'
            : index === currentStage
              ? 'current'
              : 'upcoming';
        const Icon = step.icon;
        return (
          <li
            key={step.label}
            className={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span>{state === 'complete' ? <Check /> : <Icon />}</span>
            <small>{t(step.label)}</small>
          </li>
        );
      })}
    </ol>
  );
}
