import { formatDateTime } from './dateFormat';
import {
  ActivityAction,
  ActivityCategory,
  type GroupActivityLog,
  type GroupMember,
  type MemberContactInfo,
  MemberRole,
  parseActivityAction,
  parseActivityCategory,
  parseMemberRole,
  type RallyGroup,
  ROLE_META,
} from '../types/rally';

export type AuditLogScope =
  | 'SENSITIVE'
  | 'ROLES_AND_MEMBERS'
  | 'GROUP_AND_CHANNELS'
  | 'MODERATION'
  | 'ALL_EVENTS';

export const SENSITIVE_AUDIT_ACTIONS: ReadonlySet<ActivityAction> = new Set<ActivityAction>([
  ActivityAction.GROUP_CREATED,
  ActivityAction.GROUP_UPDATED,
  ActivityAction.MEMBER_ROLE_CHANGED,
  ActivityAction.MEMBER_DELETED,
  ActivityAction.CHANNEL_CREATED,
  ActivityAction.CHANNEL_UPDATED,
  ActivityAction.CHANNEL_DELETED,
  ActivityAction.ALERT_APPROVED,
  ActivityAction.ALERT_DELETED,
  ActivityAction.ALERT_SENT,
  ActivityAction.EVENT_DELETED,
  ActivityAction.TASK_DELETED,
]);

export function isSensitiveAuditAction(action: string | ActivityAction): boolean {
  return SENSITIVE_AUDIT_ACTIONS.has(parseActivityAction(action));
}

export function getAuditActionLabel(action: ActivityAction): string {
  switch (action) {
    case ActivityAction.GROUP_CREATED:
      return 'Group Created';
    case ActivityAction.GROUP_UPDATED:
      return 'Group Updated';
    case ActivityAction.MEMBER_ROLE_CHANGED:
      return 'Role Changed';
    case ActivityAction.MEMBER_DELETED:
      return 'Member Removed';
    case ActivityAction.CHANNEL_CREATED:
      return 'Channel Created';
    case ActivityAction.CHANNEL_UPDATED:
      return 'Channel Updated';
    case ActivityAction.CHANNEL_DELETED:
      return 'Channel Deleted';
    case ActivityAction.ALERT_APPROVED:
      return 'Alert Approved';
    case ActivityAction.ALERT_SENT:
      return 'Alert Broadcast';
    case ActivityAction.ALERT_DELETED:
      return 'Alert Deleted';
    case ActivityAction.EVENT_DELETED:
      return 'Event Deleted';
    case ActivityAction.TASK_DELETED:
      return 'Task Deleted';
    case ActivityAction.TASK_CREATED:
      return 'Task Created';
    case ActivityAction.TASK_UPDATED:
      return 'Task Updated';
    case ActivityAction.TASK_COMPLETED:
      return 'Task Completed';
    case ActivityAction.TASK_CLAIMED:
      return 'Task Claimed';
    case ActivityAction.TASK_RELEASED:
      return 'Task Released';
    case ActivityAction.EVENT_CREATED:
      return 'Event Created';
    case ActivityAction.EVENT_UPDATED:
      return 'Event Updated';
    case ActivityAction.MEMBER_JOINED:
      return 'Member Joined';
    default:
      return String(action).replace(/_/g, ' ');
  }
}

/**
 * For groups created before GROUP_CREATED logs were persisted, surfaces the
 * persisted group creation timestamp and owner metadata from the group record.
 */
export function combineAuditLogsWithOrigin(
  rawLogs: GroupActivityLog[],
  activeGroup: RallyGroup | null,
  members: GroupMember[]
): GroupActivityLog[] {
  if (!activeGroup || activeGroup.createdAtMs <= 0) return rawLogs;
  const hasRecordedGroupCreated = rawLogs.some(
    (entry) => parseActivityAction(entry.action) === ActivityAction.GROUP_CREATED
  );
  if (hasRecordedGroupCreated) return rawLogs;

  const creatorMember = members.find((m) => m.uid === activeGroup.ownerId);
  const originationEntry: GroupActivityLog = {
    id: `group_origin_${activeGroup.id}`,
    actorId: activeGroup.ownerId,
    actorName: creatorMember?.displayName || 'Group Creator',
    actorRole: MemberRole.CREATOR,
    category: ActivityCategory.GROUP,
    action: ActivityAction.GROUP_CREATED,
    summary: `Created group "${activeGroup.name}"`,
    details: `Invite code ${activeGroup.groupCode}`,
    targetId: activeGroup.id,
    createdAtMs: activeGroup.createdAtMs,
  };
  return [...rawLogs, originationEntry];
}

export function filterAndSortAuditLogs(
  logs: GroupActivityLog[],
  scope: AuditLogScope,
  searchQuery: string,
  sortOrder: 'asc' | 'desc'
): GroupActivityLog[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = logs.filter((entry) => {
    const action = parseActivityAction(entry.action);
    let matchesScope = true;
    switch (scope) {
      case 'SENSITIVE':
        matchesScope = SENSITIVE_AUDIT_ACTIONS.has(action);
        break;
      case 'ROLES_AND_MEMBERS':
        matchesScope =
          action === ActivityAction.MEMBER_ROLE_CHANGED ||
          action === ActivityAction.MEMBER_DELETED;
        break;
      case 'GROUP_AND_CHANNELS':
        matchesScope =
          action === ActivityAction.GROUP_CREATED ||
          action === ActivityAction.GROUP_UPDATED ||
          action === ActivityAction.CHANNEL_CREATED ||
          action === ActivityAction.CHANNEL_UPDATED ||
          action === ActivityAction.CHANNEL_DELETED;
        break;
      case 'MODERATION':
        matchesScope =
          action === ActivityAction.ALERT_APPROVED ||
          action === ActivityAction.ALERT_DELETED ||
          action === ActivityAction.ALERT_SENT ||
          action === ActivityAction.EVENT_DELETED ||
          action === ActivityAction.TASK_DELETED ||
          action === ActivityAction.CHANNEL_DELETED ||
          action === ActivityAction.MEMBER_DELETED;
        break;
      case 'ALL_EVENTS':
        matchesScope = true;
        break;
    }
    if (!matchesScope) return false;
    if (!q) return true;
    const actionLabel = getAuditActionLabel(action).toLowerCase();
    const roleLabel = ROLE_META[parseMemberRole(entry.actorRole)].label.toLowerCase();
    return (
      entry.summary.toLowerCase().includes(q) ||
      (entry.details ?? '').toLowerCase().includes(q) ||
      entry.actorName.toLowerCase().includes(q) ||
      actionLabel.includes(q) ||
      roleLabel.includes(q)
    );
  });

  return [...filtered].sort((a, b) =>
    sortOrder === 'desc' ? b.createdAtMs - a.createdAtMs : a.createdAtMs - b.createdAtMs
  );
}

/**
 * Escapes a single CSV cell per RFC 4180 while mitigating spreadsheet formula
 * injection (`=`, `+`, `-`, `@`, tab, CR) on user-supplied strings.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvDocument(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const lines = [
    headers.map((h) => escapeCsvCell(h)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function formatEpochIso(ms: number | null | undefined): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '';
  return new Date(ms).toISOString();
}

function formatEpochLocal(ms: number | null | undefined): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '';
  return formatDateTime(ms);
}

export function buildAuditLogCsv(
  entries: GroupActivityLog[],
  group: RallyGroup | null
): string {
  const headers = [
    'Entry ID',
    'Timestamp (ISO)',
    'Timestamp (Local)',
    'Category',
    'Action Code',
    'Action Label',
    'Actor UID',
    'Actor Name',
    'Actor Role',
    'Summary',
    'Details',
    'Target ID',
    'Group ID',
    'Group Name',
  ];

  const rows = entries.map((entry) => {
    const action = parseActivityAction(entry.action);
    const category = parseActivityCategory(entry.category);
    const role = parseMemberRole(entry.actorRole);
    return [
      entry.id,
      formatEpochIso(entry.createdAtMs),
      formatEpochLocal(entry.createdAtMs),
      category,
      action,
      getAuditActionLabel(action),
      entry.actorId,
      entry.actorName,
      ROLE_META[role].label,
      entry.summary,
      entry.details ?? '',
      entry.targetId ?? '',
      group?.id ?? '',
      group?.name ?? '',
    ];
  });

  return buildCsvDocument(headers, rows);
}

export function buildGroupMembersCsv(
  members: GroupMember[],
  group: RallyGroup | null,
  contactsByUid: Record<string, MemberContactInfo> = {}
): string {
  const headers = [
    'Member UID',
    'Display Name',
    'Cell Phone Number',
    'Email',
    'Sign-In Method',
    'Role',
    'Role Code',
    'Tasks Signed Up',
    'Messages Sent',
    'Joined At (ISO)',
    'Joined At (Local)',
    'Last Updated (ISO)',
    'Group ID',
    'Group Name',
    'Group Code',
  ];

  const rows = members.map((member) => {
    const role = parseMemberRole(member.role);
    const contact = contactsByUid[member.uid];
    const signInMethod = contact
      ? contact.authMethod === 'CODE_GUEST'
        ? 'Group Code'
        : 'Google'
      : member.uid.startsWith('guest_')
        ? 'Group Code'
        : 'Google';
    return [
      member.uid,
      member.displayName,
      contact?.phoneNumber ?? '',
      contact?.email ?? '',
      signInMethod,
      ROLE_META[role].label,
      role,
      member.tasksSignedUpCount,
      member.messagesSentCount,
      formatEpochIso(member.joinedAtMs),
      formatEpochLocal(member.joinedAtMs),
      formatEpochIso(member.updatedAtMs),
      group?.id ?? '',
      group?.name ?? '',
      group?.groupCode ?? '',
    ];
  });

  return buildCsvDocument(headers, rows);
}

export function buildCombinedRecordKeepingCsv(
  members: GroupMember[],
  auditEntries: GroupActivityLog[],
  group: RallyGroup | null,
  contactsByUid: Record<string, MemberContactInfo> = {},
  exportedAtMs = Date.now()
): string {
  const headers = [
    'Record Section',
    'Record ID',
    'Primary Name / Summary',
    'Role / Category',
    'Cell Phone / Action',
    'Email / Details',
    'Actor Name',
    'Actor Role',
    'Timestamp (ISO)',
    'Timestamp (Local)',
    'Target ID / Group Code',
    'Group ID',
    'Group Name',
  ];

  const rows: Array<Array<string | number | boolean | null | undefined>> = [];

  if (group) {
    rows.push([
      'GROUP_METADATA',
      group.id,
      group.name,
      'Group Summary',
      `Members: ${members.length}`,
      `Audit Entries: ${auditEntries.length}`,
      'System Export',
      'Admin Record',
      formatEpochIso(exportedAtMs),
      formatEpochLocal(exportedAtMs),
      group.groupCode,
      group.id,
      group.name,
    ]);
  }

  for (const member of members) {
    const role = parseMemberRole(member.role);
    const contact = contactsByUid[member.uid];
    const contactSummary = [
      contact?.email ? `Email: ${contact.email}` : null,
      `Tasks: ${member.tasksSignedUpCount}`,
      `Messages: ${member.messagesSentCount}`,
    ]
      .filter(Boolean)
      .join(' | ');
    rows.push([
      'GROUP_MEMBER',
      member.uid,
      member.displayName,
      ROLE_META[role].label,
      contact?.phoneNumber ?? '',
      contactSummary,
      member.displayName,
      ROLE_META[role].label,
      formatEpochIso(member.joinedAtMs),
      formatEpochLocal(member.joinedAtMs),
      group?.groupCode ?? '',
      group?.id ?? '',
      group?.name ?? '',
    ]);
  }

  for (const entry of auditEntries) {
    const action = parseActivityAction(entry.action);
    const category = parseActivityCategory(entry.category);
    const actorRole = parseMemberRole(entry.actorRole);
    rows.push([
      'AUDIT_LOG',
      entry.id,
      entry.summary,
      category,
      getAuditActionLabel(action),
      entry.details ?? '',
      entry.actorName,
      ROLE_META[actorRole].label,
      formatEpochIso(entry.createdAtMs),
      formatEpochLocal(entry.createdAtMs),
      entry.targetId ?? '',
      group?.id ?? '',
      group?.name ?? '',
    ]);
  }

  return buildCsvDocument(headers, rows);
}

export function slugifyCsvFilenamePart(input: string | null | undefined, fallback = 'rallyhub'): string {
  const cleaned = (input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

export function makeDatedCsvFilename(
  groupName: string | null | undefined,
  datasetLabel: 'audit-log' | 'members' | 'records-combined'
): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const slug = slugifyCsvFilenamePart(groupName, 'rallyhub-group');
  return `${slug}-${datasetLabel}-${yyyy}-${mm}-${dd}.csv`;
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', filename);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
