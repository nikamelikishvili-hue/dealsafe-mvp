import { useEffect, useRef, useState } from 'react';
import { CloudOff, Wifi } from 'lucide-react';
import { t } from './i18n';
import './network-status.css';

type NetworkState = 'online' | 'offline' | 'reconnected';

export function NetworkStatusBanner() {
  const [state, setState] = useState<NetworkState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  );
  const wasOffline = useRef(state === 'offline');
  const clearTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const offline = () => {
      window.clearTimeout(clearTimer.current);
      wasOffline.current = true;
      setState('offline');
    };
    const online = () => {
      window.clearTimeout(clearTimer.current);
      if (!wasOffline.current) return;
      wasOffline.current = false;
      setState('reconnected');
      clearTimer.current = window.setTimeout(() => setState('online'), 3200);
    };

    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.clearTimeout(clearTimer.current);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);

  if (state === 'online') return null;

  return (
    <div
      className={`network-status ${state}`}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      {state === 'offline' ? (
        <>
          <CloudOff aria-hidden="true" />
          <span>
            <b>{t('You are offline.')}</b>{' '}
            {t('Keep this page open. Actions can continue after your connection returns.')}
          </span>
        </>
      ) : (
        <>
          <Wifi aria-hidden="true" />
          <span>
            <b>{t('Connection restored.')}</b>{' '}
            {t('You can continue where you left off.')}
          </span>
        </>
      )}
    </div>
  );
}
