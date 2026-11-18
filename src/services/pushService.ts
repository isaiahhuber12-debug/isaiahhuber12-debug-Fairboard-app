import { auth } from '../lib/firebase';
import { getStoredGuestSession } from '../lib/guestSession';
import {
  isNotificationSupported,
  isPushManagerSupported,
  registerNotificationServiceWorker,
} from '../lib/notifications';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getSessionHeaders(): Promise<Record<string, string> | null> {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }
  const guest = getStoredGuestSession();
  if (guest?.uid) {
    return {
      'Content-Type': 'application/json',
      'X-Guest-Uid': guest.uid,
    };
  }
  return null;
}

/**
 * Best-effort Web Push subscription sync for receiving announcement notifications as regular phone
 * notifications even when the app tab is minimized or closed. Falls back silently when PushManager
 * isn't supported (e.g. inside restricted WebViews or before iOS Home Screen installation).
 */
export async function syncWebPushSubscription(groupIds: string[]): Promise<boolean> {
  try {
    if (!isPushManagerSupported() || !isNotificationSupported()) return false;
    if (Notification.permission !== 'granted') return false;

    const reg = await registerNotificationServiceWorker();
    if (!reg || !reg.pushManager) return false;

    const headers = await getSessionHeaders();
    if (!headers) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const keyResp = await fetch('/api/push/public-key');
      if (!keyResp.ok) return false;
      const { publicKey } = (await keyResp.json()) as { publicKey?: string };
      if (!publicKey) return false;

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    const resp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        groupIds: groupIds.slice(0, 100),
        subscription: sub.toJSON(),
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  try {
    if (!isPushManagerSupported()) return;
    const reg = await registerNotificationServiceWorker();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    const headers = await getSessionHeaders();
    if (headers && endpoint) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch {
    // Best-effort cleanup
  }
}

export async function broadcastAnnouncementPush(params: {
  groupId: string;
  groupName?: string | null;
  notificationId?: string | null;
  title: string;
  body: string;
  senderName?: string | null;
}): Promise<void> {
  try {
    const headers = await getSessionHeaders();
    if (!headers) return;
    await fetch('/api/push/broadcast', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
  } catch {
    // Best-effort push broadcast; foreground listeners still receive Firestore snapshot updates
  }
}
