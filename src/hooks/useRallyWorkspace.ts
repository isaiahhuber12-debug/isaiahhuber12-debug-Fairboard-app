import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as repo from '../services/rallyRepository';
import {
  DEFAULT_PERSONAL_APPEARANCE,
  describeBackgroundSpec,
  describeColorTheme,
  type PersonalAppearance,
  readStoredPersonalAppearance,
  sanitizePersonalAppearance,
} from '../lib/backgrounds';
import {
  type AuditLogScope,
  buildAuditLogCsv,
  buildCombinedRecordKeepingCsv,
  buildGroupMembersCsv,
  combineAuditLogsWithOrigin,
  downloadCsvFile,
  filterAndSortAuditLogs,
  makeDatedCsvFilename,
} from '../lib/csvExport';
import { formatDateTime } from '../lib/dateFormat';
import { getFriendlyErrorMessage } from '../lib/firestoreError';
import { upsertGuestJoinedGroup } from '../lib/guestSession';
import {
  cancelBrowserReminder,
  cancelBrowserReminderAt,
  getEvent30mReminderEpochMs,
  getNotificationPermission,
  isReminderAt30mSet,
  postBrowserNotification,
  registerNotificationServiceWorker,
  reminderTimerKey,
  requestNotificationPermission,
  scheduleBrowserReminder,
} from '../lib/notifications';
import * as pushService from '../services/pushService';
import * as smsService from '../services/smsService';
import {
  ActivityAction,
  ActivityCategory,
  ApprovalStatus,
  type AsyncDataState,
  type ChannelAccessLevel,
  type ChatChannel,
  type ChatMessage,
  DEFAULT_SMS_PREFERENCES,
  type EngagementAnalytics,
  type EventTask,
  type GroupActivityLog,
  type GroupMember,
  type HubNotification,
  type JoinedGroupRef,
  type MemberContactInfo,
  MemberRole,
  MessageType,
  NotificationType,
  parseApprovalStatus,
  parseMemberRole,
  type RallyEvent,
  type RallyGroup,
  ROLE_META,
  type SmsPreferences,
  TaskStatus,
  type WorkspaceIdentity,
} from '../types/rally';

export interface InAppReminderNotification {
  id: string;
  itemId: string;
  eventId: string | null;
  title: string;
  body: string;
  eventStartEpochMs: number | null;
  triggerAtEpochMs: number;
  triggeredAtMs: number;
}

export interface PendingJoinRequest {
  code: string;
  displayName: string | null;
  phoneNumber?: string | null;
  switchGroupId?: string | null;
}

export interface RallyWorkspaceState {
  isCloudMode: boolean;
  isGuest: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string | null;
  activeGroup: RallyGroup | null;
  currentRole: MemberRole;
  joinedGroups: JoinedGroupRef[];
  eventsState: AsyncDataState<RallyEvent[]>;
  selectedEventId: string | null;
  selectedEventTasksState: AsyncDataState<EventTask[]>;
  allTasksByEvent: Record<string, EventTask[]>;
  channelsState: AsyncDataState<ChatChannel[]>;
  selectedChannelId: string | null;
  messagesState: AsyncDataState<ChatMessage[]>;
  notificationsState: AsyncDataState<HubNotification[]>;
  activityLogsState: AsyncDataState<GroupActivityLog[]>;
  membersState: AsyncDataState<GroupMember[]>;
  memberContactsByUid: Record<string, MemberContactInfo>;
  analytics: EngagementAnalytics;
  remindedTimes: Record<string, number[]>;
  inAppNotifications: InAppReminderNotification[];
  personalAppearance: PersonalAppearance;
  appBackground: string;
  groupBackgroundsById: Record<string, string>;
  groupImagesById: Record<string, string | null>;
  smsPreferences: SmsPreferences;
  smsPrefsLoaded: boolean;
  phoneNotificationPermission: NotificationPermission | 'unsupported';
  bannerMessage: string | null;
  isBusy: boolean;
}

export interface RallyWorkspaceActions {
  selectEvent: (eventId: string | null) => void;
  selectChannel: (channelId: string | null) => void;
  switchGroup: (groupId: string) => void;
  joinGroupByCode: (
    code: string,
    displayName?: string | null,
    phoneNumber?: string | null
  ) => Promise<boolean>;
  createGroupWithCode: (
    name: string,
    description: string,
    groupCode: string,
    switchAfterCreate?: boolean,
    groupImageUrl?: string | null
  ) => Promise<boolean>;
  updateGroupCode: (newCode: string) => Promise<void>;
  updateGroupDetails: (name: string, description: string) => Promise<void>;
  updatePersonalAppearance: (patch: Partial<PersonalAppearance>) => Promise<void>;
  resetPersonalAppearance: () => Promise<void>;
  updateAppBackground: (backgroundSpec: string) => Promise<void>;
  updateGroupBackground: (groupId: string, backgroundSpec: string) => Promise<void>;
  updateGroupImage: (groupId: string, groupImageUrl: string | null) => Promise<boolean>;
  deleteGroup: (groupId: string, groupCode?: string | null) => Promise<void>;
  updateDisplayName: (newDisplayName: string, newPhoneNumber?: string | null) => Promise<void>;
  createEvent: (
    title: string,
    description: string,
    location: string,
    category: string,
    startEpochMs: number,
    endEpochMs: number
  ) => Promise<boolean>;
  updateEvent: (
    eventId: string,
    title: string,
    description: string,
    location: string,
    category: string,
    startEpochMs: number,
    endEpochMs: number
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  createTask: (
    eventId: string,
    title: string,
    description: string,
    deadlineEpochMs: number,
    capacity: number,
    chatChannelId?: string | null
  ) => Promise<boolean>;
  updateTask: (
    eventId: string,
    taskId: string,
    title: string,
    description: string,
    deadlineEpochMs: number,
    capacity: number,
    status: TaskStatus,
    chatChannelId?: string | null
  ) => Promise<void>;
  deleteTask: (eventId: string, taskId: string) => Promise<void>;
  toggleTaskSignup: (eventId: string, taskId: string) => Promise<void>;
  createChannel: (
    name: string,
    description: string,
    accessLevel: ChannelAccessLevel
  ) => Promise<boolean>;
  updateChannel: (
    channelId: string,
    name: string,
    description: string,
    accessLevel: ChannelAccessLevel
  ) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, text: string) => Promise<void>;
  editMessage: (channelId: string, messageId: string, newText: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  sendNotification: (params: {
    title: string;
    body: string;
    type: NotificationType;
    targetScope: string;
    targetRole: string;
    targetChannelId: string | null;
    targetChannelName: string | null;
    targetEventId: string | null;
    scheduledForEpochMs?: number | null;
  }) => Promise<boolean>;
  updateNotification: (params: {
    notificationId: string;
    title: string;
    body: string;
    type: NotificationType;
    targetScope: string;
    targetRole: string;
    targetChannelId: string | null;
    targetChannelName: string | null;
    targetEventId: string | null;
    scheduledForEpochMs?: number | null;
  }) => Promise<void>;
  approveNotification: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updateMemberRole: (memberUid: string, newRole: MemberRole) => Promise<void>;
  removeMember: (memberUid: string) => Promise<void>;
  scheduleOrUpdateReminder: (
    itemId: string,
    title: string,
    body: string,
    triggerAtEpochMs: number
  ) => void;
  removeReminder: (itemId: string, triggerAtEpochMs?: number) => void;
  toggleEventReminder30m: (event: RallyEvent) => void;
  dismissInAppNotification: (notificationId: string) => void;
  dismissAllInAppNotifications: () => void;
  saveSmsPreferences: (prefs: SmsPreferences, newDisplayName?: string) => Promise<boolean>;
  enablePhoneNotifications: () => Promise<boolean>;
  testPhoneNotification: () => Promise<boolean>;
  requestGoogleSignIn: () => void;
  exportAuditLogCsv: (options?: {
    scope?: AuditLogScope;
    searchQuery?: string;
    sortOrder?: 'asc' | 'desc';
  }) => Promise<number>;
  exportMembersCsv: (membersOverride?: GroupMember[]) => number;
  exportCombinedRecordsCsv: () => Promise<boolean>;
  showBanner: (message: string) => void;
  clearBanner: () => void;
  leaveSession: () => void;
}

export function useRallyWorkspace(
  identity: WorkspaceIdentity,
  pendingJoin: PendingJoinRequest | null,
  onPendingJoinConsumed: () => void,
  onRequestGoogleSignIn?: () => void
): { state: RallyWorkspaceState; actions: RallyWorkspaceActions } {
  const uid = identity.uid;
  const isGuest = identity.isGuest;

  const [joinedGroups, setJoinedGroups] = useState<JoinedGroupRef[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeGroupEntry, setActiveGroupEntry] = useState<{
    groupId: string;
    group: RallyGroup | null;
  } | null>(null);
  const [membersEntry, setMembersEntry] = useState<{
    groupId: string;
    state: AsyncDataState<GroupMember[]>;
  } | null>(null);
  const [eventsEntry, setEventsEntry] = useState<{
    groupId: string;
    state: AsyncDataState<RallyEvent[]>;
  } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventTasksEntry, setEventTasksEntry] = useState<{
    key: string;
    state: AsyncDataState<EventTask[]>;
  } | null>(null);
  const [tasksByEventEntry, setTasksByEventEntry] = useState<{
    groupId: string;
    map: Record<string, EventTask[]>;
  } | null>(null);
  const [channelsEntry, setChannelsEntry] = useState<{
    key: string;
    state: AsyncDataState<ChatChannel[]>;
  } | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messagesEntry, setMessagesEntry] = useState<{
    key: string;
    state: AsyncDataState<ChatMessage[]>;
  } | null>(null);
  const [notificationsEntry, setNotificationsEntry] = useState<{
    key: string;
    state: AsyncDataState<HubNotification[]>;
  } | null>(null);
  const [activityLogsEntry, setActivityLogsEntry] = useState<{
    key: string;
    state: AsyncDataState<GroupActivityLog[]>;
  } | null>(null);
  const [remindedTimes, setRemindedTimes] = useState<Record<string, number[]>>(() => {
    try {
      const raw = localStorage.getItem(`rallyhub_reminders_${uid}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, number | number[]>;
      const normalized: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          normalized[k] = [v];
        } else if (Array.isArray(v)) {
          const valid = v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
          if (valid.length > 0) normalized[k] = Array.from(new Set(valid)).sort((a, b) => a - b);
        }
      }
      return normalized;
    } catch {
      return {};
    }
  });
  const [inAppNotifications, setInAppNotifications] = useState<InAppReminderNotification[]>([]);
  const [personalAppearance, setPersonalAppearance] = useState<PersonalAppearance>(() =>
    readStoredPersonalAppearance(uid)
  );
  const appBackground = personalAppearance.appBackground;
  const [groupBackgroundsById, setGroupBackgroundsById] = useState<Record<string, string>>({});
  const [groupImagesById, setGroupImagesById] = useState<Record<string, string | null>>({});
  const [memberContactsEntry, setMemberContactsEntry] = useState<{
    groupId: string;
    map: Record<string, MemberContactInfo>;
  } | null>(null);
  const [smsPreferences, setSmsPreferences] = useState<SmsPreferences>(DEFAULT_SMS_PREFERENCES);
  const [smsPrefsLoaded, setSmsPrefsLoaded] = useState<boolean>(false);
  const [phoneNotificationPermission, setPhoneNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const activeGroupNameRef = useRef<string | null>(null);

  const ensuredCreatorGroupsRef = useRef<Set<string>>(new Set());
  const deletingGroupIdRef = useRef<string | null>(null);
  const seenNotificationsRef = useRef<Set<string>>(new Set());
  const notificationsInitializedRef = useRef(false);
  const firedRemindersRef = useRef<Record<string, number> | null>(null);
  const reminderMetaRef = useRef<
    Record<
      string,
      {
        title: string;
        body: string;
        eventId: string | null;
        eventStartEpochMs: number | null;
        eventEndEpochMs: number | null;
      }
    >
  >({});

  const getFiredRemindersMap = useCallback((): Record<string, number> => {
    if (firedRemindersRef.current) return firedRemindersRef.current;
    try {
      const raw = localStorage.getItem(`rallyhub_fired_reminders_${uid}`);
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      firedRemindersRef.current = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      firedRemindersRef.current = {};
    }
    return firedRemindersRef.current;
  }, [uid]);

  const persistFiredRemindersMap = useCallback(
    (nextMap: Record<string, number>) => {
      firedRemindersRef.current = nextMap;
      try {
        localStorage.setItem(`rallyhub_fired_reminders_${uid}`, JSON.stringify(nextMap));
      } catch {
        // Ignore storage errors
      }
    },
    [uid]
  );

  const clearFiredReminderKeys = useCallback(
    (itemId: string, triggerAtEpochMs?: number) => {
      const current = getFiredRemindersMap();
      const next = { ...current };
      let changed = false;
      if (triggerAtEpochMs === undefined) {
        const prefix = `${itemId}::`;
        for (const k of Object.keys(next)) {
          if (k.startsWith(prefix)) {
            delete next[k];
            changed = true;
          }
        }
      } else {
        const key = reminderTimerKey(itemId, triggerAtEpochMs);
        if (key in next) {
          delete next[key];
          changed = true;
        }
      }
      if (changed) {
        persistFiredRemindersMap(next);
      }
      setInAppNotifications((prev) =>
        prev.filter((n) =>
          triggerAtEpochMs === undefined
            ? n.itemId !== itemId
            : n.id !== reminderTimerKey(itemId, triggerAtEpochMs)
        )
      );
    },
    [getFiredRemindersMap, persistFiredRemindersMap]
  );

  const fireInAppReminder = useCallback(
    (params: {
      itemId: string;
      eventId: string | null;
      title: string;
      body: string;
      eventStartEpochMs: number | null;
      triggerAtEpochMs: number;
    }) => {
      const key = reminderTimerKey(params.itemId, params.triggerAtEpochMs);
      const firedMap = getFiredRemindersMap();
      if (key in firedMap) return;
      const now = Date.now();
      persistFiredRemindersMap({ ...firedMap, [key]: now });
      postBrowserNotification(params.title, params.body);
      setInAppNotifications((prev) => {
        if (prev.some((n) => n.id === key)) return prev;
        return [
          {
            id: key,
            itemId: params.itemId,
            eventId: params.eventId,
            title: params.title,
            body: params.body,
            eventStartEpochMs: params.eventStartEpochMs,
            triggerAtEpochMs: Math.round(params.triggerAtEpochMs),
            triggeredAtMs: now,
          },
          ...prev,
        ];
      });
    },
    [getFiredRemindersMap, persistFiredRemindersMap]
  );

  // Sync reminders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`rallyhub_reminders_${uid}`, JSON.stringify(remindedTimes));
    } catch {
      // Ignore storage errors
    }
  }, [remindedTimes, uid]);

  // Ensure user profile exists on Google sign-in
  useEffect(() => {
    if (isGuest) return;
    void repo.ensureUserProfile().catch((err) => {
      console.warn('Could not sync user profile:', err);
    });
  }, [uid, isGuest]);

  // Observe strictly per-user personal colors & background
  useEffect(() => {
    return repo.subscribeUserPersonalAppearance(
      uid,
      (nextAppearance) => setPersonalAppearance(nextAppearance),
      () => {}
    );
  }, [uid]);

  // Observe user cell phone & contact preferences
  useEffect(() => {
    return repo.subscribeUserSmsPreferences(
      uid,
      (prefs) => {
        setSmsPreferences(prefs);
        setSmsPrefsLoaded(true);
      },
      () => {
        setSmsPrefsLoaded(true);
      }
    );
  }, [uid]);

  // Register Service Worker for native phone notifications & keep permission state fresh
  useEffect(() => {
    void registerNotificationServiceWorker();
    const syncPermission = () => {
      setPhoneNotificationPermission(getNotificationPermission());
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  // Keep Web Push subscription synced across all joined groups when phone notifications are granted
  useEffect(() => {
    if (phoneNotificationPermission !== 'granted') return;
    if (joinedGroups.length === 0) return;
    void pushService.syncWebPushSubscription(joinedGroups.map((g) => g.groupId));
  }, [phoneNotificationPermission, joinedGroups]);

  // Observe joined groups
  useEffect(() => {
    const unsub = repo.subscribeJoinedGroups(
      uid,
      (groups) => setJoinedGroups(groups),
      (err) => setBannerMessage(getFriendlyErrorMessage(err, 'Failed to load groups'))
    );
    return unsub;
  }, [uid]);

  // Keep groupBackgroundsById live across joined groups (up to 25)
  const joinedGroupIdsKey = useMemo(
    () =>
      joinedGroups
        .slice(0, 25)
        .map((g) => g.groupId)
        .join(','),
    [joinedGroups]
  );

  useEffect(() => {
    if (!joinedGroupIdsKey) return;
    const ids = joinedGroupIdsKey.split(',').filter(Boolean);
    const unsubs = ids.map((gid) =>
      repo.subscribeGroup(
        gid,
        (grp) => {
          if (!grp) return;
          const nextBg = grp.groupBackground ?? 'default';
          setGroupBackgroundsById((prev) => {
            if (prev[gid] === nextBg) return prev;
            return { ...prev, [gid]: nextBg };
          });
          const nextImg = grp.groupImageUrl ?? null;
          setGroupImagesById((prev) => {
            if (prev[gid] === nextImg) return prev;
            return { ...prev, [gid]: nextImg };
          });
        },
        () => {}
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [joinedGroupIdsKey]);

  const effectiveGroupId = useMemo(() => {
    if (selectedGroupId && joinedGroups.some((g) => g.groupId === selectedGroupId)) {
      return selectedGroupId;
    }
    return null;
  }, [selectedGroupId, joinedGroups]);

  // Observe active group, members, and events
  useEffect(() => {
    if (!effectiveGroupId) return;
    const targetGroupId = effectiveGroupId;
    const unsubGroup = repo.subscribeGroup(
      targetGroupId,
      (group) => {
        setActiveGroupEntry({ groupId: targetGroupId, group });
        if (group === null && deletingGroupIdRef.current !== targetGroupId) {
          void repo.removeJoinedGroupRef(targetGroupId).catch(() => {});
          setSelectedGroupId(null);
          setSelectedEventId(null);
          setSelectedChannelId(null);
          setBannerMessage('That group was deleted and removed from your list.');
        }
      },
      (err) => setBannerMessage(getFriendlyErrorMessage(err, 'Error observing group'))
    );
    const unsubMembers = repo.subscribeMembers(
      targetGroupId,
      (members) =>
        setMembersEntry({ groupId: targetGroupId, state: { status: 'success', data: members } }),
      (err) =>
        setMembersEntry({
          groupId: targetGroupId,
          state: { status: 'error', message: getFriendlyErrorMessage(err, 'Error loading members') },
        })
    );
    const unsubEvents = repo.subscribeEvents(
      targetGroupId,
      (events) =>
        setEventsEntry({ groupId: targetGroupId, state: { status: 'success', data: events } }),
      (err) =>
        setEventsEntry({
          groupId: targetGroupId,
          state: { status: 'error', message: getFriendlyErrorMessage(err, 'Error loading events') },
        })
    );
    return () => {
      unsubGroup();
      unsubMembers();
      unsubEvents();
    };
  }, [effectiveGroupId]);

  const activeGroup: RallyGroup | null =
    effectiveGroupId && activeGroupEntry?.groupId === effectiveGroupId
      ? activeGroupEntry.group
      : null;

  useEffect(() => {
    activeGroupNameRef.current = activeGroup?.name ?? null;
  }, [activeGroup?.name]);

  const membersState: AsyncDataState<GroupMember[]> = useMemo(() => {
    if (!effectiveGroupId) return { status: 'success', data: [] };
    if (membersEntry?.groupId === effectiveGroupId) return membersEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, membersEntry]);

  const eventsState: AsyncDataState<RallyEvent[]> = useMemo(() => {
    if (!effectiveGroupId) return { status: 'success', data: [] };
    if (eventsEntry?.groupId === effectiveGroupId) return eventsEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, eventsEntry]);

  // Arm timers & run periodic catch-up check for persisted reminders -> triggers in-app & browser notifications
  useEffect(() => {
    const loadedEvents = eventsState.status === 'success' ? eventsState.data : [];
    const eventsById = new Map(loadedEvents.map((evt) => [evt.id, evt]));

    const syncAndCheckReminders = (allowImmediateFire: boolean) => {
      const now = Date.now();
      const firedMap = getFiredRemindersMap();

      for (const [itemId, timestamps] of Object.entries(remindedTimes)) {
        const evt = eventsById.get(itemId);
        const meta = reminderMetaRef.current[itemId];
        if (!evt && !meta) continue;

        for (const rawTs of timestamps) {
          const ts = Math.round(rawTs);
          const key = reminderTimerKey(itemId, ts);
          if (key in firedMap) continue;

          let notifTitle = meta?.title ?? 'Upcoming Reminder';
          let notifBody = meta?.body ?? 'Scheduled RallyHub reminder';
          let eventId: string | null = meta?.eventId ?? null;
          let eventStartEpochMs: number | null = meta?.eventStartEpochMs ?? null;
          let windowEndMs = meta?.eventEndEpochMs ?? ts + 24 * 60 * 60_000;

          if (evt) {
            eventId = evt.id;
            eventStartEpochMs = evt.startEpochMs;
            windowEndMs = evt.endEpochMs;
            const minsUntilStart = Math.max(0, Math.ceil((evt.startEpochMs - now) / 60_000));
            if (evt.startEpochMs <= now) {
              notifTitle = 'Event In Progress';
            } else if (minsUntilStart === 30) {
              notifTitle = 'Event Starting in 30 Minutes';
            } else if (minsUntilStart <= 1) {
              notifTitle = 'Event Starting Now';
            } else if (minsUntilStart < 60) {
              notifTitle = `Event Starting in ${minsUntilStart} Minutes`;
            } else {
              notifTitle = `Event Reminder: ${evt.title}`;
            }
            notifBody = `${evt.title} • ${formatDateTime(evt.startEpochMs)} • ${evt.location}`;
          }

          if (now >= windowEndMs) continue;

          if (ts <= now) {
            if (allowImmediateFire) {
              fireInAppReminder({
                itemId,
                eventId,
                title: notifTitle,
                body: notifBody,
                eventStartEpochMs,
                triggerAtEpochMs: ts,
              });
            } else {
              scheduleBrowserReminder(itemId, notifTitle, notifBody, now, () => {
                fireInAppReminder({
                  itemId,
                  eventId,
                  title: notifTitle,
                  body: notifBody,
                  eventStartEpochMs,
                  triggerAtEpochMs: ts,
                });
              });
            }
          } else {
            scheduleBrowserReminder(itemId, notifTitle, notifBody, ts, () => {
              const fireNow = Date.now();
              const freshEvt = eventsById.get(itemId);
              const freshTitle = freshEvt
                ? (() => {
                    const mins = Math.max(
                      1,
                      Math.ceil((freshEvt.startEpochMs - fireNow) / 60_000)
                    );
                    return mins === 30
                      ? 'Event Starting in 30 Minutes'
                      : `Event Starting in ${mins} Minute${mins === 1 ? '' : 's'}`;
                  })()
                : notifTitle;
              const freshBody = freshEvt
                ? `${freshEvt.title} • ${formatDateTime(freshEvt.startEpochMs)} • ${freshEvt.location}`
                : notifBody;
              fireInAppReminder({
                itemId,
                eventId,
                title: freshTitle,
                body: freshBody,
                eventStartEpochMs,
                triggerAtEpochMs: ts,
              });
            });
          }
        }
      }
    };

    syncAndCheckReminders(false);
    const intervalId = window.setInterval(() => {
      syncAndCheckReminders(true);
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [remindedTimes, eventsState, fireInAppReminder, getFiredRemindersMap]);

  const fallbackName =
    identity.displayName?.trim() || identity.email?.split('@')[0]?.trim() || 'Participant';

  // Normalize members list and ensure creator present
  const normalizedMembersState: AsyncDataState<GroupMember[]> = useMemo(() => {
    if (membersState.status !== 'success' || !activeGroup) return membersState;
    const ownerId = activeGroup.ownerId;
    const mapped = membersState.data.map((m) =>
      ownerId && m.uid === ownerId && parseMemberRole(m.role) !== MemberRole.CREATOR
        ? { ...m, role: MemberRole.CREATOR }
        : m
    );
    const withOwner =
      ownerId && !mapped.some((m) => m.uid === ownerId)
        ? [
            ...mapped,
            {
              id: ownerId,
              uid: ownerId,
              displayName: ownerId === uid ? fallbackName : 'Group Admin',
              role: MemberRole.CREATOR,
              tasksSignedUpCount: 0,
              messagesSentCount: 0,
              joinedAtMs: 0,
              updatedAtMs: 0,
            },
          ]
        : mapped;
    const sorted = [...withOwner].sort((a, b) => {
      const rankDiff =
        ROLE_META[parseMemberRole(b.role)].rank - ROLE_META[parseMemberRole(a.role)].rank;
      if (rankDiff !== 0) return rankDiff;
      return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
    });
    return { status: 'success', data: sorted };
  }, [membersState, activeGroup, uid, fallbackName]);

  useEffect(() => {
    if (
      activeGroup &&
      activeGroup.ownerId === uid &&
      membersState.status === 'success' &&
      !membersState.data.some((m) => m.uid === uid) &&
      !ensuredCreatorGroupsRef.current.has(activeGroup.id)
    ) {
      ensuredCreatorGroupsRef.current.add(activeGroup.id);
      void repo.ensureCreatorMemberRecord(activeGroup.id).catch(() => {});
    }
  }, [activeGroup, uid, membersState]);

  const currentRole: MemberRole = useMemo(() => {
    if (activeGroup && activeGroup.ownerId === uid) return MemberRole.CREATOR;
    if (normalizedMembersState.status === 'success') {
      const found = normalizedMembersState.data.find((m) => m.uid === uid);
      if (found) return parseMemberRole(found.role);
    }
    const ref = joinedGroups.find((g) => g.groupId === activeGroup?.id);
    return ref ? parseMemberRole(ref.role) : MemberRole.PARTICIPANT;
  }, [activeGroup, uid, normalizedMembersState, joinedGroups]);

  // Keep guest session joinedGroups role synced when an Admin/Creator updates a no-email member's role
  useEffect(() => {
    if (!isGuest || !activeGroup || normalizedMembersState.status !== 'success') return;
    const found = normalizedMembersState.data.find((m) => m.uid === uid);
    if (!found) return;
    const liveRole = parseMemberRole(found.role);
    const existingRef = joinedGroups.find((g) => g.groupId === activeGroup.id);
    if (!existingRef || parseMemberRole(existingRef.role) === liveRole) return;
    upsertGuestJoinedGroup({
      ...existingRef,
      role: liveRole,
      updatedAtMs: Date.now(),
    });
  }, [isGuest, activeGroup, uid, normalizedMembersState, joinedGroups]);

  const currentUserName = useMemo(() => {
    if (normalizedMembersState.status === 'success') {
      const found = normalizedMembersState.data.find((m) => m.uid === uid);
      if (found?.displayName?.trim()) return found.displayName;
    }
    return fallbackName;
  }, [normalizedMembersState, uid, fallbackName]);

  // Observe selected event tasks
  useEffect(() => {
    if (!effectiveGroupId || !selectedEventId) return;
    const targetGroupId = effectiveGroupId;
    const targetEventId = selectedEventId;
    const subKey = `${targetGroupId}:${targetEventId}`;
    return repo.subscribeTasksForEvent(
      targetGroupId,
      targetEventId,
      (tasks) => {
        setEventTasksEntry({ key: subKey, state: { status: 'success', data: tasks } });
        setTasksByEventEntry((prev) => ({
          groupId: targetGroupId,
          map: {
            ...(prev?.groupId === targetGroupId ? prev.map : {}),
            [targetEventId]: tasks,
          },
        }));
      },
      (err) =>
        setEventTasksEntry({
          key: subKey,
          state: {
            status: 'error',
            message: getFriendlyErrorMessage(err, 'Error loading tasks'),
          },
        })
    );
  }, [effectiveGroupId, selectedEventId]);

  const selectedEventTasksState: AsyncDataState<EventTask[]> = useMemo(() => {
    if (!effectiveGroupId || !selectedEventId) return { status: 'success', data: [] };
    const subKey = `${effectiveGroupId}:${selectedEventId}`;
    if (eventTasksEntry?.key === subKey) return eventTasksEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, selectedEventId, eventTasksEntry]);

  // Keep tasks loaded across all group events for Dashboard & Analytics
  const upcomingEventIdsKey = useMemo(() => {
    if (eventsState.status !== 'success') return '';
    return eventsState.data.map((e) => e.id).join(',');
  }, [eventsState]);

  useEffect(() => {
    if (!effectiveGroupId || !upcomingEventIdsKey) return;
    const targetGroupId = effectiveGroupId;
    const ids = upcomingEventIdsKey.split(',').filter(Boolean);
    const unsubs = ids.map((eventId) =>
      repo.subscribeTasksForEvent(
        targetGroupId,
        eventId,
        (tasks) => {
          setTasksByEventEntry((prev) => ({
            groupId: targetGroupId,
            map: {
              ...(prev?.groupId === targetGroupId ? prev.map : {}),
              [eventId]: tasks,
            },
          }));
        },
        () => {
          // Non-fatal
        }
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [effectiveGroupId, upcomingEventIdsKey]);

  const allTasksByEvent: Record<string, EventTask[]> = useMemo(() => {
    if (!effectiveGroupId || !upcomingEventIdsKey) return {};
    if (tasksByEventEntry?.groupId === effectiveGroupId) return tasksByEventEntry.map;
    return {};
  }, [effectiveGroupId, upcomingEventIdsKey, tasksByEventEntry]);

  // Observe channels & notifications based on role
  useEffect(() => {
    if (!effectiveGroupId) return;
    const targetGroupId = effectiveGroupId;
    const channelsKey = `${targetGroupId}:${currentRole}`;
    const notifsKey = `${targetGroupId}:${currentRole}:${uid}`;

    const unsubChannels = repo.subscribeChannels(
      targetGroupId,
      currentRole,
      (channels) =>
        setChannelsEntry({ key: channelsKey, state: { status: 'success', data: channels } }),
      (err) =>
        setChannelsEntry({
          key: channelsKey,
          state: {
            status: 'error',
            message: getFriendlyErrorMessage(err, 'Error loading channels'),
          },
        })
    );

    const unsubNotifs = repo.subscribeNotifications(
      targetGroupId,
      currentRole,
      uid,
      (list) => {
        if (!notificationsInitializedRef.current) {
          list.forEach((n) => seenNotificationsRef.current.add(`${n.id}_${n.approvalStatus}`));
          notificationsInitializedRef.current = true;
        } else {
          for (const n of list) {
            const key = `${n.id}_${n.approvalStatus}`;
            if (n.id && !seenNotificationsRef.current.has(key)) {
              seenNotificationsRef.current.add(key);
              if (n.senderId !== uid) {
                const isPending = parseApprovalStatus(n.approvalStatus) === ApprovalStatus.PENDING;
                const canSeePending = ROLE_META[currentRole].canAccessAdminPanel;
                if (!isPending || canSeePending) {
                  const groupLabel = activeGroupNameRef.current;
                  const notifTitle = isPending
                    ? `Approval Needed: ${n.title}`
                    : groupLabel
                      ? `${groupLabel}: ${n.title}`
                      : n.title;
                  const notifBody = n.senderName ? `${n.body} — ${n.senderName}` : n.body;
                  void postBrowserNotification(notifTitle, notifBody, {
                    tag: `rallyhub-alert-${n.id}`,
                    groupId: targetGroupId,
                    notificationId: n.id,
                    url: '/?tab=alerts',
                  });
                }
              }
            }
          }
        }
        setNotificationsEntry({ key: notifsKey, state: { status: 'success', data: list } });
      },
      (err) =>
        setNotificationsEntry({
          key: notifsKey,
          state: {
            status: 'error',
            message: getFriendlyErrorMessage(err, 'Error loading alerts'),
          },
        })
    );

    return () => {
      unsubChannels();
      unsubNotifs();
    };
  }, [effectiveGroupId, currentRole, uid]);

  const channelsState: AsyncDataState<ChatChannel[]> = useMemo(() => {
    if (!effectiveGroupId) return { status: 'success', data: [] };
    const key = `${effectiveGroupId}:${currentRole}`;
    if (channelsEntry?.key === key) return channelsEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, currentRole, channelsEntry]);

  const notificationsState: AsyncDataState<HubNotification[]> = useMemo(() => {
    if (!effectiveGroupId) return { status: 'success', data: [] };
    const key = `${effectiveGroupId}:${currentRole}:${uid}`;
    if (notificationsEntry?.key === key) return notificationsEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, currentRole, uid, notificationsEntry]);

  // Observe group activity logs for managers (Organizers, Admins, Creator)
  const canViewActivityLog = !isGuest && ROLE_META[currentRole].canManageEventsAndTasks;
  useEffect(() => {
    if (!effectiveGroupId || !canViewActivityLog) return;
    const subKey = `${effectiveGroupId}:${currentRole}`;
    return repo.subscribeActivityLogs(
      effectiveGroupId,
      (logs) => setActivityLogsEntry({ key: subKey, state: { status: 'success', data: logs } }),
      (err) =>
        setActivityLogsEntry({
          key: subKey,
          state: {
            status: 'error',
            message: getFriendlyErrorMessage(err, 'Error loading activity log'),
          },
        })
    );
  }, [effectiveGroupId, canViewActivityLog, currentRole]);

  const activityLogsState: AsyncDataState<GroupActivityLog[]> = useMemo(() => {
    if (!effectiveGroupId || !canViewActivityLog) return { status: 'success', data: [] };
    const subKey = `${effectiveGroupId}:${currentRole}`;
    if (activityLogsEntry?.key === subKey) return activityLogsEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, canViewActivityLog, currentRole, activityLogsEntry]);

  // Observe private member contact directory (name, cell phone, email) for Creator & Admins
  const canViewMemberContacts = !isGuest && ROLE_META[currentRole].canAccessAdminPanel;
  useEffect(() => {
    if (!effectiveGroupId || !canViewMemberContacts) return;
    const targetGroupId = effectiveGroupId;
    return repo.subscribeMemberContacts(
      targetGroupId,
      (map) => setMemberContactsEntry({ groupId: targetGroupId, map }),
      () => {}
    );
  }, [effectiveGroupId, canViewMemberContacts]);

  const memberContactsByUid: Record<string, MemberContactInfo> = useMemo(() => {
    if (!effectiveGroupId || !canViewMemberContacts) return {};
    if (memberContactsEntry?.groupId === effectiveGroupId) return memberContactsEntry.map;
    return {};
  }, [effectiveGroupId, canViewMemberContacts, memberContactsEntry]);

  // Keep own contact record synced in active group whenever phone & name are known
  const syncedContactKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveGroupId || !smsPreferences.phone || !currentUserName.trim()) return;
    const syncKey = `${effectiveGroupId}:${uid}:${currentUserName}:${smsPreferences.phone}`;
    if (syncedContactKeyRef.current === syncKey) return;
    syncedContactKeyRef.current = syncKey;
    void repo
      .upsertMemberContact(effectiveGroupId, {
        uid,
        displayName: currentUserName,
        phoneNumber: smsPreferences.phone,
        email: identity.email,
        authMethod: isGuest ? 'CODE_GUEST' : 'GOOGLE',
        smsEnabled: false,
      })
      .catch(() => {});
  }, [
    effectiveGroupId,
    uid,
    currentUserName,
    smsPreferences.phone,
    identity.email,
    isGuest,
  ]);

  // Observe messages for selected channel
  useEffect(() => {
    if (!effectiveGroupId || !selectedChannelId) return;
    const subKey = `${effectiveGroupId}:${selectedChannelId}`;
    return repo.subscribeMessages(
      effectiveGroupId,
      selectedChannelId,
      (msgs) => setMessagesEntry({ key: subKey, state: { status: 'success', data: msgs } }),
      (err) =>
        setMessagesEntry({
          key: subKey,
          state: {
            status: 'error',
            message: getFriendlyErrorMessage(err, 'Error loading messages'),
          },
        })
    );
  }, [effectiveGroupId, selectedChannelId]);

  const messagesState: AsyncDataState<ChatMessage[]> = useMemo(() => {
    if (!effectiveGroupId || !selectedChannelId) return { status: 'success', data: [] };
    const subKey = `${effectiveGroupId}:${selectedChannelId}`;
    if (messagesEntry?.key === subKey) return messagesEntry.state;
    return { status: 'loading' };
  }, [effectiveGroupId, selectedChannelId, messagesEntry]);

  const switchGroup = useCallback((groupId: string) => {
    notificationsInitializedRef.current = false;
    seenNotificationsRef.current.clear();
    setSelectedEventId(null);
    setSelectedChannelId(null);
    setSelectedGroupId(groupId);
  }, []);

  const joinGroupByCode = useCallback(
    async (
      code: string,
      displayName?: string | null,
      phoneNumber?: string | null
    ): Promise<boolean> => {
      setIsBusy(true);
      try {
        const newGroupId = await repo.joinGroupByCode(code, displayName, phoneNumber);
        switchGroup(newGroupId);
        setBannerMessage(`Joined group ${repo.normalizeGroupCode(code)}`);
        return true;
      } catch (err) {
        setBannerMessage(getFriendlyErrorMessage(err, 'Failed to join group'));
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [switchGroup]
  );

  // Consume pending join code or direct group switch from AuthAndJoinScreen
  const pendingCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingJoin) return;
    if (pendingJoin.switchGroupId) {
      if (pendingCodeRef.current !== `switch:${pendingJoin.switchGroupId}`) {
        pendingCodeRef.current = `switch:${pendingJoin.switchGroupId}`;
        switchGroup(pendingJoin.switchGroupId);
        onPendingJoinConsumed();
      }
      return;
    }
    if (pendingJoin.code && pendingCodeRef.current !== pendingJoin.code) {
      pendingCodeRef.current = pendingJoin.code;
      void joinGroupByCode(
        pendingJoin.code,
        pendingJoin.displayName,
        pendingJoin.phoneNumber
      ).finally(() => {
        onPendingJoinConsumed();
      });
    }
  }, [pendingJoin, joinGroupByCode, onPendingJoinConsumed, switchGroup]);

  const analytics: EngagementAnalytics = useMemo(() => {
    const members = normalizedMembersState.status === 'success' ? normalizedMembersState.data : [];
    const events = eventsState.status === 'success' ? eventsState.data : [];
    const channels = channelsState.status === 'success' ? channelsState.data : [];
    const notifications =
      notificationsState.status === 'success' ? notificationsState.data : [];
    const allTasks = Object.values(allTasksByEvent).flat();
    const totalTaskSlots = allTasks.reduce((acc, t) => acc + t.capacity, 0);
    const filledTaskSlots = allTasks.reduce((acc, t) => acc + t.assignedCount, 0);
    const fillRatePercent =
      totalTaskSlots <= 0
        ? 0
        : Math.min(100, Math.max(0, Math.floor((filledTaskSlots * 100) / totalTaskSlots)));

    return {
      totalMembers: members.length,
      creatorCount: members.filter((m) => parseMemberRole(m.role) === MemberRole.CREATOR).length,
      adminCount: members.filter((m) => parseMemberRole(m.role) === MemberRole.ADMIN).length,
      organizerCount: members.filter((m) => parseMemberRole(m.role) === MemberRole.ORGANIZER).length,
      participantCount: members.filter((m) => parseMemberRole(m.role) === MemberRole.PARTICIPANT).length,
      totalEvents: events.length,
      totalTasks: allTasks.length,
      totalTaskSlots,
      filledTaskSlots,
      totalMessages: channels.reduce((acc, c) => acc + c.messageCount, 0),
      totalNotifications: notifications.length,
      channelActivity: [...channels]
        .sort((a, b) => b.messageCount - a.messageCount)
        .map((c) => ({ name: c.name, count: c.messageCount })),
      fillRatePercent,
    };
  }, [normalizedMembersState, eventsState, channelsState, notificationsState, allTasksByEvent]);

  const logActivity = useCallback(
    (
      groupId: string,
      category: ActivityCategory,
      action: ActivityAction,
      summary: string,
      details?: string | null,
      targetId?: string | null
    ) => {
      void repo
        .recordActivityLog(groupId, {
          actorName: currentUserName,
          actorRole: currentRole,
          category,
          action,
          summary,
          details,
          targetId,
        })
        .catch(() => {});
    },
    [currentUserName, currentRole]
  );

  const actions: RallyWorkspaceActions = useMemo(
    () => ({
      selectEvent: (eventId) => setSelectedEventId(eventId),
      selectChannel: (channelId) => setSelectedChannelId(channelId),
      switchGroup,
      joinGroupByCode,
      createGroupWithCode: async (
        name,
        description,
        groupCode,
        switchAfterCreate = true,
        groupImageUrl = null
      ) => {
        setIsBusy(true);
        try {
          const newGroupId = await repo.createGroupWithCode(
            name,
            description,
            groupCode,
            groupImageUrl
          );
          if (switchAfterCreate) {
            switchGroup(newGroupId);
          }
          setBannerMessage(`Group created with code ${repo.normalizeGroupCode(groupCode)}`);
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create group'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      updateGroupCode: async (newCode) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          const updated = await repo.updateGroupCode(
            activeGroup.id,
            activeGroup.groupCode,
            newCode,
            activeGroup.name
          );
          logActivity(
            activeGroup.id,
            ActivityCategory.GROUP,
            ActivityAction.GROUP_UPDATED,
            `Updated invite code to ${updated}`,
            `Group: ${activeGroup.name}`,
            activeGroup.id
          );
          setBannerMessage(`Group code updated to ${updated}`);
        } catch (err) {
          setBannerMessage(
            getFriendlyErrorMessage(err, 'Only Admins or the Group Creator can change the group code')
          );
        } finally {
          setIsBusy(false);
        }
      },
      updateGroupDetails: async (name, description) => {
        if (!activeGroup) return;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only Admins or the Group Creator can edit group details.');
          return;
        }
        setIsBusy(true);
        try {
          await repo.updateGroupDetails(activeGroup.id, name, description, activeGroup.groupCode);
          logActivity(
            activeGroup.id,
            ActivityCategory.GROUP,
            ActivityAction.GROUP_UPDATED,
            `Updated group details for "${name.trim()}"`,
            description.trim() ? description.trim().slice(0, 120) : null,
            activeGroup.id
          );
          setBannerMessage('Group details updated');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update group'));
        } finally {
          setIsBusy(false);
        }
      },
      updatePersonalAppearance: async (patch) => {
        const merged = sanitizePersonalAppearance({
          ...personalAppearance,
          ...patch,
        });
        setPersonalAppearance(merged);
        try {
          await repo.saveUserPersonalAppearance(merged);
          if (patch.colorTheme !== undefined) {
            setBannerMessage(`Your colors updated (${describeColorTheme(merged.colorTheme)})`);
          } else if (patch.appBackground !== undefined) {
            setBannerMessage(
              `Your app background updated (${describeBackgroundSpec(merged.appBackground)})`
            );
          } else if (patch.bannerBackground !== undefined) {
            setBannerMessage(
              `Your banner style updated (${describeBackgroundSpec(merged.bannerBackground)})`
            );
          } else if (patch.colorMode !== undefined) {
            setBannerMessage(`Display mode set to ${merged.colorMode}`);
          }
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to save your personal theme'));
        }
      },
      resetPersonalAppearance: async () => {
        setPersonalAppearance(DEFAULT_PERSONAL_APPEARANCE);
        try {
          await repo.saveUserPersonalAppearance(DEFAULT_PERSONAL_APPEARANCE);
          setBannerMessage('Reset your personal colors and background to default');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to reset your personal theme'));
        }
      },
      updateAppBackground: async (backgroundSpec) => {
        const merged = sanitizePersonalAppearance({
          ...personalAppearance,
          appBackground: backgroundSpec,
        });
        setPersonalAppearance(merged);
        try {
          await repo.saveUserPersonalAppearance(merged);
          setBannerMessage(
            `Your app background updated (${describeBackgroundSpec(merged.appBackground)})`
          );
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update your app background'));
        }
      },
      updateGroupBackground: async (_groupId, backgroundSpec) => {
        const merged = sanitizePersonalAppearance({
          ...personalAppearance,
          bannerBackground: backgroundSpec,
        });
        setPersonalAppearance(merged);
        try {
          await repo.saveUserPersonalAppearance(merged);
          setBannerMessage(
            `Your banner style updated (${describeBackgroundSpec(merged.bannerBackground)})`
          );
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update your banner style'));
        }
      },
      updateGroupImage: async (groupId, groupImageUrl) => {
        const isCurrentCreator =
          groupId === activeGroup?.id && ROLE_META[currentRole].isCreator;
        const ref = joinedGroups.find((g) => g.groupId === groupId);
        const isJoinedCreator = ref
          ? parseMemberRole(ref.role) === MemberRole.CREATOR
          : false;
        if (!isCurrentCreator && !isJoinedCreator) {
          setBannerMessage('Only the Group Creator can update the group profile image.');
          return false;
        }
        setIsBusy(true);
        try {
          await repo.updateGroupImage(groupId, groupImageUrl);
          const clean = groupImageUrl?.trim() || null;
          setGroupImagesById((prev) => ({ ...prev, [groupId]: clean }));
          if (groupId === activeGroup?.id) {
            logActivity(
              groupId,
              ActivityCategory.GROUP,
              ActivityAction.GROUP_UPDATED,
              clean ? 'Updated group profile image' : 'Removed group profile image',
              clean
                ? clean.startsWith('data:')
                  ? 'Uploaded custom image'
                  : clean.slice(0, 140)
                : 'Reset to group initials',
              groupId
            );
          }
          setBannerMessage(
            clean ? 'Group profile image updated' : 'Group profile image removed'
          );
          return true;
        } catch (err) {
          setBannerMessage(
            getFriendlyErrorMessage(err, 'Only the Group Creator can update the group profile image')
          );
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      deleteGroup: async (groupId, groupCode) => {
        setIsBusy(true);
        deletingGroupIdRef.current = groupId;
        try {
          await repo.deleteGroup(groupId, groupCode);
          if (selectedGroupId === groupId) {
            setSelectedGroupId(null);
            setSelectedEventId(null);
            setSelectedChannelId(null);
          }
          setBannerMessage('Group deleted');
        } catch (err) {
          setBannerMessage(
            getFriendlyErrorMessage(err, 'Only the Group Creator can delete this group')
          );
        } finally {
          if (deletingGroupIdRef.current === groupId) {
            deletingGroupIdRef.current = null;
          }
          setIsBusy(false);
        }
      },
      updateDisplayName: async (newDisplayName, newPhoneNumber) => {
        if (!activeGroup) return;
        try {
          await repo.updateOwnDisplayName(activeGroup.id, newDisplayName, newPhoneNumber);
          setBannerMessage(newPhoneNumber ? 'Contact info updated' : 'Display name updated');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update contact info'));
        }
      },
      createEvent: async (title, description, location, category, startEpochMs, endEpochMs) => {
        if (!activeGroup) return false;
        setIsBusy(true);
        try {
          const eventId = await repo.createEvent(
            activeGroup.id,
            title,
            description,
            location,
            category,
            startEpochMs,
            endEpochMs,
            currentUserName
          );
          logActivity(
            activeGroup.id,
            ActivityCategory.CALENDAR,
            ActivityAction.EVENT_CREATED,
            `Scheduled event "${title.trim()}"`,
            `${location.trim()} • ${category.trim() || 'General'}`,
            eventId
          );
          setBannerMessage(`Event '${title}' added to calendar`);
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create event'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      updateEvent: async (
        eventId,
        title,
        description,
        location,
        category,
        startEpochMs,
        endEpochMs
      ) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          await repo.updateEvent(
            activeGroup.id,
            eventId,
            title,
            description,
            location,
            category,
            startEpochMs,
            endEpochMs,
            currentUserName
          );
          logActivity(
            activeGroup.id,
            ActivityCategory.CALENDAR,
            ActivityAction.EVENT_UPDATED,
            `Updated calendar event "${title.trim()}"`,
            `${location.trim()} • ${category.trim() || 'General'}`,
            eventId
          );
          setBannerMessage(`Event '${title}' updated`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update event'));
        } finally {
          setIsBusy(false);
        }
      },
      deleteEvent: async (eventId) => {
        if (!activeGroup) return;
        setIsBusy(true);
        const existingEvent =
          eventsState.status === 'success'
            ? eventsState.data.find((e) => e.id === eventId)
            : undefined;
        try {
          const childTasks = allTasksByEvent[eventId] ?? [];
          await repo.deleteEvent(activeGroup.id, eventId);
          logActivity(
            activeGroup.id,
            ActivityCategory.CALENDAR,
            ActivityAction.EVENT_DELETED,
            `Removed calendar event "${existingEvent?.title ?? 'Event'}"`,
            existingEvent?.location ?? null,
            eventId
          );
          setSelectedEventId((prev) => (prev === eventId ? null : prev));
          cancelBrowserReminder(eventId);
          clearFiredReminderKeys(eventId);
          childTasks.forEach((t) => {
            cancelBrowserReminder(t.id);
            clearFiredReminderKeys(t.id);
          });
          setRemindedTimes((prev) => {
            const next = { ...prev };
            delete next[eventId];
            childTasks.forEach((t) => {
              delete next[t.id];
            });
            return next;
          });
          setBannerMessage('Event deleted');
        } catch (err) {
          setBannerMessage(
            getFriendlyErrorMessage(err, 'Only an Admin or event creator can delete this event')
          );
        } finally {
          setIsBusy(false);
        }
      },
      createTask: async (eventId, title, description, deadlineEpochMs, capacity, chatChannelId) => {
        if (!activeGroup) return false;
        setIsBusy(true);
        const parentEvent =
          eventsState.status === 'success'
            ? eventsState.data.find((e) => e.id === eventId)
            : undefined;
        try {
          const taskId = await repo.createTask(
            activeGroup.id,
            eventId,
            title,
            description,
            deadlineEpochMs,
            capacity,
            chatChannelId
          );
          logActivity(
            activeGroup.id,
            ActivityCategory.TASK,
            ActivityAction.TASK_CREATED,
            `Created task "${title.trim()}"`,
            `${parentEvent ? `${parentEvent.title} • ` : ''}${capacity} volunteer slots`,
            taskId
          );
          setBannerMessage(`Task '${title}' published`);
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create task'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      updateTask: async (
        eventId,
        taskId,
        title,
        description,
        deadlineEpochMs,
        capacity,
        status,
        chatChannelId
      ) => {
        if (!activeGroup) return;
        const existing = allTasksByEvent[eventId]?.find((t) => t.id === taskId);
        const assignedCount = existing?.assignedCount ?? 0;
        const parentEvent =
          eventsState.status === 'success'
            ? eventsState.data.find((e) => e.id === eventId)
            : undefined;
        setIsBusy(true);
        try {
          await repo.updateTask(
            activeGroup.id,
            eventId,
            taskId,
            title,
            description,
            deadlineEpochMs,
            capacity,
            assignedCount,
            status,
            chatChannelId
          );
          const isCompleted = status === TaskStatus.COMPLETED;
          logActivity(
            activeGroup.id,
            ActivityCategory.TASK,
            isCompleted ? ActivityAction.TASK_COMPLETED : ActivityAction.TASK_UPDATED,
            isCompleted ? `Completed task "${title.trim()}"` : `Updated task "${title.trim()}"`,
            `${parentEvent ? `${parentEvent.title} • ` : ''}${assignedCount}/${capacity} filled`,
            taskId
          );
          setBannerMessage(`Task '${title}' updated`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update task'));
        } finally {
          setIsBusy(false);
        }
      },
      deleteTask: async (eventId, taskId) => {
        if (!activeGroup) return;
        setIsBusy(true);
        const existingTask = allTasksByEvent[eventId]?.find((t) => t.id === taskId);
        try {
          await repo.deleteTask(activeGroup.id, eventId, taskId);
          logActivity(
            activeGroup.id,
            ActivityCategory.TASK,
            ActivityAction.TASK_DELETED,
            `Deleted task "${existingTask?.title ?? 'Task'}"`,
            null,
            taskId
          );
          cancelBrowserReminder(taskId);
          setRemindedTimes((prev) => {
            if (!(taskId in prev)) return prev;
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
          setBannerMessage('Task deleted');
        } catch (err) {
          setBannerMessage(
            getFriendlyErrorMessage(err, 'Only an Admin or task creator can delete this task')
          );
        } finally {
          setIsBusy(false);
        }
      },
      toggleTaskSignup: async (eventId, taskId) => {
        if (!activeGroup) return;
        const existingTask = allTasksByEvent[eventId]?.find((t) => t.id === taskId);
        const parentEvent =
          eventsState.status === 'success'
            ? eventsState.data.find((e) => e.id === eventId)
            : undefined;
        try {
          const claimed = await repo.toggleTaskSignup(
            activeGroup.id,
            eventId,
            taskId,
            currentUserName
          );
          logActivity(
            activeGroup.id,
            ActivityCategory.TASK,
            claimed ? ActivityAction.TASK_CLAIMED : ActivityAction.TASK_RELEASED,
            claimed
              ? `Signed up for "${existingTask?.title ?? 'task shift'}"`
              : `Left shift for "${existingTask?.title ?? 'task shift'}"`,
            parentEvent ? `Event: ${parentEvent.title}` : null,
            taskId
          );
          setBannerMessage(claimed ? 'Signed up for task!' : 'Removed from task shift');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Could not update task signup'));
        }
      },
      createChannel: async (name, description, accessLevel) => {
        if (!activeGroup) return false;
        setIsBusy(true);
        try {
          const channelId = await repo.createChannel(activeGroup.id, name, description, accessLevel);
          logActivity(
            activeGroup.id,
            ActivityCategory.CHANNEL,
            ActivityAction.CHANNEL_CREATED,
            `Created chat channel #${name.trim()}`,
            `Access: ${accessLevel}`,
            channelId
          );
          setBannerMessage(`Created #${name.trim()} channel`);
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create channel'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      updateChannel: async (channelId, name, description, accessLevel) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          await repo.updateChannel(activeGroup.id, channelId, name, description, accessLevel);
          logActivity(
            activeGroup.id,
            ActivityCategory.CHANNEL,
            ActivityAction.CHANNEL_UPDATED,
            `Updated chat channel #${name.trim()}`,
            `Access: ${accessLevel}`,
            channelId
          );
          setBannerMessage(`Updated #${name.trim()} channel`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update channel'));
        } finally {
          setIsBusy(false);
        }
      },
      deleteChannel: async (channelId) => {
        if (!activeGroup) return;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only Admins or the Group Creator can delete messaging groups.');
          return;
        }
        const existingChannel =
          channelsState.status === 'success'
            ? channelsState.data.find((c) => c.id === channelId)
            : undefined;
        setIsBusy(true);
        try {
          await repo.deleteChannel(activeGroup.id, channelId);
          setSelectedChannelId((prev) => (prev === channelId ? null : prev));
          logActivity(
            activeGroup.id,
            ActivityCategory.CHANNEL,
            ActivityAction.CHANNEL_DELETED,
            `Deleted messaging channel #${existingChannel?.name ?? 'channel'}`,
            null,
            channelId
          );
          setBannerMessage(
            `Deleted #${existingChannel?.name ?? 'channel'} messaging group`
          );
        } catch (err) {
          setBannerMessage(
            getFriendlyErrorMessage(err, 'Only Admins or the Group Creator can delete channels')
          );
        } finally {
          setIsBusy(false);
        }
      },
      sendMessage: async (channelId, text) => {
        if (!activeGroup) return;
        try {
          await repo.sendMessage(
            activeGroup.id,
            channelId,
            currentUserName,
            currentRole,
            text,
            MessageType.TEXT
          );
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to send message'));
        }
      },
      editMessage: async (channelId, messageId, newText) => {
        if (!activeGroup) return;
        try {
          await repo.updateMessage(activeGroup.id, channelId, messageId, newText);
          setBannerMessage('Message updated');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update message'));
        }
      },
      deleteMessage: async (channelId, messageId) => {
        if (!activeGroup) return;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin can delete messages.');
          return;
        }
        try {
          await repo.deleteMessage(activeGroup.id, channelId, messageId);
          setBannerMessage('Message deleted');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to delete message'));
        }
      },
      sendNotification: async ({
        title,
        body,
        type,
        targetScope,
        targetRole,
        targetChannelId,
        targetChannelName,
        targetEventId,
        scheduledForEpochMs = null,
      }) => {
        if (!activeGroup) return false;
        const needsApproval =
          isGuest ||
          (type === NotificationType.ANNOUNCEMENT && !ROLE_META[currentRole].canAccessAdminPanel);
        const resolvedScope = needsApproval ? 'ALL' : targetScope;
        const resolvedTargetRole = needsApproval ? 'ADMIN' : targetRole;
        const resolvedStatus = needsApproval ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;

        setIsBusy(true);
        try {
          const notifId = await repo.sendNotification(
            activeGroup.id,
            title,
            body,
            type,
            resolvedScope,
            resolvedTargetRole,
            needsApproval ? null : targetChannelId,
            needsApproval ? null : targetChannelName,
            targetEventId,
            currentUserName,
            scheduledForEpochMs,
            resolvedStatus
          );
          logActivity(
            activeGroup.id,
            ActivityCategory.ALERT,
            ActivityAction.ALERT_SENT,
            needsApproval
              ? `Submitted announcement "${title.trim()}" for approval`
              : `Posted alert "${title.trim()}"`,
            needsApproval ? 'Pending Admin review' : `Target: ${targetChannelName ?? targetRole}`,
            notifId
          );
          if (!needsApproval) {
            void pushService.broadcastAnnouncementPush({
              groupId: activeGroup.id,
              groupName: activeGroup.name,
              notificationId: notifId,
              title: title.trim(),
              body: body.trim(),
              senderName: currentUserName,
            });
          }
          setBannerMessage(
            needsApproval
              ? 'Announcement submitted for Admin approval before posting'
              : `Alert dispatched to ${targetChannelName ?? targetRole}`
          );
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to send alert'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      updateNotification: async ({
        notificationId,
        title,
        body,
        type,
        targetScope,
        targetRole,
        targetChannelId,
        targetChannelName,
        targetEventId,
        scheduledForEpochMs = null,
      }) => {
        if (!activeGroup) return;
        const isPendingSubmission =
          isGuest ||
          (type === NotificationType.ANNOUNCEMENT && !ROLE_META[currentRole].canAccessAdminPanel);
        setIsBusy(true);
        try {
          await repo.updateNotification(
            activeGroup.id,
            notificationId,
            title,
            body,
            type,
            isPendingSubmission ? 'ALL' : targetScope,
            isPendingSubmission ? 'ADMIN' : targetRole,
            isPendingSubmission ? null : targetChannelId,
            isPendingSubmission ? null : targetChannelName,
            targetEventId,
            scheduledForEpochMs
          );
          setBannerMessage('Alert updated');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update alert'));
        } finally {
          setIsBusy(false);
        }
      },
      approveNotification: async (notificationId) => {
        if (!activeGroup) return;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin can approve announcements.');
          return;
        }
        const existingNotif =
          notificationsState.status === 'success'
            ? notificationsState.data.find((n) => n.id === notificationId)
            : undefined;
        setIsBusy(true);
        try {
          await repo.approveNotification(activeGroup.id, notificationId);
          logActivity(
            activeGroup.id,
            ActivityCategory.ALERT,
            ActivityAction.ALERT_APPROVED,
            `Approved announcement "${existingNotif?.title ?? 'Announcement'}"`,
            existingNotif ? `Submitted by ${existingNotif.senderName}` : null,
            notificationId
          );
          void pushService.broadcastAnnouncementPush({
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            notificationId,
            title: existingNotif?.title?.trim() || 'Group Announcement',
            body: existingNotif?.body?.trim() || 'A new group announcement was posted.',
            senderName: existingNotif?.senderName ?? currentUserName,
          });
          setBannerMessage('Announcement approved and posted to everyone!');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to approve announcement'));
        } finally {
          setIsBusy(false);
        }
      },
      deleteNotification: async (notificationId) => {
        if (!activeGroup) return;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin can delete announcements.');
          return;
        }
        const existingNotif =
          notificationsState.status === 'success'
            ? notificationsState.data.find((n) => n.id === notificationId)
            : undefined;
        try {
          await repo.deleteNotification(activeGroup.id, notificationId);
          logActivity(
            activeGroup.id,
            ActivityCategory.ALERT,
            ActivityAction.ALERT_DELETED,
            `Deleted alert "${existingNotif?.title ?? 'Announcement'}"`,
            null,
            notificationId
          );
          setBannerMessage('Announcement deleted');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to delete announcement'));
        }
      },
      updateMemberRole: async (memberUid, newRole) => {
        if (!activeGroup) return;
        const targetMember =
          normalizedMembersState.status === 'success'
            ? normalizedMembersState.data.find((m) => m.uid === memberUid)
            : undefined;
        const prevRole = targetMember ? parseMemberRole(targetMember.role) : null;
        try {
          await repo.updateMemberRole(activeGroup.id, memberUid, newRole);
          logActivity(
            activeGroup.id,
            ActivityCategory.MEMBER,
            ActivityAction.MEMBER_ROLE_CHANGED,
            `Changed ${targetMember?.displayName ?? 'member'}'s role to ${ROLE_META[newRole].label}`,
            prevRole
              ? `Previous role: ${ROLE_META[prevRole].label} -> New role: ${ROLE_META[newRole].label}`
              : null,
            memberUid
          );
          setBannerMessage(`Updated member role to ${ROLE_META[newRole].label}`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Permission denied updating role'));
        }
      },
      removeMember: async (memberUid) => {
        if (!activeGroup) return;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin or Creator can remove members.');
          return;
        }
        if (memberUid === uid || memberUid === activeGroup.ownerId) {
          setBannerMessage('Cannot remove yourself or the group creator.');
          return;
        }
        const targetMember =
          normalizedMembersState.status === 'success'
            ? normalizedMembersState.data.find((m) => m.uid === memberUid)
            : undefined;
        const targetRole = targetMember ? parseMemberRole(targetMember.role) : null;
        if (!ROLE_META[currentRole].isCreator && targetRole === MemberRole.ADMIN) {
          setBannerMessage('Only the Group Creator can remove an Admin.');
          return;
        }
        const targetName = targetMember?.displayName ?? 'Member';
        setIsBusy(true);
        try {
          await repo.removeMember(activeGroup.id, memberUid);
          logActivity(
            activeGroup.id,
            ActivityCategory.MEMBER,
            ActivityAction.MEMBER_DELETED,
            `Removed ${targetName} from group`,
            targetRole ? `Previous role: ${ROLE_META[targetRole].label}` : null,
            memberUid
          );
          setBannerMessage(`Removed ${targetName} from the group`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Permission denied removing member'));
        } finally {
          setIsBusy(false);
        }
      },
      scheduleOrUpdateReminder: (itemId, title, body, triggerAtEpochMs) => {
        const rounded = Math.round(triggerAtEpochMs);
        const loadedEvents = eventsState.status === 'success' ? eventsState.data : [];
        const matchedEvent = loadedEvents.find((e) => e.id === itemId);
        reminderMetaRef.current[itemId] = {
          title,
          body,
          eventId: matchedEvent ? matchedEvent.id : null,
          eventStartEpochMs: matchedEvent ? matchedEvent.startEpochMs : null,
          eventEndEpochMs: matchedEvent ? matchedEvent.endEpochMs : null,
        };
        clearFiredReminderKeys(itemId, rounded);
        setRemindedTimes((prev) => {
          const existing = prev[itemId] ?? [];
          if (existing.some((ts) => Math.abs(ts - rounded) < 1000)) return prev;
          const nextList = [...existing, rounded].sort((a, b) => a - b);
          return { ...prev, [itemId]: nextList };
        });
        if (rounded <= Date.now()) {
          fireInAppReminder({
            itemId,
            eventId: matchedEvent ? matchedEvent.id : null,
            title,
            body,
            eventStartEpochMs: matchedEvent ? matchedEvent.startEpochMs : null,
            triggerAtEpochMs: rounded,
          });
        } else {
          scheduleBrowserReminder(itemId, title, body, rounded, () =>
            fireInAppReminder({
              itemId,
              eventId: matchedEvent ? matchedEvent.id : null,
              title,
              body,
              eventStartEpochMs: matchedEvent ? matchedEvent.startEpochMs : null,
              triggerAtEpochMs: rounded,
            })
          );
        }
        setBannerMessage(`Reminder added for ${title}`);
      },
      removeReminder: (itemId, triggerAtEpochMs) => {
        clearFiredReminderKeys(itemId, triggerAtEpochMs);
        setRemindedTimes((prev) => {
          const existing = prev[itemId] ?? [];
          if (triggerAtEpochMs === undefined) {
            if (!(itemId in prev)) return prev;
            const next = { ...prev };
            delete next[itemId];
            return next;
          }
          const filtered = existing.filter((ts) => ts !== triggerAtEpochMs);
          if (filtered.length === existing.length) return prev;
          const next = { ...prev };
          if (filtered.length === 0) {
            delete next[itemId];
          } else {
            next[itemId] = filtered;
          }
          return next;
        });
        if (triggerAtEpochMs === undefined) {
          cancelBrowserReminder(itemId);
          setBannerMessage('Reminders removed');
        } else {
          cancelBrowserReminderAt(itemId, triggerAtEpochMs);
          setBannerMessage('Reminder removed');
        }
      },
      toggleEventReminder30m: (event) => {
        const now = Date.now();
        const triggerAtMs = getEvent30mReminderEpochMs(event.startEpochMs);
        const existingList = remindedTimes[event.id] ?? [];
        const has30m = isReminderAt30mSet(existingList, event.startEpochMs);

        if (has30m) {
          const matchingTimestamps = existingList.filter(
            (ts) => Math.abs(ts - triggerAtMs) < 1000
          );
          for (const ts of matchingTimestamps) {
            cancelBrowserReminderAt(event.id, ts);
            clearFiredReminderKeys(event.id, ts);
          }
          setRemindedTimes((prev) => {
            const cur = prev[event.id] ?? [];
            const filtered = cur.filter((ts) => Math.abs(ts - triggerAtMs) >= 1000);
            if (filtered.length === cur.length) return prev;
            const next = { ...prev };
            if (filtered.length === 0) {
              delete next[event.id];
            } else {
              next[event.id] = filtered;
            }
            return next;
          });
          setBannerMessage(`Remind Me turned off for ${event.title}`);
          return;
        }

        if (event.endEpochMs <= now) {
          setBannerMessage('This event has already ended.');
          return;
        }
        if (event.startEpochMs <= now) {
          setBannerMessage('This event has already started.');
          return;
        }

        const notifTitle = 'Event Starting in 30 Minutes';
        const notifBody = `${event.title} • ${formatDateTime(event.startEpochMs)} • ${event.location}`;
        reminderMetaRef.current[event.id] = {
          title: notifTitle,
          body: notifBody,
          eventId: event.id,
          eventStartEpochMs: event.startEpochMs,
          eventEndEpochMs: event.endEpochMs,
        };
        clearFiredReminderKeys(event.id, triggerAtMs);
        setRemindedTimes((prev) => {
          const existing = prev[event.id] ?? [];
          if (existing.some((ts) => Math.abs(ts - triggerAtMs) < 1000)) return prev;
          const nextList = [...existing, triggerAtMs].sort((a, b) => a - b);
          return { ...prev, [event.id]: nextList };
        });

        if (triggerAtMs <= now) {
          const minsLeft = Math.max(1, Math.ceil((event.startEpochMs - now) / 60_000));
          fireInAppReminder({
            itemId: event.id,
            eventId: event.id,
            title: `Event Starting in ${minsLeft} Minute${minsLeft === 1 ? '' : 's'}`,
            body: `${event.title} • ${formatDateTime(event.startEpochMs)} • ${event.location}`,
            eventStartEpochMs: event.startEpochMs,
            triggerAtEpochMs: triggerAtMs,
          });
          setBannerMessage(
            `Remind Me on — "${event.title}" starts in ${minsLeft} min`
          );
        } else {
          scheduleBrowserReminder(event.id, notifTitle, notifBody, triggerAtMs, () => {
            fireInAppReminder({
              itemId: event.id,
              eventId: event.id,
              title: notifTitle,
              body: notifBody,
              eventStartEpochMs: event.startEpochMs,
              triggerAtEpochMs: triggerAtMs,
            });
          });
          setBannerMessage(
            `Remind Me on: in-app alert at ${formatDateTime(triggerAtMs)} (30 min before)`
          );
        }
      },
      dismissInAppNotification: (notificationId) => {
        setInAppNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      },
      dismissAllInAppNotifications: () => {
        setInAppNotifications([]);
      },
      saveSmsPreferences: async (prefs, newDisplayName) => {
        setIsBusy(true);
        try {
          const normalizedPhone = prefs.phone.trim()
            ? smsService.normalizePhoneInput(prefs.phone)
            : '';
          if (normalizedPhone && !smsService.E164_PHONE_REGEX.test(normalizedPhone)) {
            setBannerMessage('Enter a valid mobile number in E.164 format (e.g. +15551234567).');
            return false;
          }
          const nextPrefs: SmsPreferences = {
            phone: normalizedPhone,
            enabled: false,
            forMessages: false,
            forEvents: false,
          };
          await repo.saveUserSmsPreferences(nextPrefs, {
            joinedGroupIds: joinedGroups.map((g) => g.groupId),
            displayName: newDisplayName?.trim() || currentUserName,
          });
          setBannerMessage(
            normalizedPhone
              ? `Cell phone number saved (${smsService.formatPhoneDisplay(normalizedPhone)})`
              : 'Cell phone number cleared'
          );
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to save phone number'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      enablePhoneNotifications: async () => {
        const granted = await requestNotificationPermission();
        const nextPerm = getNotificationPermission();
        setPhoneNotificationPermission(nextPerm);
        if (granted) {
          if (joinedGroups.length > 0) {
            await pushService.syncWebPushSubscription(joinedGroups.map((g) => g.groupId));
          }
          setBannerMessage('Phone notifications enabled for announcements & reminders!');
          return true;
        }
        if (nextPerm === 'denied') {
          setBannerMessage(
            'Notifications are blocked in your browser settings. Enable them in site settings to get phone alerts.'
          );
        } else if (nextPerm === 'unsupported') {
          setBannerMessage(
            'System notifications are unavailable in this view. Open RallyHub in your mobile browser or install to your Home Screen.'
          );
        }
        return false;
      },
      testPhoneNotification: async () => {
        let perm = getNotificationPermission();
        if (perm === 'default') {
          await requestNotificationPermission();
          perm = getNotificationPermission();
          setPhoneNotificationPermission(perm);
        }
        if (perm !== 'granted') {
          setBannerMessage(
            perm === 'denied'
              ? 'Notifications are blocked in browser settings.'
              : 'Enable phone notifications first to send a test alert.'
          );
          return false;
        }
        if (joinedGroups.length > 0) {
          void pushService.syncWebPushSubscription(joinedGroups.map((g) => g.groupId));
        }
        const shown = await postBrowserNotification(
          `${activeGroup?.name ? `${activeGroup.name}: ` : ''}Test Announcement`,
          'Group announcements will appear as regular notifications on your device.',
          {
            tag: 'rallyhub-test-notification',
            groupId: activeGroup?.id ?? null,
            url: '/?tab=alerts',
          }
        );
        setBannerMessage(
          shown
            ? 'Test phone notification sent! Check your notification shade.'
            : 'Could not display a system notification in this browser context.'
        );
        return shown;
      },
      requestGoogleSignIn: () => {
        onRequestGoogleSignIn?.();
      },
      exportAuditLogCsv: async (options) => {
        if (!activeGroup) return 0;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin or Creator can export audit records.');
          return 0;
        }
        setIsBusy(true);
        try {
          const members =
            normalizedMembersState.status === 'success' ? normalizedMembersState.data : [];
          const fullLogs = await repo.fetchActivityLogsForExport(activeGroup.id);
          const combined = combineAuditLogsWithOrigin(fullLogs, activeGroup, members);
          const rows = filterAndSortAuditLogs(
            combined,
            options?.scope ?? 'SENSITIVE',
            options?.searchQuery ?? '',
            options?.sortOrder ?? 'desc'
          );
          const csv = buildAuditLogCsv(rows, activeGroup);
          const filename = makeDatedCsvFilename(activeGroup.name, 'audit-log');
          downloadCsvFile(filename, csv);
          setBannerMessage(
            `Exported ${rows.length} audit log ${rows.length === 1 ? 'entry' : 'entries'} to CSV`
          );
          return rows.length;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to export audit log CSV'));
          return 0;
        } finally {
          setIsBusy(false);
        }
      },
      exportMembersCsv: (membersOverride) => {
        if (!activeGroup) return 0;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin or Creator can export membership records.');
          return 0;
        }
        const members =
          membersOverride ??
          (normalizedMembersState.status === 'success' ? normalizedMembersState.data : []);
        const csv = buildGroupMembersCsv(members, activeGroup, memberContactsByUid);
        const filename = makeDatedCsvFilename(activeGroup.name, 'members');
        downloadCsvFile(filename, csv);
        setBannerMessage(
          `Exported ${members.length} group ${members.length === 1 ? 'member' : 'members'} to CSV`
        );
        return members.length;
      },
      exportCombinedRecordsCsv: async () => {
        if (!activeGroup) return false;
        if (!ROLE_META[currentRole].canAccessAdminPanel) {
          setBannerMessage('Only an Admin or Creator can export group records.');
          return false;
        }
        setIsBusy(true);
        try {
          const members =
            normalizedMembersState.status === 'success' ? normalizedMembersState.data : [];
          const fullLogs = await repo.fetchActivityLogsForExport(activeGroup.id);
          const combined = combineAuditLogsWithOrigin(fullLogs, activeGroup, members);
          const auditRows = filterAndSortAuditLogs(combined, 'SENSITIVE', '', 'desc');
          const csv = buildCombinedRecordKeepingCsv(
            members,
            auditRows,
            activeGroup,
            memberContactsByUid
          );
          const filename = makeDatedCsvFilename(activeGroup.name, 'records-combined');
          downloadCsvFile(filename, csv);
          setBannerMessage(
            `Exported ${members.length} members & ${auditRows.length} audit entries to CSV`
          );
          return true;
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to export combined CSV report'));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      showBanner: (message) => setBannerMessage(message),
      clearBanner: () => setBannerMessage(null),
      leaveSession: () => {
        setSelectedGroupId(null);
        setSelectedEventId(null);
        setSelectedChannelId(null);
      },
    }),
    [
      activeGroup,
      allTasksByEvent,
      channelsState,
      clearFiredReminderKeys,
      currentRole,
      currentUserName,
      eventsState,
      fireInAppReminder,
      isGuest,
      joinGroupByCode,
      joinedGroups,
      logActivity,
      memberContactsByUid,
      normalizedMembersState,
      notificationsState,
      onRequestGoogleSignIn,
      personalAppearance,
      remindedTimes,
      selectedGroupId,
      switchGroup,
      uid,
    ]
  );

  const state: RallyWorkspaceState = {
    isCloudMode: false,
    isGuest: false,
    currentUserId: uid,
    currentUserName,
    currentUserEmail: identity.email ?? null,
    activeGroup,
    currentRole,
    joinedGroups,
    eventsState,
    selectedEventId,
    selectedEventTasksState,
    allTasksByEvent,
    channelsState,
    selectedChannelId,
    messagesState,
    notificationsState,
    activityLogsState,
    membersState: normalizedMembersState,
    memberContactsByUid,
    analytics,
    remindedTimes,
    inAppNotifications,
    personalAppearance,
    appBackground,
    groupBackgroundsById,
    groupImagesById,
    smsPreferences,
    smsPrefsLoaded,
    phoneNotificationPermission,
    bannerMessage,
    isBusy,
  };

  return { state, actions };
}
