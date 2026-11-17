import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Hourglass,
  Megaphone,
  Pencil,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import {
  countdownLabel,
  formatDateTime,
} from '../../lib/dateFormat';
import {
  ApprovalStatus,
  type EventTask,
  type GroupMember,
  type HubNotification,
  MemberRole,
  NotificationType,
  parseApprovalStatus,
  parseMemberRole,
  parseNotificationType,
  type RallyEvent,
  ROLE_META,
} from '../../types/rally';
import {
  GroupCodePill,
  MetricStatTile,
  ModalDialog,
  ReminderEditorDialog,
  RoleBadge,
} from '../RallyComponents';

interface DashboardScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  onOpenEvent: (eventId: string) => void;
  onOpenNotifications: () => void;
  onOpenAiCoordinator: () => void;
  onCopiedCode: () => void;
}

export function DashboardScreen({
  state,
  actions,
  onOpenEvent,
  onOpenNotifications,
  onOpenAiCoordinator,
  onCopiedCode,
}: DashboardScreenProps) {
  const group = state.activeGroup;
  const events = state.eventsState.status === 'success' ? state.eventsState.data : [];
  const members = useMemo(
    () => (state.membersState.status === 'success' ? state.membersState.data : []),
    [state.membersState]
  );
  const notifications = useMemo(
    () => (state.notificationsState.status === 'success' ? state.notificationsState.data : []),
    [state.notificationsState]
  );

  const leadershipMembers = useMemo(
    () =>
      members.filter((m) => {
        const r = parseMemberRole(m.role);
        return r === MemberRole.CREATOR || r === MemberRole.ADMIN;
      }),
    [members]
  );

  const latestAnnouncement = useMemo(() => {
    const approved = notifications.filter(
      (n) => parseApprovalStatus(n.approvalStatus) === ApprovalStatus.APPROVED
    );
    return (
      approved.find((n) => parseNotificationType(n.notificationType) === NotificationType.ANNOUNCEMENT) ??
      approved[0] ??
      null
    );
  }, [notifications]);

  const pendingCount = useMemo(() => {
    if (!ROLE_META[state.currentRole].canAccessAdminPanel) return 0;
    return notifications.filter(
      (n) => parseApprovalStatus(n.approvalStatus) === ApprovalStatus.PENDING
    ).length;
  }, [notifications, state.currentRole]);

  const openTasks = useMemo(() => {
    const flat = Object.values(state.allTasksByEvent).flat();
    return flat.filter((t) => t.assignedCount < t.capacity).slice(0, 4);
  }, [state.allTasksByEvent]);

  const [reminderEvent, setReminderEvent] = useState<RallyEvent | null>(null);
  const [deleteSpotlightNotif, setDeleteSpotlightNotif] = useState<HubNotification | null>(null);
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState(state.currentUserName);
  const [showAllMembers, setShowAllMembers] = useState(false);

  const canManageEvents = ROLE_META[state.currentRole].canManageEventsAndTasks;
  const canAdmin = ROLE_META[state.currentRole].canAccessAdminPanel;

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 px-4 py-5 sm:px-6">
      {/* Live Group Header Banner */}
      <div
        className="rounded-3xl p-5 text-white shadow-md sm:p-6"
        style={{
          background: 'linear-gradient(135deg, #1B4DFF 0%, #1034B8 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <Cloud className="h-4 w-4 text-white/85" />
            <span>Live Cloud Sync</span>
          </div>
          <RoleBadge role={state.currentRole} />
        </div>

        <h1 className="mt-2.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {group?.name ?? 'RallyHub Group'}
        </h1>

        {group?.description && (
          <p className="mt-1 line-clamp-2 text-sm text-white/85">{group.description}</p>
        )}

        {leadershipMembers.length > 0 && (
          <div
            data-testid="dashboard_header_admin_summary"
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-white/95"
          >
            <Shield className="h-3.5 w-3.5 shrink-0 text-white/90" />
            <span className="truncate">
              Admin:{' '}
              {leadershipMembers
                .map((m) => (m.uid === state.currentUserId ? `${m.displayName} (You)` : m.displayName))
                .join(', ')}
            </span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-xs text-white/90">
          <span className="truncate">Signed in as {state.currentUserName}</span>
          <button
            type="button"
            onClick={() => {
              setNameInput(state.currentUserName);
              setShowEditNameDialog(true);
            }}
            data-testid="edit_display_name_button"
            title="Edit display name"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        {group && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <GroupCodePill code={group.groupCode} onCopied={onCopiedCode} />
          </div>
        )}
      </div>

      {/* Gemini AI Coordinator Callout Card */}
      <div
        onClick={onOpenAiCoordinator}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenAiCoordinator();
        }}
        data-testid="dashboard_ai_coordinator_card"
        className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--rally-primary)]/25 bg-[var(--rally-primary-container)]/55 p-4 text-[var(--rally-on-primary-container)] transition hover:bg-[var(--rally-primary-container)]/75"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary)] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold">Gemini AI Coordinator</div>
            <p className="text-xs opacity-90">
              Summarize events, spot open shifts, or draft announcements with Gemini.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAiCoordinator();
          }}
          data-testid="dashboard_open_ai_button"
          className="shrink-0 rounded-xl bg-[var(--rally-primary)] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
        >
          Ask AI
        </button>
      </div>

      {/* Admin Pending Approval Banner */}
      {pendingCount > 0 && (
        <div
          onClick={onOpenNotifications}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenNotifications();
          }}
          data-testid="dashboard_pending_approval_banner"
          className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--rally-amber)]/40 bg-[var(--rally-amber-container)] p-3.5 text-amber-950 dark:text-amber-100"
        >
          <div className="flex items-center gap-2.5">
            <Hourglass className="h-5 w-5 shrink-0 text-[var(--rally-amber)]" />
            <span className="text-sm font-bold">
              {pendingCount} member announcement(s) waiting for Admin approval
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNotifications();
            }}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--rally-amber)] hover:bg-black/5"
          >
            Review
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <MetricStatTile
          label="Members"
          value={String(state.analytics.totalMembers)}
          accentColor="#1B4DFF"
        />
        <MetricStatTile
          label="Events"
          value={String(state.analytics.totalEvents)}
          accentColor="#0F9D76"
        />
        <MetricStatTile
          label="Fill Rate"
          value={`${state.analytics.fillRatePercent}%`}
          accentColor="#FF5A36"
        />
      </div>

      {/* Group Admins & Members Roster */}
      <GroupRosterCard
        membersState={state.membersState}
        currentUserId={state.currentUserId}
        expanded={showAllMembers}
        onToggleExpand={() => setShowAllMembers((prev) => !prev)}
      />

      {/* Announcement Spotlight */}
      {latestAnnouncement && (
        <div
          onClick={onOpenNotifications}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenNotifications();
          }}
          data-testid="announcement_spotlight"
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--rally-secondary)]/30 bg-[var(--rally-secondary-container)]/65 p-4 text-[var(--rally-on-secondary-container)] transition hover:bg-[var(--rally-secondary-container)]/85"
        >
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rally-secondary)]" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold">{latestAnnouncement.title}</div>
            <p className="mt-1 line-clamp-3 text-sm opacity-95">{latestAnnouncement.body}</p>
            <div className="mt-2 text-xs font-medium opacity-80">
              From {latestAnnouncement.senderName}
            </div>
          </div>
          {canAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteSpotlightNotif(latestAnnouncement);
              }}
              data-testid="delete_spotlight_button"
              title="Delete announcement"
              className="rounded-lg p-1.5 text-[var(--rally-error)] hover:bg-black/5"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Upcoming Events */}
      <section className="space-y-2.5 pt-1">
        <h2 className="font-display text-lg font-bold">Upcoming Events</h2>
        {events.length === 0 ? (
          <EmptyDashboardCard
            message={
              canManageEvents
                ? 'No events scheduled yet. Open the Calendar tab to create your first event.'
                : 'No upcoming events posted by organizers yet.'
            }
          />
        ) : (
          <div className="space-y-2.5">
            {events.slice(0, 4).map((evt) => {
              const evtTasks = state.allTasksByEvent[evt.id] ?? [];
              const remindedAtMs = state.remindedTimes[evt.id] ?? null;
              const isReminded = remindedAtMs !== null;
              const totalAssigned = evtTasks.reduce((a, t) => a + t.assignedCount, 0);
              const totalCapacity = evtTasks.reduce((a, t) => a + t.capacity, 0);
              return (
                <div
                  key={evt.id}
                  onClick={() => onOpenEvent(evt.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onOpenEvent(evt.id);
                  }}
                  data-testid={`dashboard_event_${evt.id}`}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 transition hover:border-[var(--rally-primary)]/45 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[var(--rally-primary-container)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--rally-on-primary-container)]">
                        {evt.category}
                      </span>
                      <span className="text-xs font-semibold text-[var(--rally-secondary)]">
                        {countdownLabel(evt.startEpochMs)}
                      </span>
                    </div>
                    <div className="mt-1.5 font-display text-base font-semibold">
                      {evt.title}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--rally-on-surface-variant)]">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {formatDateTime(evt.startEpochMs)} • {evt.location}
                      </span>
                    </div>
                    {remindedAtMs !== null && (
                      <div className="mt-1 text-xs font-medium text-[var(--rally-secondary)]">
                        Reminder: {formatDateTime(remindedAtMs)}
                      </div>
                    )}
                    {evtTasks.length > 0 && (
                      <div className="mt-1.5 text-xs font-semibold text-[var(--rally-tertiary)]">
                        {evtTasks.length} task shifts • {totalAssigned}/{totalCapacity} volunteers
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReminderEvent(evt);
                    }}
                    data-testid={`remind_event_${evt.id}`}
                    title="Set or edit event reminder"
                    className="shrink-0 rounded-xl p-2 hover:bg-[var(--rally-surface-variant)]"
                  >
                    {isReminded ? (
                      <BellRing className="h-5 w-5 text-[var(--rally-secondary)]" />
                    ) : (
                      <Bell className="h-5 w-5 text-[var(--rally-on-surface-variant)]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Open Tasks Needing Sign-Ups */}
      <section className="space-y-2.5 pt-1">
        <h2 className="font-display text-lg font-bold">Open Tasks Needing Sign-Ups</h2>
        {openTasks.length === 0 ? (
          <EmptyDashboardCard message="All current event tasks are filled or none are posted yet." />
        ) : (
          <div className="space-y-2.5">
            {openTasks.map((task) => (
              <QuickTaskCard
                key={task.id}
                task={task}
                currentUid={state.currentUserId}
                onToggleSignup={() => void actions.toggleTaskSignup(task.eventId, task.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reminder Dialog */}
      <ReminderEditorDialog
        open={reminderEvent !== null}
        itemTitle={reminderEvent?.title ?? ''}
        targetEpochMs={reminderEvent?.startEpochMs ?? 0}
        currentReminderEpochMs={reminderEvent ? (state.remindedTimes[reminderEvent.id] ?? null) : null}
        onClose={() => setReminderEvent(null)}
        onSave={(triggerMs) => {
          if (!reminderEvent) return;
          actions.scheduleOrUpdateReminder(
            reminderEvent.id,
            `Event Starting: ${reminderEvent.title}`,
            `Location: ${reminderEvent.location} (${formatDateTime(reminderEvent.startEpochMs)})`,
            triggerMs
          );
          setReminderEvent(null);
        }}
        onRemove={() => {
          if (!reminderEvent) return;
          actions.removeReminder(reminderEvent.id);
          setReminderEvent(null);
        }}
      />

      {/* Delete Spotlight Announcement Dialog */}
      <ModalDialog
        open={deleteSpotlightNotif !== null}
        onClose={() => setDeleteSpotlightNotif(null)}
        title="Delete Announcement"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteSpotlightNotif(null)}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteSpotlightNotif) {
                  void actions.deleteNotification(deleteSpotlightNotif.id);
                }
                setDeleteSpotlightNotif(null);
              }}
              data-testid="confirm_delete_spotlight_button"
              className="rounded-xl bg-[var(--rally-error)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm">
          Delete &ldquo;{deleteSpotlightNotif?.title}&rdquo;? Only Admins can delete announcements.
        </p>
      </ModalDialog>

      {/* Edit Display Name Dialog */}
      <ModalDialog
        open={showEditNameDialog}
        onClose={() => setShowEditNameDialog(false)}
        title="Edit Your Display Name"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowEditNameDialog(false)}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={nameInput.trim().length < 2}
              onClick={() => {
                void actions.updateDisplayName(nameInput);
                setShowEditNameDialog(false);
              }}
              data-testid="confirm_display_name_button"
              className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-45"
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Display Name
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value.slice(0, 50))}
            data-testid="edit_display_name_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>
      </ModalDialog>
    </div>
  );
}

function GroupRosterCard({
  membersState,
  currentUserId,
  expanded,
  onToggleExpand,
}: {
  membersState: RallyWorkspaceState['membersState'];
  currentUserId: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div
      data-testid="dashboard_members_card"
      className="space-y-2.5 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--rally-primary)]" />
          <h3 className="font-display text-base font-bold">Group Admins & Members</h3>
        </div>
        {membersState.status === 'success' && (
          <span className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
            {membersState.data.length} total
          </span>
        )}
      </div>

      {membersState.status === 'loading' && (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rally-surface-variant)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--rally-primary)]" />
          </div>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            Syncing group admins and members...
          </p>
        </div>
      )}

      {membersState.status === 'error' && (
        <p className="text-xs font-medium text-[var(--rally-error)]">{membersState.message}</p>
      )}

      {membersState.status === 'success' && (
        <>
          {membersState.data.length === 0 ? (
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              No members synced yet.
            </p>
          ) : (
            <div className="space-y-2">
              {(expanded || membersState.data.length <= 6
                ? membersState.data
                : membersState.data.slice(0, 6)
              ).map((member) => (
                <DashboardMemberRow
                  key={member.uid}
                  member={member}
                  isCurrentUser={member.uid === currentUserId}
                />
              ))}
              {membersState.data.length > 6 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onToggleExpand}
                    data-testid="toggle_all_members_button"
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
                  >
                    <span>
                      {expanded ? 'Show fewer' : `Show all ${membersState.data.length} members`}
                    </span>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DashboardMemberRow({
  member,
  isCurrentUser,
}: {
  member: GroupMember;
  isCurrentUser: boolean;
}) {
  const role = parseMemberRole(member.role);
  const isLeadership = role === MemberRole.CREATOR || role === MemberRole.ADMIN;
  const initial = member.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      data-testid={`dashboard_member_row_${member.uid}`}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
        isLeadership
          ? 'bg-[var(--rally-primary-container)]/35'
          : 'bg-[var(--rally-surface-variant)]/40'
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isLeadership
            ? 'bg-[var(--rally-primary)] text-white'
            : 'bg-[var(--rally-secondary-container)] text-[var(--rally-on-secondary-container)]'
        }`}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">
        {isCurrentUser ? `${member.displayName} (You)` : member.displayName}
      </div>
      <RoleBadge role={role} />
    </div>
  );
}

function QuickTaskCard({
  task,
  currentUid,
  onToggleSignup,
}: {
  task: EventTask;
  currentUid: string;
  onToggleSignup: () => void;
}) {
  const isSignedUp = task.assignedUids.includes(currentUid);
  const pct =
    task.capacity <= 0 ? 0 : Math.min(100, Math.round((task.assignedCount / task.capacity) * 100));

  return (
    <div className="space-y-2.5 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-semibold">{task.title}</div>
          <div className="text-xs text-[var(--rally-on-surface-variant)]">
            Deadline: {formatDateTime(task.deadlineEpochMs)}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSignup}
          data-testid={`quick_signup_${task.id}`}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            isSignedUp
              ? 'bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)] hover:brightness-95'
              : 'bg-[var(--rally-primary)] text-white hover:brightness-110'
          }`}
        >
          {isSignedUp ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Joined</span>
            </>
          ) : (
            <span>Sign Up</span>
          )}
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rally-surface-variant)]">
        <div
          className="h-full rounded-full bg-[var(--rally-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
        {task.assignedCount} of {task.capacity} slots claimed
      </div>
    </div>
  );
}

function EmptyDashboardCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-[var(--rally-surface-variant)]/50 p-4 text-sm text-[var(--rally-on-surface-variant)]">
      {message}
    </div>
  );
}
