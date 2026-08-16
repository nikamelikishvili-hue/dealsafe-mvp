import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Eye,
  FileSignature,
  LockKeyhole,
  MailCheck,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import type { Deal } from './domain';
import { AsyncStatePanel } from './AsyncStatePanel';
import { t } from './i18n';
import type {
  DealActionPlan,
  DealParticipants,
  StoredSession,
} from './services/supabaseRest';
import { DealEvidenceWorkspace } from './DealEvidenceWorkspace';
import {
  DealPaymentWorkspace,
  ProtectedPaymentReceipt,
} from './DealPaymentWorkspace';
import {
  HandoffPanel,
  MeetingPanel,
  ShippingPanel,
} from './DealFulfillmentWorkspace';
import {
  DealChat,
  DealSafetyActions,
  RatingPanel,
  ReportDealPanel,
} from './DealResolutionWorkspace';
import {
  DealPrimaryActionDock,
  DealWorkspaceGroup,
  DealWorkspaceNavigation,
  type DealPrimaryAction,
} from './DealWorkspaceShell';
import {
  AgreementExport,
  AgreementFingerprint,
  AgreementHistory,
} from './AgreementRecordSummary';
import { AgreementPrintDocument } from './AgreementPrintDocument';
import { PublicSellerDeclaration } from './SellerDeclarations';
import {
  AgreementExpiredNotice,
  BuyerAccessCodeEntry,
  BuyerAccessCodeManager,
  BuyerInvitePanel,
  CompletionReceipt,
  CoverSelector,
  DealActionPlanCard,
  DealCopyLinkButton,
  DealEditor,
  DealExpiry,
  DealInquiries,
  DealMedia,
  DealParticipantsCard,
  DealProgressStrip,
  DealQrCode,
  DealReadiness,
  DealRenewalPanel,
  DealRiskCheck,
  DemoAgreementComplete,
  ExistingMediaManager,
  OfferPanel,
  PhotoManager,
  SavedDraftPanel,
  SaveDealButton,
  SellerTrustProfile,
  TimelinePanel,
  dealPrice,
} from './DealWorkspaceFeatures';

export interface AgreementChecks {
  item: boolean;
  price: boolean;
  handoff: boolean;
}

interface DealWorkspaceProps {
  deal: Deal;
  session: StoredSession | null;
  now: number;
  expired: boolean;
  demo: boolean;
  demoCompleted: boolean;
  agreementChecks: AgreementChecks;
  buyer: string;
  buyerAccessCode: string;
  paymentReady: boolean;
  evidenceRevision: number;
  acceptanceProtected: boolean;
  acceptanceProtectionState: 'idle' | 'loading' | 'ready' | 'error';
  acceptanceProtectionError: string;
  agreementDocumentMode: boolean;
  primaryAction: DealPrimaryAction;
  nextStep: string;
  homeLabel: string;
  authMessage: string;
  onBack: () => void;
  onOpenCreate: () => void;
  onOpenProfile: () => void;
  onSignIn: () => void;
  onRefreshSavedDeals: () => void;
  onAccept: () => void;
  accepting: boolean;
  onResetDemo: () => void;
  onAgreementCheckChange: (
    key: keyof AgreementChecks,
    checked: boolean,
  ) => void;
  onBuyerChange: (value: string) => void;
  onBuyerAccessCodeChange: (value: string) => void;
  onPaymentReadyChanged: (ready: boolean) => void;
  onEvidenceChanged: () => void;
  onActionPlanSync: (plan: DealActionPlan) => void;
  onParticipantsLoaded: (participants: DealParticipants) => void;
  onRefreshActionPlan: () => void;
  onDealChanged: (deal: Deal) => void;
  onAcceptanceProtectedChanged: (enabled: boolean) => void;
  onRetryAcceptanceProtection: () => void;
  onOpenActions: () => void;
  onOpenProtection: () => void;
  onOpenRecords: () => void;
  onPrimaryAction: () => void;
}

const privateStatuses: Deal['status'][] = [
  'accepted',
  'completed',
  'disputed',
  'cancelled',
];
const activeFulfillmentStatuses: Deal['status'][] = [
  'accepted',
  'completed',
];
const evidenceStatuses: Deal['status'][] = [
  'accepted',
  'completed',
  'disputed',
];

export function DealWorkspace({
  deal,
  session,
  now,
  expired,
  demo,
  demoCompleted,
  agreementChecks,
  buyer,
  buyerAccessCode,
  paymentReady,
  evidenceRevision,
  acceptanceProtected,
  acceptanceProtectionState,
  acceptanceProtectionError,
  agreementDocumentMode,
  primaryAction,
  nextStep,
  homeLabel,
  authMessage,
  onBack,
  onOpenCreate,
  onOpenProfile,
  onSignIn,
  onRefreshSavedDeals,
  onAccept,
  accepting,
  onResetDemo,
  onAgreementCheckChange,
  onBuyerChange,
  onBuyerAccessCodeChange,
  onPaymentReadyChanged,
  onEvidenceChanged,
  onActionPlanSync,
  onParticipantsLoaded,
  onRefreshActionPlan,
  onDealChanged,
  onAcceptanceProtectedChanged,
  onRetryAcceptanceProtection,
  onOpenActions,
  onOpenProtection,
  onOpenRecords,
  onPrimaryAction,
}: DealWorkspaceProps) {
  const [editRequestedAt, setEditRequestedAt] = useState(0);
  const isParticipant = Boolean(
    session &&
      deal.viewerRole !== 'visitor' &&
      privateStatuses.includes(deal.status),
  );

  const updateStatus = (status: Deal['status']) =>
    onDealChanged({ ...deal, status });
  const updateMedia = (mediaUrls: string[]) =>
    onDealChanged({ ...deal, mediaUrls });

  return (
    <>
      {!demo && (
        <div className="deal-workspace-sections">
          <DealWorkspaceGroup
            id="deal-actions"
            icon={ArrowRight}
            kicker="NEXT ACTIONS"
            title="What to do now"
            summary={nextStep}
            defaultOpen
          >
            {session && privateStatuses.includes(deal.status) && (
              <DealActionPlanCard
                deal={deal}
                session={session}
                onSync={onActionPlanSync}
              />
            )}
            <DealExpiry deal={deal} now={now} />
            <div className="deal-trust-grid">
              <DealReadiness
                deal={deal}
                onOpenProfile={
                  deal.viewerRole === 'seller' && session
                    ? onOpenProfile
                    : undefined
                }
                onEditDetails={
                  deal.viewerRole === 'seller' &&
                  session &&
                  deal.status === 'published' &&
                  !expired
                    ? () => setEditRequestedAt(Date.now())
                    : undefined
                }
              />
              {session && privateStatuses.includes(deal.status) && (
                <DealParticipantsCard
                  deal={deal}
                  session={session}
                  onLoaded={onParticipantsLoaded}
                />
              )}
            </div>
            {deal.viewerRole !== 'seller' &&
              !(['draft', 'cancelled'] as Deal['status'][]).includes(
                deal.status,
              ) && (
                <SaveDealButton
                  deal={deal}
                  session={session}
                  onChanged={onRefreshSavedDeals}
                  onSignIn={onSignIn}
                />
              )}
            {deal.viewerRole === 'seller' &&
              deal.status === 'published' &&
              !expired && <BuyerInvitePanel deal={deal} />}
            {deal.viewerRole !== 'seller' &&
              deal.status === 'published' &&
              !expired &&
              acceptanceProtectionState !== 'ready' && (
                <AsyncStatePanel
                  state={acceptanceProtectionState === 'error' ? 'error' : 'loading'}
                  title={acceptanceProtectionState === 'error' ? 'Acceptance protection unavailable' : 'Checking acceptance protection…'}
                  message={acceptanceProtectionState === 'error' ? acceptanceProtectionError : 'Verifying whether this Deal requires a private buyer code.'}
                  actionLabel="Retry"
                  onAction={acceptanceProtectionState === 'error' ? onRetryAcceptanceProtection : undefined}
                />
              )}
            {deal.viewerRole !== 'seller' &&
              deal.status === 'published' &&
              !expired &&
              acceptanceProtectionState === 'ready' &&
              acceptanceProtected && (
                <BuyerAccessCodeEntry
                  value={buyerAccessCode}
                  onChange={onBuyerAccessCodeChange}
                />
              )}
            {deal.status === 'published' && (
              <DealInquiries
                deal={deal}
                session={session}
                onSignIn={onSignIn}
              />
            )}
            {session && deal.status === 'published' && !expired && (
              <OfferPanel
                deal={deal}
                session={session}
                onAccepted={(amount) =>
                  onDealChanged({
                    ...deal,
                    priceCents: amount,
                    status: 'accepted',
                  })
                }
              />
            )}
            {isParticipant && (
              <div className="deal-fulfillment-grid is-single">
                <DealPaymentWorkspace
                  deal={deal}
                  session={session!}
                  onChanged={onPaymentReadyChanged}
                />
              </div>
            )}
            {session &&
              deal.viewerRole === 'seller' &&
              deal.deliveryMethod === 'Ship to buyer' &&
              activeFulfillmentStatuses.includes(deal.status) && (
                <div className="deal-shipping-protection is-prerequisite">
                  <div className="deal-shipping-protection-intro">
                    <span className="shipping-sequence-number" aria-hidden="true">
                      1
                    </span>
                    <div>
                      <p className="eyebrow">
                        {t('Step 1 · Required before shipping')}
                      </p>
                      <h2>{t('Prepare the protected shipping record')}</h2>
                      <p>
                        {t(
                          'Document the condition, packing, weight, and serial number first. Shipping unlocks automatically when the required evidence is saved.',
                        )}
                      </p>
                    </div>
                  </div>
                  <DealEvidenceWorkspace
                    deal={deal}
                    session={session}
                    onChanged={onEvidenceChanged}
                  />
                </div>
              )}
            {session &&
              deal.viewerRole !== 'visitor' &&
              deal.deliveryMethod === 'Ship to buyer' &&
              activeFulfillmentStatuses.includes(deal.status) && (
                <div
                  className={`deal-shipping-stage ${
                    deal.viewerRole === 'seller' ? 'follows-evidence' : ''
                  }`}
                >
                  {deal.viewerRole === 'seller' && (
                    <div className="deal-shipping-stage-marker">
                      <span aria-hidden="true">2</span>
                      <div>
                        <p className="eyebrow">{t('Step 2 · Shipping')}</p>
                        <strong>{t('Add carrier and tracking')}</strong>
                        <small>
                          {t(
                            'This step becomes available as soon as the required package evidence is complete.',
                          )}
                        </small>
                      </div>
                      <ArrowRight aria-hidden="true" />
                    </div>
                  )}
                  <div id="shipping-panel">
                    <ShippingPanel
                      deal={deal}
                      session={session}
                      paymentReady={paymentReady}
                      evidenceRevision={evidenceRevision}
                      onProgressChanged={onRefreshActionPlan}
                      onDelivered={() => updateStatus('completed')}
                    />
                  </div>
                </div>
              )}
            {session &&
              deal.viewerRole !== 'visitor' &&
              deal.deliveryMethod === 'Ship to buyer' &&
              (deal.viewerRole !== 'seller' || deal.status === 'disputed') &&
              evidenceStatuses.includes(deal.status) && (
                <div className="deal-shipping-protection is-arrival-evidence">
                  <div className="deal-shipping-protection-intro">
                    <span>
                      <ShieldCheck />
                    </span>
                    <div>
                      <p className="eyebrow">
                        {t(
                          deal.status === 'disputed'
                            ? 'Issue evidence'
                            : 'After delivery',
                        )}
                      </p>
                      <h2>
                        {t(
                          deal.status === 'disputed'
                            ? 'Add evidence to the deal record'
                            : 'Document the item on arrival',
                        )}
                      </h2>
                      <p>
                        {t(
                          deal.status === 'disputed'
                            ? 'Keep photos, videos, and supporting proof tied to this transaction.'
                            : 'Record the delivery, packaging, and unboxing before using the item.',
                        )}
                      </p>
                    </div>
                  </div>
                  <DealEvidenceWorkspace
                    deal={deal}
                    session={session}
                    onChanged={onEvidenceChanged}
                  />
                </div>
              )}
            {session &&
              deal.status === 'accepted' &&
              deal.deliveryMethod === 'Meet in person' &&
              deal.viewerRole !== 'visitor' && (
                <div id="meeting-panel">
                  <MeetingPanel deal={deal} session={session} />
                </div>
              )}
            {session &&
              deal.status === 'accepted' &&
              deal.deliveryMethod === 'Meet in person' &&
              deal.viewerRole !== 'visitor' && (
                <div id="handoff-panel">
                  <HandoffPanel
                    deal={deal}
                    session={session}
                    paymentReady={paymentReady}
                    onComplete={() => updateStatus('completed')}
                  />
                </div>
              )}
            {session &&
              deal.status === 'completed' &&
              deal.viewerRole !== 'visitor' && (
                <div id="rating-panel">
                  <RatingPanel deal={deal} session={session} />
                </div>
              )}
          </DealWorkspaceGroup>

          <DealWorkspaceGroup
            id="deal-safety"
            icon={ShieldCheck}
            kicker="PROTECTION & SUPPORT"
            title="Help and issue resolution"
            summary="Evidence, reporting, disputes, cancellation, and urgent safety actions."
          >
            {session &&
              deal.viewerRole !== 'visitor' &&
              deal.deliveryMethod !== 'Ship to buyer' &&
              evidenceStatuses.includes(deal.status) && (
                <DealEvidenceWorkspace
                  deal={deal}
                  session={session}
                  onChanged={onEvidenceChanged}
                />
              )}
            {session && deal.viewerRole !== 'visitor' && (
              <DealSafetyActions
                deal={deal}
                session={session}
                onStatus={updateStatus}
              />
            )}
            {deal.viewerRole !== 'seller' &&
              !(['draft', 'cancelled'] as Deal['status'][]).includes(
                deal.status,
              ) && (
                <ReportDealPanel
                  deal={deal}
                  session={session}
                  onSignIn={onSignIn}
                />
              )}
          </DealWorkspaceGroup>

          <DealWorkspaceGroup
            id="deal-records"
            icon={FileSignature}
            kicker="DEAL RECORD"
            title="Agreement and activity"
            summary="Versions, receipts, trust checks, and the complete timeline."
          >
            {deal.status !== 'draft' && <AgreementExport deal={deal} />}
            {deal.status !== 'draft' && <DealRiskCheck deal={deal} />}
            {deal.status !== 'draft' && <PublicSellerDeclaration deal={deal} />}
            {deal.status !== 'draft' && <SellerTrustProfile deal={deal} />}
            {deal.status !== 'draft' && <AgreementFingerprint deal={deal} />}
            {deal.status !== 'draft' && <AgreementHistory deal={deal} />}
            {isParticipant && (
              <ProtectedPaymentReceipt deal={deal} session={session!} />
            )}
            {session &&
              deal.status === 'completed' &&
              deal.viewerRole !== 'visitor' && (
                <CompletionReceipt deal={deal} session={session} />
              )}
            {session && deal.viewerRole !== 'visitor' && (
              <TimelinePanel deal={deal} session={session} />
            )}
          </DealWorkspaceGroup>

          {session && deal.viewerRole === 'seller' && (
            <DealWorkspaceGroup
              id="deal-manage"
              icon={Pencil}
              kicker="SELLER TOOLS"
              title="Manage this deal"
              summary="Edit the listing, sharing controls, photos, and offer expiry."
            >
              {deal.status === 'published' && (
                <DealRenewalPanel
                  deal={deal}
                  session={session}
                  onRenewed={(agreementVersion, expiresAt) =>
                    onDealChanged({ ...deal, agreementVersion, expiresAt })
                  }
                />
              )}
              {deal.status === 'published' && !expired && (
                <BuyerAccessCodeManager
                  deal={deal}
                  session={session}
                  enabled={acceptanceProtected}
                  onChanged={onAcceptanceProtectedChanged}
                />
              )}
              {deal.status === 'draft' && (
                <SavedDraftPanel
                  deal={deal}
                  session={session}
                  onUpdated={onDealChanged}
                />
              )}
              {deal.status === 'published' && !expired && (
                <DealEditor
                  deal={deal}
                  session={session}
                  onSaved={onDealChanged}
                  openRequestedAt={editRequestedAt}
                />
              )}
              {deal.status !== 'cancelled' && (
                <PhotoManager
                  deal={deal}
                  session={session}
                  onAdded={(urls) =>
                    updateMedia([...(deal.mediaUrls || []), ...urls])
                  }
                />
              )}
              {deal.status !== 'cancelled' && (
                <ExistingMediaManager
                  deal={deal}
                  session={session}
                  onRemoved={(url) =>
                    updateMedia(
                      (deal.mediaUrls || []).filter((item) => item !== url),
                    )
                  }
                />
              )}
              {deal.status !== 'cancelled' && (
                <CoverSelector
                  deal={deal}
                  session={session}
                  onReordered={updateMedia}
                />
              )}
            </DealWorkspaceGroup>
          )}
        </div>
      )}

      {session &&
        deal.viewerRole !== 'visitor' &&
        (['accepted', 'completed', 'disputed'] as Deal['status'][]).includes(
          deal.status,
        ) && <DealChat deal={deal} session={session} />}

      <section
        id="deal-overview"
        className={`deal-page${
          agreementDocumentMode ? ' agreement-document-mode' : ''
        }`}
      >
        <DealWorkspaceNavigation
          deal={deal}
          expired={expired}
          homeLabel={homeLabel}
          nextStep={nextStep}
          demo={demo}
          primaryAction={primaryAction}
          onBack={onBack}
          onOpenActions={onOpenActions}
          onOpenProtection={onOpenProtection}
          onOpenRecords={onOpenRecords}
          onPrimaryAction={onPrimaryAction}
        />
        {demo && (
          <section
            className="demo-deal-banner"
            aria-label={t('Interactive sample deal')}
          >
            <span className="demo-deal-icon">
              <Eye />
            </span>
            <div>
              <p className="eyebrow">{t('INTERACTIVE SAMPLE')}</p>
              <h2>{t('See how a Deal Link works.')}</h2>
              <p>
                {t(
                  'Sample only — no real item, agreement, or payment is created.',
                )}
              </p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={onOpenCreate}
            >
              <Plus size={17} />
              {t('Start a deal')}
            </button>
          </section>
        )}
        <DealProgressStrip deal={deal} paymentReady={paymentReady} />
        <div className="deal-mobile-summary">
          <span className="deal-mobile-icon">
            <Package />
          </span>
          <div>
            <small>
              {deal.publicId} ·{' '}
              {t(deal.viewerRole === 'seller' ? 'Seller view' : 'Buyer view')}
            </small>
            <b>{deal.title}</b>
          </div>
          <strong>{dealPrice(deal)}</strong>
        </div>
        <div className="deal-grid">
          <div className="deal-item-card">
            <div className="deal-item-heading">
              <div
                className={`safe ${
                  deal.sellerContactVerified ? '' : 'pending'
                }`}
              >
                {deal.sellerContactVerified ? <MailCheck /> : <Clock3 />}{' '}
                {t(
                  deal.sellerContactVerified
                    ? 'Seller contact verified'
                    : 'Seller contact verification pending',
                )}
              </div>
              <div className="deal-item-title">
                <p className="eyebrow">
                  {t('Deal')} {deal.publicId}
                </p>
                <h1>{deal.title}</h1>
              </div>
              <div className="price">{dealPrice(deal)}</div>
            </div>
            <div
              className={`deal-item-body ${
                deal.mediaUrls?.length ? 'has-media' : 'no-media'
              }`}
            >
              <DealMedia deal={deal} />
              <div className="deal-item-details">
                <h2>{t('Item details')}</h2>
                <p>{deal.description}</p>
                <div className="facts">
                  <div>
                    <span>{t('Condition')}</span>
                    <b>{t(deal.condition)}</b>
                  </div>
                  <div>
                    <span>{t('Handoff')}</span>
                    <b>{t(deal.deliveryMethod)}</b>
                  </div>
                  <div>
                    <span>{t('Serial')}</span>
                    <b>{deal.serialNumber || t('Not provided')}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {demoCompleted && (
            <aside className="demo-completion-aside">
              <div className="agreement">
                <DemoAgreementComplete
                  buyerName={buyer.trim()}
                  onStart={onOpenCreate}
                  onReviewAgain={onResetDemo}
                />
              </div>
            </aside>
          )}
          <aside>
            <div id="deal-agreement" className="agreement">
              <FileSignature />
              <h2>
                {t(
                  deal.status === 'draft'
                    ? 'Private draft'
                    : 'Deal agreement',
                )}
              </h2>
              {deal.status === 'draft' ? (
                <div className="draft-agreement-notice">
                  <LockKeyhole />
                  <div>
                    <b>{t('Not published')}</b>
                    <span>
                      {t(
                        'This draft is not shared through a Deal Link until you publish it.',
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <p>
                    {t('Version')} {deal.agreementVersion} ·{' '}
                    {t(
                      'The buyer agrees to the stated price, condition disclosures, and handoff method.',
                    )}
                  </p>
                  {deal.status === 'published' && !expired ? (
                    deal.viewerRole === 'seller' ? (
                      <>
                        <AgreementTermsList />
                        <div className="waiting-buyer">
                          <Clock3 />
                          <div>
                            <b>{t('Waiting for buyer')}</b>
                            <span>
                              {t(
                                'The buyer must review and accept this agreement from their own account.',
                              )}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <form
                        className="agreement-acceptance-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          onAccept();
                        }}
                      >
                        <p className="agreement-instruction">
                          {t('Review agreement')}
                        </p>
                        <ul className="agreement-confirm-list">
                          {(
                            [
                              ['item', 'Item and defects reviewed'],
                              ['price', 'Price confirmed'],
                              ['handoff', 'Handoff terms confirmed'],
                            ] as const
                          ).map(([key, label]) => (
                            <li
                              key={key}
                              className={agreementChecks[key] ? 'checked' : ''}
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  required
                                  checked={agreementChecks[key]}
                                  onChange={(event) =>
                                    onAgreementCheckChange(
                                      key,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>{t(label)}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                        <label>
                          {t('Your full name')}
                          <input
                            required
                            minLength={2}
                            placeholder={t('Buyer name')}
                            value={buyer}
                            onChange={(event) =>
                              onBuyerChange(event.target.value)
                            }
                          />
                        </label>
                        {authMessage && (
                          <div className="notice" role="status">
                            {t(authMessage)}
                          </div>
                        )}
                        <button
                          type="submit"
                          className="primary full"
                          disabled={accepting}
                          aria-busy={accepting}
                        >
                          {t(accepting ? 'Accepting…' : 'Accept these terms')}
                        </button>
                        <small>
                          {t(
                            'Complete all three confirmations and enter your full name to record consent.',
                          )}
                        </small>
                      </form>
                    )
                  ) : expired ? (
                    <AgreementExpiredNotice />
                  ) : (
                    <>
                      <AgreementTermsList />
                      <div className="accepted">
                        <BadgeCheck />
                        <div>
                          <b>{t('Terms accepted')}</b>
                          <span>
                            {deal.buyerName || t('Buyer')} ·{' '}
                            {t('verification pending')}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            {deal.status !== 'draft' && !demo && (
              <>
                <DealCopyLinkButton deal={deal} />
                <DealQrCode deal={deal} />
              </>
            )}
          </aside>
        </div>
        {deal.status !== 'draft' && <AgreementPrintDocument deal={deal} />}
      </section>
      <DealPrimaryActionDock
        action={primaryAction}
        price={dealPrice(deal)}
        onPrimaryAction={onPrimaryAction}
      />
    </>
  );
}

function AgreementTermsList() {
  return (
    <ul>
      <li>
        <Check />
        {t('Item and defects reviewed')}
      </li>
      <li>
        <Check />
        {t('Price confirmed')}
      </li>
      <li>
        <Check />
        {t('Handoff terms confirmed')}
      </li>
    </ul>
  );
}
