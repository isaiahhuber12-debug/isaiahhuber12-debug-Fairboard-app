export enum MemberRole {
  PARTICIPANT = 'PARTICIPANT',
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
  CREATOR = 'CREATOR',
}

export const ROLE_META: Record<
  MemberRole,
  {
    label: string;
    rank: number;
    canManageEventsAndTasks: boolean;
    canSendTargetedUpdates: boolean;
    canSendGlobalAnnouncements: boolean;
    canAccessAdminPanel: boolean;
    canCreateAdmins: boolean;
    isCreator: boolean;
  }
> = {
  [MemberRole.PARTICIPANT]: {
    label: 'Participant',
    rank: 1,
    canManageEventsAndTasks: false,
    canSendTargetedUpdates: false,
    canSendGlobalAnnouncements: false,
    canAccessAdminPanel: false,
    canCreateAdmins: false,
    isCreator: false,
  },
  [MemberRole.ORGANIZER]: {
    label: 'Organizer',
    rank: 2,
    canManageEventsAndTasks: true,
    canSendTargetedUpdates: true,
    canSendGlobalAnnouncements: false,
    canAccessAdminPanel: false,
    canCreateAdmins: false,
    isCreator: false,
  },
  [MemberRole.ADMIN]: {
    label: 'Admin',
    rank: 3,
    canManageEventsAndTasks: true,
    canSendTargetedUpdates: true,
    canSendGlobalAnnouncements: true,
    canAccessAdminPanel: true,
    canCreateAdmins: true,
    isCreator: false,
  },
  [MemberRole.CREATOR]: {
    label: 'Creator',
    rank: 4,
    canManageEventsAndTasks: true,
    canSendTargetedUpdates: true,
    canSendGlobalAnnouncements: true,
    canAccessAdminPanel: true,
    canCreateAdmins: true,
    isCreator: true,
  },
};

export function parseMemberRole(raw?: string | null): MemberRole {
  if (!raw) return MemberRole.PARTICIPANT;
  const upper = raw.toUpperCase();
  if (upper in MemberRole) return upper as MemberRole;
  return MemberRole.PARTICIPANT;
}

export enum ChannelAccessLevel {
  ALL = 'ALL',
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
}

export const CHANNEL_ACCESS_LABELS: Record<ChannelAccessLevel, string> = {
  [ChannelAccessLevel.ALL]: 'All Members',
  [ChannelAccessLevel.ORGANIZER]: 'Organizers & Admins',
  [ChannelAccessLevel.ADMIN]: 'Admins Only',
};

export function parseChannelAccessLevel(raw?: string | null): ChannelAccessLevel {
  if (!raw) return ChannelAccessLevel.ALL;
  const upper = raw.toUpperCase();
  if (upper in ChannelAccessLevel) return upper as ChannelAccessLevel;
  return ChannelAccessLevel.ALL;
}

export enum TaskStatus {
  OPEN = 'OPEN',
  FILLED = 'FILLED',
  COMPLETED = 'COMPLETED',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: 'Open',
  [TaskStatus.FILLED]: 'Filled',
  [TaskStatus.COMPLETED]: 'Completed',
};

export function parseTaskStatus(raw?: string | null): TaskStatus {
  if (!raw) return TaskStatus.OPEN;
  const upper = raw.toUpperCase();
  if (upper in TaskStatus) return upper as TaskStatus;
  return TaskStatus.OPEN;
}

export enum NotificationType {
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  TASK_UPDATE = 'TASK_UPDATE',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.ANNOUNCEMENT]: 'Announcement',
  [NotificationType.TASK_UPDATE]: 'Task Update',
  [NotificationType.DEADLINE_REMINDER]: 'Deadline Reminder',
};

export function parseNotificationType(raw?: string | null): NotificationType {
  if (!raw) return NotificationType.ANNOUNCEMENT;
  const upper = raw.toUpperCase();
  if (upper in NotificationType) return upper as NotificationType;
  return NotificationType.ANNOUNCEMENT;
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'Pending Admin Approval',
  [ApprovalStatus.APPROVED]: 'Posted',
};

export function parseApprovalStatus(raw?: string | null): ApprovalStatus {
  if (!raw) return ApprovalStatus.APPROVED;
  const upper = raw.toUpperCase();
  if (upper in ApprovalStatus) return upper as ApprovalStatus;
  return ApprovalStatus.APPROVED;
}

export enum MessageType {
  TEXT = 'TEXT',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  TASK_UPDATE = 'TASK_UPDATE',
}

export function parseMessageType(raw?: string | null): MessageType {
  if (!raw) return MessageType.TEXT;
  const upper = raw.toUpperCase();
  if (upper in MessageType) return upper as MessageType;
  return MessageType.TEXT;
}

export enum ActivityCategory {
  TASK = 'TASK',
  CALENDAR = 'CALENDAR',
  MEMBER = 'MEMBER',
  CHANNEL = 'CHANNEL',
  ALERT = 'ALERT',
  GROUP = 'GROUP',
}

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  [ActivityCategory.TASK]: 'Tasks',
  [ActivityCategory.CALENDAR]: 'Calendar',
  [ActivityCategory.MEMBER]: 'Members',
  [ActivityCategory.CHANNEL]: 'Chats',
  [ActivityCategory.ALERT]: 'Alerts',
  [ActivityCategory.GROUP]: 'Group',
};

export function parseActivityCategory(raw?: string | null): ActivityCategory {
  if (!raw) return ActivityCategory.TASK;
  const upper = raw.toUpperCase();
  if (upper in ActivityCategory) return upper as ActivityCategory;
  return ActivityCategory.TASK;
}

export enum ActivityAction {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_DELETED = 'TASK_DELETED',
  TASK_CLAIMED = 'TASK_CLAIMED',
  TASK_RELEASED = 'TASK_RELEASED',
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  EVENT_DELETED = 'EVENT_DELETED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_ROLE_CHANGED = 'MEMBER_ROLE_CHANGED',
  MEMBER_DELETED = 'MEMBER_DELETED',
  CHANNEL_CREATED = 'CHANNEL_CREATED',
  CHANNEL_UPDATED = 'CHANNEL_UPDATED',
  CHANNEL_DELETED = 'CHANNEL_DELETED',
  ALERT_SENT = 'ALERT_SENT',
  ALERT_APPROVED = 'ALERT_APPROVED',
  ALERT_DELETED = 'ALERT_DELETED',
  GROUP_CREATED = 'GROUP_CREATED',
  GROUP_UPDATED = 'GROUP_UPDATED',
}

export function parseActivityAction(raw?: string | null): ActivityAction {
  if (!raw) return ActivityAction.TASK_UPDATED;
  const upper = raw.toUpperCase();
  if (upper in ActivityAction) return upper as ActivityAction;
  return ActivityAction.TASK_UPDATED;
}

export interface JoinedGroupRef {
  id: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  role: string;
  groupBackground?: string | null;
  groupImageUrl?: string | null;
  joinedAtMs: number;
  updatedAtMs: number;
}

export interface RallyGroup {
  id: string;
  name: string;
  description: string;
  groupCode: string;
  ownerId: string;
  groupBackground?: string | null;
  groupImageUrl?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GroupMember {
  id: string;
  uid: string;
  displayName: string;
  role: string;
  tasksSignedUpCount: number;
  messagesSentCount: number;
  joinedAtMs: number;
  updatedAtMs: number;
}

export interface MemberContactInfo {
  uid: string;
  displayName: string;
  phoneNumber: string;
  email?: string | null;
  authMethod: 'GOOGLE' | 'CODE_GUEST';
  smsEnabled: boolean;
  updatedAtMs: number;
}

export interface WorkspaceIdentity {
  uid: string;
  displayName: string | null;
  email: string | null;
  isGuest: boolean;
  phoneNumber?: string | null;
}

export interface RallyEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  startEpochMs: number;
  endEpochMs: number;
  createdBy: string;
  organizerName: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  description: string;
  deadlineEpochMs: number;
  capacity: number;
  assignedCount: number;
  assignedUids: string[];
  assignedNames: string[];
  status: string;
  chatChannelId?: string | null;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  accessLevel: string;
  eventId?: string | null;
  createdBy: string;
  messageCount: number;
  lastMessagePreview?: string | null;
  lastMessageAtMs?: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  messageType: string;
  createdAtMs: number;
  updatedAtMs?: number | null;
}

export interface HubNotification {
  id: string;
  title: string;
  body: string;
  notificationType: string;
  targetScope: string;
  targetRole: string;
  targetChannelId?: string | null;
  targetChannelName?: string | null;
  targetEventId?: string | null;
  senderId: string;
  senderName: string;
  scheduledForEpochMs?: number | null;
  approvalStatus: string;
  createdAtMs: number;
  updatedAtMs?: number | null;
}

export interface GroupActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  category: string;
  action: string;
  summary: string;
  details?: string | null;
  targetId?: string | null;
  createdAtMs: number;
}

export interface SmsPreferences {
  phone: string;
  enabled: boolean;
  forMessages: boolean;
  forEvents: boolean;
}

export const DEFAULT_SMS_PREFERENCES: SmsPreferences = {
  phone: '',
  enabled: false,
  forMessages: true,
  forEvents: true,
};

export interface EngagementAnalytics {
  totalMembers: number;
  creatorCount: number;
  adminCount: number;
  organizerCount: number;
  participantCount: number;
  totalEvents: number;
  totalTasks: number;
  totalTaskSlots: number;
  filledTaskSlots: number;
  totalMessages: number;
  totalNotifications: number;
  channelActivity: Array<{ name: string; count: number }>;
  fillRatePercent: number;
}

export type AsyncDataState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

export type HubTab = 'dashboard' | 'calendar' | 'chats' | 'alerts' | 'admin';

export interface AiChatMessage {
  id: string;
  isUser: boolean;
  text: string;
  isStreaming?: boolean;
}

export interface AiAnnouncementDraft {
  title: string;
  body: string;
  type: NotificationType;
}
