import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import * as repo from '../services/rallyRepository';
import { getFriendlyErrorMessage } from '../lib/firestoreError';
import {
  cancelBrowserReminder,
  postBrowserNotification,
  scheduleBrowserReminder,
} from '../lib/notifications';
import {
  ApprovalStatus,
  type AsyncDataState,
  type ChannelAccessLevel,
  type ChatChannel,
  type ChatMessage,
  type EngagementAnalytics,
  type EventTask,
  type GroupMember,
  type HubNotification,
  type JoinedGroupRef,
  MemberRole,
  MessageType,
  NotificationType,
  parseApprovalStatus,
  parseMemberRole,
  type RallyEvent,
  type RallyGroup,
  ROLE_META,
  TaskStatus,
} from '../types/rally';

export interface RallyWorkspaceState {
  isCloudMode: boolean;
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
  membersState: AsyncDataState<GroupMember[]>;
  analytics: EngagementAnalytics;
  remindedTimes: Record<string, number>;
  bannerMessage: string | null;
  isBusy: boolean;
}

export interface RallyWorkspaceActions {
  selectEvent: (eventId: string | null) => void;
  selectChannel: (channelId: string | null) => void;
  switchGroup: (groupId: string) => void;
  joinGroupByCode: (code: string, displayName?: string | null) => Promise<void>;
  createGroupWithCode: (name: string, description: string, groupCode: string) => Promise<void>;
  updateGroupCode: (newCode: string) => Promise<void>;
  updateGroupDetails: (name: string, description: string) => Promise<void>;
  updateDisplayName: (newDisplayName: string) => Promise<void>;
  createEvent: (
    title: string,
    description: string,
    location: string,
    category: string,
    startEpochMs: number,
    endEpochMs: number
  ) => Promise<void>;
  updateEvent: (
    eventId: string,
    title: string,
    description: string,
    location: string,
    category: string,
    startEpochMs: number,
    endEpochMs: number
  ) => Promise<void>;
  createTask: (
    eventId: string,
    title: string,
    description: string,
    deadlineEpochMs: number,
    capacity: number,
    chatChannelId?: string | null
  ) => Promise<void>;
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
  toggleTaskSignup: (eventId: string, taskId: string) => Promise<void>;
  createChannel: (
    name: string,
    description: string,
    accessLevel: ChannelAccessLevel
  ) => Promise<void>;
  updateChannel: (
    channelId: string,
    name: string,
    description: string,
    accessLevel: ChannelAccessLevel
  ) => Promise<void>;
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
  }) => Promise<void>;
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
  scheduleOrUpdateReminder: (
    itemId: string,
    title: string,
    body: string,
    triggerAtEpochMs: number
  ) => void;
  removeReminder: (itemId: string) => void;
  showBanner: (message: string) => void;
  clearBanner: () => void;
  leaveSession: () => void;
}

export function useRallyWorkspace(
  user: User,
  pendingJoin: { code: string; displayName: string | null } | null,
  onPendingJoinConsumed: () => void
): { state: RallyWorkspaceState; actions: RallyWorkspaceActions } {
  const uid = user.uid;

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
  const [remindedTimes, setRemindedTimes] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`rallyhub_reminders_${uid}`);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const ensuredCreatorGroupsRef = useRef<Set<string>>(new Set());
  const seenNotificationsRef = useRef<Set<string>>(new Set());
  const notificationsInitializedRef = useRef(false);

  // Sync reminders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`rallyhub_reminders_${uid}`, JSON.stringify(remindedTimes));
    } catch {
      // Ignore storage errors
    }
  }, [remindedTimes, uid]);

  // Ensure user profile exists on sign-in
  useEffect(() => {
    void repo.ensureUserProfile().catch((err) => {
      console.warn('Could not sync user profile:', err);
    });
  }, [uid]);

  // Observe joined groups
  useEffect(() => {
    const unsub = repo.subscribeJoinedGroups(
      uid,
      (groups) => setJoinedGroups(groups),
      (err) => setBannerMessage(getFriendlyErrorMessage(err, 'Failed to load groups'))
    );
    return unsub;
  }, [uid]);

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
      (group) => setActiveGroupEntry({ groupId: targetGroupId, group }),
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

  const fallbackName =
    user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Member';

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

  // Keep tasks loaded for up to 10 upcoming events for Dashboard & Analytics
  const upcomingEventIdsKey = useMemo(() => {
    if (eventsState.status !== 'success') return '';
    return eventsState.data
      .slice(0, 10)
      .map((e) => e.id)
      .join(',');
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
                postBrowserNotification(
                  isPending ? `Approval Needed: ${n.title}` : n.title,
                  n.body
                );
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
    async (code: string, displayName?: string | null) => {
      setIsBusy(true);
      try {
        const newGroupId = await repo.joinGroupByCode(code, displayName);
        switchGroup(newGroupId);
        setBannerMessage(`Joined group ${repo.normalizeGroupCode(code)}`);
      } catch (err) {
        setBannerMessage(getFriendlyErrorMessage(err, 'Failed to join group'));
      } finally {
        setIsBusy(false);
      }
    },
    [switchGroup]
  );

  // Consume pending join code from AuthAndJoinScreen
  const pendingCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingJoin && pendingJoin.code && pendingCodeRef.current !== pendingJoin.code) {
      pendingCodeRef.current = pendingJoin.code;
      void joinGroupByCode(pendingJoin.code, pendingJoin.displayName).finally(() => {
        onPendingJoinConsumed();
      });
    }
  }, [pendingJoin, joinGroupByCode, onPendingJoinConsumed]);

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
        .slice(0, 5)
        .map((c) => ({ name: c.name, count: c.messageCount })),
      fillRatePercent,
    };
  }, [normalizedMembersState, eventsState, channelsState, notificationsState, allTasksByEvent]);

  const actions: RallyWorkspaceActions = useMemo(
    () => ({
      selectEvent: (eventId) => setSelectedEventId(eventId),
      selectChannel: (channelId) => setSelectedChannelId(channelId),
      switchGroup,
      joinGroupByCode,
      createGroupWithCode: async (name, description, groupCode) => {
        setIsBusy(true);
        try {
          const newGroupId = await repo.createGroupWithCode(name, description, groupCode);
          switchGroup(newGroupId);
          setBannerMessage(`Group created with code ${repo.normalizeGroupCode(groupCode)}`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create group'));
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
          setBannerMessage('Group details updated');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update group'));
        } finally {
          setIsBusy(false);
        }
      },
      updateDisplayName: async (newDisplayName) => {
        if (!activeGroup) return;
        try {
          await repo.updateOwnDisplayName(activeGroup.id, newDisplayName);
          setBannerMessage('Display name updated');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update display name'));
        }
      },
      createEvent: async (title, description, location, category, startEpochMs, endEpochMs) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          await repo.createEvent(
            activeGroup.id,
            title,
            description,
            location,
            category,
            startEpochMs,
            endEpochMs,
            currentUserName
          );
          setBannerMessage(`Event '${title}' added to calendar`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create event'));
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
          setBannerMessage(`Event '${title}' updated`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update event'));
        } finally {
          setIsBusy(false);
        }
      },
      createTask: async (eventId, title, description, deadlineEpochMs, capacity, chatChannelId) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          await repo.createTask(
            activeGroup.id,
            eventId,
            title,
            description,
            deadlineEpochMs,
            capacity,
            chatChannelId
          );
          setBannerMessage(`Task '${title}' published`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create task'));
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
          setBannerMessage(`Task '${title}' updated`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update task'));
        } finally {
          setIsBusy(false);
        }
      },
      toggleTaskSignup: async (eventId, taskId) => {
        if (!activeGroup) return;
        try {
          const claimed = await repo.toggleTaskSignup(
            activeGroup.id,
            eventId,
            taskId,
            currentUserName
          );
          setBannerMessage(claimed ? 'Signed up for task!' : 'Removed from task shift');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Could not update task signup'));
        }
      },
      createChannel: async (name, description, accessLevel) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          await repo.createChannel(activeGroup.id, name, description, accessLevel);
          setBannerMessage(`Created #${name.trim()} channel`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to create channel'));
        } finally {
          setIsBusy(false);
        }
      },
      updateChannel: async (channelId, name, description, accessLevel) => {
        if (!activeGroup) return;
        setIsBusy(true);
        try {
          await repo.updateChannel(activeGroup.id, channelId, name, description, accessLevel);
          setBannerMessage(`Updated #${name.trim()} channel`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to update channel'));
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
        if (!activeGroup) return;
        const needsApproval =
          type === NotificationType.ANNOUNCEMENT && !ROLE_META[currentRole].canAccessAdminPanel;
        const resolvedScope = needsApproval ? 'ALL' : targetScope;
        const resolvedTargetRole = needsApproval ? 'ADMIN' : targetRole;
        const resolvedStatus = needsApproval ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;

        setIsBusy(true);
        try {
          await repo.sendNotification(
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
          setBannerMessage(
            needsApproval
              ? 'Announcement submitted for Admin approval before posting'
              : `Alert dispatched to ${targetChannelName ?? targetRole}`
          );
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to send alert'));
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
          type === NotificationType.ANNOUNCEMENT && !ROLE_META[currentRole].canAccessAdminPanel;
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
        setIsBusy(true);
        try {
          await repo.approveNotification(activeGroup.id, notificationId);
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
        try {
          await repo.deleteNotification(activeGroup.id, notificationId);
          setBannerMessage('Announcement deleted');
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Failed to delete announcement'));
        }
      },
      updateMemberRole: async (memberUid, newRole) => {
        if (!activeGroup) return;
        try {
          await repo.updateMemberRole(activeGroup.id, memberUid, newRole);
          setBannerMessage(`Updated member role to ${ROLE_META[newRole].label}`);
        } catch (err) {
          setBannerMessage(getFriendlyErrorMessage(err, 'Permission denied updating role'));
        }
      },
      scheduleOrUpdateReminder: (itemId, title, body, triggerAtEpochMs) => {
        setRemindedTimes((prev) => ({ ...prev, [itemId]: triggerAtEpochMs }));
        scheduleBrowserReminder(itemId, title, body, triggerAtEpochMs);
        setBannerMessage(`Reminder set for ${title}`);
      },
      removeReminder: (itemId) => {
        setRemindedTimes((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        cancelBrowserReminder(itemId);
        setBannerMessage('Reminder removed');
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
      currentRole,
      currentUserName,
      joinGroupByCode,
      switchGroup,
    ]
  );

  const state: RallyWorkspaceState = {
    isCloudMode: true,
    currentUserId: uid,
    currentUserName,
    currentUserEmail: user.email ?? null,
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
    membersState: normalizedMembersState,
    analytics,
    remindedTimes,
    bannerMessage,
    isBusy,
  };

  return { state, actions };
}
