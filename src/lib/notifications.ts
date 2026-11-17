export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
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

export function postBrowserNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/src/assets/images/rallyhub_icon_fg_1794933043507.jpg',
    });
  } catch {
    // Ignore browser notification errors in restricted contexts
  }
}

const activeTimers = new Map<string, number>();

export function scheduleBrowserReminder(
  itemId: string,
  title: string,
  body: string,
  triggerAtEpochMs: number
): void {
  cancelBrowserReminder(itemId);
  const delayMs = Math.max(3000, triggerAtEpochMs - Date.now());
  // Cap setTimeout to max 32-bit signed int (~24.8 days)
  if (delayMs > 2_147_483_647) return;
  const timerId = window.setTimeout(() => {
    postBrowserNotification(title, body);
    activeTimers.delete(itemId);
  }, delayMs);
  activeTimers.set(itemId, timerId);
}

export function cancelBrowserReminder(itemId: string): void {
  const existing = activeTimers.get(itemId);
  if (existing !== undefined) {
    window.clearTimeout(existing);
    activeTimers.delete(itemId);
  }
}
