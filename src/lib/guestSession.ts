import {
  DEFAULT_SMS_PREFERENCES,
  type JoinedGroupRef,
  type SmsPreferences,
} from '../types/rally';

const GUEST_SESSION_STORAGE_KEY = 'rallyhub_guest_session_v1';

export interface GuestSession {
  uid: string;
  displayName: string;
  phoneNumber: string;
  smsPreferences: SmsPreferences;
  joinedGroups: JoinedGroupRef[];
  createdAtMs: number;
  updatedAtMs: number;
}

type GuestSessionListener = (session: GuestSession | null) => void;
const listeners = new Set<GuestSessionListener>();

function emitGuestSessionChange(session: GuestSession | null): void {
  for (const listener of listeners) {
    try {
      listener(session);
    } catch {
      // Ignore listener errors
    }
  }
}

export function isGuestUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return /^guest_[a-zA-Z0-9]{16,40}$/.test(uid);
}

export function generateGuestUid(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `guest_${hex}`;
}

export function getStoredGuestSession(): GuestSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession>;
    if (!parsed || typeof parsed.uid !== 'string' || !isGuestUid(parsed.uid)) {
      return null;
    }
    const phoneNumber = typeof parsed.phoneNumber === 'string' ? parsed.phoneNumber : '';
    const smsPrefsRaw = parsed.smsPreferences;
    const smsPreferences: SmsPreferences = {
      phone:
        typeof smsPrefsRaw?.phone === 'string' && smsPrefsRaw.phone
          ? smsPrefsRaw.phone
          : phoneNumber,
      enabled:
        typeof smsPrefsRaw?.enabled === 'boolean'
          ? smsPrefsRaw.enabled
          : Boolean(phoneNumber),
      forMessages:
        typeof smsPrefsRaw?.forMessages === 'boolean'
          ? smsPrefsRaw.forMessages
          : DEFAULT_SMS_PREFERENCES.forMessages,
      forEvents:
        typeof smsPrefsRaw?.forEvents === 'boolean'
          ? smsPrefsRaw.forEvents
          : DEFAULT_SMS_PREFERENCES.forEvents,
    };
    const joinedGroups = Array.isArray(parsed.joinedGroups)
      ? parsed.joinedGroups.filter(
          (g): g is JoinedGroupRef =>
            Boolean(g && typeof g === 'object' && typeof g.groupId === 'string')
        )
      : [];
    return {
      uid: parsed.uid,
      displayName:
        typeof parsed.displayName === 'string' && parsed.displayName.trim()
          ? parsed.displayName.trim()
          : 'Participant',
      phoneNumber,
      smsPreferences,
      joinedGroups,
      createdAtMs: typeof parsed.createdAtMs === 'number' ? parsed.createdAtMs : Date.now(),
      updatedAtMs: typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
  emitGuestSessionChange(session);
}

export function ensureGuestSession(displayName: string, phoneNumber: string): GuestSession {
  const existing = getStoredGuestSession();
  const now = Date.now();
  const cleanName = displayName.trim().slice(0, 60) || existing?.displayName || 'Participant';
  const cleanPhone = phoneNumber.trim() || existing?.phoneNumber || '';

  const next: GuestSession = {
    uid: existing?.uid ?? generateGuestUid(),
    displayName: cleanName,
    phoneNumber: cleanPhone,
    smsPreferences: {
      phone: cleanPhone,
      enabled: existing ? existing.smsPreferences.enabled || Boolean(cleanPhone) : Boolean(cleanPhone),
      forMessages: existing?.smsPreferences.forMessages ?? true,
      forEvents: existing?.smsPreferences.forEvents ?? true,
    },
    joinedGroups: existing?.joinedGroups ?? [],
    createdAtMs: existing?.createdAtMs ?? now,
    updatedAtMs: now,
  };
  saveGuestSession(next);
  return next;
}

export function updateGuestProfile(updates: {
  displayName?: string;
  phoneNumber?: string;
  smsPreferences?: SmsPreferences;
}): GuestSession | null {
  const existing = getStoredGuestSession();
  if (!existing) return null;
  const nextPhone =
    updates.smsPreferences?.phone !== undefined
      ? updates.smsPreferences.phone.trim()
      : updates.phoneNumber !== undefined
        ? updates.phoneNumber.trim()
        : existing.phoneNumber;

  const next: GuestSession = {
    ...existing,
    displayName:
      updates.displayName !== undefined && updates.displayName.trim()
        ? updates.displayName.trim().slice(0, 60)
        : existing.displayName,
    phoneNumber: nextPhone,
    smsPreferences: updates.smsPreferences
      ? {
          phone: nextPhone,
          enabled: Boolean(updates.smsPreferences.enabled && nextPhone),
          forMessages: Boolean(updates.smsPreferences.forMessages),
          forEvents: Boolean(updates.smsPreferences.forEvents),
        }
      : {
          ...existing.smsPreferences,
          phone: nextPhone,
        },
    updatedAtMs: Date.now(),
  };
  saveGuestSession(next);
  return next;
}

export function upsertGuestJoinedGroup(ref: JoinedGroupRef): void {
  const existing = getStoredGuestSession();
  if (!existing) return;
  const idx = existing.joinedGroups.findIndex((g) => g.groupId === ref.groupId);
  const nextGroups = [...existing.joinedGroups];
  if (idx >= 0) {
    nextGroups[idx] = {
      ...nextGroups[idx],
      ...ref,
      joinedAtMs: nextGroups[idx].joinedAtMs || ref.joinedAtMs,
      updatedAtMs: Date.now(),
    };
  } else {
    nextGroups.unshift(ref);
  }
  nextGroups.sort((a, b) => b.joinedAtMs - a.joinedAtMs);
  saveGuestSession({
    ...existing,
    joinedGroups: nextGroups,
    updatedAtMs: Date.now(),
  });
}

export function removeGuestJoinedGroup(groupId: string): void {
  const existing = getStoredGuestSession();
  if (!existing) return;
  const filtered = existing.joinedGroups.filter((g) => g.groupId !== groupId);
  if (filtered.length === existing.joinedGroups.length) return;
  saveGuestSession({
    ...existing,
    joinedGroups: filtered,
    updatedAtMs: Date.now(),
  });
}

export function clearGuestSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  emitGuestSessionChange(null);
}

export function subscribeGuestSession(listener: GuestSessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
