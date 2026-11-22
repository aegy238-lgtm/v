import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

// Capture beforeinstallprompt globally (and hydrate from index.html early capture)
let globalDeferredPrompt: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' ? window.__deferredPWAInstallPrompt || null : null;
const promptListeners = new Set<(ev: BeforeInstallPromptEvent | null) => void>();

function notifyPromptListeners(ev: BeforeInstallPromptEvent | null) {
  globalDeferredPrompt = ev;
  if (typeof window !== 'undefined') {
    window.__deferredPWAInstallPrompt = ev;
  }
  promptListeners.forEach((cb) => cb(ev));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    notifyPromptListeners(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('fokashat:pwa-prompt-ready', () => {
    if (window.__deferredPWAInstallPrompt) {
      notifyPromptListeners(window.__deferredPWAInstallPrompt);
    }
  });

  window.addEventListener('appinstalled', () => {
    notifyPromptListeners(null);
  });
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function detectInAppBrowser(ua: string): boolean {
  return /fban|fbav|instagram|whatsapp|telegram|tiktok|snapchat|line\/|wv\)|; wv\)/i.test(ua);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () =>
      globalDeferredPrompt ||
      (typeof window !== 'undefined' ? window.__deferredPWAInstallPrompt || null : null)
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(() => detectInIframe());
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    setIsInstalled(detectStandalone());
    setIsInIframe(detectInIframe());

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));
    setIsInAppBrowser(detectInAppBrowser(ua));

    // Hydrate if index.html captured the prompt before React mounted
    if (window.__deferredPWAInstallPrompt && !globalDeferredPrompt) {
      notifyPromptListeners(window.__deferredPWAInstallPrompt);
    } else if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    const onPromptChange = (ev: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(ev);
    };
    promptListeners.add(onPromptChange);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      notifyPromptListeners(null);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      promptListeners.delete(onPromptChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEv =
      deferredPrompt || globalDeferredPrompt || window.__deferredPWAInstallPrompt || null;
    if (!promptEv) return 'unavailable';
    setIsInstalling(true);
    try {
      await promptEv.prompt();
      const { outcome } = await promptEv.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        notifyPromptListeners(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    } finally {
      setIsInstalling(false);
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    isInAppBrowser,
    isInstalling,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
