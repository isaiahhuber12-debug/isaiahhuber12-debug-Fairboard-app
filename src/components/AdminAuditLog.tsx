import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Bell,
  CalendarX2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileWarning,
  Hash,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Trash2,
  UserCog,
  UserMinus,
  X,
} from 'lucide-react';
import {
  type AuditLogScope,
  combineAuditLogsWithOrigin,
  filterAndSortAuditLogs,
  isSensitiveAuditAction,
} from '../lib/csvExport';
import { formatDateTime, formatRelativeTime } from '../lib/dateFormat';
import {
  ActivityAction,
  type AsyncDataState,
  type GroupActivityLog,
  type GroupMember,
  parseActivityAction,
  parseMemberRole,
  type RallyGroup,
} from '../types/rally';
import { RoleBadge } from './RallyComponents';

export { isSensitiveAuditAction };

const SCOPE_OPTIONS: Array<{ id: AuditLogScope; label: string }> = [
  { id: 'SENSITIVE', label: 'All Admin Actions' },
  { id: 'ROLES_AND_MEMBERS', label: 'Roles & Deletions' },
  { id: 'GROUP_AND_CHANNELS', label: 'Group & Channels' },
  { id: 'MODERATION', label: 'Moderation & Alerts' },
  { id: 'ALL_EVENTS', label: 'All Activity' },
];

interface AdminAuditLogProps {
  activityLogsState: AsyncDataState<GroupActivityLog[]>;
  activeGroup: RallyGroup | null;
  members: GroupMember[];
  currentUserId: string;
  isBusy?: boolean;
  onExportCsv?: (options: {
    scope: AuditLogScope;
    searchQuery: string;
    sortOrder: 'asc' | 'desc';
  }) => void;
}

export function AdminAuditLog({
  activityLogsState,
  activeGroup,
  members,
  currentUserId,
  isBusy = false,
  onExportCsv,
}: AdminAuditLogProps) {
  const [scope, setScope] = useState<AuditLogScope>('SENSITIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [visibleLimit, setVisibleLimit] = useState(25);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const rawLogs = useMemo(
    () => (activityLogsState.status === 'success' ? activityLogsState.data : []),
    [activityLogsState]
  );

  const combinedLogs = useMemo(
    () => combineAuditLogsWithOrigin(rawLogs, activeGroup, members),
    [rawLogs, activeGroup, members]
  );

  const sensitiveCount = useMemo(
    () => combinedLogs.filter((entry) => isSensitiveAuditAction(entry.action)).length,
    [combinedLogs]
  );

  const filteredLogs = useMemo(
    () => filterAndSortAuditLogs(combinedLogs, scope, searchQuery, sortOrder),
    [combinedLogs, scope, searchQuery, sortOrder]
  );

  const visibleLogs = filteredLogs.slice(0, visibleLimit);

  return (
    <section
      data-testid="admin_audit_log_panel"
      className="space-y-4 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Administrative Audit Log</h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Immutable chronological trail of group creation, role promotions/demotions, member
              removals, and moderation changes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="audit_log_total_badge"
            className="rounded-lg bg-[var(--rally-surface-variant)] px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-surface-variant)]"
          >
            {sensitiveCount} sensitive {sensitiveCount === 1 ? 'event' : 'events'}
          </span>
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            data-testid="audit_log_sort_toggle"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
          >
            <ArrowDownUp className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
            <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>
          {onExportCsv && (
            <button
              type="button"
              disabled={isBusy || activityLogsState.status === 'loading'}
              onClick={() => onExportCsv({ scope, searchQuery, sortOrder })}
              data-testid="audit_log_export_csv_button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Scope Filters */}
      <div className="flex flex-wrap gap-1.5">
        {SCOPE_OPTIONS.map((opt) => {
          const active = scope === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setScope(opt.id);
                setVisibleLimit(25);
              }}
              data-testid={`audit_scope_${opt.id.toLowerCase()}`}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                  : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/45'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setVisibleLimit(25);
          }}
          placeholder="Search audit history by admin name, member, action, or details..."
          aria-label="Search administrative audit log"
          data-testid="audit_log_search_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/30 py-2.5 pl-10 pr-10 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setVisibleLimit(25);
            }}
            aria-label="Clear audit search"
            data-testid="audit_log_search_clear"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)] hover:text-[var(--rally-on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Loading & Error */}
      {activityLogsState.status === 'loading' && (
        <div className="space-y-1.5 py-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rally-surface-variant)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--rally-primary)]" />
          </div>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            Loading administrative audit records...
          </p>
        </div>
      )}

      {activityLogsState.status === 'error' && (
        <p className="text-xs font-medium text-[var(--rally-error)]">
          {activityLogsState.message}
        </p>
      )}

      {/* Empty State */}
      {activityLogsState.status === 'success' && filteredLogs.length === 0 && (
        <div
          data-testid="audit_log_empty_state"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--rally-surface-variant)]/45 p-4 text-xs text-[var(--rally-on-surface-variant)]"
        >
          <span>No administrative audit records match your current scope or search query.</span>
          {(scope !== 'SENSITIVE' || searchQuery.trim().length > 0) && (
            <button
              type="button"
              onClick={() => {
                setScope('SENSITIVE');
                setSearchQuery('');
                setVisibleLimit(25);
              }}
              data-testid="audit_log_reset_filters"
              className="rounded-xl border border-[var(--rally-outline)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/40"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Chronological Timeline List */}
      {activityLogsState.status === 'success' && visibleLogs.length > 0 && (
        <div className="divide-y divide-[var(--rally-outline)]/45 rounded-2xl border border-[var(--rally-outline)]/55 bg-[var(--rally-bg)]/50">
          {visibleLogs.map((entry) => (
            <AuditLogRow
              key={entry.id}
              entry={entry}
              isCurrentUser={entry.actorId === currentUserId}
              nowMs={nowMs}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredLogs.length > 25 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-[var(--rally-on-surface-variant)]">
            Showing {visibleLogs.length} of {filteredLogs.length} records
          </span>
          <div className="flex items-center gap-2">
            {visibleLimit > 25 && (
              <button
                type="button"
                onClick={() => setVisibleLimit(25)}
                data-testid="audit_log_show_fewer"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
              >
                <span>Show fewer</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            {filteredLogs.length > visibleLimit && (
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 25)}
                data-testid="audit_log_show_more"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
              >
                <span>Show 25 more ({filteredLogs.length - visibleLimit} remaining)</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AuditLogRow({
  entry,
  isCurrentUser,
  nowMs,
}: {
  entry: GroupActivityLog;
  isCurrentUser: boolean;
  nowMs: number;
}) {
  const action = parseActivityAction(entry.action);
  const actorRole = parseMemberRole(entry.actorRole);
  const meta = getAuditActionMeta(action);
  const Icon = meta.icon;

  return (
    <div
      data-testid={`audit_log_row_${entry.id}`}
      data-audit-action={action}
      className="flex items-start gap-3.5 px-4 py-3.5"
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBgClass} ${meta.iconFgClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
            <span className="text-sm font-semibold text-[var(--rally-on-surface)]">
              {entry.summary}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--rally-on-surface-variant)]">
            <Clock className="h-3 w-3 shrink-0" />
            <time
              dateTime={new Date(entry.createdAtMs).toISOString()}
              title={formatDateTime(entry.createdAtMs)}
            >
              {formatDateTime(entry.createdAtMs)} ({formatRelativeTime(entry.createdAtMs, nowMs)})
            </time>
          </div>
        </div>

        {entry.details && (
          <p className="text-xs text-[var(--rally-on-surface-variant)]">{entry.details}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-[var(--rally-on-surface-variant)]">
          <span>
            Actor:{' '}
            <strong className="font-semibold text-[var(--rally-on-surface)]">
              {isCurrentUser ? `${entry.actorName} (You)` : entry.actorName}
            </strong>
          </span>
          <RoleBadge role={actorRole} />
          {entry.targetId && (
            <span className="font-mono-code text-[10px] text-[var(--rally-on-surface-variant)]">
              Target: {entry.targetId.length > 16 ? `${entry.targetId.slice(0, 14)}…` : entry.targetId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function getAuditActionMeta(action: ActivityAction): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgClass: string;
  iconFgClass: string;
  badgeClass: string;
} {
  switch (action) {
    case ActivityAction.GROUP_CREATED:
      return {
        label: 'Group Created',
        icon: Shield,
        iconBgClass: 'bg-[var(--rally-primary-container)]',
        iconFgClass: 'text-[var(--rally-on-primary-container)]',
        badgeClass: 'bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]',
      };
    case ActivityAction.GROUP_UPDATED:
      return {
        label: 'Group Updated',
        icon: Settings,
        iconBgClass: 'bg-[var(--rally-surface-variant)]',
        iconFgClass: 'text-[var(--rally-on-surface-variant)]',
        badgeClass: 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface)]',
      };
    case ActivityAction.MEMBER_ROLE_CHANGED:
      return {
        label: 'Role Changed',
        icon: UserCog,
        iconBgClass: 'bg-[var(--rally-secondary-container)]',
        iconFgClass: 'text-[var(--rally-on-secondary-container)]',
        badgeClass:
          'bg-[var(--rally-secondary-container)] text-[var(--rally-on-secondary-container)]',
      };
    case ActivityAction.MEMBER_DELETED:
      return {
        label: 'Member Removed',
        icon: UserMinus,
        iconBgClass: 'bg-[var(--rally-error)]/12',
        iconFgClass: 'text-[var(--rally-error)]',
        badgeClass: 'bg-[var(--rally-error)]/12 text-[var(--rally-error)]',
      };
    case ActivityAction.CHANNEL_CREATED:
      return {
        label: 'Channel Created',
        icon: Hash,
        iconBgClass: 'bg-[var(--rally-tertiary-container)]',
        iconFgClass: 'text-[var(--rally-on-tertiary-container)]',
        badgeClass:
          'bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)]',
      };
    case ActivityAction.CHANNEL_UPDATED:
      return {
        label: 'Channel Updated',
        icon: Hash,
        iconBgClass: 'bg-[var(--rally-surface-variant)]',
        iconFgClass: 'text-[var(--rally-on-surface-variant)]',
        badgeClass: 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface)]',
      };
    case ActivityAction.CHANNEL_DELETED:
      return {
        label: 'Channel Deleted',
        icon: Trash2,
        iconBgClass: 'bg-[var(--rally-error)]/12',
        iconFgClass: 'text-[var(--rally-error)]',
        badgeClass: 'bg-[var(--rally-error)]/12 text-[var(--rally-error)]',
      };
    case ActivityAction.ALERT_APPROVED:
      return {
        label: 'Alert Approved',
        icon: Bell,
        iconBgClass: 'bg-[var(--rally-tertiary-container)]',
        iconFgClass: 'text-[var(--rally-on-tertiary-container)]',
        badgeClass:
          'bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)]',
      };
    case ActivityAction.ALERT_SENT:
      return {
        label: 'Alert Broadcast',
        icon: Bell,
        iconBgClass: 'bg-[var(--rally-secondary-container)]',
        iconFgClass: 'text-[var(--rally-on-secondary-container)]',
        badgeClass:
          'bg-[var(--rally-secondary-container)] text-[var(--rally-on-secondary-container)]',
      };
    case ActivityAction.ALERT_DELETED:
      return {
        label: 'Alert Deleted',
        icon: Trash2,
        iconBgClass: 'bg-[var(--rally-error)]/12',
        iconFgClass: 'text-[var(--rally-error)]',
        badgeClass: 'bg-[var(--rally-error)]/12 text-[var(--rally-error)]',
      };
    case ActivityAction.EVENT_DELETED:
      return {
        label: 'Event Deleted',
        icon: CalendarX2,
        iconBgClass: 'bg-[var(--rally-error)]/12',
        iconFgClass: 'text-[var(--rally-error)]',
        badgeClass: 'bg-[var(--rally-error)]/12 text-[var(--rally-error)]',
      };
    case ActivityAction.TASK_DELETED:
      return {
        label: 'Task Deleted',
        icon: Trash2,
        iconBgClass: 'bg-[var(--rally-error)]/12',
        iconFgClass: 'text-[var(--rally-error)]',
        badgeClass: 'bg-[var(--rally-error)]/12 text-[var(--rally-error)]',
      };
    default:
      return {
        label: action.replace(/_/g, ' '),
        icon: FileWarning,
        iconBgClass: 'bg-[var(--rally-surface-variant)]',
        iconFgClass: 'text-[var(--rally-on-surface-variant)]',
        badgeClass: 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface-variant)]',
      };
  }
}
