import { auth } from '../lib/firebase';
import type { SmsPreferences } from '../types/rally';

export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const digitsOnly = trimmed.replace(/[^\d+]/g, '');
  if (digitsOnly.startsWith('+')) {
    return `+${digitsOnly.slice(1).replace(/\+/g, '').slice(0, 15)}`;
  }
  const plainDigits = digitsOnly.replace(/\+/g, '');
  if (plainDigits.length === 10) {
    return `+1${plainDigits}`;
  }
  if (plainDigits.length >= 11 && plainDigits.length <= 15) {
    return `+${plainDigits}`;
  }
  return plainDigits ? `+${plainDigits.slice(0, 15)}` : '';
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSmsServerStatus(): Promise<{ configured: boolean }> {
  try {
    const resp = await fetch('/api/sms/status');
    if (!resp.ok) return { configured: false };
    const data = (await resp.json()) as { configured?: boolean };
    return { configured: Boolean(data.configured) };
  } catch {
    return { configured: false };
  }
}

export async function syncSmsSubscriptionsToServer(
  groupMemberships: Array<{ groupId: string; role: string }>,
  prefs: SmsPreferences
): Promise<{ configured: boolean }> {
  const headers = await getAuthHeaders();
  if (!headers) return { configured: false };

  const resp = await fetch('/api/sms/subscriptions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      groupMemberships,
      phone: prefs.phone || null,
      enabled: prefs.enabled,
      forMessages: prefs.forMessages,
      forEvents: prefs.forEvents,
    }),
  });
  const data = (await resp.json().catch(() => ({}))) as { configured?: boolean; error?: string };
  if (!resp.ok) {
    throw new Error(data.error || 'Failed to sync SMS subscription settings.');
  }
  return { configured: Boolean(data.configured) };
}

export async function sendTestSms(
  phone: string,
  groupName?: string | null
): Promise<{ sid?: string }> {
  const headers = await getAuthHeaders();
  if (!headers) {
    throw new Error('Sign in with Google before testing SMS alerts.');
  }
  const resp = await fetch('/api/sms/test', {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, groupName: groupName ?? undefined }),
  });
  const data = (await resp.json().catch(() => ({}))) as { sid?: string; error?: string };
  if (!resp.ok) {
    throw new Error(data.error || 'Could not send test SMS.');
  }
  return { sid: data.sid };
}

export async function dispatchSmsNotification(params: {
  groupId: string;
  groupName?: string | null;
  kind: 'message' | 'event';
  title: string;
  body: string;
  senderName?: string | null;
  channelAccessLevel?: string | null;
}): Promise<{ configured: boolean; eligibleCount: number; sentCount: number }> {
  try {
    const headers = await getAuthHeaders();
    if (!headers) return { configured: false, eligibleCount: 0, sentCount: 0 };
    const resp = await fetch('/api/sms/dispatch', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!resp.ok) return { configured: false, eligibleCount: 0, sentCount: 0 };
    const data = (await resp.json().catch(() => ({}))) as {
      configured?: boolean;
      eligibleCount?: number;
      sentCount?: number;
    };
    return {
      configured: Boolean(data.configured),
      eligibleCount: Number(data.eligibleCount ?? 0),
      sentCount: Number(data.sentCount ?? 0),
    };
  } catch {
    return { configured: false, eligibleCount: 0, sentCount: 0 };
  }
}
