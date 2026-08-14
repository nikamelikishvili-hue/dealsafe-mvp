import { ArrowRight, Route, ShieldAlert, ShieldCheck } from 'lucide-react';
import { t } from './i18n';
import { publicInfoPaths, verifyPath, type PublicInfoView } from './navigation';

type PublicInfoContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
};

const publicInfoContent: Record<PublicInfoView, PublicInfoContent> = {
  'buyer-protection': {
    eyebrow: 'BUYER PROTECTION',
    title: 'Know what happens before you pay.',
    intro: 'Dealivra keeps the accepted terms, payment state, delivery evidence, inspection record, and dispute history together.',
    sections: [
      { title: 'Review one shared agreement', body: 'Confirm the item, price, condition disclosures, delivery method, and accepted agreement version before paying.' },
      { title: 'Payment status stays visible', body: 'The beta uses Stripe Sandbox. Dealivra does not store card or bank details and is not legal escrow.' },
      { title: 'Raise a problem before release', body: 'A dispute records evidence and pauses the normal completion path while the issue is reviewed.' }
    ]
  },
  'seller-protection': {
    eyebrow: 'SELLER PROTECTION',
    title: 'Ship or hand off with a clearer record.',
    intro: 'The seller can see whether terms were accepted and whether the payment workflow is ready before releasing an item.',
    sections: [
      { title: 'Accepted terms are versioned', body: 'Price, disclosures, handoff terms, and each accepted agreement version remain attached to the deal.' },
      { title: 'Evidence supports the handoff', body: 'Shipping, meeting confirmation, inspection, photos, and messages stay with the transaction record.' },
      { title: 'Release is recorded', body: 'Payment and completion actions are time-stamped so both parties can understand the current state.' }
    ]
  },
  fees: {
    eyebrow: 'FEES & AVAILABILITY',
    title: 'See costs before committing.',
    intro: 'This private beta does not publish production pricing yet. A production transaction must show every fee before either party confirms payment.',
    sections: [
      { title: 'Sandbox testing only', body: 'Stripe Sandbox is used for testing. Live U.S. payment methods, transaction limits, and fees depend on approved provider availability.' },
      { title: 'What the final quote should show', body: 'Item price, Dealivra fee, payment processing, shipping, insurance, applicable taxes, and the final U.S. dollar amount.' },
      { title: 'United States launch', body: 'The first release is English-only and U.S.-only. State availability may depend on payment-provider approval and applicable law.' }
    ]
  },
  disputes: {
    eyebrow: 'DISPUTES & REFUNDS',
    title: 'A problem should stop the normal release path.',
    intro: 'Dealivra keeps the dispute reason, messages, delivery evidence, inspection record, and financial resolution together.',
    sections: [
      { title: 'Open a dispute', body: 'Report non-delivery, damage, a material mismatch, suspected counterfeit goods, or another documented problem.' },
      { title: 'Add evidence', body: 'Upload relevant photos, shipment records, inspection details, and messages without sharing passwords or full payment credentials.' },
      { title: 'Possible outcomes', body: 'A production policy may support release, full refund, partial refund, or return. Exact rights require provider terms and legal review.' }
    ]
  },
  terms: {
    eyebrow: 'TERMS',
    title: 'Beta terms and important limitations.',
    intro: 'Dealivra is a private beta for recording transaction facts, consent, payment state, evidence, and handoff activity.',
    sections: [
      { title: 'Not legal advice or legal escrow', body: 'The current beta must not be treated as a licensed escrow service, legal opinion, authenticity guarantee, or ownership guarantee.' },
      { title: 'Users remain responsible', body: 'Users must provide accurate information, comply with applicable law, and avoid prohibited goods or unsafe payment requests.' },
      { title: 'Production review required', body: 'Binding terms, refund rights, fees, supported markets, and dispute rules require specialist legal and payments review before launch.' }
    ]
  },
  privacy: {
    eyebrow: 'PRIVACY',
    title: 'Collect only what the deal needs.',
    intro: 'Dealivra is designed to keep transaction information in one private record and avoid exposing personal contact details unnecessarily.',
    sections: [
      { title: 'Sensitive payment data', body: 'Card and bank details are handled by the payment provider and are not stored by Dealivra.' },
      { title: 'Media privacy', body: 'Uploaded item media is prepared to remove location and camera metadata before storage.' },
      { title: 'Access and retention', body: 'A production privacy policy must define data categories, lawful bases, retention periods, user rights, subprocessors, and international transfers.' }
    ]
  }
};

export type PageMetadata = {
  label: string;
  title: string;
  description: string;
  path: string;
  indexable: boolean;
};

const siteOrigin = 'https://dealivra.com';
const privateViewLabels: Record<string, string> = {
  auth: 'Dealivra account',
  create: 'Start a deal',
  published: 'Deal Link ready',
  deal: 'Deal record',
  profile: 'Trust profile',
  passport: 'Digital Trust Passport',
  admin: 'Admin',
  forgot: 'Reset password',
  reset: 'Choose a new password',
  'link-error': 'Deal Link unavailable',
  'route-loading': 'Opening secure link',
  'not-found': 'Page not found',
  verify: 'Verify an agreement'
};

export const getPageMetadata = (
  view: string,
  activeDealTitle?: string,
  isAuthenticated = false
): PageMetadata => {
  if (view === 'home' && isAuthenticated) {
    return {
      label: 'Private workspace',
      title: 'Private Workspace — Dealivra',
      description: 'Private Dealivra workspace for saved deals and transaction records.',
      path: '/',
      indexable: false
    };
  }
  if (view === 'home') {
    return {
      label: 'Home',
      title: 'Dealivra — Private Deals, Made Clear',
      description: 'Create one trusted record for the agreement, payment state, evidence, delivery, and handoff.',
      path: '/',
      indexable: true
    };
  }
  if (view === 'verify') {
    return {
      label: 'Verify an agreement',
      title: 'Verify an Agreement — Dealivra',
      description: 'Compare a saved Dealivra agreement code without signing in.',
      path: verifyPath,
      indexable: true
    };
  }
  if (view === 'not-found') {
    return {
      label: 'Page not found',
      title: 'Page Not Found — Dealivra',
      description: 'The requested Dealivra page could not be found.',
      path: '/',
      indexable: false
    };
  }
  if (Object.hasOwn(publicInfoContent, view)) {
    const content = publicInfoContent[view as PublicInfoView];
    return {
      label: content.title,
      title: `Dealivra — ${content.title}`,
      description: content.intro,
      path: publicInfoPaths[view as PublicInfoView],
      indexable: true
    };
  }
  const label = view === 'deal' && activeDealTitle
    ? activeDealTitle
    : (privateViewLabels[view] || 'Private workspace');
  return {
    label,
    title: `${label} — Dealivra`,
    description: 'Private Dealivra workspace for protected transaction records.',
    path: '/',
    indexable: false
  };
};

const upsertNamedMeta = (name: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
};

const upsertPropertyMeta = (property: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.append(element);
  }
  element.content = content;
};

export const applyPageMetadata = (metadata: PageMetadata) => {
  const title = t(metadata.title);
  const description = t(metadata.description);
  const canonicalUrl = `${siteOrigin}${metadata.path}`;
  document.title = title;
  upsertNamedMeta('description', description);
  upsertNamedMeta('robots', metadata.indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow,noarchive');
  upsertNamedMeta('twitter:title', title);
  upsertNamedMeta('twitter:description', description);
  upsertPropertyMeta('og:title', title);
  upsertPropertyMeta('og:description', description);
  upsertPropertyMeta('og:url', canonicalUrl);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl;
};

export function DealLinkError({ message, onBack }: { message: string; onBack: () => void }) {
  return <section className="form-wrap deal-link-error">
    <div className="safe pending"><ShieldAlert />{t('Deal Link unavailable')}</div>
    <h1>{t('Deal Link unavailable')}</h1>
    <p className="lede small">{t('The link may be incomplete, expired, or no longer public.')}</p>
    {message && <div className="notice" role="alert"><ShieldAlert size={18} /><span>{t(message)}</span></div>}
    <button type="button" className="primary" onClick={onBack}>{t('Back')}</button>
  </section>;
}

export function RouteLoading() {
  return <section className="form-wrap route-status-page" role="status" aria-live="polite">
    <div className="route-status-icon"><ShieldCheck /></div>
    <p className="eyebrow">{t('Secure Dealivra link')}</p>
    <h1>{t('Opening the requested record…')}</h1>
    <p className="lede small">{t('We are checking the link and loading the latest available version.')}</p>
  </section>;
}

export function NotFoundPage({ onBack }: { onBack: () => void }) {
  return <section className="form-wrap route-status-page not-found-page">
    <div className="route-status-code" aria-hidden="true">404</div>
    <div className="route-status-icon"><Route /></div>
    <p className="eyebrow">{t('Page not found')}</p>
    <h1>{t('This address does not lead to a Dealivra page.')}</h1>
    <p className="lede small">{t('Check the address, or return home to continue safely.')}</p>
    <button type="button" className="primary" onClick={onBack}>{t('Return to home')}</button>
  </section>;
}

export function PublicInfoPage({
  view,
  onBack,
  onCreate
}: {
  view: PublicInfoView;
  onBack: () => void;
  onCreate: () => void;
}) {
  const content = publicInfoContent[view];
  return <section className="public-info-page">
    <button type="button" className="back" onClick={onBack}>← {t('Back to home')}</button>
    <p className="eyebrow">{t(content.eyebrow)}</p>
    <h1>{t(content.title)}</h1>
    <p className="lede small">{t(content.intro)}</p>
    <div className="public-info-grid">
      {content.sections.map(section => <article key={section.title}>
        <ShieldCheck />
        <div><h2>{t(section.title)}</h2><p>{t(section.body)}</p></div>
      </article>)}
    </div>
    <div className="legal-caution">
      <ShieldAlert />
      <p>{t('Important: production payment protection, fees, refunds, and dispute rights depend on licensed providers, applicable law, and final legal terms.')}</p>
    </div>
    <button type="button" className="global-primary" onClick={onCreate}>{t('Start a deal')}<ArrowRight size={18} /></button>
  </section>;
}
