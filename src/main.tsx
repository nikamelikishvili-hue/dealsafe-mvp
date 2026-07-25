import React from 'react';
import { createRoot } from 'react-dom/client';
import { PublicLanding, type LandingDestination } from './PublicLanding';
import { initializeI18n } from './i18n';
import './styles.css';
import './home.css';
import './global-redesign.css';
import './workspace-redesign.css';
import './verification-polish.css';
import './dealivra-brand.css';

const root = createRoot(document.getElementById('root')!);

const destinationPath: Record<Exclude<LandingDestination, 'create' | 'signin' | 'signup' | 'demo'>, string> = {
  'buyer-protection': '/buyer-protection',
  'seller-protection': '/seller-protection',
  fees: '/fees',
  disputes: '/disputes',
  terms: '/terms',
  privacy: '/privacy',
  verify: '/verify',
};

const loadFullApp = async (destination?: LandingDestination) => {
  if (destination === 'demo') {
    history.pushState({}, '', '/?deal=DV-7K4M2Q');
  } else if (destination === 'create' || destination === 'signin' || destination === 'signup') {
    history.pushState({}, '', `/?start=${destination}`);
  } else if (destination) {
    history.pushState({}, '', destinationPath[destination]);
  }

  const { App } = await import('./app');
  root.render(<React.StrictMode><App /></React.StrictMode>);
};

const hasStoredSession = Boolean(localStorage.getItem('dealsafe_session'));
const needsFullApp = hasStoredSession || location.pathname !== '/' || Boolean(location.search) || Boolean(location.hash);

void initializeI18n()
  .catch(() => {})
  .then(() => {
    if (needsFullApp) {
      void loadFullApp();
      return;
    }
    root.render(<React.StrictMode><PublicLanding onLaunch={destination => void loadFullApp(destination)} /></React.StrictMode>);
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
