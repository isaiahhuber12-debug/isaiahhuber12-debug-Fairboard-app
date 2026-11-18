export const THIRTY_MINUTES_MS = 30 * 60_000;

export interface BrowserNotificationOptions {
  tag?: string;
  groupId?: string | null;
  notificationId?: string | null;
  url?: string;
}

export function getEvent30mReminderEpochMs(startEpochMs: number): number {
  return Math.round(startEpochMs - THIRTY_MINUTES_MS);
}

export function isReminderAt30mSet(
  reminders: number[] | undefined,
  eventStartEpochMs: number
): boolean {
  if (!reminders || reminders.length === 0) return false;
  const targetMs = getEvent30mReminderEpochMs(eventStartEpochMs);
  return reminders.some((ts) => Math.abs(ts - targetMs) < 1000);
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isPushManagerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(ua) || isTouchMac;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ]);
    if (ready) return ready;
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function dispatchPushOrBrowserNotification(
  title: string,
  body: string,
  optionsOrTag?: string | BrowserNotificationOptions
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  const options: BrowserNotificationOptions =
    typeof optionsOrTag === 'string' ? { tag: optionsOrTag } : (optionsOrTag ?? {});

  try {
    if ('serviceWorker' in navigator) {
      const reg = await registerNotificationServiceWorker();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: options.tag,
          data: {
            url: options.url ?? '/',
            groupId: options.groupId ?? null,
            notificationId: options.notificationId ?? null,
          },
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: options.tag,
    });
    return true;
  } catch {
    return false;
  }
}

export async function postBrowserNotification(
  title: string,
  body: string,
  options?: BrowserNotificationOptions
): Promise<boolean> {
  return dispatchPushOrBrowserNotification(title, body, options);
}

export async function sendHomeScreenPushNotification(
  platform: 'ios' | 'android' | 'desktop'
): Promise<boolean> {
  const title = 'Add RallyHub to Your Home Screen';
  const body =
    platform === 'ios'
      ? 'In Safari, tap the Share button and choose "Add to Home Screen" for instant app access and alerts.'
      : platform === 'android'
        ? 'Tap "Add to Home Screen" (or Chrome menu ⋮ -> Install app) for fast access and push alerts.'
        : 'Install RallyHub to your home screen or desktop for one-tap access and push alerts.';
  return dispatchPushOrBrowserNotification(title, body, {
    tag: 'rallyhub-add-to-homescreen',
    url: '/',
  });
}

const activeTimers = new Map<string, number>();

export function reminderTimerKey(itemId: string, triggerAtEpochMs: number): string {
  return `${itemId}::${Math.round(triggerAtEpochMs)}`;
}

export function scheduleBrowserReminder(
  itemId: string,
  title: string,
  body: string,
  triggerAtEpochMs: number,
  onTrigger?: () => void
): void {
  const rounded = Math.round(triggerAtEpochMs);
  const key = reminderTimerKey(itemId, rounded);
  cancelBrowserReminderAt(itemId, rounded);
  const delayMs = Math.max(0, rounded - Date.now());
  // Cap setTimeout to max 32-bit signed int (~24.8 days)
  if (delayMs > 2_147_483_647) return;
  const timerId = window.setTimeout(() => {
    activeTimers.delete(key);
    onTrigger?.();
    void postBrowserNotification(title, body, {
      tag: `rallyhub-reminder-${itemId}`,
      url: '/?tab=alerts',
    });
  }, delayMs);
  activeTimers.set(key, timerId);
}

export function cancelBrowserReminderAt(itemId: string, triggerAtEpochMs: number): void {
  const key = reminderTimerKey(itemId, Math.round(triggerAtEpochMs));
  const existing = activeTimers.get(key);
  if (existing !== undefined) {
    window.clearTimeout(existing);
    activeTimers.delete(key);
  }
}

export function cancelBrowserReminder(itemId: string): void {
  const prefix = `${itemId}::`;
  for (const [key, timerId] of activeTimers.entries()) {
    if (key === itemId || key.startsWith(prefix)) {
      window.clearTimeout(timerId);
      activeTimers.delete(key);
    }
  }
}
