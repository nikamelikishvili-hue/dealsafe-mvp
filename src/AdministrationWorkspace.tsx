import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  Check,
  CircleCheckBig,
  FileCheck2,
  FileDown,
  LockKeyhole,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { formatMoney } from './currency';
import { useConfirmAction } from './ConfirmActionDialog';
import type { Deal } from './domain';
import { EvidenceLifecycleCenter } from './EvidenceLifecycleCenter';
import { EvidenceViewer } from './EvidenceViewer';
import { evidenceLabels } from './DealEvidenceWorkspace';
import { getAppLanguage, t } from './i18n';
import {
  getAdminCatalogAdoption,
  getAdminDisputes,
  getAdminReports,
  getAdminRevenueSummary,
  getAdminRevenueTransactions,
  getPublicDeal,
  listDealEvidence,
  resolveAdminDispute,
  resolveAdminDisputeFinancial,
  resolveAdminReport,
  setAdminDealVisibility,
  type AdminCatalogAdoption,
  type AdminDispute,
  type AdminReport,
  type AdminRevenueSummary,
  type AdminRevenueTransaction,
  type DealEvidence,
  type StoredSession,
} from './services/supabaseRest';
import { smartCatalogVersion } from './smartCatalog';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

interface AdministrationWorkspaceProps {
  session: StoredSession;
  onBack: () => void;
  onOpenDeal: (deal: Deal) => void;
}

export function AdministrationWorkspace({
  session,
  onBack,
  onOpenDeal,
}: AdministrationWorkspaceProps) {
  return (
    <>
      <EvidenceLifecycleCenter session={session} />
      <AdminCatalogCenter session={session} />
      <AdminRevenueCenter session={session} onOpenDeal={onOpenDeal} />
      <AdminDisputeCenter session={session} />
      <AdminReportCenter
        session={session}
        onBack={onBack}
        onOpenDeal={onOpenDeal}
      />
    </>
  );
}

function AdminCatalogCenter({ session }: { session: StoredSession }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [rows, setRows] = useState<AdminCatalogAdoption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const requestRef = useRef(0);

  const load = useCallback(
    async (activeDays = days) => {
      const request = ++requestRef.current;
      setLoading(true);
      setMessage('');
      try {
        const next = await getAdminCatalogAdoption(session, activeDays);
        if (request !== requestRef.current) return;
        setRows(next);
      } catch (error) {
        if (request !== requestRef.current) return;
        setRows([]);
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load catalog adoption',
        );
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [days, session.accessToken],
  );

  useEffect(() => {
    void load(days);
    return () => {
      requestRef.current += 1;
    };
  }, [days, load]);

  const metrics = useMemo(() => {
    const totals = rows.reduce(
      (summary, row) => ({
        deals: summary.deals + Number(row.deal_count || 0),
        brands: summary.brands + Number(row.structured_brand_count || 0),
        models: summary.models + Number(row.structured_model_count || 0),
        fallbacks:
          summary.fallbacks + Number(row.manual_fallback_count || 0),
      }),
      { deals: 0, brands: 0, models: 0, fallbacks: 0 },
    );
    const percent = (value: number) =>
      totals.deals ? `${Math.round((value / totals.deals) * 100)}%` : '0%';
    const activeVersionDeals = rows
      .filter((row) => row.catalog_version === smartCatalogVersion)
      .reduce((total, row) => total + Number(row.deal_count || 0), 0);
    return [
      {
        label: 'Active version adoption',
        value: percent(activeVersionDeals),
        detail: `Catalog ${smartCatalogVersion}`,
      },
      {
        label: 'Structured brand coverage',
        value: percent(totals.brands),
        detail: `${totals.brands} of ${totals.deals} deals`,
      },
      {
        label: 'Structured model coverage',
        value: percent(totals.models),
        detail: `${totals.models} of ${totals.deals} deals`,
      },
      {
        label: 'Manual fallback',
        value: percent(totals.fallbacks),
        detail: `${totals.fallbacks} deals need coverage review`,
      },
    ];
  }, [rows]);

  return (
    <section className="admin-catalog">
      <div className="admin-catalog-heading">
        <div className="admin-catalog-title">
          <Boxes />
          <div>
            <p className="eyebrow">{t('Catalog operations')}</p>
            <h2>{t('Catalog governance')}</h2>
            <span>
              {t(
                'Monitor version adoption and manual fallback without exposing deal or participant identifiers.',
              )}
            </span>
          </div>
        </div>
        <div className="admin-catalog-controls">
          <label>
            {t('Window')}
            <select
              value={days}
              onChange={(event) =>
                setDays(Number(event.target.value) as 7 | 30 | 90)
              }
            >
              <option value={7}>{t('7 days')}</option>
              <option value={30}>{t('30 days')}</option>
              <option value={90}>{t('90 days')}</option>
            </select>
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() => void load()}
            disabled={loading}
          >
            {t(loading ? 'Refreshing…' : 'Refresh')}
          </button>
        </div>
      </div>
      <div className="admin-catalog-release">
        <CircleCheckBig />
        <div>
          <b>{t('Active governed release')}</b>
          <span>
            {smartCatalogVersion} · U.S. launch catalog ·{' '}
            {t('historical deal versions remain unchanged')}
          </span>
        </div>
      </div>
      {message && (
        <div className="notice" role="alert">
          {t(message)}
        </div>
      )}
      {loading && !rows.length ? (
        <div className="admin-catalog-empty" role="status">
          {t('Loading catalog adoption…')}
        </div>
      ) : (
        <>
          <div className="admin-catalog-grid">
            {metrics.map((card) => (
              <article key={card.label}>
                <span>{t(card.label)}</span>
                <strong>{card.value}</strong>
                <small>{t(card.detail)}</small>
              </article>
            ))}
          </div>
          <div className="admin-catalog-table-wrap">
            <table className="admin-catalog-table">
              <thead>
                <tr>
                  <th>{t('Version and category')}</th>
                  <th>{t('Deals')}</th>
                  <th>{t('Brand')}</th>
                  <th>{t('Model')}</th>
                  <th>{t('Fallback')}</th>
                  <th>{t('Lifecycle')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.catalog_version}-${row.category_id}`}>
                    <td>
                      <b>{row.category_id.replaceAll('-', ' ')}</b>
                      <small>{row.catalog_version}</small>
                    </td>
                    <td>{row.deal_count}</td>
                    <td>{row.structured_brand_count}</td>
                    <td>{row.structured_model_count}</td>
                    <td>
                      <span
                        className={
                          Number(row.manual_fallback_count) > 0
                            ? 'needs-review'
                            : ''
                        }
                      >
                        {row.manual_fallback_count}
                      </span>
                    </td>
                    <td>
                      <small>
                        {row.draft_count} {t('draft')} · {row.published_count}{' '}
                        {t('published')} · {row.accepted_count} {t('accepted')} ·{' '}
                        {row.completed_count} {t('completed')}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !message && (
              <div className="admin-catalog-empty">
                {t(`No catalog activity in the last ${days} days.`)}
              </div>
            )}
          </div>
          <p className="admin-catalog-note">
            <ShieldCheck size={16} />
            {t(
              'Only aggregate version and category counts are returned. Deal IDs, people, addresses, serials, evidence, and payments are excluded.',
            )}
          </p>
        </>
      )}
    </section>
  );
}

function AdminEvidenceReview({
  dispute,
  session,
}: {
  dispute: AdminDispute;
  session: StoredSession;
}) {
  const [items, setItems] = useState<DealEvidence[]>([]);
  const [selected, setSelected] = useState<DealEvidence | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    setMessage('');
    setSelected(null);
    void listDealEvidence(session, dispute.deal_id)
      .then((next) => {
        if (current) setItems(next);
      })
      .catch((error) => {
        if (current) {
          setMessage(
            error instanceof Error ? error.message : 'Could not load evidence',
          );
        }
      });
    return () => {
      current = false;
    };
  }, [dispute.deal_id, session.accessToken]);

  const verified = (id: string, checkedAt: string) =>
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              integrity_status: 'verified',
              integrity_checked_at: checkedAt,
            }
          : item,
      ),
    );

  return (
    <div className="admin-evidence-review">
      <div className="admin-evidence-heading">
        <b>{t('Evidence files')}</b>
        <span>
          {items.length} {t(items.length === 1 ? 'file' : 'files')}
        </span>
      </div>
      {message && (
        <div className="notice" role="alert">
          {t(message)}
        </div>
      )}
      {items.length ? (
        items.map((item) => (
          <article key={item.id}>
            <div className="admin-evidence-preview">
              <FileCheck2 size={20} />
            </div>
            <div>
              <b>{t(evidenceLabels[item.evidence_type] || 'Other evidence')}</b>
              <span>
                {item.file_name || t('Uploaded file')} · {item.uploader_role} ·{' '}
                {item.sha256
                  ? `SHA-256 ${item.sha256.slice(0, 12)}…`
                  : t('Fingerprint unavailable')}
              </span>
              <span>
                {t(
                  item.integrity_status === 'verified'
                    ? 'Integrity verified'
                    : item.integrity_status === 'unverified'
                      ? 'Integrity check required'
                      : 'File blocked by integrity check',
                )}
              </span>
            </div>
            {item.scan_status === 'clean' ? (
              <button
                type="button"
                className="secondary"
                onClick={() => setSelected(item)}
              >
                {t('Verify and open')}
              </button>
            ) : (
              <em>{t('Security review required')}</em>
            )}
          </article>
        ))
      ) : (
        <p>{t('No evidence uploaded yet.')}</p>
      )}
      {selected && (
        <EvidenceViewer
          item={selected}
          label={evidenceLabels[selected.evidence_type] || 'Other evidence'}
          session={session}
          onClose={() => setSelected(null)}
          onVerified={(checkedAt) => verified(selected.id, checkedAt)}
        />
      )}
    </div>
  );
}

interface AdminRevenueCenterProps {
  session: StoredSession;
  onOpenDeal: (deal: Deal) => void;
}

function AdminRevenueCenter({
  session,
  onOpenDeal,
}: AdminRevenueCenterProps) {
  const [summary, setSummary] = useState<AdminRevenueSummary | null>(null);
  const [transactions, setTransactions] = useState<
    AdminRevenueTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [transactionsMessage, setTransactionsMessage] = useState('');
  const [transactionQuery, setTransactionQuery] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('all');
  const [openingDeal, setOpeningDeal] = useState('');
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setMessage('');
    setTransactionsMessage('');
    const [summaryResult, transactionsResult] = await Promise.allSettled([
      getAdminRevenueSummary(session),
      getAdminRevenueTransactions(session, 100),
    ]);
    if (request !== requestRef.current) return;

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setMessage(
        summaryResult.reason instanceof Error
          ? summaryResult.reason.message
          : 'Could not load revenue summary',
      );
    }
    if (transactionsResult.status === 'fulfilled') {
      setTransactions(transactionsResult.value);
    } else {
      setTransactionsMessage(
        transactionsResult.reason instanceof Error
          ? transactionsResult.reason.message
          : 'Could not load revenue transactions',
      );
    }
    setLoading(false);
  }, [session.accessToken]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const filteredTransactions = useMemo(() => {
    const query = transactionQuery.trim().toLowerCase();
    return transactions.filter((item) => {
      const matchesQuery =
        !query ||
        [item.public_id, item.title, item.seller_name, item.buyer_name].some(
          (value) => String(value || '').toLowerCase().includes(query),
        );
      const matchesStatus =
        transactionStatus === 'all' || item.status === transactionStatus;
      return matchesQuery && matchesStatus;
    });
  }, [transactionQuery, transactionStatus, transactions]);

  const transactionStatuses = useMemo(
    () => Array.from(new Set(transactions.map((item) => item.status))).sort(),
    [transactions],
  );

  const cards = useMemo(() => {
    if (!summary) return [];
    const money = (cents: number) =>
      formatMoney(
        Number(cents || 0),
        summary.currency,
        getAppLanguage(),
      );
    return [
      {
        label: 'Payment volume',
        value: money(summary.total_payment_volume_cents),
        detail: `${summary.payment_count} ${t(
          summary.payment_count === 1 ? 'payment' : 'payments',
        )}`,
        tone: 'neutral',
      },
      {
        label: 'Dealivra commission earned',
        value: money(summary.total_commission_earned_cents),
        detail: `${summary.released_count} ${t(
          summary.released_count === 1 ? 'released deal' : 'released deals',
        )}`,
        tone: 'green',
      },
      {
        label: 'Released to sellers',
        value: money(summary.total_released_to_sellers_cents),
        detail: t('Completed payouts'),
        tone: 'green',
      },
      {
        label: 'Funds currently protected',
        value: money(summary.total_protected_cents),
        detail: t('Awaiting release or review'),
        tone: 'gold',
      },
      {
        label: 'Refunded to buyers',
        value: money(summary.total_refunded_cents),
        detail: `${summary.refunded_count} ${t(
          summary.refunded_count === 1 ? 'refund' : 'refunds',
        )}`,
        tone: 'rose',
      },
      {
        label: 'Open disputes',
        value: String(summary.disputed_count),
        detail: t('Needs admin review'),
        tone: 'gold',
      },
    ];
  }, [summary]);

  const openDeal = async (publicId: string) => {
    if (openingDeal) return;
    setOpeningDeal(publicId);
    setTransactionsMessage('');
    try {
      onOpenDeal(await getPublicDeal(publicId));
    } catch (error) {
      setTransactionsMessage(
        error instanceof Error ? error.message : 'Deal Link is unavailable',
      );
    } finally {
      setOpeningDeal('');
    }
  };

  const exportCsv = () => {
    if (!filteredTransactions.length) return;
    const cell = (value: unknown) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      [
        'Dealivra ID',
        'Title',
        'Status',
        'Gross USD',
        'Dealivra fee allocation USD',
        'Seller amount USD',
        'Seller',
        'Buyer',
        'Created',
      ],
      ...filteredTransactions.map((item) => [
        item.public_id,
        item.title,
        item.status,
        (Number(item.item_amount_cents) / 100).toFixed(2),
        (Number(item.platform_fee_cents) / 100).toFixed(2),
        (Number(item.seller_amount_cents) / 100).toFixed(2),
        item.seller_name,
        item.buyer_name,
        item.created_at,
      ]),
    ];
    const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dealivra-revenue-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="admin-revenue">
      <div className="admin-revenue-heading">
        <div className="admin-revenue-title">
          <BadgeDollarSign />
          <div>
            <p className="eyebrow">{t('Administrator finances')}</p>
            <h2>{t('Revenue dashboard')}</h2>
            <span>
              {t(
                'Track payment volume, earned commission, protected funds, and payouts in one place.',
              )}
            </span>
          </div>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          {t(loading ? 'Refreshing…' : 'Refresh')}
        </button>
      </div>
      {message && (
        <div className="notice" role="alert">
          {t(message)}
        </div>
      )}
      {loading && !summary ? (
        <div className="admin-revenue-loading" role="status">
          {t('Loading revenue summary…')}
        </div>
      ) : summary ? (
        <>
          <div className="admin-revenue-grid">
            {cards.map((card) => (
              <article
                className={`admin-revenue-card ${card.tone}`}
                key={card.label}
              >
                <span>{t(card.label)}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </article>
            ))}
          </div>
          <p className="admin-revenue-note">
            <ShieldCheck size={16} />
            {t(
              'Commission earned is counted only after funds are released to the seller. Stripe processing fees are shown separately in Stripe and are not included in Dealivra commission.',
            )}
          </p>
          <div className="admin-revenue-ledger">
            <div className="admin-revenue-ledger-heading">
              <div>
                <p className="eyebrow">{t('Payment activity')}</p>
                <h3>{t('Recent transactions')}</h3>
                <span>
                  {t(
                    'Review the latest protected payments and fee allocations.',
                  )}
                </span>
              </div>
              <button
                className="secondary"
                type="button"
                onClick={exportCsv}
                disabled={!filteredTransactions.length}
              >
                <FileDown size={16} />
                {t('Export CSV')}
              </button>
            </div>
            <div className="admin-revenue-filters">
              <label>
                <Search size={16} />
                <input
                  value={transactionQuery}
                  onChange={(event) => setTransactionQuery(event.target.value)}
                  placeholder={t('Search transactions')}
                  aria-label={t('Search transactions')}
                />
              </label>
              <select
                value={transactionStatus}
                onChange={(event) => setTransactionStatus(event.target.value)}
                aria-label={t('Filter by status')}
              >
                <option value="all">{t('All statuses')}</option>
                {transactionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(status.replaceAll('_', ' '))}
                  </option>
                ))}
              </select>
              <span>
                {filteredTransactions.length} / {transactions.length}
              </span>
            </div>
            {transactionsMessage && (
              <div className="notice" role="alert">
                {t(transactionsMessage)}
              </div>
            )}
            {filteredTransactions.length ? (
              <div className="admin-revenue-table-wrap">
                <table className="admin-revenue-table">
                  <thead>
                    <tr>
                      <th>{t('Deal')}</th>
                      <th>{t('Status')}</th>
                      <th>{t('Gross')}</th>
                      <th>{t('Dealivra fee')}</th>
                      <th>{t('Seller amount')}</th>
                      <th>{t('Created')}</th>
                      <th className="action-heading">{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((item) => (
                      <tr key={item.transaction_id}>
                        <td>
                          <b>{item.title}</b>
                          <small>{item.public_id}</small>
                        </td>
                        <td>
                          <span className={`status ${item.status}`}>
                            {t(item.status.replaceAll('_', ' '))}
                          </span>
                        </td>
                        <td>
                          {formatMoney(
                            Number(item.item_amount_cents),
                            item.currency,
                            getAppLanguage(),
                          )}
                        </td>
                        <td>
                          {formatMoney(
                            Number(item.platform_fee_cents),
                            item.currency,
                            getAppLanguage(),
                          )}
                        </td>
                        <td>
                          {formatMoney(
                            Number(item.seller_amount_cents),
                            item.currency,
                            getAppLanguage(),
                          )}
                        </td>
                        <td>{formatDateTime(item.created_at)}</td>
                        <td className="table-open-cell">
                          <button
                            className="table-open secondary"
                            type="button"
                            disabled={Boolean(openingDeal)}
                            onClick={() => void openDeal(item.public_id)}
                          >
                            {t(
                              openingDeal === item.public_id
                                ? 'Opening'
                                : 'Open Deal Link',
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : transactions.length ? (
              <div className="admin-revenue-loading">
                {t('No matching transactions.')}
              </div>
            ) : (
              !transactionsMessage && (
                <div className="admin-revenue-loading">
                  {t('No payment activity yet.')}
                </div>
              )
            )}
          </div>
        </>
      ) : (
        <div className="admin-revenue-loading">
          {t('Revenue summary is unavailable.')}
        </div>
      )}
    </section>
  );
}

function AdminDisputeCenter({ session }: { session: StoredSession }) {
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageFailed, setMessageFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const savingRef = useRef(false);
  const requestRef = useRef(0);
  const { confirmAction, confirmDialog } = useConfirmAction();

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setMessage('');
    setMessageFailed(false);
    try {
      const next = await getAdminDisputes(session, filter);
      if (request === requestRef.current) setDisputes(next);
    } catch (error) {
      if (request === requestRef.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load dispute queue',
        );
        setMessageFailed(true);
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filter, session.accessToken]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const decide = async (
    dispute: AdminDispute,
    decision: 'resolved_buyer' | 'resolved_seller' | 'cancelled',
  ) => {
    const note = (notes[dispute.dispute_id] || '').trim();
    if (note.length < 3 || savingRef.current) return;
    savingRef.current = true;
    const prompt =
      decision === 'resolved_buyer'
        ? 'Resolve for buyer and issue a full Stripe refund?'
        : decision === 'resolved_seller'
          ? 'Resolve for seller and release the protected Stripe funds?'
          : 'Close this dispute without moving funds?';
    const confirmed = await confirmAction({
      title: t('Confirm dispute decision'),
      description: t(prompt),
      confirmLabel: t(
        decision === 'resolved_buyer'
          ? 'Resolve for buyer'
          : decision === 'resolved_seller'
            ? 'Resolve for seller'
            : 'Close dispute',
      ),
      tone: decision === 'cancelled' ? 'default' : 'danger',
    });
    if (!confirmed) {
      savingRef.current = false;
      return;
    }
    setSaving(dispute.dispute_id);
    setMessage('');
    setMessageFailed(false);
    try {
      if (decision === 'cancelled') {
        await resolveAdminDispute(
          session,
          dispute.dispute_id,
          decision,
          note,
        );
      } else {
        await resolveAdminDisputeFinancial(
          session,
          dispute.dispute_id,
          decision,
          note,
        );
      }
      setDisputes((items) =>
        filter === 'all'
          ? items.map((item) =>
              item.dispute_id === dispute.dispute_id
                ? {
                    ...item,
                    dispute_status: decision,
                    resolution_note: note,
                    payment_status:
                      decision === 'resolved_buyer'
                        ? 'refunded'
                        : decision === 'resolved_seller'
                          ? 'released'
                          : item.payment_status,
                  }
                : item,
            )
          : items.filter(
              (item) => item.dispute_id !== dispute.dispute_id,
            ),
      );
      setMessage(
        decision === 'resolved_buyer'
          ? 'Dispute resolved and buyer refunded.'
          : decision === 'resolved_seller'
            ? 'Dispute resolved and funds released to seller.'
            : 'Dispute closed.',
      );
      setMessageFailed(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not resolve dispute',
      );
      setMessageFailed(true);
    } finally {
      savingRef.current = false;
      setSaving('');
    }
  };

  return (
    <>
    <section className="admin-disputes">
      <div className="admin-disputes-heading">
        <Scale />
        <div>
          <p className="eyebrow">{t('Buyer and seller protection')}</p>
          <h2>{t('Dispute review')}</h2>
          <span>
            {t('Compare both parties’ evidence before recording a decision.')}
          </span>
        </div>
      </div>
      <div className="admin-filters">
        {(['open', 'resolved', 'all'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? 'active' : ''}
            onClick={() => setFilter(item)}
          >
            {t(
              item === 'open'
                ? 'Open disputes'
                : item === 'resolved'
                  ? 'Resolved'
                  : 'All disputes',
            )}
          </button>
        ))}
      </div>
      {message && (
        <div
          className={`notice ${messageFailed ? 'error' : ''}`}
          role={messageFailed ? 'alert' : 'status'}
          aria-live={messageFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      {loading ? (
        <div className="admin-empty" role="status">
          {t('Loading disputes…')}
        </div>
      ) : disputes.length ? (
        <div className="admin-dispute-list">
          {disputes.map((dispute) => {
            const note = (notes[dispute.dispute_id] || '').trim();
            const isOpen = [
              'open',
              'evidence_requested',
              'under_review',
            ].includes(dispute.dispute_status);
            return (
              <article key={dispute.dispute_id}>
                <div className="admin-dispute-top">
                  <div>
                    <div className="admin-dispute-badges">
                      <span className={`status ${dispute.dispute_status}`}>
                        {t(dispute.dispute_status.replaceAll('_', ' '))}
                      </span>
                      <span className="status moderation-visible">
                        {t(dispute.payment_status.replaceAll('_', ' '))}
                      </span>
                    </div>
                    <h3>{dispute.title}</h3>
                    <small>
                      {dispute.public_id} · {formatDateTime(dispute.opened_at)}
                    </small>
                  </div>
                  <strong>
                    {formatMoney(
                      Number(dispute.item_amount_cents),
                      dispute.currency,
                      getAppLanguage(),
                    )}
                  </strong>
                </div>
                <p className="admin-dispute-reason">{dispute.reason}</p>
                <div className="admin-dispute-people">
                  <span>
                    {t('Opened by')}
                    <b>{dispute.opened_by_name}</b>
                  </span>
                  <span>
                    {t('Seller')}
                    <b>{dispute.seller_name}</b>
                  </span>
                  <span>
                    {t('Buyer')}
                    <b>{dispute.buyer_name}</b>
                  </span>
                  <span>
                    {t('Response deadline')}
                    <b>{formatDateTime(dispute.response_deadline)}</b>
                  </span>
                </div>
                <button
                  className="secondary admin-evidence-toggle"
                  type="button"
                  onClick={() =>
                    setExpanded(
                      expanded === dispute.dispute_id
                        ? null
                        : dispute.dispute_id,
                    )
                  }
                >
                  <ShieldCheck size={16} />
                  {t(
                    expanded === dispute.dispute_id
                      ? 'Hide evidence'
                      : 'Review evidence',
                  )}
                </button>
                {expanded === dispute.dispute_id && (
                  <AdminEvidenceReview dispute={dispute} session={session} />
                )}
                {isOpen ? (
                  <div className="admin-dispute-decision">
                    <label>
                      {t('Decision note')}
                      <textarea
                        required
                        minLength={3}
                        maxLength={1000}
                        value={notes[dispute.dispute_id] || ''}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [dispute.dispute_id]: event.target.value,
                          }))
                        }
                        placeholder={t(
                          'Explain what evidence was checked and the next payment action.',
                        )}
                      />
                    </label>
                    <div>
                      <button
                        className="secondary"
                        type="button"
                        disabled={Boolean(saving) || note.length < 3}
                        onClick={() => void decide(dispute, 'cancelled')}
                      >
                        {t('Close dispute')}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={Boolean(saving) || note.length < 3}
                        onClick={() =>
                          void decide(dispute, 'resolved_buyer')
                        }
                      >
                        {t('Resolve for buyer')}
                      </button>
                      <button
                        className="primary"
                        type="button"
                        disabled={Boolean(saving) || note.length < 3}
                        onClick={() =>
                          void decide(dispute, 'resolved_seller')
                        }
                      >
                        {t('Resolve for seller')}
                      </button>
                    </div>
                  </div>
                ) : (
                  dispute.resolution_note && (
                    <div className="admin-resolution">
                      <b>{t('Decision note')}</b>
                      <p>{dispute.resolution_note}</p>
                    </div>
                  )
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty">
          <Check />
          <b>{t('No disputes in this queue.')}</b>
        </div>
      )}
      <p className="admin-dispute-note">
        <LockKeyhole size={16} />
        {t(
          'Buyer and seller resolutions perform the confirmed Stripe refund or release. Closing a dispute moves no funds.',
        )}
      </p>
    </section>
    {confirmDialog}
    </>
  );
}

interface AdminReportCenterProps {
  session: StoredSession;
  onBack: () => void;
  onOpenDeal: (deal: Deal) => void;
}

function AdminReportCenter({
  session,
  onBack,
  onOpenDeal,
}: AdminReportCenterProps) {
  const [filter, setFilter] = useState<
    'open' | 'reviewed' | 'dismissed' | 'all'
  >('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [messageFailed, setMessageFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [openingDeal, setOpeningDeal] = useState('');
  const savingRef = useRef(false);
  const openingDealRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setMessage('');
    setMessageFailed(false);
    try {
      const next = await getAdminReports(session, filter);
      if (request === requestRef.current) setReports(next);
    } catch (error) {
      if (request === requestRef.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load report queue',
        );
        setMessageFailed(true);
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filter, session.accessToken]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const openDeal = async (publicId: string) => {
    if (openingDealRef.current) return;
    openingDealRef.current = true;
    setOpeningDeal(publicId);
    setMessage('');
    setMessageFailed(false);
    try {
      onOpenDeal(await getPublicDeal(publicId));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Deal Link unavailable',
      );
      setMessageFailed(true);
    } finally {
      openingDealRef.current = false;
      setOpeningDeal('');
    }
  };

  const decide = async (
    report: AdminReport,
    decision: 'reviewed' | 'dismissed',
  ) => {
    const note = (notes[report.report_id] || '').trim();
    if (note.length < 3 || savingRef.current) return;
    savingRef.current = true;
    setSaving(report.report_id);
    setMessage('');
    setMessageFailed(false);
    try {
      await resolveAdminReport(
        session,
        report.report_id,
        decision,
        note,
      );
      setReports((items) =>
        filter === 'all'
          ? items.map((item) =>
              item.report_id === report.report_id
                ? { ...item, report_status: decision, resolution_note: note }
                : item,
            )
          : items.filter((item) => item.report_id !== report.report_id),
      );
      setMessage('Decision saved.');
      setMessageFailed(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save report decision',
      );
      setMessageFailed(true);
    } finally {
      savingRef.current = false;
      setSaving('');
    }
  };

  const changeVisibility = async (report: AdminReport) => {
    const note = (notes[report.report_id] || '').trim();
    if (note.length < 3 || savingRef.current) return;
    savingRef.current = true;
    const status =
      report.moderation_status === 'hidden' ? 'visible' : 'hidden';
    setSaving(report.report_id);
    setMessage('');
    setMessageFailed(false);
    try {
      await setAdminDealVisibility(
        session,
        report.deal_id,
        status,
        note,
      );
      setReports((items) =>
        items.map((item) =>
          item.deal_id === report.deal_id
            ? { ...item, moderation_status: status }
            : item,
        ),
      );
      setMessage(
        status === 'hidden'
          ? 'Deal hidden from public access.'
          : 'Deal restored to public access.',
      );
      setMessageFailed(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update Deal Link visibility',
      );
      setMessageFailed(true);
    } finally {
      savingRef.current = false;
      setSaving('');
    }
  };

  return (
    <section className="admin-center">
      <button className="back" type="button" onClick={onBack}>
        ← {t('Dashboard')}
      </button>
      <div className="admin-heading">
        <ShieldCheck />
        <div>
          <p className="eyebrow">{t('Admin review')}</p>
          <h1>{t('Moderation queue')}</h1>
          <p>{t('Review reported deals and record a decision.')}</p>
        </div>
      </div>
      <div className="admin-filters">
        {(['open', 'reviewed', 'dismissed', 'all'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? 'active' : ''}
            onClick={() => setFilter(item)}
          >
            {t(
              item === 'open'
                ? 'Open reports'
                : item === 'reviewed'
                  ? 'Reviewed'
                  : item === 'dismissed'
                    ? 'Dismissed'
                    : 'All reports',
            )}
          </button>
        ))}
      </div>
      {message && (
        <div
          className={`notice ${messageFailed ? 'error' : ''}`}
          role={messageFailed ? 'alert' : 'status'}
          aria-live={messageFailed ? 'assertive' : 'polite'}
        >
          {t(message)}
        </div>
      )}
      {loading ? (
        <div className="admin-empty" role="status">
          {t('Loading reports…')}
        </div>
      ) : reports.length ? (
        <div className="admin-report-list">
          {reports.map((report) => {
            const note = (notes[report.report_id] || '').trim();
            return (
              <article key={report.report_id}>
                <div className="admin-report-top">
                  <div className="admin-report-identity">
                    <div>
                      <span className={`status ${report.report_status}`}>
                        {t(report.report_status)}
                      </span>
                      <span
                        className={`status moderation-${report.moderation_status}`}
                      >
                        {t(
                          report.moderation_status === 'hidden'
                            ? 'Hidden'
                            : 'Visible',
                        )}
                      </span>
                    </div>
                    <h2>{report.title}</h2>
                    <small>
                      {report.public_id} · {formatDateTime(report.created_at)}
                    </small>
                  </div>
                  <button
                    className="secondary"
                    type="button"
                    disabled={
                      Boolean(openingDeal) ||
                      report.moderation_status === 'hidden'
                    }
                    onClick={() => void openDeal(report.public_id)}
                  >
                    {t(
                      openingDeal === report.public_id
                        ? 'Opening'
                        : 'Open Deal Link',
                    )}
                    <ArrowRight size={16} />
                  </button>
                </div>
                {report.moderation_status === 'hidden' && (
                  <p className="admin-hidden-note">
                    {t(
                      'Hidden Deal Links cannot be opened or accepted until restored.',
                    )}
                  </p>
                )}
                <p className="admin-reason">{report.reason}</p>
                <div className="admin-people">
                  <span>
                    {t('Reporter')}
                    <b>{report.reporter_name}</b>
                  </span>
                  <span>
                    {t('Seller')}
                    <b>{report.seller_name}</b>
                  </span>
                </div>
                <div className="admin-decision">
                  <label>
                    {t('Resolution note')}
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      value={notes[report.report_id] || ''}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [report.report_id]: event.target.value,
                        }))
                      }
                      placeholder={t(
                        'Record what was checked and why this decision was made.',
                      )}
                    />
                  </label>
                  <div>
                    <button
                      className={`secondary ${
                        report.moderation_status === 'hidden' ? '' : 'danger'
                      }`}
                      type="button"
                      disabled={Boolean(saving) || note.length < 3}
                      onClick={() => void changeVisibility(report)}
                    >
                      {t(
                        report.moderation_status === 'hidden'
                          ? 'Restore Deal Link'
                          : 'Hide Deal Link',
                      )}
                    </button>
                    {report.report_status === 'open' && (
                      <>
                        <button
                          className="secondary"
                          type="button"
                          disabled={Boolean(saving) || note.length < 3}
                          onClick={() => void decide(report, 'dismissed')}
                        >
                          {t('Dismiss report')}
                        </button>
                        <button
                          className="primary"
                          type="button"
                          disabled={Boolean(saving) || note.length < 3}
                          onClick={() => void decide(report, 'reviewed')}
                        >
                          {t('Mark reviewed')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {report.report_status !== 'open' &&
                  report.resolution_note && (
                    <div className="admin-resolution">
                      <b>{t('Resolution note')}</b>
                      <p>{report.resolution_note}</p>
                    </div>
                  )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty">
          <Check />
          <b>{t('No reports in this queue.')}</b>
        </div>
      )}
    </section>
  );
}
