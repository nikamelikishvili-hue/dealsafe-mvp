import { useEffect, useState, type MouseEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Car,
  Check,
  ChevronDown,
  Eye,
  FileSignature,
  Fingerprint,
  Laptop,
  Link2,
  LockKeyhole,
  Menu,
  PackageCheck,
  Plus,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Watch,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export type LandingDestination =
  | 'create'
  | 'signin'
  | 'signup'
  | 'demo'
  | 'buyer-protection'
  | 'seller-protection'
  | 'fees'
  | 'disputes'
  | 'terms'
  | 'privacy'
  | 'verify';

type PublicLandingProps = {
  onLaunch: (destination: LandingDestination) => void;
};

const scrollToSection = (id?: string) => {
  if (!id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const isPlainNavigation = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function PublicLanding({ onLaunch }: PublicLandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const openSection = (id?: string) => {
    setMobileMenuOpen(false);
    const destination = id ? `/#${id}` : '/';
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (current !== destination) history.pushState({}, '', destination);
    scrollToSection(id);
  };
  const followSectionLink = (event: MouseEvent<HTMLAnchorElement>, id?: string) => {
    if (!isPlainNavigation(event)) return;
    event.preventDefault();
    openSection(id);
  };
  const launch = (destination: LandingDestination) => {
    setMobileMenuOpen(false);
    onLaunch(destination);
  };
  useEffect(() => {
    const syncSection = () => {
      const id = location.hash.slice(1);
      window.requestAnimationFrame(() => scrollToSection(id || undefined));
    };
    syncSection();
    window.addEventListener('popstate', syncSection);
    return () => window.removeEventListener('popstate', syncSection);
  }, []);
  const steps = [
    { icon: <FileSignature />, number: '01', title: 'Create one secure record', body: 'Add the item, price, condition, photos, and handoff terms.' },
    { icon: <Link2 />, number: '02', title: 'Share the Deal Link', body: 'Both parties review the same version and keep the conversation together.' },
    { icon: <BadgeDollarSign />, number: '03', title: 'Follow the payment status', body: 'Both parties can see the Stripe Sandbox payment state and what happens next.' },
    { icon: <PackageCheck />, number: '04', title: 'Complete with evidence', body: 'Record delivery, inspection, and the final handoff in the same deal history.' },
  ];

  return <div className="app view-home">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header">
      <div className="header-inner">
        <div className="header-brand-group">
          <a className="brand" href="/" aria-label="Dealivra home" onClick={event => followSectionLink(event)}><BrandLogo /></a>
          <span className="beta">Launching in the U.S.</span>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="/" onClick={event => followSectionLink(event)}>Home</a>
          <a href="/#how-it-works" onClick={event => followSectionLink(event, 'how-it-works')}>How it works</a>
          <a href="/#protection" onClick={event => followSectionLink(event, 'protection')}>Protection</a>
          <a href="/fees" onClick={event => { if (!isPlainNavigation(event)) return; event.preventDefault(); launch('fees'); }}>Fees</a>
        </nav>
        <div className="header-actions">
          <div className="account">
            <button onClick={() => launch('signin')}>Sign in</button>
            <button className="header-signup" onClick={() => launch('signup')}>Create account</button>
          </div>
          <button
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(open => !open)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
    {mobileMenuOpen && <nav className="mobile-menu" aria-label="Mobile navigation">
      <a href="/" onClick={event => followSectionLink(event)}>Home</a>
      <a href="/#how-it-works" onClick={event => followSectionLink(event, 'how-it-works')}>How it works</a>
      <a href="/#protection" onClick={event => followSectionLink(event, 'protection')}>Protection</a>
      <a href="/fees" onClick={event => { if (!isPlainNavigation(event)) return; event.preventDefault(); launch('fees'); }}>Fees</a>
      <a href="/disputes" onClick={event => { if (!isPlainNavigation(event)) return; event.preventDefault(); launch('disputes'); }}>Disputes</a>
      <button className="mobile-signin" onClick={() => launch('signin')}>Sign in</button>
      <button className="mobile-signup" onClick={() => launch('signup')}>Create account</button>
    </nav>}

    <main id="main-content" tabIndex={-1}>
      <section className="global-hero">
        <div className="global-hero-copy">
          <p className="global-kicker"><ShieldCheck size={17} />One Deal Room from agreement to handoff</p>
          <h1>Make every private deal<br /><span>clear from the start.</span></h1>
          <p className="global-lede">Agree on the terms, follow the payment status, and keep delivery evidence together in one private transaction record.</p>
          <div className="global-hero-actions">
            <button type="button" className="global-primary" onClick={() => launch('create')}><Plus size={18} />Start a deal<ArrowRight size={18} /></button>
            <button type="button" className="global-secondary" onClick={() => launch('demo')}><Eye size={18} />See a sample</button>
          </div>
          <div className="global-proof">
            <span><FileSignature size={18} />Shared agreement</span>
            <span><BadgeDollarSign size={18} />Visible payment status</span>
            <span><PackageCheck size={18} />Recorded handoff</span>
          </div>
          <p className="beta-payment-note"><ShieldAlert size={16} />Sandbox demo — no real money is transferred. Dealivra is not legal escrow.</p>
        </div>
        <div className="network-stage" aria-label="Dealivra protected transaction flow">
          <article className="home-product-preview">
            <header>
              <div><span className="preview-mark"><ShieldCheck /></span><div><small>DEAL ROOM</small><b>One place for the whole transaction</b></div></div>
              <span className="preview-live"><i></i>Sandbox workflow</span>
            </header>
            <div className="preview-item">
              <span className="preview-item-icon"><Laptop /></span>
              <div><small>ACTIVE DEAL</small><strong>MacBook Pro 14 · M3</strong><p>Like new · Ship to buyer</p></div>
              <b>$1,450.00</b>
            </div>
            <div className="preview-progress" role="group" aria-label="Deal progress">
              <div className="done"><span><Check /></span><small>Agreement</small></div><i></i>
              <div className="active"><span><LockKeyhole /></span><small>Payment</small></div><i></i>
              <div><span><Truck /></span><small>Delivery</small></div><i></i>
              <div><span><PackageCheck /></span><small>Complete</small></div>
            </div>
            <div className="preview-next">
              <div><small>NEXT STEP</small><b>Buyer reviews and confirms the shared terms</b></div>
              <button type="button" onClick={() => launch('demo')}>Open sample<ArrowRight /></button>
            </div>
            <footer><span><BadgeCheck />Seller contact verified</span><span><Fingerprint />Agreement version recorded</span></footer>
          </article>
        </div>
      </section>

      <section className="home-capability-strip" aria-label="What Dealivra keeps together">
        <article><FileSignature /><div><b>Clear agreement</b><span>Price, condition, and handoff terms in one version.</span></div></article>
        <article><BadgeDollarSign /><div><b>Visible payment state</b><span>Both parties can see what is ready and what comes next.</span></div></article>
        <article><PackageCheck /><div><b>Proof of delivery</b><span>Photos, inspection, and handoff stay with the deal.</span></div></article>
        <article><Scale /><div><b>Dispute record</b><span>Problems and evidence remain tied to the same timeline.</span></div></article>
      </section>

      <section className="deal-flow deferred-home-section" id="how-it-works">
        <div className="global-section-heading">
          <p className="eyebrow">HOW DEALIVRA WORKS</p>
          <h2>A clear path from agreement to completion.</h2>
          <p>The essential steps stay visible to both sides, without the clutter of a traditional marketplace.</p>
        </div>
        <div className="deal-flow-grid">{steps.map(step => <article key={step.number}><div className="flow-icon">{step.icon}</div><span>{step.number}</span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
      </section>

      <section className="home-use-cases deferred-home-section" aria-labelledby="use-cases-title">
        <div className="global-section-heading">
          <p className="eyebrow">BUILT FOR PRIVATE SALES</p>
          <h2 id="use-cases-title">Useful when the item matters and the buyer is not beside you.</h2>
          <p>Dealivra is focused on higher-trust private transactions, not an endless public marketplace feed.</p>
        </div>
        <div className="use-case-grid">
          <article><Laptop /><div><h3>Electronics</h3><p>Record condition, serial details, photos, shipping, and inspection expectations.</p></div></article>
          <article><Car /><div><h3>Vehicles</h3><p>Keep VIN details, known defects, price, and the planned in-person handoff together.</p></div></article>
          <article><Watch /><div><h3>Watches and collectibles</h3><p>Document identifiers, authenticity claims, included accessories, and delivery evidence.</p></div></article>
        </div>
      </section>

      <section className="money-flow deferred-home-section" aria-labelledby="money-flow-title">
        <div className="money-flow-copy">
          <p className="eyebrow">PAYMENT CLARITY</p>
          <h2 id="money-flow-title">Know what the beta does before you continue.</h2>
          <p>The current product demonstrates a Stripe Sandbox payment workflow. It does not transfer real money and Dealivra is not a licensed escrow service.</p>
          <ol>
            <li><span>1</span><div><strong>Agree to one version</strong><small>Both parties review the same item, price, disclosures, and handoff terms.</small></div></li>
            <li><span>2</span><div><strong>Open Stripe Sandbox</strong><small>The buyer tests checkout without a real charge or live card transfer.</small></div></li>
            <li><span>3</span><div><strong>Record delivery evidence</strong><small>Shipping, inspection, messages, and handoff activity stay with the deal.</small></div></li>
            <li><span>4</span><div><strong>Complete or raise a problem</strong><small>The final status remains visible in the same transaction history.</small></div></li>
          </ol>
        </div>
        <aside className="fee-preview" aria-label="Production cost preview">
          <p className="eyebrow">PRODUCTION COST PREVIEW</p>
          <h3>Every charge must be visible before payment.</h3>
          <dl>
            <div><dt>Item price</dt><dd>Set by seller</dd></div>
            <div><dt>Dealivra service fee</dt><dd>Shown before payment</dd></div>
            <div><dt>Processing, shipping, and tax</dt><dd>Itemized separately</dd></div>
            <div className="fee-total"><dt>Final amount</dt><dd>One U.S. dollar total</dd></div>
          </dl>
          <p><ShieldAlert />Production pricing, payment limits, and state availability are not published yet.</p>
          <button type="button" className="global-secondary light" onClick={() => launch('fees')}>Read fees and availability<ArrowRight size={16} /></button>
        </aside>
      </section>

      <section className="global-protection deferred-home-section" id="protection">
        <div className="global-protection-copy">
          <p className="eyebrow">BUILT FOR TRUST</p>
          <h2>Protection both parties can understand.</h2>
          <p>Dealivra keeps the agreement, payment status, evidence, and handoff history in one private transaction record.</p>
          <button type="button" className="global-secondary light" onClick={() => launch('create')}>Start a deal<ArrowRight size={17} /></button>
        </div>
        <div className="protection-grid">
          <article><FileSignature /><div><h3>One shared agreement</h3><p>Price, disclosures, and every accepted version stay together.</p></div></article>
          <article><BadgeDollarSign /><div><h3>Visible card-payment status</h3><p>The payment state and seller transfer steps are recorded clearly.</p></div></article>
          <article><ShieldCheck /><div><h3>Evidence before release</h3><p>Shipping, inspection, and disputes use the same deal history.</p></div></article>
        </div>
        <div className="protection-links" aria-label="Learn about protection">
          <a href="/buyer-protection" onClick={event => { event.preventDefault(); launch('buyer-protection'); }}>Buyer protection<ArrowRight size={15} /></a>
          <a href="/seller-protection" onClick={event => { event.preventDefault(); launch('seller-protection'); }}>Seller protection<ArrowRight size={15} /></a>
          <a href="/disputes" onClick={event => { event.preventDefault(); launch('disputes'); }}>Disputes and refunds<ArrowRight size={15} /></a>
          <a href="/fees" onClick={event => { event.preventDefault(); launch('fees'); }}>Fees and availability<ArrowRight size={15} /></a>
        </div>
      </section>

      <section className="home-faq deferred-home-section" aria-labelledby="faq-title">
        <div className="global-section-heading"><p className="eyebrow">BEFORE YOU START</p><h2 id="faq-title">Straight answers about the U.S. beta.</h2></div>
        <div className="faq-list">
          <details><summary>Is Dealivra a legal escrow service?<ChevronDown /></summary><p>No. The current beta records agreements, Sandbox payment status, evidence, and handoff activity. A licensed payment or escrow partner and legal review are required before a live-money launch.</p></details>
          <details><summary>Does Dealivra store card or bank details?<ChevronDown /></summary><p>No. Payment credentials belong in the payment provider flow, not in Dealivra messages, forms, or evidence uploads.</p></details>
          <details><summary>Where is the first release available?<ChevronDown /></summary><p>The first release is planned for the United States in English (US) and U.S. dollars. Provider approval and applicable law may limit availability by state.</p></details>
          <details><summary>What happens if something goes wrong?<ChevronDown /></summary><p>A dispute keeps the reason, messages, delivery evidence, and inspection details in the deal record. Final refund and release rights must follow the published terms and payment-provider rules.</p></details>
        </div>
      </section>

      <section className="global-cta deferred-home-section">
        <div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Make the next private deal easier to trust.</h2></div>
        <button type="button" className="global-primary" onClick={() => launch('create')}>Start a deal<ArrowRight size={18} /></button>
      </section>
    </main>

    <footer>
      <div><BrandLogo className="footer-brand-logo" /><span>Global vision · U.S. launch · English (US) · USD</span></div>
      <nav aria-label="Legal and protection">
        <a href="/buyer-protection" onClick={event => { event.preventDefault(); launch('buyer-protection'); }}>Buyer protection</a>
        <a href="/seller-protection" onClick={event => { event.preventDefault(); launch('seller-protection'); }}>Seller protection</a>
        <a href="/fees" onClick={event => { event.preventDefault(); launch('fees'); }}>Fees</a>
        <a href="/disputes" onClick={event => { event.preventDefault(); launch('disputes'); }}>Disputes</a>
        <a href="/verify" onClick={event => { event.preventDefault(); launch('verify'); }}>Verify agreement</a>
        <a href="/terms" onClick={event => { event.preventDefault(); launch('terms'); }}>Terms</a>
        <a href="/privacy" onClick={event => { event.preventDefault(); launch('privacy'); }}>Privacy</a>
      </nav>
    </footer>
  </div>;
}
