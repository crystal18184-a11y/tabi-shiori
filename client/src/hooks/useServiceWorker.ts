import { useEffect, useState } from 'react';

export type SwStatus = 'idle' | 'installing' | 'active' | 'error' | 'unsupported';

export function useServiceWorker() {
  const [status, setStatus] = useState<SwStatus>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // オンライン/オフライン状態の監視
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Service Worker登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          setStatus('active');

          // アップデート確認
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              setStatus('installing');
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                } else if (newWorker.state === 'activated') {
                  setStatus('active');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
          setStatus('error');
        });
    } else {
      setStatus('unsupported');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  };

  return { status, isOnline, updateAvailable, applyUpdate };
}
