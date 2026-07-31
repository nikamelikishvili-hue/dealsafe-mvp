import React from 'react';
import { createRoot } from 'react-dom/client';
import { PublicLanding, type LandingDestination } from './PublicLanding';
import { initializeI18n } from './i18n';
import { publicInfoPaths, verifyPath } from './navigation';
import { AppErrorBoundary, ApplicationFailurePage } from './AppErrorBoundary';
import { reportClientFailure } from './services/clientFailureReporter.ts';
import { startWebVitalMonitoring } from './services/webVitalReporter.ts';
import './styles.css';
import './home.css';
import './global-redesign.css';
import './workspace-redesign.css';
import './verification-polish.css';
import './dealivra-brand.css';

const demoDealPath = '/?deal=DV7K4M2Q';

const analyticsHost = location.hostname === 'dealivra.com'
  || location.hostname === 'www.dealivra.com'
  || location.hostname.endsWith('.vercel.app');
if (analyticsHost) {
  const analyticsScript = document.createElement('script');
  analyticsScript.src = '/_vercel/insights/script.js';
  analyticsScript.defer = true;
  document.head.append(analyticsScript);
}
startWebVitalMonitoring();

const root = createRoot(document.getElementById('root')!);

const destinationPath: Record<Exclude<LandingDestination, 'create' | 'signin' | 'signup' | 'demo'>, string> = {
  ...publicInfoPaths,
  verify: verifyPath,
};

const loadFullApp = async (destination?: LandingDestination) => {
  if (destination === 'demo') {
    history.pushState({}, '', demoDealPath);
  } else if (destination === 'create' || destination === 'signin' || destination === 'signup') {
    history.pushState({}, '', `/?start=${destination}`);
  } else if (destination) {
    history.pushState({}, '', destinationPath[destination]);
  }

  try {
    const { App } = await import('./app');
    root.render(<React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);
  } catch {
    reportClientFailure({
      schema: 'dealivra.client-failure.v1',
      boundary: 'application_bootstrap',
      issue: 'bundle_load_failed',
    });
    root.render(<React.StrictMode><ApplicationFailurePage /></React.StrictMode>);
  }
};

window.addEventListener('error', () => {
  reportClientFailure({
    schema: 'dealivra.client-failure.v1',
    boundary: 'browser_runtime',
    issue: 'window_error',
  });
});
window.addEventListener('unhandledrejection', () => {
  reportClientFailure({
    schema: 'dealivra.client-failure.v1',
    boundary: 'browser_runtime',
    issue: 'unhandled_promise_rejection',
  });
});

// Do not retain browser-readable refresh tokens created by pre-hardening builds.
localStorage.removeItem('dealsafe_session');
const hasStoredSession = Boolean(
  sessionStorage.getItem('dealivra_session_v2'),
);
const hashParams = new URLSearchParams(location.hash.slice(1));
const hasRecoveryHash = hashParams.get('type') === 'recovery' && Boolean(hashParams.get('access_token'));
const needsFullApp = hasStoredSession || location.pathname !== '/' || Boolean(location.search) || hasRecoveryHash;

void initializeI18n()
  .catch(() => {
    reportClientFailure({
      schema: 'dealivra.client-failure.v1',
      boundary: 'application_bootstrap',
      issue: 'localization_initialization_failed',
    });
  })
  .then(() => {
    if (needsFullApp) {
      void loadFullApp();
      return;
    }
    root.render(<React.StrictMode><AppErrorBoundary><PublicLanding onLaunch={destination => void loadFullApp(destination)} /></AppErrorBoundary></React.StrictMode>);
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(registration => registration.update())
        .catch(() => {});
      return;
    }
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => {});
  });
}
