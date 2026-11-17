import React, { useMemo, useState } from 'react';
import {
  AlarmClock,
  Bell,
  BellRing,
  CheckCircle2,
  Copy,
  Hourglass,
  ListChecks,
  Megaphone,
  Pencil,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { formatDateTime } from '../../lib/dateFormat';
import { E164_PHONE_REGEX, normalizePhoneInput } from '../../services/smsService';
import {
  getNotificationPermission,
  isReminderAt30mSet,
  requestNotificationPermission,
} from '../../lib/notifications';
import {
  ApprovalStatus,
  type HubNotification,
  NOTIFICATION_TYPE_LABELS,
  NotificationType,
  parseApprovalStatus,
  parseNotificationType,
  ROLE_META,
  type SmsPreferences,
} from '../../types/rally';
import { ModalDialog, NotificationComposerDialog } from '../RallyComponents';

interface NotificationsScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
}

export function NotificationsScreen({ state, actions }: NotificationsScreenProps) {
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [filterType, setFilterType] = useState<NotificationType | null>(null);
  const [showComposerDialog, setShowComposerDialog] = useState(false);
  const [duplicatingNotification, setDuplicatingNotification] = useState<HubNotification | null>(
    null
  );
  const [editingNotification, setEditingNotification] = useState<HubNotification | null>(null);
  const [deletingNotification, setDeletingNotification] = useState<HubNotification | null>(null);

  const notifications = useMemo(
    () => (state.notificationsState.status === 'success' ? state.notificationsState.data : []),
    [state.notificationsState]
  );
  const channels = state.channelsState.status === 'success' ? state.channelsState.data : [];
  const events = useMemo(
    () => (state.eventsState.status === 'success' ? state.eventsState.data : []),
    [state.eventsState]
  );

  const remindedEvents = useMemo(
    () => events.filter((evt) => (state.remindedTimes[evt.id] ?? []).length > 0),
    [events, state.remindedTimes]
  );

  const isAdminOrCreator = ROLE_META[state.currentRole].canAccessAdminPanel;
  const canSendTargetedUpdates = ROLE_META[state.currentRole].canSendTargetedUpdates;

  const pendingNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => parseApprovalStatus(n.approvalStatus) === ApprovalStatus.PENDING
      ),
    [notifications]
  );

  const allApproved = useMemo(
    () =>
      notifications.filter(
        (n) => parseApprovalStatus(n.approvalStatus) === ApprovalStatus.APPROVED
      ),
    [notifications]
  );

  const approvedNotifications = useMemo(
    () =>
      filterType === null
        ? allApproved
        : allApproved.filter((n) => parseNotificationType(n.notificationType) === filterType),
    [allApproved, filterType]
  );

  const handleRequestPermission = async () => {
    await requestNotificationPermission();
    setPermission(getNotificationPermission());
  };

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
            Alerts &amp; Reminders
          </h1>
          <p className="text-xs text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]">
            {isAdminOrCreator
              ? 'Broadcast announcements, approve member announcements, and manage group & SMS alerts.'
              : 'View group alerts, configure SMS push alerts, or submit an announcement (Admin approval required).'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowComposerDialog(true)}
          data-testid="compose_notification_fab"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-secondary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Send className="h-4 w-4" />
          <span>{isAdminOrCreator ? 'Send Alert' : 'Submit Announcement'}</span>
        </button>
      </div>

      {/* SMS Text Push Notification Settings */}
      <SmsNotificationsCard
        key={`${state.smsPreferences.phone}_${state.smsPreferences.enabled}_${state.smsPreferences.forMessages}_${state.smsPreferences.forEvents}`}
        preferences={state.smsPreferences}
        serverConfigured={state.smsServerConfigured}
        isBusy={state.isBusy}
        onSave={(prefs) => actions.saveSmsPreferences(prefs)}
        onSendTest={(phone) => void actions.sendTestSms(phone)}
      />

      {/* Browser Push Notification Prompt */}
      {permission === 'default' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--rally-primary-container)] p-4 text-[var(--rally-on-primary-container)]">
          <div className="flex items-start gap-2.5">
            <Bell className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-display text-sm font-bold">
                Enable Push & Deadline Alerts
              </div>
              <p className="text-xs opacity-90">
                Allow browser notifications so announcements and task reminders appear immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRequestPermission()}
            data-testid="enable_notifications_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            Enable
          </button>
        </div>
      )}

      {/* Active Event Reminders */}
      {remindedEvents.length > 0 && (
        <section
          data-testid="alerts_active_event_reminders"
          className="space-y-2 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4"
        >
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-[var(--rally-secondary)]" />
            <h2 className="font-display text-sm font-bold">
              Your Event Reminders ({remindedEvents.length})
            </h2>
          </div>
          <div className="space-y-2">
            {remindedEvents.map((evt) => {
              const evtReminders = state.remindedTimes[evt.id] ?? [];
              const is30m = isReminderAt30mSet(evtReminders, evt.startEpochMs);
              return (
                <div
                  key={evt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--rally-outline)]/50 bg-[var(--rally-bg)]/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{evt.title}</div>
                    <div className="text-xs text-[var(--rally-on-surface-variant)]">
                      Starts {formatDateTime(evt.startEpochMs)} •{' '}
                      {is30m
                        ? 'In-app alert 30 min before'
                        : `Next alert: ${formatDateTime(evtReminders[0])}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      is30m
                        ? actions.toggleEventReminder30m(evt)
                        : actions.removeReminder(evt.id)
                    }
                    data-testid={`alerts_clear_reminder_${evt.id}`}
                    className="rounded-lg border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                  >
                    {is30m ? 'Turn Off' : 'Clear'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pending Admin Approval Section */}
      {pendingNotifications.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-display text-base font-bold text-[var(--rally-amber)]">
            {isAdminOrCreator
              ? `Pending Admin Approval (${pendingNotifications.length})`
              : `Your Submissions Awaiting Admin Approval (${pendingNotifications.length})`}
          </h2>
          <div className="space-y-2.5">
            {pendingNotifications.map((item) => {
              const canEditItem =
                isAdminOrCreator ||
                (item.senderId === state.currentUserId &&
                  parseApprovalStatus(item.approvalStatus) === ApprovalStatus.PENDING);
              return (
                <NotificationItemCard
                  key={`pending_${item.id}`}
                  notification={item}
                  canApprove={isAdminOrCreator}
                  canEdit={canEditItem}
                  canDelete={isAdminOrCreator}
                  onApprove={() => void actions.approveNotification(item.id)}
                  onDuplicate={() => {
                    setDuplicatingNotification(item);
                    setShowComposerDialog(true);
                  }}
                  onEdit={() => setEditingNotification(item)}
                  onDelete={() => setDeletingNotification(item)}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterType(null)}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
            filterType === null
              ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
              : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)]'
          }`}
        >
          All ({allApproved.length})
        </button>
        {Object.values(NotificationType).map((type) => {
          const active = filterType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(active ? null : type)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                  : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)]'
              }`}
            >
              {NOTIFICATION_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {/* Approved Feed */}
      {approvedNotifications.length === 0 ? (
        <div className="rounded-2xl bg-[var(--rally-surface-variant)]/50 p-5 text-sm text-[var(--rally-on-surface-variant)]">
          No notifications in this category yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {approvedNotifications.map((item) => {
            const canEditItem =
              isAdminOrCreator ||
              (canSendTargetedUpdates &&
                parseNotificationType(item.notificationType) !== NotificationType.ANNOUNCEMENT);
            return (
              <NotificationItemCard
                key={item.id}
                notification={item}
                canApprove={false}
                canEdit={canEditItem}
                canDelete={isAdminOrCreator}
                onApprove={() => {}}
                onDuplicate={() => {
                  setDuplicatingNotification(item);
                  setShowComposerDialog(true);
                }}
                onEdit={() => setEditingNotification(item)}
                onDelete={() => setDeletingNotification(item)}
              />
            );
          })}
        </div>
      )}

      {/* Compose Dialog */}
      <NotificationComposerDialog
        open={showComposerDialog}
        currentRole={state.currentRole}
        initialNotification={null}
        prefillNotification={duplicatingNotification}
        channels={channels}
        events={events}
        isBusy={state.isBusy}
        onClose={() => {
          setShowComposerDialog(false);
          setDuplicatingNotification(null);
        }}
        onSend={(params) => {
          void actions.sendNotification(params);
          setShowComposerDialog(false);
          setDuplicatingNotification(null);
        }}
        onSendAndAnother={(params) => actions.sendNotification(params)}
      />

      {/* Edit Dialog */}
      <NotificationComposerDialog
        open={editingNotification !== null}
        currentRole={state.currentRole}
        initialNotification={editingNotification}
        channels={channels}
        events={events}
        isBusy={state.isBusy}
        onClose={() => setEditingNotification(null)}
        onSend={(params) => {
          if (editingNotification) {
            void actions.updateNotification({
              notificationId: editingNotification.id,
              ...params,
            });
          }
          setEditingNotification(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ModalDialog
        open={deletingNotification !== null}
        onClose={() => setDeletingNotification(null)}
        title="Delete Announcement / Alert"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeletingNotification(null)}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deletingNotification) {
                  void actions.deleteNotification(deletingNotification.id);
                }
                setDeletingNotification(null);
              }}
              data-testid="confirm_delete_notification_button"
              className="rounded-xl bg-[var(--rally-error)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm">
          Delete &ldquo;{deletingNotification?.title}&rdquo;? This will remove it for all group
          members.
        </p>
      </ModalDialog>
    </div>
  );
}

function NotificationItemCard({
  notification,
  canApprove,
  canEdit,
  canDelete,
  onApprove,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  notification: HubNotification;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onApprove: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const type = parseNotificationType(notification.notificationType);
  const isPending = parseApprovalStatus(notification.approvalStatus) === ApprovalStatus.PENDING;

  const targetLabel = isPending
    ? 'Pending Admin Approval'
    : notification.targetScope === 'CHANNEL'
      ? `#${notification.targetChannelName || 'Team'}`
      : notification.targetScope === 'ROLE'
        ? `${notification.targetRole}S`
        : 'All Members';

  const IconComponent = isPending
    ? Hourglass
    : type === NotificationType.ANNOUNCEMENT
      ? Megaphone
      : type === NotificationType.TASK_UPDATE
        ? ListChecks
        : AlarmClock;

  const iconColor = isPending
    ? 'text-[var(--rally-amber)]'
    : type === NotificationType.ANNOUNCEMENT
      ? 'text-[var(--rally-secondary)]'
      : type === NotificationType.TASK_UPDATE
        ? 'text-[var(--rally-tertiary)]'
        : 'text-[var(--rally-primary)]';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isPending
          ? 'border-[var(--rally-amber)]/65 bg-[var(--rally-amber-container)]/35'
          : 'border-[var(--rally-outline)]/65 bg-[var(--rally-surface)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <IconComponent className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                isPending
                  ? 'bg-[var(--rally-amber-container)] text-amber-900 dark:text-amber-100'
                  : 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface-variant)]'
              }`}
            >
              {NOTIFICATION_TYPE_LABELS[type]} • {targetLabel}
            </span>
            <span className="text-[11px] text-[var(--rally-on-surface-variant)]">
              {formatDateTime(notification.createdAtMs)}
            </span>
          </div>

          <h3 className="font-display text-base font-bold">{notification.title}</h3>
          <p className="whitespace-pre-wrap text-sm">{notification.body}</p>

          {notification.scheduledForEpochMs && (
            <div className="text-xs font-semibold text-[var(--rally-primary)]">
              Scheduled: {formatDateTime(notification.scheduledForEpochMs)}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-[var(--rally-on-surface-variant)]">
              Sent by {notification.senderName}
              {notification.updatedAtMs ? ' • Edited' : ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onDuplicate}
                data-testid={`duplicate_notification_${notification.id}`}
                title="Duplicate & send another"
                className="rounded-lg p-1.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
              >
                <Copy className="h-4 w-4" />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  data-testid={`edit_notification_${notification.id}`}
                  title="Edit alert"
                  className="rounded-lg p-1.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  data-testid={`delete_notification_${notification.id}`}
                  title="Delete alert"
                  className="rounded-lg p-1.5 text-[var(--rally-error)] hover:bg-[var(--rally-error-container)]/50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {canApprove && (
            <button
              type="button"
              onClick={onApprove}
              data-testid={`approve_notification_${notification.id}`}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve & Post to Everyone</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SmsNotificationsCard({
  preferences,
  serverConfigured,
  isBusy,
  onSave,
  onSendTest,
}: {
  preferences: SmsPreferences;
  serverConfigured: boolean;
  isBusy: boolean;
  onSave: (prefs: SmsPreferences) => Promise<boolean>;
  onSendTest: (phone: string) => void;
}) {
  const [phoneInput, setPhoneInput] = useState(preferences.phone);
  const [enabled, setEnabled] = useState(preferences.enabled);
  const [forMessages, setForMessages] = useState(preferences.forMessages);
  const [forEvents, setForEvents] = useState(preferences.forEvents);

  const normalizedPhone = phoneInput.trim() ? normalizePhoneInput(phoneInput) : '';
  const isPhoneValid = !normalizedPhone || E164_PHONE_REGEX.test(normalizedPhone);
  const canSave = !isBusy && (!enabled || Boolean(normalizedPhone)) && isPhoneValid;
  const canTest = !isBusy && serverConfigured && Boolean(normalizedPhone) && isPhoneValid;

  return (
    <section
      data-testid="sms_notifications_card"
      className="space-y-3.5 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)]">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg">
              SMS Text Push Notifications
            </h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Receive real-time SMS text alerts for new group messages and calendar events.
            </p>
          </div>
        </div>
        <span
          data-testid="sms_status_badge"
          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
            preferences.enabled
              ? 'bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)]'
              : 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface-variant)]'
          }`}
        >
          {preferences.enabled ? 'SMS Enabled' : 'SMS Off'}
        </span>
      </div>

      {!serverConfigured && (
        <div className="rounded-2xl border border-[var(--rally-amber)]/35 bg-[var(--rally-amber-container)]/50 px-3.5 py-2.5 text-xs text-amber-950 dark:text-amber-100">
          Your SMS preferences save to your profile right away. Live carrier SMS dispatch activates
          once Twilio server environment variables (<code>TWILIO_ACCOUNT_SID</code>,{' '}
          <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM_NUMBER</code>) are set.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Mobile Phone Number
          </label>
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.slice(0, 24))}
            placeholder="+15551234567"
            data-testid="sms_phone_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/30 px-3.5 py-2 font-mono-code text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-[var(--rally-on-surface-variant)]">
            10-digit US numbers auto-format to +1; international numbers start with +.
          </p>
          {!isPhoneValid && (
            <p className="mt-1 text-[11px] font-semibold text-[var(--rally-error)]">
              Enter a valid E.164 phone number (e.g. +15551234567).
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-surface-variant)]/25 p-3">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold">
            <span>Enable SMS text alerts</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              data-testid="sms_enabled_toggle"
              className="h-4 w-4 accent-[var(--rally-primary)]"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-[var(--rally-on-surface-variant)]">
            <span>New chat messages</span>
            <input
              type="checkbox"
              checked={forMessages}
              onChange={(e) => setForMessages(e.target.checked)}
              data-testid="sms_messages_toggle"
              className="h-4 w-4 accent-[var(--rally-primary)]"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-[var(--rally-on-surface-variant)]">
            <span>Calendar events &amp; updates</span>
            <input
              type="checkbox"
              checked={forEvents}
              onChange={(e) => setForEvents(e.target.checked)}
              data-testid="sms_events_toggle"
              className="h-4 w-4 accent-[var(--rally-primary)]"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={!canTest}
          onClick={() => onSendTest(normalizedPhone)}
          data-testid="send_test_sms_button"
          title={
            serverConfigured
              ? 'Send a test SMS to your saved number'
              : 'Configure Twilio env vars on server to send a test SMS'
          }
          className="rounded-xl border border-[var(--rally-outline)] px-3.5 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Send Test SMS
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            void onSave({
              phone: normalizedPhone,
              enabled,
              forMessages,
              forEvents,
            })
          }
          data-testid="save_sms_settings_button"
          className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Save SMS Settings
        </button>
      </div>
    </section>
  );
}
