export const THIRTY_MINUTES_MS = 30 * 60_000;

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
    postBrowserNotification(title, body);
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
