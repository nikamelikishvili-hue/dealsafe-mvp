import {
  BadgeCheck,
  Check,
  Clock3,
  FileDown,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useStoredAgreementDocument } from './AgreementRecordSummary';
import { formatMoney } from './currency';
import type { Deal } from './domain';
import { getAppLanguage, t } from './i18n';
import { dealPath } from './navigation';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage());

export function AgreementPrintDocument({ deal }: { deal: Deal }) {
  const { record, loading, error } = useStoredAgreementDocument(deal);
  const link = `${location.origin}${dealPath(deal.publicId)}`;

  if (!record) {
    return (
      <>
        <div
          className="agreement-document-toolbar no-print"
          role="toolbar"
          aria-label={t('Agreement document actions')}
        >
          <button
            type="button"
            className="secondary"
            onClick={() => {
              location.href = dealPath(deal.publicId);
            }}
          >
            ← {t('Back to deal')}
          </button>
          <div>
            <span>
              <ShieldAlert aria-hidden="true" />
            </span>
            <strong>{t('Agreement preview')}</strong>
            <small>
              {deal.publicId} · {t('Version')} {deal.agreementVersion}
            </small>
          </div>
          <button type="button" className="primary" disabled>
            <FileDown size={17} aria-hidden="true" />
            {t('Download PDF')}
          </button>
        </div>
        <article
          className="agreement-print-document agreement-print-unavailable"
          aria-busy={loading}
          role={loading ? 'status' : 'alert'}
        >
          <BrandLogo />
          <ShieldAlert aria-hidden="true" />
          <h1>
            {loading
              ? t('Checking the stored agreement…')
              : t('Agreement document unavailable')}
          </h1>
          <p>
            {loading
              ? t(
                  'The PDF will be enabled after the immutable record is verified.',
                )
              : t(
                  error ||
                    'The stored agreement document could not be verified.',
                )}
          </p>
          <small>
            {deal.publicId} · {t('Version')} {deal.agreementVersion}
          </small>
        </article>
      </>
    );
  }

  const buyerRecorded = Boolean(deal.buyerName);
  const sellerVerification =
    deal.sellerVerification === 'verified'
      ? 'Identity verified'
      : deal.sellerContactVerified
        ? 'Contact verified'
        : 'Verification pending';
  const buyerVerification =
    deal.buyerVerification === 'verified'
      ? 'Identity verified'
      : buyerRecorded
        ? 'Verification pending'
        : 'Not yet recorded';
  const statusLabel = record.is_current
    ? 'Current version'
    : 'Archived version';
  const agreementPrice = formatMoney(
    record.price_cents,
    record.currency,
    getAppLanguage(),
  );
  const catalogSummary = [
    record.catalog_identity?.brand_label,
    record.catalog_identity?.model_label,
    record.catalog_identity?.model_year,
    record.catalog_identity?.variant_label,
  ]
    .filter(value => value !== null && value !== undefined && value !== '')
    .join(' · ');
  const declarations = record.seller_declarations;
  const acceptanceCopy =
    record.acceptance_count > 0
      ? `${record.acceptance_count} acceptance ${
          record.acceptance_count === 1 ? 'record is' : 'records are'
        } attached to this exact agreement version.`
      : 'The seller has issued this agreement version for buyer review. No buyer acceptance is attached to this version yet.';

  return (
    <>
      <div
        className="agreement-document-toolbar no-print"
        role="toolbar"
        aria-label={t('Agreement document actions')}
      >
        <button
          type="button"
          className="secondary"
          onClick={() => {
            location.href = dealPath(deal.publicId);
          }}
        >
          ← {t('Back to deal')}
        </button>
        <div>
          <span>
            <ShieldCheck aria-hidden="true" />
          </span>
          <strong>{t('Verified agreement preview')}</strong>
          <small>
            {record.public_id} · {t('Version')} {record.version}
          </small>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => window.print()}
        >
          <FileDown size={17} aria-hidden="true" />
          {t('Download PDF')}
        </button>
      </div>
      <article
        className="agreement-print-document"
        role="document"
        aria-labelledby="agreement-document-title"
        aria-describedby="agreement-document-summary"
      >
        <header
          className="agreement-print-header"
          aria-label="Agreement record header"
        >
          <div className="agreement-print-brand">
            <span>
              <BrandLogo iconOnly />
            </span>
            <div>
              <strong>Dealivra</strong>
              <small>PRIVATE TRANSACTION RECORD</small>
            </div>
          </div>
          <div className="agreement-print-status">
            <small>RECORD STATUS</small>
            <strong>{statusLabel}</strong>
          </div>
        </header>

        <section
          className="agreement-print-hero"
          aria-labelledby="agreement-document-title"
        >
          <div>
            <p>TRANSACTION AGREEMENT</p>
            <h1 id="agreement-document-title">Private sale agreement</h1>
            <span id="agreement-document-summary">
              Deal {record.public_id} · Agreement Version {record.version}
            </span>
          </div>
          <div className="agreement-print-price">
            <small>AGREED PRICE</small>
            <strong>{agreementPrice}</strong>
            <span>{record.currency}</span>
          </div>
        </section>

        <section
          className="agreement-print-meta"
          aria-label="Transaction record metadata"
        >
          <div>
            <small>DEAL ID</small>
            <strong>{record.public_id}</strong>
          </div>
          <div>
            <small>VERSION</small>
            <strong>{record.version}</strong>
          </div>
          <div>
            <small>RECORD CREATED</small>
            <strong>{formatDateTime(record.created_at)}</strong>
          </div>
          <div>
            <small>ACCEPTANCES</small>
            <strong>{record.acceptance_count}</strong>
          </div>
        </section>

        <section
          className="agreement-print-section"
          aria-labelledby="agreement-participants-title"
        >
          <div className="agreement-print-section-title">
            <span aria-hidden="true">01</span>
            <div>
              <small>CURRENT PARTICIPANT RECORD · OUTSIDE TERMS HASH</small>
              <h2 id="agreement-participants-title">
                Transaction participants
              </h2>
            </div>
          </div>
          <div className="agreement-print-parties">
            <article aria-label="Seller participant">
              <small>SELLER</small>
              <strong>{deal.sellerName}</strong>
              <span>
                <BadgeCheck aria-hidden="true" />
                {sellerVerification}
              </span>
            </article>
            <article aria-label="Buyer participant">
              <small>BUYER</small>
              <strong>{deal.buyerName || 'Pending buyer'}</strong>
              <span>
                <BadgeCheck aria-hidden="true" />
                {buyerVerification}
              </span>
            </article>
          </div>
        </section>

        <section
          className="agreement-print-section"
          aria-labelledby="agreement-terms-title"
        >
          <div className="agreement-print-section-title">
            <span aria-hidden="true">02</span>
            <div>
              <small>TRANSACTION</small>
              <h2 id="agreement-terms-title">Item and agreed terms</h2>
            </div>
          </div>
          <div className="agreement-print-terms">
            <div className="agreement-print-item">
              <small>ITEM</small>
              <strong>{record.title}</strong>
              <p>{record.description}</p>
            </div>
            <dl>
              <div>
                <dt>Price</dt>
                <dd>{agreementPrice}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{record.condition}</dd>
              </div>
              <div>
                <dt>Handoff</dt>
                <dd>{record.delivery_method}</dd>
              </div>
              {catalogSummary && (
                <div>
                  <dt>Catalog identity</dt>
                  <dd>{catalogSummary}</dd>
                </div>
              )}
              <div>
                <dt>Identifier suffix</dt>
                <dd>
                  {record.identifier || 'Not recorded in this version'}
                </dd>
              </div>
              <div>
                <dt>Offer expiration</dt>
                <dd>
                  {record.expires_at
                    ? formatDateTime(record.expires_at)
                    : 'Not specified'}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section
          className="agreement-print-section agreement-print-conditions"
          aria-labelledby="agreement-declarations-title"
        >
          <div className="agreement-print-section-title">
            <span aria-hidden="true">03</span>
            <div>
              <small>AGREEMENT RECORD</small>
              <h2 id="agreement-declarations-title">
                Recorded declarations and acceptance
              </h2>
            </div>
          </div>
          <p className="agreement-print-acceptance">{acceptanceCopy}</p>
          {declarations ? (
            <ol>
              <li>
                <span>
                  {declarations.has_authority_to_sell ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <X size={12} aria-hidden="true" />
                  )}
                </span>
                <p>
                  <b>Authority to sell.</b> The seller recorded that they are
                  authorized to offer this item.
                </p>
              </li>
              <li>
                <span>
                  {declarations.not_stolen_counterfeit_or_prohibited ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <X size={12} aria-hidden="true" />
                  )}
                </span>
                <p>
                  <b>Lawful item.</b> The seller recorded that the item is not
                  stolen, counterfeit, or prohibited.
                </p>
              </li>
              <li>
                <span>
                  {declarations.known_defects_and_material_facts_disclosed ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <X size={12} aria-hidden="true" />
                  )}
                </span>
                <p>
                  <b>Material disclosure.</b> The seller recorded that known
                  defects and material facts were disclosed.
                </p>
              </li>
              <li>
                <span>
                  <Clock3 size={12} aria-hidden="true" />
                </span>
                <p>
                  <b>Attested.</b>{' '}
                  {declarations.attested_at
                    ? formatDateTime(declarations.attested_at)
                    : 'Timestamp not stored in this version.'}
                </p>
              </li>
            </ol>
          ) : (
            <p className="agreement-print-legacy-note">
              Seller declarations were not stored in this legacy agreement
              version. This PDF does not infer or recreate them.
            </p>
          )}
        </section>

        <section
          className="agreement-print-section agreement-print-verification"
          aria-labelledby="agreement-verification-title"
        >
          <div className="agreement-print-section-title">
            <span aria-hidden="true">04</span>
            <div>
              <small>INTEGRITY</small>
              <h2 id="agreement-verification-title">Record verification</h2>
            </div>
          </div>
          <div className="agreement-print-code">
            <span>
              <Fingerprint aria-hidden="true" />
            </span>
            <div>
              <small>SERVER-RECORDED SHA-256 AGREEMENT CODE</small>
              <code>{record.content_hash.toUpperCase()}</code>
            </div>
          </div>
          <div className="agreement-print-schema">
            <small>DOCUMENT SCHEMA</small>
            <strong>{record.schema_version}</strong>
          </div>
          <div className="agreement-print-link">
            <small>LIVE DEAL LINK</small>
            <span>{link}</span>
          </div>
        </section>

        <section
          className="agreement-print-notice"
          role="note"
          aria-label="Important platform notice"
        >
          <ShieldAlert aria-hidden="true" />
          <p>
            <b>Important platform notice.</b> This document is a Dealivra
            transaction record, not legal advice, title verification,
            insurance, or an escrow certificate. During the beta, payments use
            Stripe Sandbox and no real money is transferred. Dealivra does not
            hold or insure funds.
          </p>
        </section>

        <footer
          className="agreement-print-footer"
          aria-label="Agreement record footer"
        >
          <span>Dealivra · Clear terms. Recorded handoff.</span>
          <span>
            Deal {record.public_id} · Version {record.version}
          </span>
          <span className="agreement-print-page">Page </span>
        </footer>
      </article>
    </>
  );
}
