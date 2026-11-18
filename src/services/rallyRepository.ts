import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  isValidBackgroundSpec,
  isValidColorMode,
  isValidColorTheme,
  type PersonalAppearance,
  readStoredPersonalAppearance,
  sanitizePersonalAppearance,
  subscribeStoredPersonalAppearance,
  writeStoredPersonalAppearance,
} from '../lib/backgrounds';
import { isValidGroupImageUrl, normalizeGroupImageInput } from '../lib/groupImages';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import {
  getStoredGuestSession,
  isGuestUid,
  removeGuestJoinedGroup,
  subscribeGuestSession,
  updateGuestProfile,
  upsertGuestJoinedGroup,
} from '../lib/guestSession';
import { E164_PHONE_REGEX, normalizePhoneInput } from './smsService';
import {
  ActivityAction,
  ActivityCategory,
  ApprovalStatus,
  ChannelAccessLevel,
  type ChatChannel,
  type ChatMessage,
  DEFAULT_SMS_PREFERENCES,
  type EventTask,
  type GroupActivityLog,
  type GroupMember,
  type HubNotification,
  type JoinedGroupRef,
  type MemberContactInfo,
  MemberRole,
  MessageType,
  NotificationType,
  type RallyEvent,
  type RallyGroup,
  type SmsPreferences,
  TaskStatus,
} from '../types/rally';

export const MAX_GROUP_MEMBERS = 500;
export const MAX_TASK_CAPACITY = 500;

function makeId(prefix: string, len = 14): string {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, len);
  return `${prefix}_${raw}`;
}

function tsToMs(val: unknown, fallback = Date.now()): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    const secs = Number((val as { seconds: number }).seconds);
    if (!Number.isNaN(secs)) return secs * 1000;
  }
  return fallback;
}

function optionalTsToMs(val: unknown): number | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    const secs = Number((val as { seconds: number }).seconds);
    if (!Number.isNaN(secs)) return secs * 1000;
  }
  return null;
}

function requireUserId(): string {
  const uid = auth.currentUser?.uid ?? getStoredGuestSession()?.uid;
  if (!uid) {
    throw new Error('Join a group with a code or sign in with Google first.');
  }
  return uid;
}

function requireGoogleUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Sign in with Google to create or manage groups.');
  }
  return uid;
}

export function normalizeGroupCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

export async function ensureUserProfile(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(docRef);
    const displayName = (
      user.displayName?.trim() ||
      user.email?.split('@')[0]?.trim() ||
      'Member'
    ).slice(0, 60);
    const email = (user.email?.trim() || `${uid}@rallyhub.app`).slice(0, 160);

    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        payload.photoUrl = user.photoURL.slice(0, 500);
      }
      await setDoc(docRef, payload);
    } else {
      const existingName =
        typeof snap.data().displayName === 'string' && snap.data().displayName.trim()
          ? snap.data().displayName.trim()
          : displayName;
      await updateDoc(docRef, {
        displayName: existingName.slice(0, 60),
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserSmsPreferences(
  uid: string,
  onData: (prefs: SmsPreferences) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!auth.currentUser && isGuestUid(uid)) {
    const cur = getStoredGuestSession();
    onData(cur?.smsPreferences ?? DEFAULT_SMS_PREFERENCES);
    return subscribeGuestSession((session) => {
      onData(session?.smsPreferences ?? DEFAULT_SMS_PREFERENCES);
    });
  }

  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SMS_PREFERENCES);
        return;
      }
      const data = snap.data();
      onData({
        phone: typeof data.smsPhone === 'string' ? data.smsPhone : '',
        enabled: Boolean(data.smsEnabled ?? false),
        forMessages: data.smsForMessages === undefined ? true : Boolean(data.smsForMessages),
        forEvents: data.smsForEvents === undefined ? true : Boolean(data.smsForEvents),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export async function upsertMemberContact(
  groupId: string,
  params: {
    uid: string;
    displayName: string;
    phoneNumber: string;
    email?: string | null;
    authMethod: 'GOOGLE' | 'CODE_GUEST';
    smsEnabled: boolean;
  }
): Promise<void> {
  const cleanPhone = normalizePhoneInput(params.phoneNumber);
  if (!E164_PHONE_REGEX.test(cleanPhone)) return;

  const payload: Record<string, unknown> = {
    uid: params.uid,
    displayName: (params.displayName.trim() || 'Member').slice(0, 60),
    phoneNumber: cleanPhone,
    authMethod: params.authMethod,
    smsEnabled: Boolean(params.smsEnabled),
    updatedAt: serverTimestamp(),
  };
  if (params.authMethod === 'GOOGLE' && params.email && params.email.trim().length >= 3) {
    payload.email = params.email.trim().slice(0, 160);
  }
  await setDoc(doc(db, 'groups', groupId, 'memberContacts', params.uid), payload);
}

export function subscribeMemberContacts(
  groupId: string,
  onData: (contactsByUid: Record<string, MemberContactInfo>) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/memberContacts`;
  return onSnapshot(
    collection(db, 'groups', groupId, 'memberContacts'),
    (snap) => {
      const map: Record<string, MemberContactInfo> = {};
      for (const d of snap.docs) {
        const data = d.data();
        const uid = String(data.uid ?? d.id);
        map[uid] = {
          uid,
          displayName: String(data.displayName ?? 'Member'),
          phoneNumber: String(data.phoneNumber ?? ''),
          email: typeof data.email === 'string' ? data.email : null,
          authMethod: data.authMethod === 'CODE_GUEST' ? 'CODE_GUEST' : 'GOOGLE',
          smsEnabled: Boolean(data.smsEnabled ?? true),
          updatedAtMs: tsToMs(data.updatedAt, 0),
        };
      }
      onData(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export async function saveUserSmsPreferences(
  prefs: SmsPreferences,
  options?: {
    joinedGroupIds?: string[];
    displayName?: string;
  }
): Promise<void> {
  const uid = requireUserId();
  const cleanPhone = prefs.phone.trim() ? normalizePhoneInput(prefs.phone) : '';
  if (cleanPhone && !E164_PHONE_REGEX.test(cleanPhone)) {
    throw new Error('Phone number must be in E.164 format (e.g. +15551234567).');
  }
  if (prefs.enabled && !cleanPhone) {
    throw new Error('Enter a mobile phone number before enabling SMS notifications.');
  }

  const nextPrefs: SmsPreferences = {
    phone: cleanPhone,
    enabled: Boolean(prefs.enabled && cleanPhone),
    forMessages: Boolean(prefs.forMessages),
    forEvents: Boolean(prefs.forEvents),
  };

  if (!auth.currentUser && isGuestUid(uid)) {
    updateGuestProfile({
      displayName: options?.displayName,
      phoneNumber: cleanPhone,
      smsPreferences: nextPrefs,
    });
  } else {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      const resolvedName = (
        options?.displayName?.trim() ||
        auth.currentUser?.displayName?.trim() ||
        auth.currentUser?.email?.split('@')[0]?.trim() ||
        'Member'
      ).slice(0, 60);
      const email = (auth.currentUser?.email?.trim() || `${uid}@rallyhub.app`).slice(0, 160);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid,
          displayName: resolvedName,
          email,
          smsPhone: cleanPhone || null,
          smsEnabled: nextPrefs.enabled,
          smsForMessages: nextPrefs.forMessages,
          smsForEvents: nextPrefs.forEvents,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const updatePayload: Record<string, unknown> = {
          smsPhone: cleanPhone || null,
          smsEnabled: nextPrefs.enabled,
          smsForMessages: nextPrefs.forMessages,
          smsForEvents: nextPrefs.forEvents,
          updatedAt: serverTimestamp(),
        };
        if (options?.displayName?.trim()) {
          updatePayload.displayName = options.displayName.trim().slice(0, 60);
        }
        await updateDoc(userRef, updatePayload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  if (cleanPhone && options?.joinedGroupIds && options.joinedGroupIds.length > 0) {
    const isGuest = !auth.currentUser && isGuestUid(uid);
    const resolvedName =
      options.displayName?.trim() ||
      auth.currentUser?.displayName?.trim() ||
      getStoredGuestSession()?.displayName ||
      'Member';
    await Promise.allSettled(
      options.joinedGroupIds.slice(0, 25).map((gid) =>
        upsertMemberContact(gid, {
          uid,
          displayName: resolvedName,
          phoneNumber: cleanPhone,
          email: auth.currentUser?.email ?? null,
          authMethod: isGuest ? 'CODE_GUEST' : 'GOOGLE',
          smsEnabled: nextPrefs.enabled,
        })
      )
    );
  }
}

export function subscribeUserPersonalAppearance(
  uid: string,
  onData: (appearance: PersonalAppearance) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const initialLocal = readStoredPersonalAppearance(uid);
  onData(initialLocal);
  const unsubLocal = subscribeStoredPersonalAppearance(uid, onData);

  if (!auth.currentUser && isGuestUid(uid)) {
    return unsubLocal;
  }

  const path = `users/${uid}`;
  const unsubRemote = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(readStoredPersonalAppearance(uid));
        return;
      }
      const data = snap.data();
      const fallback = readStoredPersonalAppearance(uid);
      const hasAnyRemoteField =
        typeof data.personalColorTheme === 'string' ||
        typeof data.personalColorMode === 'string' ||
        typeof data.personalBackground === 'string' ||
        typeof data.personalBannerBackground === 'string';

      if (!hasAnyRemoteField) {
        onData(fallback);
        return;
      }

      const resolved = sanitizePersonalAppearance({
        colorTheme:
          typeof data.personalColorTheme === 'string' && isValidColorTheme(data.personalColorTheme)
            ? data.personalColorTheme
            : fallback.colorTheme,
        colorMode:
          typeof data.personalColorMode === 'string' && isValidColorMode(data.personalColorMode)
            ? data.personalColorMode
            : fallback.colorMode,
        appBackground:
          typeof data.personalBackground === 'string' && isValidBackgroundSpec(data.personalBackground)
            ? data.personalBackground
            : fallback.appBackground,
        bannerBackground:
          typeof data.personalBannerBackground === 'string' &&
          isValidBackgroundSpec(data.personalBannerBackground)
            ? data.personalBannerBackground
            : fallback.bannerBackground,
      });

      writeStoredPersonalAppearance(uid, resolved);
      onData(resolved);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e);
      }
    }
  );

  return () => {
    unsubLocal();
    unsubRemote();
  };
}

export function subscribeJoinedGroups(
  uid: string,
  onData: (groups: JoinedGroupRef[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  if (!auth.currentUser && isGuestUid(uid)) {
    onData(getStoredGuestSession()?.joinedGroups ?? []);
    return subscribeGuestSession((session) => {
      onData(session?.joinedGroups ?? []);
    });
  }

  const path = `users/${uid}/joinedGroups`;
  return onSnapshot(
    collection(db, 'users', uid, 'joinedGroups'),
    (snap) => {
      const list: JoinedGroupRef[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            groupId: String(data.groupId ?? d.id),
            groupName: String(data.groupName ?? ''),
            groupCode: String(data.groupCode ?? ''),
            role: String(data.role ?? MemberRole.PARTICIPANT),
            groupBackground:
              typeof data.groupBackground === 'string' ? data.groupBackground : null,
            groupImageUrl:
              typeof data.groupImageUrl === 'string' ? data.groupImageUrl : null,
            joinedAtMs: tsToMs(data.joinedAt, 0),
            updatedAtMs: tsToMs(data.updatedAt, 0),
          };
        })
        .sort((a, b) => b.joinedAtMs - a.joinedAtMs);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeGroup(
  groupId: string,
  onData: (group: RallyGroup | null) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}`;
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data();
      onData({
        id: snap.id,
        name: String(data.name ?? ''),
        description: String(data.description ?? ''),
        groupCode: String(data.groupCode ?? ''),
        ownerId: String(data.ownerId ?? ''),
        groupBackground:
          typeof data.groupBackground === 'string' ? data.groupBackground : null,
        groupImageUrl:
          typeof data.groupImageUrl === 'string' ? data.groupImageUrl : null,
        createdAtMs: tsToMs(data.createdAt, 0),
        updatedAtMs: tsToMs(data.updatedAt, 0),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeMembers(
  groupId: string,
  onData: (members: GroupMember[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/members`;
  return onSnapshot(
    collection(db, 'groups', groupId, 'members'),
    (snap) => {
      const list: GroupMember[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid ?? d.id),
          displayName: String(data.displayName ?? 'Member'),
          role: String(data.role ?? MemberRole.PARTICIPANT),
          tasksSignedUpCount: Number(data.tasksSignedUpCount ?? 0),
          messagesSentCount: Number(data.messagesSentCount ?? 0),
          joinedAtMs: tsToMs(data.joinedAt, 0),
          updatedAtMs: tsToMs(data.updatedAt, 0),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeEvents(
  groupId: string,
  onData: (events: RallyEvent[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/events`;
  const q = query(collection(db, 'groups', groupId, 'events'), orderBy('startEpochMs', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: RallyEvent[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title ?? ''),
          description: String(data.description ?? ''),
          location: String(data.location ?? ''),
          category: String(data.category ?? 'General'),
          startEpochMs: Number(data.startEpochMs ?? 0),
          endEpochMs: Number(data.endEpochMs ?? 0),
          createdBy: String(data.createdBy ?? ''),
          organizerName: String(data.organizerName ?? ''),
          createdAtMs: tsToMs(data.createdAt, 0),
          updatedAtMs: tsToMs(data.updatedAt, 0),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeTasksForEvent(
  groupId: string,
  eventId: string,
  onData: (tasks: EventTask[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/events/${eventId}/tasks`;
  const q = query(
    collection(db, 'groups', groupId, 'events', eventId, 'tasks'),
    orderBy('deadlineEpochMs', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: EventTask[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          eventId: String(data.eventId ?? eventId),
          title: String(data.title ?? ''),
          description: String(data.description ?? ''),
          deadlineEpochMs: Number(data.deadlineEpochMs ?? 0),
          capacity: Number(data.capacity ?? 1),
          assignedCount: Number(data.assignedCount ?? 0),
          assignedUids: Array.isArray(data.assignedUids)
            ? data.assignedUids.filter((x): x is string => typeof x === 'string')
            : [],
          assignedNames: Array.isArray(data.assignedNames)
            ? data.assignedNames.filter((x): x is string => typeof x === 'string')
            : [],
          status: String(data.status ?? TaskStatus.OPEN),
          chatChannelId: typeof data.chatChannelId === 'string' ? data.chatChannelId : null,
          createdBy: String(data.createdBy ?? ''),
          createdAtMs: tsToMs(data.createdAt, 0),
          updatedAtMs: tsToMs(data.updatedAt, 0),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeChannels(
  groupId: string,
  role: MemberRole,
  onData: (channels: ChatChannel[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/channels`;
  const isSignedInUser = Boolean(auth.currentUser);
  const allowedLevels = !isSignedInUser
    ? ['ALL']
    : role === MemberRole.CREATOR || role === MemberRole.ADMIN
      ? ['ALL', 'ORGANIZER', 'ADMIN']
      : role === MemberRole.ORGANIZER
        ? ['ALL', 'ORGANIZER']
        : ['ALL'];

  const q = query(
    collection(db, 'groups', groupId, 'channels'),
    where('accessLevel', 'in', allowedLevels)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatChannel[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? ''),
            description: String(data.description ?? ''),
            accessLevel: String(data.accessLevel ?? ChannelAccessLevel.ALL),
            eventId: typeof data.eventId === 'string' ? data.eventId : null,
            createdBy: String(data.createdBy ?? ''),
            messageCount: Number(data.messageCount ?? 0),
            lastMessagePreview: typeof data.lastMessagePreview === 'string' ? data.lastMessagePreview : null,
            lastMessageAtMs: optionalTsToMs(data.lastMessageAt),
            createdAtMs: tsToMs(data.createdAt, 0),
            updatedAtMs: tsToMs(data.updatedAt, 0),
          };
        })
        .sort(
          (a, b) =>
            (b.lastMessageAtMs ?? b.createdAtMs) - (a.lastMessageAtMs ?? a.createdAtMs)
        );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeMessages(
  groupId: string,
  channelId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/channels/${channelId}/messages`;
  const q = query(
    collection(db, 'groups', groupId, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'asc'),
    limitToLast(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          channelId: String(data.channelId ?? channelId),
          senderId: String(data.senderId ?? ''),
          senderName: String(data.senderName ?? ''),
          senderRole: String(data.senderRole ?? MemberRole.PARTICIPANT),
          text: String(data.text ?? ''),
          messageType: String(data.messageType ?? MessageType.TEXT),
          createdAtMs: tsToMs(data.createdAt, Date.now()),
          updatedAtMs: optionalTsToMs(data.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export function subscribeNotifications(
  groupId: string,
  role: MemberRole,
  uid: string,
  onData: (notifications: HubNotification[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `groups/${groupId}/notifications`;
  const isSignedInUser = Boolean(auth.currentUser);
  const allowedRoles = !isSignedInUser
    ? ['ALL', 'PARTICIPANT']
    : role === MemberRole.CREATOR || role === MemberRole.ADMIN
      ? ['ALL', 'PARTICIPANT', 'ORGANIZER', 'ADMIN']
      : role === MemberRole.ORGANIZER
        ? ['ALL', 'PARTICIPANT', 'ORGANIZER']
        : ['ALL', 'PARTICIPANT'];

  const roleQuery = query(
    collection(db, 'groups', groupId, 'notifications'),
    where('targetRole', 'in', allowedRoles)
  );

  let roleItems: HubNotification[] = [];
  let ownItems: HubNotification[] = [];

  const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): HubNotification => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title ?? ''),
      body: String(data.body ?? ''),
      notificationType: String(data.notificationType ?? NotificationType.ANNOUNCEMENT),
      targetScope: String(data.targetScope ?? 'ALL'),
      targetRole: String(data.targetRole ?? 'ALL'),
      targetChannelId: typeof data.targetChannelId === 'string' ? data.targetChannelId : null,
      targetChannelName: typeof data.targetChannelName === 'string' ? data.targetChannelName : null,
      targetEventId: typeof data.targetEventId === 'string' ? data.targetEventId : null,
      senderId: String(data.senderId ?? ''),
      senderName: String(data.senderName ?? ''),
      scheduledForEpochMs:
        typeof data.scheduledForEpochMs === 'number' ? data.scheduledForEpochMs : null,
      approvalStatus: String(data.approvalStatus ?? ApprovalStatus.APPROVED),
      createdAtMs: tsToMs(data.createdAt, Date.now()),
      updatedAtMs: optionalTsToMs(data.updatedAt),
    };
  };

  const emitMerged = () => {
    const byId = new Map<string, HubNotification>();
    for (const item of [...roleItems, ...ownItems]) {
      byId.set(item.id, item);
    }
    const merged = Array.from(byId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
    onData(merged);
  };

  const unsubRole = onSnapshot(
    roleQuery,
    (snap) => {
      roleItems = snap.docs.map(mapDoc);
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );

  const isAdminOrCreator =
    isSignedInUser && (role === MemberRole.CREATOR || role === MemberRole.ADMIN);
  if (isAdminOrCreator || !isSignedInUser) {
    return unsubRole;
  }

  const ownQuery = query(
    collection(db, 'groups', groupId, 'notifications'),
    where('senderId', '==', uid)
  );
  const unsubOwn = onSnapshot(
    ownQuery,
    (snap) => {
      ownItems = snap.docs.map(mapDoc);
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );

  return () => {
    unsubRole();
    unsubOwn();
  };
}

export function subscribeActivityLogs(
  groupId: string,
  onData: (logs: GroupActivityLog[]) => void,
  onError: (err: unknown) => void,
  maxEntries = 200
): Unsubscribe {
  const path = `groups/${groupId}/activityLogs`;
  const q = query(
    collection(db, 'groups', groupId, 'activityLogs'),
    orderBy('createdAt', 'desc'),
    limit(maxEntries)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: GroupActivityLog[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          actorId: String(data.actorId ?? ''),
          actorName: String(data.actorName ?? 'Member'),
          actorRole: String(data.actorRole ?? MemberRole.PARTICIPANT),
          category: String(data.category ?? ActivityCategory.TASK),
          action: String(data.action ?? ActivityAction.TASK_UPDATED),
          summary: String(data.summary ?? ''),
          details: typeof data.details === 'string' ? data.details : null,
          targetId: typeof data.targetId === 'string' ? data.targetId : null,
          createdAtMs: tsToMs(data.createdAt, Date.now()),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e);
      }
    }
  );
}

export async function fetchActivityLogsForExport(
  groupId: string,
  maxEntries = 2000
): Promise<GroupActivityLog[]> {
  requireUserId();
  const path = `groups/${groupId}/activityLogs`;
  try {
    const q = query(
      collection(db, 'groups', groupId, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(maxEntries)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        actorId: String(data.actorId ?? ''),
        actorName: String(data.actorName ?? 'Member'),
        actorRole: String(data.actorRole ?? MemberRole.PARTICIPANT),
        category: String(data.category ?? ActivityCategory.TASK),
        action: String(data.action ?? ActivityAction.TASK_UPDATED),
        summary: String(data.summary ?? ''),
        details: typeof data.details === 'string' ? data.details : null,
        targetId: typeof data.targetId === 'string' ? data.targetId : null,
        createdAtMs: tsToMs(data.createdAt, Date.now()),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function recordActivityLog(
  groupId: string,
  params: {
    actorName: string;
    actorRole: MemberRole;
    category: ActivityCategory;
    action: ActivityAction;
    summary: string;
    details?: string | null;
    targetId?: string | null;
  }
): Promise<void> {
  const uid = requireUserId();
  const logId = makeId('act', 16);
  const path = `groups/${groupId}/activityLogs/${logId}`;
  const cleanSummary = params.summary.trim().slice(0, 200);
  if (cleanSummary.length < 2) return;

  try {
    const payload: Record<string, unknown> = {
      actorId: uid,
      actorName: (params.actorName.trim() || 'Member').slice(0, 60),
      actorRole: params.actorRole,
      category: params.category,
      action: params.action,
      summary: cleanSummary,
      createdAt: serverTimestamp(),
    };
    const cleanDetails = params.details?.trim().slice(0, 300);
    if (cleanDetails) {
      payload.details = cleanDetails;
    }
    const cleanTargetId = params.targetId?.trim();
    if (cleanTargetId && /^[a-zA-Z0-9_-]{1,128}$/.test(cleanTargetId)) {
      payload.targetId = cleanTargetId;
    }
    await setDoc(doc(db, 'groups', groupId, 'activityLogs', logId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createGroupWithCode(
  groupName: StringLike,
  description: string,
  rawGroupCode: string,
  groupImageUrl?: string | null
): Promise<string> {
  const normalizedCode = normalizeGroupCode(rawGroupCode);
  const groupId = makeId('grp', 16);
  const uid = requireGoogleUserId();
  const trimmedName = groupName.trim();
  const cleanImageUrl = normalizeGroupImageInput(groupImageUrl);

  if (trimmedName.length < 2 || trimmedName.length > 80) {
    throw new Error('Group name must be 2–80 characters.');
  }
  if (!/^[A-Z0-9_-]{4,24}$/.test(normalizedCode)) {
    throw new Error('Group code must be 4–24 characters (A–Z, 0–9, -, _).');
  }
  if (cleanImageUrl && !isValidGroupImageUrl(cleanImageUrl)) {
    throw new Error('Group image must be a valid HTTPS URL or uploaded PNG/JPG/WebP/GIF.');
  }

  try {
    const existingCode = await getDoc(doc(db, 'groupCodes', normalizedCode));
    if (existingCode.exists()) {
      throw new Error(`Group code '${normalizedCode}' is already taken.`);
    }

    const displayName = (
      auth.currentUser?.displayName?.trim() ||
      auth.currentUser?.email?.split('@')[0]?.trim() ||
      'Creator'
    ).slice(0, 60);
    const trimmedDesc = description.trim().slice(0, 500);
    const groupRef = doc(db, 'groups', groupId);

    // Step 1: Create group document first so security rules verify ownership
    const groupPayload: Record<string, unknown> = {
      name: trimmedName,
      description: trimmedDesc,
      groupCode: normalizedCode,
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (cleanImageUrl) {
      groupPayload.groupImageUrl = cleanImageUrl;
    }
    await setDoc(groupRef, groupPayload);

    try {
      // Step 2: Claim groupCode and register creator membership
      const setupBatch = writeBatch(db);
      setupBatch.set(doc(db, 'groupCodes', normalizedCode), {
        groupId,
        groupName: trimmedName,
        createdBy: uid,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setupBatch.set(doc(db, 'groups', groupId, 'members', uid), {
        uid,
        displayName,
        role: MemberRole.CREATOR,
        tasksSignedUpCount: 0,
        messagesSentCount: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setupBatch.commit();

      // Step 3: Default role-tiered channels
      const defaultChannels: Array<[string, string, ChannelAccessLevel, string]> = [
        ['general', 'General Lobby', ChannelAccessLevel.ALL, 'Community announcements & participant Q&A'],
        ['organizers', 'Event Organizers', ChannelAccessLevel.ORGANIZER, 'Shift leads, logistics & task coordination'],
        ['admins', 'Admin Command', ChannelAccessLevel.ADMIN, 'Private admin coordination & permissions'],
      ];
      const channelBatch = writeBatch(db);
      for (const [idSuffix, title, accessLevel, desc] of defaultChannels) {
        channelBatch.set(doc(db, 'groups', groupId, 'channels', `ch_${idSuffix}`), {
          name: title,
          description: desc,
          accessLevel,
          createdBy: uid,
          messageCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await channelBatch.commit();

      // Step 4: Index in user's joinedGroups last
      const joinedPayload: Record<string, unknown> = {
        groupId,
        groupName: trimmedName,
        groupCode: normalizedCode,
        role: MemberRole.CREATOR,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanImageUrl) {
        joinedPayload.groupImageUrl = cleanImageUrl;
      }
      await setDoc(doc(db, 'users', uid, 'joinedGroups', groupId), joinedPayload);
    } catch (innerErr) {
      try {
        await deleteDoc(groupRef);
      } catch {
        // Ignore rollback failure
      }
      throw innerErr;
    }

    void recordActivityLog(groupId, {
      actorName: displayName,
      actorRole: MemberRole.CREATOR,
      category: ActivityCategory.GROUP,
      action: ActivityAction.GROUP_CREATED,
      summary: `Created group "${trimmedName}"`,
      details: `Invite code ${normalizedCode}`,
      targetId: groupId,
    }).catch(() => {});

    return groupId;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already taken')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}`);
  }
}

type StringLike = string;

export async function updateGroupCode(
  groupId: string,
  oldCode: string,
  newRawCode: string,
  groupName: string
): Promise<string> {
  const newCode = normalizeGroupCode(newRawCode);
  const uid = requireUserId();
  if (!/^[A-Z0-9_-]{4,24}$/.test(newCode)) {
    throw new Error('Group code must be 4–24 characters (A–Z, 0–9, -, _).');
  }
  if (newCode === oldCode) return newCode;

  try {
    const existing = await getDoc(doc(db, 'groupCodes', newCode));
    if (existing.exists()) {
      throw new Error(`Group code '${newCode}' is already in use.`);
    }
    const batch = writeBatch(db);
    if (oldCode.trim()) {
      batch.delete(doc(db, 'groupCodes', oldCode));
    }
    batch.set(doc(db, 'groupCodes', newCode), {
      groupId,
      groupName: groupName.trim().slice(0, 80),
      createdBy: uid,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'groups', groupId), {
      groupCode: newCode,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', uid, 'joinedGroups', groupId), {
      groupCode: newCode,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return newCode;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already in use')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
  }
}

export async function updateGroupDetails(
  groupId: string,
  name: string,
  description: string,
  currentCode: string
): Promise<void> {
  const path = `groups/${groupId}`;
  const uid = requireUserId();
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    throw new Error('Group name must be 2–80 characters.');
  }
  const trimmedDesc = description.trim().slice(0, 500);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'groups', groupId), {
      name: trimmedName,
      description: trimmedDesc,
      updatedAt: serverTimestamp(),
    });
    if (currentCode.trim()) {
      batch.update(doc(db, 'groupCodes', currentCode), {
        groupName: trimmedName,
        updatedAt: serverTimestamp(),
      });
    }
    batch.update(doc(db, 'users', uid, 'joinedGroups', groupId), {
      groupName: trimmedName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserPersonalAppearance(
  appearance: PersonalAppearance
): Promise<PersonalAppearance> {
  const uid = requireUserId();
  const clean = writeStoredPersonalAppearance(uid, appearance);

  if (!auth.currentUser && isGuestUid(uid)) {
    return clean;
  }

  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const displayName = (
        auth.currentUser?.displayName?.trim() ||
        auth.currentUser?.email?.split('@')[0]?.trim() ||
        'Member'
      ).slice(0, 60);
      const email = (auth.currentUser?.email?.trim() || `${uid}@rallyhub.app`).slice(0, 160);
      await setDoc(userRef, {
        uid,
        displayName,
        email,
        personalColorTheme: clean.colorTheme,
        personalColorMode: clean.colorMode,
        personalBackground: clean.appBackground,
        personalBannerBackground: clean.bannerBackground,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        personalColorTheme: clean.colorTheme,
        personalColorMode: clean.colorMode,
        personalBackground: clean.appBackground,
        personalBannerBackground: clean.bannerBackground,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return clean;
}

export async function updateGroupImage(
  groupId: string,
  groupImageUrl: string | null
): Promise<void> {
  const uid = requireUserId();
  const path = `groups/${groupId}`;
  const cleanImageUrl = normalizeGroupImageInput(groupImageUrl);
  if (cleanImageUrl !== null && !isValidGroupImageUrl(cleanImageUrl)) {
    throw new Error('Group image must be a valid HTTPS URL or uploaded PNG/JPG/WebP/GIF.');
  }

  try {
    await updateDoc(doc(db, 'groups', groupId), {
      groupImageUrl: cleanImageUrl,
      updatedAt: serverTimestamp(),
    });
    try {
      const joinedRef = doc(db, 'users', uid, 'joinedGroups', groupId);
      const joinedSnap = await getDoc(joinedRef);
      if (joinedSnap.exists()) {
        await updateDoc(joinedRef, {
          groupImageUrl: cleanImageUrl,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Best-effort joinedGroups cache sync
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGroup(groupId: string, groupCode?: string | null): Promise<void> {
  const uid = requireUserId();
  const path = `groups/${groupId}`;
  try {
    let codeToDelete = groupCode?.trim() ? normalizeGroupCode(groupCode) : '';
    if (!codeToDelete) {
      const groupSnap = await getDoc(doc(db, 'groups', groupId));
      if (groupSnap.exists()) {
        codeToDelete = normalizeGroupCode(String(groupSnap.data().groupCode ?? ''));
      }
    }

    if (codeToDelete) {
      try {
        const codeRef = doc(db, 'groupCodes', codeToDelete);
        const codeSnap = await getDoc(codeRef);
        if (codeSnap.exists() && codeSnap.data().groupId === groupId) {
          await deleteDoc(codeRef);
        }
      } catch {
        // Best-effort invite code cleanup
      }
    }

    await deleteDoc(doc(db, 'groups', groupId));

    try {
      await deleteDoc(doc(db, 'users', uid, 'joinedGroups', groupId));
    } catch {
      // Best-effort user index cleanup
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeJoinedGroupRef(groupId: string): Promise<void> {
  const uid = requireUserId();
  if (!auth.currentUser && isGuestUid(uid)) {
    removeGuestJoinedGroup(groupId);
    return;
  }
  const path = `users/${uid}/joinedGroups/${groupId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'joinedGroups', groupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateOwnDisplayName(
  groupId: string,
  newDisplayName: string,
  newPhoneNumber?: string | null
): Promise<void> {
  const uid = requireUserId();
  const isGuest = !auth.currentUser && isGuestUid(uid);
  const path = `groups/${groupId}/members/${uid}`;
  const clean = newDisplayName.trim();
  if (clean.length < 1 || clean.length > 60) {
    throw new Error('Display name must be 1–60 characters.');
  }
  const cleanPhone =
    newPhoneNumber !== undefined && newPhoneNumber !== null && newPhoneNumber.trim()
      ? normalizePhoneInput(newPhoneNumber)
      : null;
  if (cleanPhone && !E164_PHONE_REGEX.test(cleanPhone)) {
    throw new Error('Enter a valid cell phone number (e.g. +15551234567).');
  }

  try {
    if (isGuest) {
      await updateDoc(doc(db, 'groups', groupId, 'members', uid), {
        displayName: clean,
        updatedAt: serverTimestamp(),
      });
      const updatedGuest = updateGuestProfile({
        displayName: clean,
        ...(cleanPhone ? { phoneNumber: cleanPhone } : {}),
      });
      const phoneToSync = cleanPhone ?? updatedGuest?.phoneNumber ?? '';
      if (phoneToSync && E164_PHONE_REGEX.test(phoneToSync)) {
        await upsertMemberContact(groupId, {
          uid,
          displayName: clean,
          phoneNumber: phoneToSync,
          email: null,
          authMethod: 'CODE_GUEST',
          smsEnabled: updatedGuest?.smsPreferences.enabled ?? true,
        });
      }
    } else {
      const batch = writeBatch(db);
      batch.update(doc(db, 'groups', groupId, 'members', uid), {
        displayName: clean,
        updatedAt: serverTimestamp(),
      });
      const userUpdate: Record<string, unknown> = {
        displayName: clean,
        updatedAt: serverTimestamp(),
      };
      if (cleanPhone) {
        userUpdate.smsPhone = cleanPhone;
        userUpdate.smsEnabled = true;
      }
      batch.update(doc(db, 'users', uid), userUpdate);
      await batch.commit();

      if (cleanPhone) {
        await upsertMemberContact(groupId, {
          uid,
          displayName: clean,
          phoneNumber: cleanPhone,
          email: auth.currentUser?.email ?? null,
          authMethod: 'GOOGLE',
          smsEnabled: true,
        }).catch(() => {});
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function joinGroupByCode(
  rawCode: string,
  displayNameOverride?: string | null,
  phoneNumberOverride?: string | null
): Promise<string> {
  const code = normalizeGroupCode(rawCode);
  const uid = requireUserId();
  const isGuest = !auth.currentUser && isGuestUid(uid);
  if (!/^[A-Z0-9_-]{4,24}$/.test(code)) {
    throw new Error('Enter a valid 4–24 character Group Code.');
  }

  const guestSession = isGuest ? getStoredGuestSession() : null;
  const resolvedNameRaw =
    displayNameOverride !== undefined
      ? (displayNameOverride ?? '').trim()
      : guestSession?.displayName?.trim() || auth.currentUser?.displayName?.trim() || '';

  if (resolvedNameRaw.length < 2) {
    throw new Error('Please enter your name (at least 2 characters) to join a group.');
  }
  const displayName = resolvedNameRaw.slice(0, 60);

  const rawPhoneCandidate =
    phoneNumberOverride?.trim() || guestSession?.phoneNumber?.trim() || '';
  const normalizedPhone = rawPhoneCandidate ? normalizePhoneInput(rawPhoneCandidate) : '';
  if (isGuest && !E164_PHONE_REGEX.test(normalizedPhone)) {
    throw new Error('Please enter a valid cell phone number (e.g. (555) 123-4567).');
  }
  if (rawPhoneCandidate && !E164_PHONE_REGEX.test(normalizedPhone)) {
    throw new Error('Please enter a valid cell phone number (e.g. (555) 123-4567).');
  }

  try {
    const codeSnap = await getDoc(doc(db, 'groupCodes', code));
    if (!codeSnap.exists() || codeSnap.data().active === false) {
      throw new Error(`No active group found for code '${code}'.`);
    }
    const groupId = codeSnap.data().groupId as string | undefined;
    if (!groupId) {
      throw new Error('Group code is missing target group.');
    }
    const groupName = String(codeSnap.data().groupName ?? 'RallyHub Group').slice(0, 80);

    const memberRef = doc(db, 'groups', groupId, 'members', uid);
    const existingMember = await getDoc(memberRef);
    const resolvedRole = existingMember.exists()
      ? String(existingMember.data().role ?? MemberRole.PARTICIPANT)
      : MemberRole.PARTICIPANT;

    if (!existingMember.exists()) {
      await setDoc(memberRef, {
        uid,
        displayName,
        role: MemberRole.PARTICIPANT,
        tasksSignedUpCount: 0,
        messagesSentCount: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const countSnap = await getCountFromServer(collection(db, 'groups', groupId, 'members'));
      if (countSnap.data().count > MAX_GROUP_MEMBERS) {
        try {
          await deleteDoc(memberRef);
        } catch {
          // Best-effort rollback
        }
        throw new Error(
          `This group has reached its maximum capacity of ${MAX_GROUP_MEMBERS} members.`
        );
      }
    } else if (
      displayNameOverride?.trim() &&
      displayName !== existingMember.data().displayName
    ) {
      await updateDoc(memberRef, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }

    // Resolve phone number for Google users from profile if not passed explicitly
    let finalPhone = normalizedPhone;
    if (!finalPhone && auth.currentUser) {
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists() && typeof userSnap.data().smsPhone === 'string') {
          finalPhone = normalizePhoneInput(userSnap.data().smsPhone);
        }
      } catch {
        // Ignore profile lookup errors
      }
    }

    if (finalPhone && E164_PHONE_REGEX.test(finalPhone)) {
      await upsertMemberContact(groupId, {
        uid,
        displayName,
        phoneNumber: finalPhone,
        email: auth.currentUser?.email ?? null,
        authMethod: isGuest ? 'CODE_GUEST' : 'GOOGLE',
        smsEnabled: true,
      }).catch(() => {});

      if (auth.currentUser && normalizedPhone) {
        await updateDoc(doc(db, 'users', uid), {
          displayName,
          smsPhone: normalizedPhone,
          smsEnabled: true,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }

    if (isGuest) {
      let groupBackground: string | null = null;
      let groupImageUrl: string | null = null;
      try {
        const grpSnap = await getDoc(doc(db, 'groups', groupId));
        if (grpSnap.exists()) {
          groupBackground =
            typeof grpSnap.data().groupBackground === 'string'
              ? grpSnap.data().groupBackground
              : null;
          groupImageUrl =
            typeof grpSnap.data().groupImageUrl === 'string'
              ? grpSnap.data().groupImageUrl
              : null;
        }
      } catch {
        // Ignore optional metadata fetch error
      }
      updateGuestProfile({ displayName, phoneNumber: finalPhone });
      upsertGuestJoinedGroup({
        id: groupId,
        groupId,
        groupName,
        groupCode: code,
        role: resolvedRole,
        groupBackground,
        groupImageUrl,
        joinedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
    } else {
      const joinedGroupRef = doc(db, 'users', uid, 'joinedGroups', groupId);
      const existingJoined = await getDoc(joinedGroupRef);
      if (existingJoined.exists()) {
        await updateDoc(joinedGroupRef, {
          groupName,
          groupCode: code,
          role: resolvedRole,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(joinedGroupRef, {
          groupId,
          groupName,
          groupCode: code,
          role: resolvedRole,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (!existingMember.exists()) {
      void recordActivityLog(groupId, {
        actorName: displayName,
        actorRole: MemberRole.PARTICIPANT,
        category: ActivityCategory.MEMBER,
        action: ActivityAction.MEMBER_JOINED,
        summary: `Joined "${groupName}"`,
        details: isGuest ? `Joined via invite code ${code}` : `Invite code ${code}`,
        targetId: uid,
      }).catch(() => {});
    }
    return groupId;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('No active group found') ||
        error.message.includes('Group code') ||
        error.message.includes('maximum capacity') ||
        error.message.includes('enter your name') ||
        error.message.includes('cell phone'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `groupCodes/${code}`);
  }
}

export async function ensureCreatorMemberRecord(groupId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const path = `groups/${groupId}/members/${uid}`;
  try {
    const memberRef = doc(db, 'groups', groupId, 'members', uid);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      const displayName = (
        auth.currentUser?.displayName?.trim() ||
        auth.currentUser?.email?.split('@')[0]?.trim() ||
        'Creator'
      ).slice(0, 60);
      await setDoc(memberRef, {
        uid,
        displayName,
        role: MemberRole.CREATOR,
        tasksSignedUpCount: 0,
        messagesSentCount: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateMemberRole(
  groupId: string,
  targetMemberUid: string,
  newRole: MemberRole
): Promise<void> {
  requireUserId();
  if (newRole === MemberRole.CREATOR) {
    throw new Error('Creator role cannot be assigned.');
  }
  const path = `groups/${groupId}/members/${targetMemberUid}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'members', targetMemberUid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMember(
  groupId: string,
  targetMemberUid: string
): Promise<void> {
  const actorUid = requireGoogleUserId();
  if (targetMemberUid === actorUid) {
    throw new Error('You cannot remove yourself from the group here.');
  }
  const path = `groups/${groupId}/members/${targetMemberUid}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'members', targetMemberUid));
    await deleteDoc(doc(db, 'groups', groupId, 'memberContacts', targetMemberUid)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createEvent(
  groupId: string,
  title: string,
  description: string,
  location: string,
  category: string,
  startEpochMs: number,
  endEpochMs: number,
  organizerName: string
): Promise<string> {
  const uid = requireUserId();
  const eventId = makeId('evt', 14);
  const path = `groups/${groupId}/events/${eventId}`;
  const cleanTitle = title.trim();
  const cleanLoc = location.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Event title must be 2–100 characters.');
  }
  if (cleanLoc.length < 1 || cleanLoc.length > 160) {
    throw new Error('Location is required.');
  }
  if (endEpochMs < startEpochMs) {
    throw new Error('End time must be after start time.');
  }

  try {
    await setDoc(doc(db, 'groups', groupId, 'events', eventId), {
      title: cleanTitle,
      description: description.trim().slice(0, 1000),
      location: cleanLoc,
      category: (category.trim() || 'General').slice(0, 40),
      startEpochMs: Math.round(startEpochMs),
      endEpochMs: Math.round(endEpochMs),
      createdBy: uid,
      organizerName: (organizerName.trim() || 'Organizer').slice(0, 60),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return eventId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateEvent(
  groupId: string,
  eventId: string,
  title: string,
  description: string,
  location: string,
  category: string,
  startEpochMs: number,
  endEpochMs: number,
  organizerName: string
): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/events/${eventId}`;
  const cleanTitle = title.trim();
  const cleanLoc = location.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Event title must be 2–100 characters.');
  }
  if (cleanLoc.length < 1 || cleanLoc.length > 160) {
    throw new Error('Location is required.');
  }
  if (endEpochMs < startEpochMs) {
    throw new Error('End time must be after start time.');
  }

  try {
    await updateDoc(doc(db, 'groups', groupId, 'events', eventId), {
      title: cleanTitle,
      description: description.trim().slice(0, 1000),
      location: cleanLoc,
      category: (category.trim() || 'General').slice(0, 40),
      startEpochMs: Math.round(startEpochMs),
      endEpochMs: Math.round(endEpochMs),
      organizerName: (organizerName.trim() || 'Organizer').slice(0, 60),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEvent(groupId: string, eventId: string): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/events/${eventId}`;
  try {
    try {
      const tasksSnap = await getDocs(
        collection(db, 'groups', groupId, 'events', eventId, 'tasks')
      );
      if (!tasksSnap.empty) {
        await Promise.allSettled(tasksSnap.docs.map((d) => deleteDoc(d.ref)));
      }
    } catch {
      // Proceed to delete event document even if child task cleanup is partial
    }
    await deleteDoc(doc(db, 'groups', groupId, 'events', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createTask(
  groupId: string,
  eventId: string,
  title: string,
  description: string,
  deadlineEpochMs: number,
  capacity: number,
  chatChannelId?: string | null
): Promise<string> {
  const uid = requireUserId();
  const taskId = makeId('tsk', 14);
  const path = `groups/${groupId}/events/${eventId}/tasks/${taskId}`;
  const cleanTitle = title.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Task title must be 2–100 characters.');
  }
  if (capacity < 1 || capacity > MAX_TASK_CAPACITY) {
    throw new Error(`Capacity must be between 1 and ${MAX_TASK_CAPACITY}.`);
  }

  try {
    const payload: Record<string, unknown> = {
      eventId,
      title: cleanTitle,
      description: description.trim().slice(0, 600),
      deadlineEpochMs: Math.round(deadlineEpochMs),
      capacity: Math.round(capacity),
      assignedCount: 0,
      assignedUids: [],
      assignedNames: [],
      status: TaskStatus.OPEN,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (chatChannelId && chatChannelId.trim()) {
      payload.chatChannelId = chatChannelId.trim();
    }
    await setDoc(doc(db, 'groups', groupId, 'events', eventId, 'tasks', taskId), payload);
    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTask(
  groupId: string,
  eventId: string,
  taskId: string,
  title: string,
  description: string,
  deadlineEpochMs: number,
  capacity: number,
  assignedCount: number,
  status: TaskStatus,
  chatChannelId?: string | null
): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/events/${eventId}/tasks/${taskId}`;
  const cleanTitle = title.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Task title must be 2–100 characters.');
  }
  const minCap = Math.max(1, assignedCount);
  if (capacity < minCap || capacity > MAX_TASK_CAPACITY) {
    throw new Error(`Capacity must be between ${minCap} and ${MAX_TASK_CAPACITY}.`);
  }
  const effectiveStatus =
    status === TaskStatus.COMPLETED
      ? TaskStatus.COMPLETED
      : assignedCount >= capacity
        ? TaskStatus.FILLED
        : TaskStatus.OPEN;

  try {
    await updateDoc(doc(db, 'groups', groupId, 'events', eventId, 'tasks', taskId), {
      title: cleanTitle,
      description: description.trim().slice(0, 600),
      deadlineEpochMs: Math.round(deadlineEpochMs),
      capacity: Math.round(capacity),
      status: effectiveStatus,
      chatChannelId: chatChannelId && chatChannelId.trim() ? chatChannelId.trim() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(
  groupId: string,
  eventId: string,
  taskId: string
): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/events/${eventId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'events', eventId, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleTaskSignup(
  groupId: string,
  eventId: string,
  taskId: string,
  memberDisplayName: string
): Promise<boolean> {
  const uid = requireUserId();
  const path = `groups/${groupId}/events/${eventId}/tasks/${taskId}`;
  const taskRef = doc(db, 'groups', groupId, 'events', eventId, 'tasks', taskId);

  try {
    const signedUpNow = await runTransaction(db, async (tx) => {
      const snap = await tx.get(taskRef);
      if (!snap.exists()) {
        throw new Error('Task not found.');
      }
      const data = snap.data();
      const capacity = Number(data.capacity ?? 1);
      const status = String(data.status ?? TaskStatus.OPEN);
      if (status === TaskStatus.COMPLETED) {
        throw new Error('Task is already completed.');
      }

      const currentUids: string[] = Array.isArray(data.assignedUids)
        ? data.assignedUids.filter((x): x is string => typeof x === 'string')
        : [];
      const currentNames: string[] = Array.isArray(data.assignedNames)
        ? data.assignedNames.filter((x): x is string => typeof x === 'string')
        : [];

      const idx = currentUids.indexOf(uid);
      if (idx !== -1) {
        currentUids.splice(idx, 1);
        if (idx < currentNames.length) currentNames.splice(idx, 1);
        tx.update(taskRef, {
          assignedUids: currentUids,
          assignedNames: currentNames,
          assignedCount: currentUids.length,
          status: TaskStatus.OPEN,
          updatedAt: serverTimestamp(),
        });
        return false;
      } else {
        if (currentUids.length >= capacity) {
          throw new Error('This task shift is already full.');
        }
        currentUids.push(uid);
        currentNames.push(memberDisplayName.slice(0, 60));
        const nextStatus =
          currentUids.length >= capacity ? TaskStatus.FILLED : TaskStatus.OPEN;
        tx.update(taskRef, {
          assignedUids: currentUids,
          assignedNames: currentNames,
          assignedCount: currentUids.length,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
        return true;
      }
    });

    // Best-effort member activity counter update
    try {
      const delta = signedUpNow ? 1 : -1;
      const memberRef = doc(db, 'groups', groupId, 'members', uid);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        const cur = Number(memberSnap.data().tasksSignedUpCount ?? 0);
        await updateDoc(memberRef, {
          tasksSignedUpCount: Math.max(0, cur + delta),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Best-effort analytics counter
    }

    return signedUpNow;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already full') || error.message.includes('already completed'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createChannel(
  groupId: string,
  name: string,
  description: string,
  accessLevel: ChannelAccessLevel,
  eventId?: string | null
): Promise<string> {
  const uid = requireUserId();
  const channelId = makeId('ch', 12);
  const path = `groups/${groupId}/channels/${channelId}`;
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error('Channel name must be 2–60 characters.');
  }

  try {
    const payload: Record<string, unknown> = {
      name: cleanName,
      description: description.trim().slice(0, 300),
      accessLevel,
      createdBy: uid,
      messageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (eventId && eventId.trim()) {
      payload.eventId = eventId.trim();
    }
    await setDoc(doc(db, 'groups', groupId, 'channels', channelId), payload);
    return channelId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateChannel(
  groupId: string,
  channelId: string,
  name: string,
  description: string,
  accessLevel: ChannelAccessLevel
): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/channels/${channelId}`;
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error('Channel name must be 2–60 characters.');
  }
  try {
    await updateDoc(doc(db, 'groups', groupId, 'channels', channelId), {
      name: cleanName,
      description: description.trim().slice(0, 300),
      accessLevel,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChannel(groupId: string, channelId: string): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/channels/${channelId}`;
  try {
    try {
      const msgsSnap = await getDocs(
        collection(db, 'groups', groupId, 'channels', channelId, 'messages')
      );
      if (!msgsSnap.empty) {
        await Promise.allSettled(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
      }
    } catch {
      // Proceed to delete channel document even if child message cleanup is partial
    }
    await deleteDoc(doc(db, 'groups', groupId, 'channels', channelId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendMessage(
  groupId: string,
  channelId: string,
  senderName: string,
  senderRole: MemberRole,
  text: string,
  messageType: MessageType = MessageType.TEXT
): Promise<void> {
  const uid = requireUserId();
  const msgId = makeId('msg', 16);
  const msgPath = `groups/${groupId}/channels/${channelId}/messages/${msgId}`;
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    throw new Error('Message must be 1–2000 characters.');
  }

  try {
    const channelRef = doc(db, 'groups', groupId, 'channels', channelId);
    const msgRef = doc(db, 'groups', groupId, 'channels', channelId, 'messages', msgId);

    const batch = writeBatch(db);
    batch.set(msgRef, {
      channelId,
      senderId: uid,
      senderName: senderName.slice(0, 60),
      senderRole,
      text: trimmed,
      messageType,
      createdAt: serverTimestamp(),
    });
    batch.update(channelRef, {
      messageCount: increment(1),
      lastMessagePreview: trimmed.slice(0, 160),
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    try {
      await updateDoc(doc(db, 'groups', groupId, 'members', uid), {
        messagesSentCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Best-effort counter
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, msgPath);
  }
}

export async function updateMessage(
  groupId: string,
  channelId: string,
  messageId: string,
  newText: string
): Promise<void> {
  requireUserId();
  const msgPath = `groups/${groupId}/channels/${channelId}/messages/${messageId}`;
  const trimmed = newText.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    throw new Error('Message must be 1–2000 characters.');
  }
  try {
    await updateDoc(doc(db, 'groups', groupId, 'channels', channelId, 'messages', messageId), {
      text: trimmed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, msgPath);
  }
}

export async function deleteMessage(
  groupId: string,
  channelId: string,
  messageId: string
): Promise<void> {
  requireUserId();
  const msgPath = `groups/${groupId}/channels/${channelId}/messages/${messageId}`;
  try {
    const channelRef = doc(db, 'groups', groupId, 'channels', channelId);
    const msgRef = doc(db, 'groups', groupId, 'channels', channelId, 'messages', messageId);
    await deleteDoc(msgRef);
    try {
      const chSnap = await getDoc(channelRef);
      const cur = Number(chSnap.data()?.messageCount ?? 0);
      if (cur > 0) {
        await updateDoc(channelRef, {
          messageCount: cur - 1,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore counter update errors
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, msgPath);
  }
}

export async function sendNotification(
  groupId: string,
  title: string,
  body: string,
  notificationType: NotificationType,
  targetScope: string,
  targetRole: string,
  targetChannelId: string | null,
  targetChannelName: string | null,
  targetEventId: string | null,
  senderName: string,
  scheduledForEpochMs: number | null = null,
  approvalStatus: ApprovalStatus = ApprovalStatus.APPROVED
): Promise<string> {
  const uid = requireUserId();
  const notifId = makeId('ntf', 16);
  const path = `groups/${groupId}/notifications/${notifId}`;
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Notification title must be 2–100 characters.');
  }
  if (cleanBody.length < 2 || cleanBody.length > 600) {
    throw new Error('Notification body must be 2–600 characters.');
  }

  try {
    const payload: Record<string, unknown> = {
      title: cleanTitle,
      body: cleanBody,
      notificationType,
      targetScope,
      targetRole,
      senderId: uid,
      senderName: senderName.slice(0, 60),
      approvalStatus,
      createdAt: serverTimestamp(),
    };
    if (targetChannelId?.trim()) payload.targetChannelId = targetChannelId.trim();
    if (targetChannelName?.trim()) payload.targetChannelName = targetChannelName.trim().slice(0, 80);
    if (targetEventId?.trim()) payload.targetEventId = targetEventId.trim();
    if (scheduledForEpochMs !== null) payload.scheduledForEpochMs = Math.round(scheduledForEpochMs);

    await setDoc(doc(db, 'groups', groupId, 'notifications', notifId), payload);
    return notifId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function approveNotification(groupId: string, notificationId: string): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'notifications', notificationId), {
      approvalStatus: ApprovalStatus.APPROVED,
      targetScope: 'ALL',
      targetRole: 'ALL',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateNotification(
  groupId: string,
  notificationId: string,
  title: string,
  body: string,
  notificationType: NotificationType,
  targetScope: string,
  targetRole: string,
  targetChannelId: string | null,
  targetChannelName: string | null,
  targetEventId: string | null,
  scheduledForEpochMs: number | null = null
): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/notifications/${notificationId}`;
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Notification title must be 2–100 characters.');
  }
  if (cleanBody.length < 2 || cleanBody.length > 600) {
    throw new Error('Notification body must be 2–600 characters.');
  }

  try {
    await updateDoc(doc(db, 'groups', groupId, 'notifications', notificationId), {
      title: cleanTitle,
      body: cleanBody,
      notificationType,
      targetScope,
      targetRole,
      targetChannelId: targetChannelId?.trim() || null,
      targetChannelName: targetChannelName?.trim()?.slice(0, 80) || null,
      targetEventId: targetEventId?.trim() || null,
      scheduledForEpochMs: scheduledForEpochMs !== null ? Math.round(scheduledForEpochMs) : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(groupId: string, notificationId: string): Promise<void> {
  requireUserId();
  const path = `groups/${groupId}/notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
