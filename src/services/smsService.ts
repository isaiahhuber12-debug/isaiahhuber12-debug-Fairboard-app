import { auth } from '../lib/firebase';
import { getStoredGuestSession } from '../lib/guestSession';
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
  if (plainDigits.length === 11 && plainDigits.startsWith('1')) {
    return `+${plainDigits}`;
  }
  if (plainDigits.length >= 8 && plainDigits.length <= 15) {
    return `+${plainDigits}`;
  }
  return plainDigits ? `+${plainDigits.slice(0, 15)}` : '';
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhoneInput(phone);
  const usMatch = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(normalized);
  if (usMatch) {
    return `+1 (${usMatch[1]}) ${usMatch[2]}-${usMatch[3]}`;
  }
  return normalized || phone;
}

export function parsePhoneListInput(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts = raw
    .split(/[\n,;]+/)
    .map((segment) => normalizePhoneInput(segment))
    .filter((p) => E164_PHONE_REGEX.test(p));
  return Array.from(new Set(parts));
}

/**
 * Builds a cross-platform `sms:` URI that opens the device's native Messages / SMS app
 * with one or multiple recipient phone numbers and message body pre-populated.
 * Works immediately on Android (including APK WebViews), iOS, and desktop Messages apps
 * without requiring server Twilio credentials.
 */
export function buildDeviceSmsUri(phones: string[], body = ''): string {
  const validPhones = Array.from(
    new Set(
      phones
        .map((p) => normalizePhoneInput(p))
        .filter((p) => E164_PHONE_REGEX.test(p))
    )
  );
  if (validPhones.length === 0) return '';

  const isIos =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
  const encodedBody = body.trim() ? encodeURIComponent(body.trim()) : '';

  if (validPhones.length === 1) {
    const phone = validPhones[0];
    if (!encodedBody) return `sms:${phone}`;
    return isIos ? `sms:${phone}&body=${encodedBody}` : `sms:${phone}?body=${encodedBody}`;
  }

  const joined = validPhones.join(',');
  if (isIos) {
    return encodedBody
      ? `sms://open?addresses=${joined}&body=${encodedBody}`
      : `sms://open?addresses=${joined}`;
  }
  return encodedBody ? `sms:${joined}?body=${encodedBody}` : `sms:${joined}`;
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

export interface SmsServerStatus {
  configured: boolean;
  secretsPresent: boolean;
  ready: boolean;
  accountType?: string;
  senderDisplay?: string;
  configIssue?: string;
}

export const DEFAULT_SMS_SERVER_STATUS: SmsServerStatus = {
  configured: false,
  secretsPresent: false,
  ready: false,
};

export async function fetchSmsServerStatus(forceRefresh = false): Promise<SmsServerStatus> {
  try {
    const url = forceRefresh ? '/api/sms/status?refresh=1' : '/api/sms/status';
    const resp = await fetch(url);
    if (!resp.ok) return DEFAULT_SMS_SERVER_STATUS;
    const data = (await resp.json()) as Partial<SmsServerStatus>;
    const configured = Boolean(data.configured);
    const secretsPresent = data.secretsPresent !== undefined ? Boolean(data.secretsPresent) : configured;
    const ready = data.ready !== undefined ? Boolean(data.ready) : configured;
    return {
      configured,
      secretsPresent,
      ready,
      accountType: data.accountType,
      senderDisplay: data.senderDisplay,
      configIssue: data.configIssue,
    };
  } catch {
    return DEFAULT_SMS_SERVER_STATUS;
  }
}

export async function syncSmsSubscriptionsToServer(
  groupMemberships: Array<{ groupId: string; role: string }>,
  prefs: SmsPreferences
): Promise<SmsServerStatus> {
  const headers = await getSessionHeaders();
  if (!headers) return DEFAULT_SMS_SERVER_STATUS;

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
  const data = (await resp.json().catch(() => ({}))) as Partial<SmsServerStatus> & { error?: string };
  if (!resp.ok) {
    throw new Error(data.error || 'Failed to sync SMS subscription settings.');
  }
  const configured = Boolean(data.configured);
  return {
    configured,
    secretsPresent: data.secretsPresent !== undefined ? Boolean(data.secretsPresent) : configured,
    ready: data.ready !== undefined ? Boolean(data.ready) : configured,
    accountType: data.accountType,
    senderDisplay: data.senderDisplay,
    configIssue: data.configIssue,
  };
}

export async function sendTestSms(
  phone: string,
  groupName?: string | null
): Promise<{ sid?: string }> {
  const headers = await getSessionHeaders();
  if (!headers) {
    throw new Error('Join a group or sign in before testing SMS alerts.');
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

export async function sendDirectCloudSms(params: {
  phones: string[];
  message: string;
  groupName?: string | null;
}): Promise<{
  ok: boolean;
  configured: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}> {
  const headers = await getSessionHeaders();
  if (!headers) {
    throw new Error('Sign in or join a group to send cloud SMS broadcasts, or use "Open in SMS App".');
  }
  const resp = await fetch('/api/sms/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phones: params.phones,
      message: params.message,
      groupName: params.groupName ?? undefined,
    }),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    ok?: boolean;
    configured?: boolean;
    sentCount?: number;
    failedCount?: number;
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(data.error || 'Could not send cloud SMS messages.');
  }
  return {
    ok: Boolean(data.ok),
    configured: Boolean(data.configured),
    sentCount: Number(data.sentCount ?? 0),
    failedCount: Number(data.failedCount ?? 0),
    error: data.error,
  };
}

export async function dispatchSmsNotification(params: {
  groupId: string;
  groupName?: string | null;
  kind: 'message' | 'event';
  title: string;
  body: string;
  senderName?: string | null;
  channelAccessLevel?: string | null;
  extraPhones?: string[];
}): Promise<{ configured: boolean; eligibleCount: number; sentCount: number; error?: string }> {
  try {
    const headers = await getSessionHeaders();
    if (!headers) return { configured: false, eligibleCount: 0, sentCount: 0 };
    const resp = await fetch('/api/sms/dispatch', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = (await resp.json().catch(() => ({}))) as {
      configured?: boolean;
      eligibleCount?: number;
      sentCount?: number;
      error?: string;
    };
    if (!resp.ok) {
      return {
        configured: Boolean(data.configured),
        eligibleCount: Number(data.eligibleCount ?? 0),
        sentCount: 0,
        error: data.error,
      };
    }
    return {
      configured: Boolean(data.configured),
      eligibleCount: Number(data.eligibleCount ?? 0),
      sentCount: Number(data.sentCount ?? 0),
      error: data.error,
    };
  } catch {
    return { configured: false, eligibleCount: 0, sentCount: 0 };
  }
}
