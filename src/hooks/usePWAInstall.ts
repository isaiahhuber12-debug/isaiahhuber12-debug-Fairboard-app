import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  sendHomeScreenPushNotification,
} from '../lib/notifications';

export type PwaPlatform = 'ios' | 'android' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'rallyhub_pwa_homescreen_dismissed_at';
const SESSION_PUSH_SENT_KEY = 'rallyhub_pwa_homescreen_push_sent';
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(ev: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb(capturedDeferredPrompt));
  });
  window.addEventListener('appinstalled', () => {
    capturedDeferredPrompt = null;
    promptListeners.forEach((cb) => cb(null));
  });
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): PwaPlatform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => capturedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [platform] = useState<PwaPlatform>(() => detectPlatform());
  const [dismissed, setDismissed] = useState<boolean>(() => wasRecentlyDismissed());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    () => getNotificationPermission()
  );

  useEffect(() => {
    const handlePromptChange = (next: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(next);
    };
    promptListeners.add(handlePromptChange);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      capturedDeferredPrompt = null;
      setDeferredPrompt(null);
    };

    mediaQuery.addEventListener('change', handleDisplayModeChange);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptListeners.delete(handlePromptChange);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Automatically dispatch a browser / Service Worker push notification when visiting
  // the website on iOS or Android (once per session) if notification permission is already granted.
  useEffect(() => {
    if (isInstalled) return;
    if (platform !== 'ios' && platform !== 'android') return;
    if (getNotificationPermission() !== 'granted') return;
    try {
      if (sessionStorage.getItem(SESSION_PUSH_SENT_KEY) === '1') return;
      sessionStorage.setItem(SESSION_PUSH_SENT_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    void sendHomeScreenPushNotification(platform);
  }, [isInstalled, platform]);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEv = deferredPrompt ?? capturedDeferredPrompt;
    if (!promptEv) return 'unavailable';
    await promptEv.prompt();
    const { outcome } = await promptEv.userChoice;
    if (outcome === 'accepted') {
      capturedDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
    return outcome;
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const triggerHomeScreenPushNotification = useCallback(async (): Promise<{
    sent: boolean;
    permission: NotificationPermission | 'unsupported';
  }> => {
    if (!isNotificationSupported()) {
      setNotifPermission('unsupported');
      return { sent: false, permission: 'unsupported' };
    }
    let granted = Notification.permission === 'granted';
    if (Notification.permission === 'default') {
      granted = await requestNotificationPermission();
    }
    const nextPerm = getNotificationPermission();
    setNotifPermission(nextPerm);
    if (!granted) {
      return { sent: false, permission: nextPerm };
    }
    const sent = await sendHomeScreenPushNotification(platform);
    if (sent) {
      try {
        sessionStorage.setItem(SESSION_PUSH_SENT_KEY, '1');
      } catch {
        // Ignore storage errors
      }
    }
    return { sent, permission: nextPerm };
  }, [platform]);

  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';
  const isMobileWeb = isIOS || isAndroid;
  const isInstallable = Boolean(deferredPrompt);

  // Show the automatic push-style website banner on iOS/Android visitors or when installable on desktop
  const showWebsiteBanner = !isInstalled && !dismissed && (isMobileWeb || isInstallable);

  return {
    platform,
    isIOS,
    isAndroid,
    isMobileWeb,
    isInstallable,
    isInstalled,
    notifPermission,
    showWebsiteBanner,
    install,
    dismissBanner,
    triggerHomeScreenPushNotification,
  };
}
