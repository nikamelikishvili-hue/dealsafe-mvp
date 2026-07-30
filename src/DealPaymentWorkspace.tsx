import { useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Check,
  ChevronDown,
  Clock3,
  FileDown,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatMoney } from './currency';
import type { Deal } from './domain';
import { getAppLanguage, t } from './i18n';
import {
  createProtectedCheckout,
  getDealActionPlan,
  getProtectedPaymentStatus,
  getStripeConnectStatus,
  startStripeConnectOnboarding,
  type DealActionPlan,
  type ProtectedPaymentState,
  type ProtectedPaymentStatus,
  type StoredSession,
  type StripeConnectStatus,
} from './services/supabaseRest';

const protectedPaymentLabels: Record<ProtectedPaymentState, string> = {
  not_started: 'Not started',
  checkout_created: 'Checkout ready',
  processing: 'Payment processing',
  funds_secured: 'Payment confirmed',
  release_pending: 'Release in progress',
  released: 'Released to seller',
  failed: 'Payment failed',
  expired: 'Checkout expired',
  cancelled: 'Payment cancelled',
  refund_pending: 'Refund in progress',
  refunded: 'Refunded',
  disputed: 'Payment disputed',
  release_failed: 'Release failed',
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

const dealPrice = (deal: Pick<Deal, 'priceCents' | 'currency'>) =>
  formatMoney(deal.priceCents, deal.currency, getAppLanguage());

const escapePaymentReceiptHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      (
        {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        } as Record<string, string>
      )[character] || character,
  );

function printProtectedPaymentReceipt(
  deal: Deal,
  payment: ProtectedPaymentStatus,
) {
  const popup = window.open('', '_blank', 'width=900,height=780');
  if (!popup) return false;
  popup.opener = null;
  const money = (amount: number) =>
    formatMoney(amount, payment.currency, getAppLanguage());
  const paid = Boolean(payment.paid_at);
  const receiptTitle = t(paid ? 'Payment receipt' : 'Payment breakdown');
  const paidAt = payment.paid_at
    ? formatDateTime(payment.paid_at)
    : t('Pending');
  const finalEvent = payment.refunded_at
    ? [t('Refunded at'), formatDateTime(payment.refunded_at)]
    : payment.disputed_at
      ? [t('Disputed at'), formatDateTime(payment.disputed_at)]
      : [
          t('Released at'),
          payment.released_at
            ? formatDateTime(payment.released_at)
            : t('Not released yet'),
        ];
  const rows = [
    [t('Deal reference'), deal.publicId],
    [t('Item amount'), money(payment.item_amount_cents)],
    [t('Dealivra service fee'), money(payment.platform_fee_cents)],
    [t('Seller payout'), money(payment.seller_amount_cents)],
    [t('Payment status'), t(protectedPaymentLabels[payment.status])],
    [t('Paid at'), paidAt],
    ...(payment.checkout_expires_at && !paid
      ? [
          [
            t('Checkout expires at'),
            formatDateTime(payment.checkout_expires_at),
          ],
        ]
      : []),
    finalEvent,
  ];
  const language = getAppLanguage();
  const direction = language === 'ar' || language === 'he' ? 'rtl' : 'ltr';
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="${escapePaymentReceiptHtml(language)}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapePaymentReceiptHtml(receiptTitle)} · ${escapePaymentReceiptHtml(deal.publicId)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f4f7f5;color:#14251c;font-family:Inter,Arial,sans-serif}.sheet{width:min(820px,calc(100% - 32px));margin:32px auto;padding:38px;border:1px solid #d5e0d9;border-radius:24px;background:#fff}.brand{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:22px;border-bottom:2px solid #347653}.brand strong{font-size:1.45rem}.brand span{color:#347653;font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:30px 0 7px;font-size:2rem}.reference{margin:0 0 26px;color:#66746c}.rows{overflow:hidden;border:1px solid #d8e2dc;border-radius:16px}.row{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(0,1.2fr);gap:20px;padding:15px 18px;border-bottom:1px solid #e2e8e4}.row:last-child{border-bottom:0}.row span{color:#68766e;font-size:.88rem}.row strong{text-align:end;overflow-wrap:anywhere}.row.total{background:#edf6f0;color:#245f40}.note{margin:22px 0 0;padding:16px;border-radius:14px;background:#f5f7f5;color:#5f6d65;font-size:.82rem;line-height:1.55}.legal{margin:12px 0 0;color:#78837d;font-size:.75rem;line-height:1.5}@media(max-width:600px){.sheet{margin:0;width:100%;padding:24px;border:0;border-radius:0}.row{grid-template-columns:1fr;gap:5px}.row strong{text-align:start}}@media print{body{background:#fff}.sheet{width:100%;margin:0;border:0;box-shadow:none} @page{size:auto;margin:14mm}}
  </style></head><body><main class="sheet"><header class="brand"><strong>Dealivra</strong><span>${escapePaymentReceiptHtml(t('Transparent fee record'))}</span></header><h1>${escapePaymentReceiptHtml(receiptTitle)}</h1>${paid ? '' : `<p class="note"><strong>${escapePaymentReceiptHtml(t('Not paid'))}:</strong> ${escapePaymentReceiptHtml(t('This checkout has not been paid yet.'))}</p>`}<p class="reference">${escapePaymentReceiptHtml(t('Deal reference'))}: <strong>${escapePaymentReceiptHtml(deal.publicId)}</strong></p><section class="rows">${rows.map(([label, value], index) => `<div class="row${index === 3 ? ' total' : ''}"><span>${escapePaymentReceiptHtml(label)}</span><strong>${escapePaymentReceiptHtml(value)}</strong></div>`).join('')}</section><p class="note">${escapePaymentReceiptHtml(t(payment.status === 'released' ? 'Service fee earned after seller payout' : 'Service fee allocated at checkout'))}. ${escapePaymentReceiptHtml(t('Stripe processing fees are separate and are not included in the Dealivra service fee.'))}</p><p class="legal">${escapePaymentReceiptHtml(t('This receipt records the Dealivra payment status. It is not a bank statement or legal escrow certificate.'))}</p></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));<\/script></body></html>`);
  popup.document.close();
  return true;
}

export function DealPaymentWorkspace({
  deal,
  session,
  onChanged,
}: {
  deal: Deal;
  session: StoredSession;
  onChanged: (ready: boolean) => void;
}) {
  const [payment, setPayment] = useState<ProtectedPaymentStatus | null>(null);
  const [connect, setConnect] = useState<StripeConnectStatus | null>(null);
  const [plan, setPlan] = useState<DealActionPlan | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'connect' | 'checkout' | ''>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let current = true;
    setLoaded(false);
    const load = async () => {
      try {
        const [next, account] = await Promise.all([
          getProtectedPaymentStatus(session, deal.id),
          getStripeConnectStatus(session),
        ]);
        const actionPlan = await getDealActionPlan(session, deal.id).catch(
          () => null,
        );
        if (!current) return;
        setPayment(next);
        setConnect(account);
        setPlan(actionPlan);
        onChanged(
          ['funds_secured', 'release_pending', 'released'].includes(next.status),
        );
      } catch (error) {
        if (!current) return;
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load protected payment',
        );
        onChanged(false);
      } finally {
        if (current) setLoaded(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [deal.id, session.accessToken]);

  const startOnboarding = async () => {
    setBusy('connect');
    setMessage('');
    try {
      const result = await startStripeConnectOnboarding(session, deal.publicId);
      window.location.assign(result.url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not open Stripe onboarding',
      );
    } finally {
      setBusy('');
    }
  };

  const checkout = async () => {
    setBusy('checkout');
    setMessage('');
    try {
      const result = await createProtectedCheckout(session, deal.id);
      window.location.assign(result.url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not open secure checkout',
      );
      setBusy('');
    }
  };

  if (!loaded) return null;
  const state = payment?.status || 'not_started';
  const ready = Boolean(payment?.seller_payouts_ready || connect?.ready);
  const secured = ['funds_secured', 'release_pending', 'released'].includes(
    state,
  );
  const terminal = [
    'failed',
    'expired',
    'cancelled',
    'refunded',
    'disputed',
    'release_failed',
  ].includes(state);
  const released = state === 'released';
  const shipped =
    deal.deliveryMethod === 'Meet in person'
      ? plan?.meeting_status === 'confirmed'
      : Boolean(plan?.shipment_status);
  const tracking =
    deal.deliveryMethod === 'Meet in person'
      ? Boolean(plan?.inspection_recorded)
      : plan?.shipment_status === 'delivered' ||
        Boolean(plan?.inspection_recorded);
  const buyerConfirmed =
    deal.status === 'completed' || plan?.deal_status === 'completed';
  const paymentMilestones = [
    {
      label: 'Payment',
      detail: payment?.paid_at
        ? formatDateTime(payment.paid_at)
        : t(protectedPaymentLabels[state]),
      done: secured,
    },
    {
      label: deal.deliveryMethod === 'Meet in person' ? 'Handoff' : 'Delivery',
      detail: shipped ? t('Recorded') : t('Next'),
      done: shipped,
    },
    {
      label: 'Buyer approval',
      detail: buyerConfirmed ? t('Confirmed') : t('Waiting'),
      done: buyerConfirmed,
    },
    {
      label: 'Seller payout',
      detail: released ? t('Released') : t('Pending'),
      done: released,
    },
  ];
  const paymentFlow = [
    {
      label: 'Buyer pays',
      detail:
        state === 'not_started' ? t('Waiting to start') : t('Checkout started'),
      done: secured,
    },
    {
      label: 'Stripe Checkout',
      detail: state === 'not_started' ? t('Not started') : t('Card payment'),
      done: state !== 'not_started',
    },
    {
      label: 'Payment confirmed',
      detail: payment?.paid_at
        ? formatDateTime(payment.paid_at)
        : t('Waiting for Stripe'),
      done: secured,
    },
    {
      label:
        deal.deliveryMethod === 'Meet in person'
          ? 'Seller meets buyer'
          : 'Seller ships',
      detail: shipped ? t('Recorded') : t('Waiting for next step'),
      done: shipped,
    },
    {
      label:
        deal.deliveryMethod === 'Meet in person'
          ? 'Handoff verification'
          : 'Tracking verification',
      detail: tracking ? t('Recorded') : t('Waiting for confirmation'),
      done: tracking,
    },
    {
      label: 'Buyer confirmation',
      detail: buyerConfirmed ? t('Deal completed') : t('Waiting for buyer'),
      done: buyerConfirmed,
    },
    {
      label: 'Stripe releases funds',
      detail: released ? t('Transfer created') : t('After confirmation'),
      done: released,
    },
    {
      label: 'Seller paid',
      detail: released ? t('Transfer complete') : t('Pending release'),
      done: released,
    },
    {
      label: 'Dealivra commission',
      detail: payment?.platform_fee_cents
        ? formatMoney(
            Number(payment.platform_fee_cents),
            payment.currency,
            getAppLanguage(),
          )
        : t('Configured at checkout'),
      done: released,
    },
  ];

  return (
    <section
      className="payment-status no-print"
      id="payment-status-panel"
    >
      <div className="payment-status-heading">
        <span className="workflow-icon">
          <BadgeDollarSign />
        </span>
        <div>
          <p className="eyebrow">{t('Stripe payment')}</p>
          <h2>{t('Payment status')}</h2>
          <p>{t('A clear record from checkout to seller payout.')}</p>
        </div>
        <strong className="payment-amount">{dealPrice(deal)}</strong>
      </div>
      <div
        className={`protected-payment-state ${secured ? 'success' : terminal ? 'warning' : ''}`}
      >
        <span>
          <i aria-hidden="true" />
          {t(protectedPaymentLabels[state])}
        </span>
        {payment?.paid_at && <small>{formatDateTime(payment.paid_at)}</small>}
      </div>
      <ol
        className="payment-milestones"
        aria-label={t('Payment progress')}
      >
        {paymentMilestones.map((step, index) => (
          <li
            className={
              step.done
                ? 'done'
                : index === paymentMilestones.findIndex((item) => !item.done)
                  ? 'current'
                  : ''
            }
            key={step.label}
          >
            <span>{step.done ? <Check size={15} /> : index + 1}</span>
            <div>
              <b>{t(step.label)}</b>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      {deal.viewerRole === 'seller' &&
        !ready &&
        state === 'not_started' && (
          <div className="payment-next-step">
            <ShieldCheck />
            <div>
              <b>{t('Connect Stripe payouts')}</b>
              <span>
                {t(
                  'Complete Stripe onboarding before a buyer can pay this deal.',
                )}
              </span>
            </div>
            <button
              className="primary"
              disabled={busy === 'connect'}
              onClick={startOnboarding}
            >
              {t(busy === 'connect' ? 'Opening…' : 'Connect Stripe')}
            </button>
          </div>
        )}
      {deal.viewerRole === 'seller' &&
        ready &&
        state === 'not_started' && (
          <div className="payment-wait">
            <Clock3 />
            {t(
              'Stripe payouts are connected. Waiting for the buyer to pay.',
            )}
          </div>
        )}
      {deal.viewerRole === 'buyer' &&
        state === 'not_started' &&
        !ready && (
          <div className="payment-wait">
            <Clock3 />
            {t('Waiting for the seller to finish Stripe payout setup.')}
          </div>
        )}
      {deal.viewerRole === 'buyer' &&
        state === 'not_started' &&
        ready &&
        deal.status === 'accepted' && (
          <div className="payment-actions">
            <button
              className="primary"
              disabled={busy === 'checkout'}
              onClick={checkout}
            >
              <BadgeDollarSign size={17} />
              {t(
                busy === 'checkout'
                  ? 'Opening Stripe Sandbox…'
                  : 'Open Stripe Sandbox checkout',
              )}
            </button>
          </div>
        )}
      {state === 'checkout_created' && deal.viewerRole === 'buyer' && (
        <div className="payment-actions">
          <button
            className="primary"
            disabled={busy === 'checkout'}
            onClick={checkout}
          >
            {t('Continue Stripe Sandbox checkout')}
          </button>
        </div>
      )}
      {state === 'processing' && (
        <div className="payment-wait">
          <Clock3 />
          {t(
            'Stripe is processing the payment. This page will update automatically.',
          )}
        </div>
      )}
      {state === 'funds_secured' && deal.status === 'completed' && (
        <div className="payment-wait">
          <ShieldCheck />
          {t(
            'Delivery is complete. Seller payout is waiting for Dealivra operations review.',
          )}
        </div>
      )}
      {state === 'released' && (
        <div className="payment-wait">
          <Check />
          {t('Payment has been released to the seller.')}
        </div>
      )}
      {payment?.failure_message && (
        <div className="notice">{t(payment.failure_message)}</div>
      )}
      {message && (
        <div className="notice" role="status" aria-live="polite">
          {t(message)}
        </div>
      )}
      <details className="payment-details">
        <summary>
          <span>{t('Payment events and fee details')}</span>
          <ChevronDown />
        </summary>
        <div
          className="payment-flow"
          aria-label={t('Payment flow')}
        >
          {paymentFlow.map((step) => (
            <article
              className={`payment-flow-step ${step.done ? 'done' : ''}`}
              key={step.label}
            >
              {step.done ? <Check size={17} /> : <Clock3 size={17} />}
              <span>
                <b>{t(step.label)}</b>
                <small>{step.detail}</small>
              </span>
            </article>
          ))}
        </div>
        <p className="payment-disclaimer">
          <ShieldCheck />
          {t(
            'Payments are processed in Stripe Sandbox. Dealivra never stores card or bank details. This beta is not legal escrow.',
          )}
        </p>
      </details>
    </section>
  );
}

export function ProtectedPaymentReceipt({
  deal,
  session,
}: {
  deal: Deal;
  session: StoredSession;
}) {
  const [payment, setPayment] = useState<ProtectedPaymentStatus | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    const load = () =>
      getProtectedPaymentStatus(session, deal.id)
        .then((result) => {
          if (current) setPayment(result);
        })
        .catch(() => {});
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [deal.id, session.accessToken]);

  if (!payment || payment.status === 'not_started') return null;
  const money = (amount: number) =>
    formatMoney(amount, payment.currency, getAppLanguage());
  const paid = Boolean(payment.paid_at);
  const receiptTitle = t(paid ? 'Payment receipt' : 'Payment breakdown');
  const finalEvent = payment.refunded_at
    ? { label: 'Refunded at', value: formatDateTime(payment.refunded_at) }
    : payment.disputed_at
      ? { label: 'Disputed at', value: formatDateTime(payment.disputed_at) }
      : {
          label: 'Released at',
          value: payment.released_at
            ? formatDateTime(payment.released_at)
            : t('Not released yet'),
        };
  const firstEvent = payment.paid_at
    ? { label: 'Paid at', value: formatDateTime(payment.paid_at) }
    : payment.checkout_expires_at
      ? {
          label: 'Checkout expires at',
          value: formatDateTime(payment.checkout_expires_at),
        }
      : { label: 'Paid at', value: t('Pending') };
  const printReceipt = () => {
    setMessage('');
    if (!printProtectedPaymentReceipt(deal, payment))
      setMessage('Allow pop-ups to print the payment receipt.');
  };

  return (
    <section
      className="payment-receipt"
      aria-labelledby="payment-receipt-title"
    >
      <div className="payment-receipt-heading">
        <div className="payment-receipt-title">
          <BadgeDollarSign />
          <div>
            <p className="eyebrow">{t('Transparent fee record')}</p>
            <h2 id="payment-receipt-title">{receiptTitle}</h2>
            <span>
              {t('Deal reference')}: <b>{deal.publicId}</b>
            </span>
          </div>
        </div>
        <button
          className="secondary no-print"
          onClick={printReceipt}
        >
          <FileDown size={18} />
          {t('Print payment receipt')}
        </button>
      </div>
      {!paid && (
        <div className="payment-receipt-unpaid">
          <ShieldAlert size={18} />
          <strong>{t('Not paid')}</strong>
          <span>{t('This checkout has not been paid yet.')}</span>
        </div>
      )}
      <div className="payment-receipt-grid">
        <article>
          <span>{t('Item amount')}</span>
          <strong>{money(payment.item_amount_cents)}</strong>
        </article>
        <article>
          <span>{t('Dealivra service fee')}</span>
          <strong>{money(payment.platform_fee_cents)}</strong>
        </article>
        <article className="payment-receipt-net">
          <span>{t('Seller payout')}</span>
          <strong>{money(payment.seller_amount_cents)}</strong>
        </article>
        <article>
          <span>{t('Payment status')}</span>
          <strong>{t(protectedPaymentLabels[payment.status])}</strong>
        </article>
        <article>
          <span>{t(firstEvent.label)}</span>
          <strong>{firstEvent.value}</strong>
        </article>
        <article>
          <span>{t(finalEvent.label)}</span>
          <strong>{finalEvent.value}</strong>
        </article>
      </div>
      <p className="payment-receipt-note">
        <ShieldCheck size={17} />
        <span>
          {t(
            payment.status === 'released'
              ? 'Service fee earned after seller payout'
              : 'Service fee allocated at checkout',
          )}
          .{' '}
          {t(
            'Stripe processing fees are separate and are not included in the Dealivra service fee.',
          )}
        </span>
      </p>
      <p className="payment-receipt-legal">
        {t(
          'This receipt records the Dealivra payment status. It is not a bank statement or legal escrow certificate.',
        )}
      </p>
      {message && (
        <div
          className="notice no-print"
          role="status"
          aria-live="polite"
        >
          {t(message)}
        </div>
      )}
    </section>
  );
}
