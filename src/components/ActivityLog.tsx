import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Calendar,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Hash,
  Search,
  Settings,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../lib/dateFormat';
import {
  ActivityAction,
  ActivityCategory,
  type AsyncDataState,
  type GroupActivityLog,
  MemberRole,
  parseActivityAction,
  parseActivityCategory,
  parseMemberRole,
  ROLE_META,
} from '../types/rally';

type ActivityFilter = 'ALL' | ActivityCategory.TASK | ActivityCategory.CALENDAR | ActivityCategory.MEMBER | 'OTHER';

interface ActivityLogProps {
  activityLogsState: AsyncDataState<GroupActivityLog[]>;
  currentUserId: string;
  compact?: boolean;
  onOpenFullLog?: () => void;
}

const FILTER_OPTIONS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: ActivityCategory.TASK, label: 'Tasks' },
  { id: ActivityCategory.CALENDAR, label: 'Calendar' },
  { id: ActivityCategory.MEMBER, label: 'Members' },
  { id: 'OTHER', label: 'Alerts & Group' },
];

export function ActivityLog({
  activityLogsState,
  currentUserId,
  compact = false,
  onOpenFullLog,
}: ActivityLogProps) {
  const [filter, setFilter] = useState<ActivityFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(compact ? 6 : 15);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const logs = useMemo(
    () => (activityLogsState.status === 'success' ? activityLogsState.data : []),
    [activityLogsState]
  );

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      const cat = parseActivityCategory(entry.category);
      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'OTHER'
          ? cat === ActivityCategory.ALERT ||
            cat === ActivityCategory.CHANNEL ||
            cat === ActivityCategory.GROUP
          : cat === filter);
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        entry.summary.toLowerCase().includes(q) ||
        entry.actorName.toLowerCase().includes(q) ||
        (entry.details ?? '').toLowerCase().includes(q)
      );
    });
  }, [logs, filter, searchQuery]);

  const initialCount = compact ? 6 : 15;
  const visibleLogs = filteredLogs.slice(0, visibleLimit);

  return (
    <section
      data-testid={compact ? 'dashboard_activity_log' : 'admin_activity_log'}
      className="space-y-3 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 sm:p-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg">Activity Log</h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Recent task completions, calendar updates, and member actions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activityLogsState.status === 'success' && (
            <span className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
          {compact && onOpenFullLog && (
            <button
              type="button"
              onClick={onOpenFullLog}
              data-testid="activity_log_view_full_button"
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
            >
              Open in Admin
            </button>
          )}
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setFilter(opt.id);
                setVisibleLimit(initialCount);
              }}
              data-testid={`activity_filter_${opt.id.toLowerCase()}`}
              className={`rounded-xl border px-3 py-1 text-xs font-semibold transition ${
                active
                  ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                  : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/40'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Search (Full view) */}
      {!compact && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleLimit(initialCount);
            }}
            placeholder="Filter by member, task, event, or action..."
            data-testid="activity_log_search_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/30 py-2 pl-10 pr-4 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>
      )}

      {/* States */}
      {activityLogsState.status === 'loading' && (
        <div className="space-y-1.5 py-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rally-surface-variant)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--rally-primary)]" />
          </div>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            Syncing recent group activity...
          </p>
        </div>
      )}

      {activityLogsState.status === 'error' && (
        <p className="text-xs font-medium text-[var(--rally-error)]">
          {activityLogsState.message}
        </p>
      )}

      {activityLogsState.status === 'success' && filteredLogs.length === 0 && (
        <div className="rounded-2xl bg-[var(--rally-surface-variant)]/45 p-4 text-xs text-[var(--rally-on-surface-variant)]">
          {logs.length === 0
            ? 'No group activity recorded yet. Task completions, calendar updates, and member sign-ups will appear here in real time.'
            : 'No activity entries match your current filter.'}
        </div>
      )}

      {activityLogsState.status === 'success' && visibleLogs.length > 0 && (
        <div className="divide-y divide-[var(--rally-outline)]/40 rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-bg)]/50">
          {visibleLogs.map((entry) => (
            <ActivityLogRow
              key={entry.id}
              entry={entry}
              isCurrentUser={entry.actorId === currentUserId}
              nowMs={nowMs}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredLogs.length > initialCount && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
          {visibleLimit > initialCount && (
            <button
              type="button"
              onClick={() => setVisibleLimit(initialCount)}
              data-testid="activity_log_collapse_button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              <span>Show fewer</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
          {filteredLogs.length > visibleLimit && (
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + (compact ? 10 : 25))}
              data-testid="activity_log_show_more_button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
            >
              <span>
                Show more ({filteredLogs.length - visibleLimit} remaining)
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ActivityLogRow({
  entry,
  isCurrentUser,
  nowMs,
}: {
  entry: GroupActivityLog;
  isCurrentUser: boolean;
  nowMs: number;
}) {
  const action = parseActivityAction(entry.action);
  const category = parseActivityCategory(entry.category);
  const role = parseMemberRole(entry.actorRole);
  const visual = getActivityVisual(action, category);
  const Icon = visual.icon;

  return (
    <div
      data-testid={`activity_log_row_${entry.id}`}
      className="flex items-start gap-3 px-3.5 py-3"
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${visual.bgClass} ${visual.fgClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="text-sm font-semibold text-[var(--rally-on-surface)]">{entry.summary}</p>
          <time
            dateTime={new Date(entry.createdAtMs).toISOString()}
            title={formatDateTime(entry.createdAtMs)}
            className="shrink-0 text-[11px] font-medium text-[var(--rally-on-surface-variant)]"
          >
            {formatRelativeTime(entry.createdAtMs, nowMs)}
          </time>
        </div>

        {entry.details && (
          <p className="mt-0.5 text-xs text-[var(--rally-on-surface-variant)]">{entry.details}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--rally-on-surface-variant)]">
          <span className="font-semibold text-[var(--rally-on-surface)]">
            {isCurrentUser ? `${entry.actorName} (You)` : entry.actorName}
          </span>
          <span>•</span>
          <span>{ROLE_META[role].label}</span>
          {role === MemberRole.CREATOR || role === MemberRole.ADMIN ? (
            <Shield className="h-3 w-3 text-[var(--rally-primary)]" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getActivityVisual(
  action: ActivityAction,
  category: ActivityCategory
): {
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
  fgClass: string;
} {
  switch (action) {
    case ActivityAction.TASK_COMPLETED:
      return {
        icon: CheckCircle2,
        bgClass: 'bg-[var(--rally-tertiary-container)]',
        fgClass: 'text-[var(--rally-on-tertiary-container)]',
      };
    case ActivityAction.TASK_CLAIMED:
      return {
        icon: UserCheck,
        bgClass: 'bg-[var(--rally-tertiary-container)]',
        fgClass: 'text-[var(--rally-on-tertiary-container)]',
      };
    case ActivityAction.TASK_RELEASED:
      return {
        icon: UserMinus,
        bgClass: 'bg-[var(--rally-amber-container)]',
        fgClass: 'text-amber-800 dark:text-amber-200',
      };
    case ActivityAction.TASK_CREATED:
      return {
        icon: ClipboardList,
        bgClass: 'bg-[var(--rally-primary-container)]',
        fgClass: 'text-[var(--rally-on-primary-container)]',
      };
    case ActivityAction.TASK_UPDATED:
      return {
        icon: ClipboardCheck,
        bgClass: 'bg-[var(--rally-primary-container)]',
        fgClass: 'text-[var(--rally-on-primary-container)]',
      };
    case ActivityAction.TASK_DELETED:
    case ActivityAction.EVENT_DELETED:
    case ActivityAction.ALERT_DELETED:
    case ActivityAction.CHANNEL_DELETED:
    case ActivityAction.MEMBER_DELETED:
      return {
        icon:
          action === ActivityAction.EVENT_DELETED
            ? CalendarX2
            : action === ActivityAction.MEMBER_DELETED
              ? UserMinus
              : Trash2,
        bgClass: 'bg-[var(--rally-error)]/12',
        fgClass: 'text-[var(--rally-error)]',
      };
    case ActivityAction.EVENT_CREATED:
      return {
        icon: CalendarPlus,
        bgClass: 'bg-[var(--rally-primary-container)]',
        fgClass: 'text-[var(--rally-on-primary-container)]',
      };
    case ActivityAction.EVENT_UPDATED:
      return {
        icon: Calendar,
        bgClass: 'bg-[var(--rally-primary-container)]',
        fgClass: 'text-[var(--rally-on-primary-container)]',
      };
    case ActivityAction.MEMBER_JOINED:
      return {
        icon: UserPlus,
        bgClass: 'bg-[var(--rally-tertiary-container)]',
        fgClass: 'text-[var(--rally-on-tertiary-container)]',
      };
    case ActivityAction.MEMBER_ROLE_CHANGED:
      return {
        icon: Shield,
        bgClass: 'bg-[var(--rally-secondary-container)]',
        fgClass: 'text-[var(--rally-on-secondary-container)]',
      };
    case ActivityAction.CHANNEL_CREATED:
    case ActivityAction.CHANNEL_UPDATED:
      return {
        icon: Hash,
        bgClass: 'bg-[var(--rally-surface-variant)]',
        fgClass: 'text-[var(--rally-on-surface-variant)]',
      };
    case ActivityAction.ALERT_SENT:
    case ActivityAction.ALERT_APPROVED:
      return {
        icon: Bell,
        bgClass: 'bg-[var(--rally-secondary-container)]',
        fgClass: 'text-[var(--rally-on-secondary-container)]',
      };
    case ActivityAction.GROUP_CREATED:
      return {
        icon: Shield,
        bgClass: 'bg-[var(--rally-primary-container)]',
        fgClass: 'text-[var(--rally-on-primary-container)]',
      };
    case ActivityAction.GROUP_UPDATED:
      return {
        icon: Settings,
        bgClass: 'bg-[var(--rally-surface-variant)]',
        fgClass: 'text-[var(--rally-on-surface-variant)]',
      };
    default:
      return {
        icon: category === ActivityCategory.CALENDAR ? Calendar : Activity,
        bgClass: 'bg-[var(--rally-surface-variant)]',
        fgClass: 'text-[var(--rally-on-surface-variant)]',
      };
  }
}
