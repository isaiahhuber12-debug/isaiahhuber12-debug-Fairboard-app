import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Shield,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  ApprovalStatus,
  type ChatChannel,
  type HubNotification,
  MemberRole,
  NOTIFICATION_TYPE_LABELS,
  NotificationType,
  parseApprovalStatus,
  parseNotificationType,
  type RallyEvent,
  ROLE_META,
} from '../types/rally';
import {
  applyDateInput,
  applyTimeInput,
  formatDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '../lib/dateFormat';
import { getGroupInitials } from '../lib/groupImages';

export function ModalDialog({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] flex flex-col rounded-2xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[var(--rally-outline)]/60 px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)] hover:text-[var(--rally-on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-3.5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--rally-outline)]/60 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, { bg: string; fg: string }> = {
    [MemberRole.CREATOR]: {
      bg: 'bg-[var(--rally-secondary-container)]',
      fg: 'text-[var(--rally-on-secondary-container)]',
    },
    [MemberRole.ADMIN]: {
      bg: 'bg-[var(--rally-primary-container)]',
      fg: 'text-[var(--rally-on-primary-container)]',
    },
    [MemberRole.ORGANIZER]: {
      bg: 'bg-[var(--rally-tertiary-container)]',
      fg: 'text-[var(--rally-on-tertiary-container)]',
    },
    [MemberRole.PARTICIPANT]: {
      bg: 'bg-[var(--rally-surface-variant)]',
      fg: 'text-[var(--rally-on-surface-variant)]',
    },
  };
  const { bg, fg } = styles[role];
  const showShield = role === MemberRole.CREATOR || role === MemberRole.ADMIN;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${bg} ${fg}`}
    >
      {showShield && <Shield className="h-3 w-3 shrink-0" />}
      {ROLE_META[role].label}
    </span>
  );
}

export function OfflineStatusBadge({ className = '' }: { className?: string }) {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="offline_status_indicator"
      title="You are currently offline. Live updates will resume when reconnected."
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--rally-secondary)]/35 bg-[var(--rally-secondary-container)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--rally-on-secondary-container)] ${className}`}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline</span>
    </span>
  );
}

export function GroupCodePill({
  code,
  onCopied,
  className = '',
}: {
  code: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onCopied?.();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      data-testid="group_code_pill"
      title="Copy group invite code"
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[10px] bg-[var(--rally-primary-container)] px-3 py-1.5 font-mono-code text-xs font-bold tracking-wider text-[var(--rally-on-primary-container)] transition hover:brightness-95 active:scale-[0.98] ${className}`}
    >
      <span>{code}</span>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function MetricStatTile({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div
        className="h-1 w-6 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="mt-2.5 font-display text-2xl font-bold tabular-nums text-[var(--rally-on-surface)]">
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-[var(--rally-on-surface-variant)]">
        {label}
      </div>
    </div>
  );
}

export function FillRateRing({
  percent,
  filled,
  total,
}: {
  percent: number;
  filled: number;
  total: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const size = 76;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
        <svg className="h-[76px] w-[76px] -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--rally-surface-variant)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--rally-primary)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <span className="absolute font-display text-base font-bold tabular-nums">
          {clamped}%
        </span>
      </div>
      <div>
        <div className="font-display text-base font-semibold">Task Coverage</div>
        <div className="text-xs text-[var(--rally-on-surface-variant)]">
          {filled} of {total} volunteer slots filled
        </div>
      </div>
    </div>
  );
}

export function EngagementBarChart({
  items,
}: {
  items: Array<{ name: string; count: number }>;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-[var(--rally-on-surface-variant)]">
        No channel activity recorded yet.
      </p>
    );
  }
  const maxVal = Math.max(1, ...items.map((i) => i.count));
  const barColors = [
    'var(--rally-primary)',
    'var(--rally-secondary)',
    'var(--rally-tertiary)',
    'var(--rally-amber)',
  ];

  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => {
        const pct = Math.min(100, Math.max(5, Math.round((item.count / maxVal) * 100)));
        const color = barColors[idx % barColors.length];
        return (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">#{item.name}</span>
              <span className="shrink-0 font-mono-code text-xs text-[var(--rally-on-surface-variant)]">
                {item.count} msgs
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--rally-surface-variant)]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DateTimePickerField({
  label,
  epochMs,
  onChange,
  testTagPrefix = 'datetime',
}: {
  label: string;
  epochMs: number;
  onChange: (nextEpochMs: number) => void;
  testTagPrefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
        {label}
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="relative flex items-center">
          <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--rally-on-surface-variant)]" />
          <input
            type="date"
            value={toDateInputValue(epochMs)}
            onChange={(e) => {
              if (e.target.value) onChange(applyDateInput(epochMs, e.target.value));
            }}
            data-testid={`${testTagPrefix}_date_input`}
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2 pl-9 pr-3 text-sm text-[var(--rally-on-surface)] focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>
        <div className="relative flex items-center">
          <Clock className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--rally-on-surface-variant)]" />
          <input
            type="time"
            value={toTimeInputValue(epochMs)}
            onChange={(e) => {
              if (e.target.value) onChange(applyTimeInput(epochMs, e.target.value));
            }}
            data-testid={`${testTagPrefix}_time_input`}
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2 pl-9 pr-3 text-sm text-[var(--rally-on-surface)] focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export function ReminderEditorDialog({
  open,
  itemTitle,
  targetEpochMs,
  currentReminderEpochMsList,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean;
  itemTitle: string;
  targetEpochMs: number;
  currentReminderEpochMsList: number[];
  onClose: () => void;
  onSave: (triggerAtMs: number) => void;
  onRemove: (triggerAtMs?: number) => void;
}) {
  if (!open) return null;
  return (
    <ReminderEditorDialogBody
      key={`${itemTitle}_${targetEpochMs}`}
      itemTitle={itemTitle}
      targetEpochMs={targetEpochMs}
      currentReminderEpochMsList={currentReminderEpochMsList}
      onClose={onClose}
      onSave={onSave}
      onRemove={onRemove}
    />
  );
}

function ReminderEditorDialogBody({
  itemTitle,
  targetEpochMs,
  currentReminderEpochMsList,
  onClose,
  onSave,
  onRemove,
}: {
  itemTitle: string;
  targetEpochMs: number;
  currentReminderEpochMsList: number[];
  onClose: () => void;
  onSave: (triggerAtMs: number) => void;
  onRemove: (triggerAtMs?: number) => void;
}) {
  const [mountNow] = useState(() => Date.now());
  const [triggerMs, setTriggerMs] = useState<number>(() =>
    Math.max(mountNow + 60_000, targetEpochMs - 30 * 60_000)
  );
  const [addedCount, setAddedCount] = useState(0);

  const presets = [
    { mins: 15, label: '15m before' },
    { mins: 30, label: '30m before' },
    { mins: 60, label: '1h before' },
    { mins: 1440, label: '1d before' },
  ];

  return (
    <ModalDialog
      open
      onClose={onClose}
      title={currentReminderEpochMsList.length > 0 ? 'Manage Reminders' : 'Set Reminder Times'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            {currentReminderEpochMsList.length > 0 && (
              <button
                type="button"
                onClick={() => onRemove(undefined)}
                data-testid="remove_reminder_button"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--rally-error)] hover:bg-[var(--rally-error-container)]/60"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(triggerMs);
                setAddedCount((c) => c + 1);
              }}
              data-testid="save_another_reminder_button"
              className="rounded-xl border border-[var(--rally-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
            >
              Add &amp; Keep Open
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(triggerMs);
                onClose();
              }}
              data-testid="save_reminder_button"
              className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Add Reminder
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm font-semibold">{itemTitle}</p>
      {addedCount > 0 && (
        <div className="rounded-xl bg-[var(--rally-tertiary-container)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-tertiary-container)]">
          Added {addedCount} reminder{addedCount === 1 ? '' : 's'} — pick another time or click Done.
        </div>
      )}
      {currentReminderEpochMsList.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Active Reminders ({currentReminderEpochMsList.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentReminderEpochMsList.map((ts) => (
              <span
                key={ts}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--rally-secondary-container)] px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-secondary-container)]"
              >
                <span>{formatDateTime(ts)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(ts)}
                  aria-label={`Remove reminder at ${formatDateTime(ts)}`}
                  className="rounded p-0.5 hover:bg-black/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Quick Offsets
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const presetMs = Math.max(mountNow + 60_000, targetEpochMs - p.mins * 60_000);
            const selected = Math.abs(triggerMs - presetMs) < 60_000;
            return (
              <button
                key={p.mins}
                type="button"
                onClick={() => setTriggerMs(presetMs)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/50'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <DateTimePickerField
        label="Reminder Date & Time"
        epochMs={triggerMs}
        onChange={setTriggerMs}
        testTagPrefix="reminder_picker"
      />
    </ModalDialog>
  );
}

export interface NotificationComposerPayload {
  title: string;
  body: string;
  type: NotificationType;
  targetScope: string;
  targetRole: string;
  targetChannelId: string | null;
  targetChannelName: string | null;
  targetEventId: string | null;
  scheduledForEpochMs: number | null;
}

export function NotificationComposerDialog({
  open,
  currentRole,
  initialNotification = null,
  prefillNotification = null,
  channels,
  events,
  isBusy = false,
  onClose,
  onSend,
  onSendAndAnother,
}: {
  open: boolean;
  currentRole: MemberRole;
  initialNotification?: HubNotification | null;
  prefillNotification?: HubNotification | null;
  channels: ChatChannel[];
  events: RallyEvent[];
  isBusy?: boolean;
  onClose: () => void;
  onSend: (params: NotificationComposerPayload) => void;
  onSendAndAnother?: (params: NotificationComposerPayload) => Promise<boolean> | boolean;
}) {
  if (!open) return null;
  return (
    <NotificationComposerDialogBody
      key={
        initialNotification?.id ??
        (prefillNotification ? `dup_${prefillNotification.id}` : 'new_notif')
      }
      currentRole={currentRole}
      initialNotification={initialNotification}
      prefillNotification={prefillNotification}
      channels={channels}
      events={events}
      isBusy={isBusy}
      onClose={onClose}
      onSend={onSend}
      onSendAndAnother={onSendAndAnother}
    />
  );
}

function NotificationComposerDialogBody({
  currentRole,
  initialNotification = null,
  prefillNotification = null,
  channels,
  events,
  isBusy = false,
  onClose,
  onSend,
  onSendAndAnother,
}: {
  currentRole: MemberRole;
  initialNotification?: HubNotification | null;
  prefillNotification?: HubNotification | null;
  channels: ChatChannel[];
  events: RallyEvent[];
  isBusy?: boolean;
  onClose: () => void;
  onSend: (params: NotificationComposerPayload) => void;
  onSendAndAnother?: (params: NotificationComposerPayload) => Promise<boolean> | boolean;
}) {
  const seed = initialNotification ?? prefillNotification;
  const isAdminOrCreator = ROLE_META[currentRole].canAccessAdminPanel;
  const availableTypes: NotificationType[] = isAdminOrCreator
    ? [NotificationType.ANNOUNCEMENT, NotificationType.TASK_UPDATE, NotificationType.DEADLINE_REMINDER]
    : ROLE_META[currentRole].canSendTargetedUpdates
      ? [NotificationType.TASK_UPDATE, NotificationType.DEADLINE_REMINDER, NotificationType.ANNOUNCEMENT]
      : [NotificationType.ANNOUNCEMENT];

  const initRole = seed?.targetRole;
  const initApproved =
    seed && parseApprovalStatus(seed.approvalStatus) === ApprovalStatus.APPROVED;

  const [title, setTitle] = useState(() =>
    initialNotification
      ? initialNotification.title
      : prefillNotification
        ? `${prefillNotification.title} (Copy)`.slice(0, 100)
        : ''
  );
  const [body, setBody] = useState(() => seed?.body ?? '');
  const [selectedType, setSelectedType] = useState<NotificationType>(() => {
    if (!seed) return availableTypes[0];
    const parsed = parseNotificationType(seed.notificationType);
    return availableTypes.includes(parsed) ? parsed : availableTypes[0];
  });
  const [targetRole, setTargetRole] = useState<string>(() =>
    initRole && (initRole !== 'ADMIN' || initApproved) ? initRole : 'ALL'
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    () => channels.find((c) => c.id === seed?.targetChannelId)?.id ?? channels[0]?.id ?? null
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    () => events.find((e) => e.id === seed?.targetEventId)?.id ?? events[0]?.id ?? null
  );
  const [includeSchedule, setIncludeSchedule] = useState(
    () => seed?.scheduledForEpochMs != null
  );
  const [scheduledEpochMs, setScheduledEpochMs] = useState<number>(
    () => seed?.scheduledForEpochMs ?? Date.now() + 3_600_000
  );
  const [sentCount, setSentCount] = useState(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const willRequireApproval = selectedType === NotificationType.ANNOUNCEMENT && !isAdminOrCreator;
  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const dialogTitle = initialNotification
    ? 'Edit Announcement / Alert'
    : willRequireApproval
      ? 'Submit Announcement for Approval'
      : 'Targeted Alert Dispatcher';

  const canSubmit = !isBusy && title.trim().length >= 2 && body.trim().length >= 2;

  const buildPayload = (): NotificationComposerPayload => {
    const scope = willRequireApproval
      ? 'ALL'
      : selectedType === NotificationType.TASK_UPDATE
        ? selectedChannel
          ? 'CHANNEL'
          : 'ALL'
        : selectedType === NotificationType.ANNOUNCEMENT
          ? targetRole === 'ALL'
            ? 'ALL'
            : 'ROLE'
          : 'ALL';

    const resolvedRole = willRequireApproval
      ? 'ADMIN'
      : selectedType === NotificationType.TASK_UPDATE
        ? selectedChannel?.accessLevel === 'ADMIN'
          ? 'ADMIN'
          : selectedChannel?.accessLevel === 'ORGANIZER'
            ? 'ORGANIZER'
            : 'ALL'
        : selectedType === NotificationType.ANNOUNCEMENT
          ? targetRole
          : 'ALL';

    return {
      title,
      body,
      type: selectedType,
      targetScope: scope,
      targetRole: resolvedRole,
      targetChannelId: selectedType === NotificationType.TASK_UPDATE ? (selectedChannel?.id ?? null) : null,
      targetChannelName: selectedType === NotificationType.TASK_UPDATE ? (selectedChannel?.name ?? null) : null,
      targetEventId: selectedType === NotificationType.DEADLINE_REMINDER ? (selectedEvent?.id ?? null) : null,
      scheduledForEpochMs: includeSchedule ? scheduledEpochMs : null,
    };
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSend(buildPayload());
  };

  const handleSubmitAndAnother = async () => {
    if (!canSubmit || !onSendAndAnother) return;
    const ok = await onSendAndAnother(buildPayload());
    if (ok !== false) {
      setTitle('');
      setBody('');
      setSentCount((c) => c + 1);
      window.setTimeout(() => titleInputRef.current?.focus(), 20);
    }
  };

  return (
    <ModalDialog
      open
      onClose={onClose}
      title={dialogTitle}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            {sentCount > 0 && !initialNotification ? 'Done' : 'Cancel'}
          </button>
          {!initialNotification && onSendAndAnother && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleSubmitAndAnother()}
              data-testid="confirm_send_another_notif_button"
              className="rounded-xl border border-[var(--rally-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {willRequireApproval ? 'Submit & Add Another' : 'Send & Add Another'}
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="confirm_send_notif_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {initialNotification
              ? 'Save Changes'
              : willRequireApproval
                ? 'Submit for Approval'
                : 'Send Alert'}
          </button>
        </div>
      }
    >
      {sentCount > 0 && !initialNotification && (
        <div className="rounded-xl bg-[var(--rally-tertiary-container)] px-3.5 py-2 text-xs font-semibold text-[var(--rally-on-tertiary-container)]">
          Dispatched {sentCount} alert{sentCount === 1 ? '' : 's'} — compose your next one below.
        </div>
      )}
      {availableTypes.length > 1 && !initialNotification && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Notification Type
          </div>
          <div className="flex flex-col gap-1.5">
            {availableTypes.map((t) => {
              const label =
                t === NotificationType.ANNOUNCEMENT && !isAdminOrCreator
                  ? `${NOTIFICATION_TYPE_LABELS[t]} (Needs Admin Approval)`
                  : NOTIFICATION_TYPE_LABELS[t];
              const active = selectedType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                    active
                      ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                      : 'border-[var(--rally-outline)] hover:bg-[var(--rally-surface-variant)]/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {willRequireApproval ? (
        <div className="rounded-xl bg-[var(--rally-amber-container)] px-3.5 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-100">
          This announcement will be sent to Admins first and posted to everyone once approved.
        </div>
      ) : selectedType === NotificationType.TASK_UPDATE && channels.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Target Group Chat
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannelId(ch.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  selectedChannel?.id === ch.id
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/50'
                }`}
              >
                #{ch.name}
              </button>
            ))}
          </div>
        </div>
      ) : selectedType === NotificationType.DEADLINE_REMINDER && events.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Related Event
          </div>
          <div className="flex flex-wrap gap-1.5">
            {events.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => setSelectedEventId(evt.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  selectedEvent?.id === evt.id
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/50'
                }`}
              >
                {evt.title}
              </button>
            ))}
          </div>
        </div>
      ) : selectedType === NotificationType.ANNOUNCEMENT && isAdminOrCreator ? (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Audience Scope
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { role: 'ALL', label: 'All Users' },
              { role: 'ORGANIZER', label: 'Organizers+' },
              { role: 'ADMIN', label: 'Admins' },
            ].map((opt) => (
              <button
                key={opt.role}
                type="button"
                onClick={() => setTargetRole(opt.role)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  targetRole === opt.role
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Alert Headline
        </label>
        <input
          ref={titleInputRef}
          type="text"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="notif_title_input"
          placeholder="Short clear headline"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Message
        </label>
        <textarea
          rows={4}
          maxLength={600}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="notif_body_input"
          placeholder="Details for your community or team..."
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm font-medium">
        <input
          type="checkbox"
          checked={includeSchedule}
          onChange={(e) => setIncludeSchedule(e.target.checked)}
          data-testid="notif_schedule_checkbox"
          className="h-4 w-4 rounded border-[var(--rally-outline)] accent-[var(--rally-primary)]"
        />
        <span>Attach / Edit Target Date & Time</span>
      </label>

      {includeSchedule && (
        <DateTimePickerField
          label="Scheduled Date & Time"
          epochMs={scheduledEpochMs}
          onChange={setScheduledEpochMs}
          testTagPrefix="notif_schedule"
        />
      )}
    </ModalDialog>
  );
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  isBusy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onCancel}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            data-testid="confirm_delete_cancel_button"
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onConfirm}
            data-testid="confirm_delete_submit_button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-error)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
            <span>{confirmLabel}</span>
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--rally-on-surface-variant)]">
        {description}
      </p>
    </ModalDialog>
  );
}

export function GroupAvatar({
  groupName,
  imageUrl,
  size = 'md',
  tone = 'surface',
  testId,
}: {
  groupName: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'surface' | 'on-dark' | 'on-light';
  testId?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cleanUrl = imageUrl?.trim() || null;
  const showImage = Boolean(cleanUrl && failedSrc !== cleanUrl);

  const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
    sm: 'h-8 w-8 rounded-xl text-xs',
    md: 'h-12 w-12 rounded-2xl text-sm',
    lg: 'h-14 w-14 rounded-2xl text-base',
    xl: 'h-16 w-16 rounded-2xl text-lg',
  };

  const fallbackClasses =
    tone === 'on-dark'
      ? 'border-white/25 bg-white/15 text-white'
      : tone === 'on-light'
        ? 'border-slate-900/15 bg-slate-900/10 text-slate-900'
        : 'border-[var(--rally-outline)]/65 bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]';

  const frameBorderClass =
    tone === 'on-dark'
      ? 'border-white/30 bg-white/10'
      : tone === 'on-light'
        ? 'border-slate-900/15 bg-white/60'
        : 'border-[var(--rally-outline)]/65 bg-[var(--rally-surface-variant)]';

  return (
    <div
      data-testid={testId}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border font-display font-bold shadow-xs ${sizeClasses[size]} ${
        showImage ? frameBorderClass : fallbackClasses
      }`}
    >
      {showImage ? (
        <img
          src={cleanUrl ?? undefined}
          alt={`${groupName} profile`}
          onError={() => setFailedSrc(cleanUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getGroupInitials(groupName)}</span>
      )}
    </div>
  );
}


