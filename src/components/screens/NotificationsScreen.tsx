import React, { useMemo, useState } from 'react';
import {
  AlarmClock,
  Bell,
  CheckCircle2,
  Hourglass,
  ListChecks,
  Megaphone,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { formatDateTime } from '../../lib/dateFormat';
import {
  getNotificationPermission,
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
  const [editingNotification, setEditingNotification] = useState<HubNotification | null>(null);
  const [deletingNotification, setDeletingNotification] = useState<HubNotification | null>(null);

  const notifications = useMemo(
    () => (state.notificationsState.status === 'success' ? state.notificationsState.data : []),
    [state.notificationsState]
  );
  const channels = state.channelsState.status === 'success' ? state.channelsState.data : [];
  const events = state.eventsState.status === 'success' ? state.eventsState.data : [];

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
          <h1 className="font-display text-2xl font-bold">Alerts & Reminders</h1>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            {isAdminOrCreator
              ? 'Broadcast announcements, approve member announcements, and manage group alerts.'
              : 'View group alerts or submit an announcement to everyone (Admin approval required).'}
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
        channels={channels}
        events={events}
        onClose={() => setShowComposerDialog(false)}
        onSend={(params) => {
          void actions.sendNotification(params);
          setShowComposerDialog(false);
        }}
      />

      {/* Edit Dialog */}
      <NotificationComposerDialog
        open={editingNotification !== null}
        currentRole={state.currentRole}
        initialNotification={editingNotification}
        channels={channels}
        events={events}
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
  onEdit,
  onDelete,
}: {
  notification: HubNotification;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onApprove: () => void;
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
