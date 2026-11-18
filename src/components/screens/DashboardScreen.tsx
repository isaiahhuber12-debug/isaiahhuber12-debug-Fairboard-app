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
  MessageSquareShare,
  Palette,
  Pencil,
  Phone,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { getPersonalBannerPresentation } from '../../lib/backgrounds';
import {
  countdownLabel,
  formatDateTime,
} from '../../lib/dateFormat';
import { isReminderAt30mSet } from '../../lib/notifications';
import {
  E164_PHONE_REGEX,
  formatPhoneDisplay,
  normalizePhoneInput,
} from '../../services/smsService';
import {
  ApprovalStatus,
  type EventTask,
  type GroupMember,
  type HubNotification,
  type MemberContactInfo,
  MemberRole,
  NotificationType,
  parseApprovalStatus,
  parseMemberRole,
  parseNotificationType,
  type RallyEvent,
  ROLE_META,
} from '../../types/rally';
import {
  GroupAvatar,
  GroupCodePill,
  MetricStatTile,
  ModalDialog,
  ReminderEditorDialog,
  RoleBadge,
} from '../RallyComponents';
import { ActivityLog } from '../ActivityLog';
import { PersonalAppearanceModal } from '../BackgroundCustomizerCard';
import { GroupSmsComposerModal } from '../GroupSmsComposerModal';
import { QrInviteShareButton } from '../QrInviteShareModal';

interface DashboardScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  onOpenEvent: (eventId: string) => void;
  onOpenNotifications: () => void;
  onOpenAiCoordinator: () => void;
  onOpenAdminPanel?: () => void;
  onCopiedCode: () => void;
}

export function DashboardScreen({
  state,
  actions,
  onOpenEvent,
  onOpenNotifications,
  onOpenAiCoordinator,
  onOpenAdminPanel,
  onCopiedCode,
}: DashboardScreenProps) {
  const group = state.activeGroup;
  const events = useMemo(
    () => (state.eventsState.status === 'success' ? state.eventsState.data : []),
    [state.eventsState]
  );
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
    if (state.isGuest || !ROLE_META[state.currentRole].canAccessAdminPanel) return 0;
    return notifications.filter(
      (n) => parseApprovalStatus(n.approvalStatus) === ApprovalStatus.PENDING
    ).length;
  }, [notifications, state.currentRole, state.isGuest]);

  const allOpenTasks = useMemo(() => {
    const flat = Object.values(state.allTasksByEvent).flat();
    return flat.filter((t) => t.assignedCount < t.capacity);
  }, [state.allTasksByEvent]);

  const [reminderEvent, setReminderEvent] = useState<RallyEvent | null>(null);
  const [deleteSpotlightNotif, setDeleteSpotlightNotif] = useState<HubNotification | null>(null);
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState(state.currentUserName);
  const [phoneInput, setPhoneInput] = useState(state.smsPreferences.phone);
  const [showSmsComposer, setShowSmsComposer] = useState(false);
  const [smsTargetPhones, setSmsTargetPhones] = useState<string[] | undefined>(undefined);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllOpenTasks, setShowAllOpenTasks] = useState(false);

  const openTasks = useMemo(
    () => (showAllOpenTasks ? allOpenTasks : allOpenTasks.slice(0, 4)),
    [allOpenTasks, showAllOpenTasks]
  );
  const visibleEvents = useMemo(
    () => (showAllEvents ? events : events.slice(0, 4)),
    [events, showAllEvents]
  );

  const canManageEvents = !state.isGuest && ROLE_META[state.currentRole].canManageEventsAndTasks;
  const canAdmin = !state.isGuest && ROLE_META[state.currentRole].canAccessAdminPanel;
  const hasElevatedGuestRole =
    state.isGuest && ROLE_META[state.currentRole].canManageEventsAndTasks;
  const groupBg = useMemo(
    () => getPersonalBannerPresentation(state.personalAppearance),
    [state.personalAppearance]
  );

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 px-4 py-5 sm:px-6">
      {/* Live Group Header Banner */}
      <div
        data-testid="dashboard_group_banner"
        className={`rounded-3xl p-5 shadow-md sm:p-6 ${
          groupBg.isLightBg ? 'text-slate-900' : 'text-white'
        }`}
        style={groupBg.style}
      >
        <div className="flex items-center justify-between gap-2">
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              groupBg.isLightBg ? 'text-slate-700' : 'text-white/90'
            }`}
          >
            <Cloud
              className={`h-4 w-4 ${groupBg.isLightBg ? 'text-slate-700' : 'text-white/85'}`}
            />
            <span>Live Cloud Sync</span>
          </div>
          <RoleBadge role={state.currentRole} />
        </div>

        <div className="mt-3 flex items-center gap-3.5">
          <GroupAvatar
            groupName={group?.name ?? 'RallyHub Group'}
            imageUrl={
              group?.groupImageUrl ?? (group ? state.groupImagesById[group.id] : null) ?? null
            }
            size="lg"
            tone={groupBg.isLightBg ? 'on-light' : 'on-dark'}
            testId="dashboard_group_avatar"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {group?.name ?? 'RallyHub Group'}
            </h1>

            {group?.description && (
              <p
                className={`mt-1 line-clamp-2 text-sm ${
                  groupBg.isLightBg ? 'text-slate-700' : 'text-white/85'
                }`}
              >
                {group.description}
              </p>
            )}
          </div>
        </div>

        {leadershipMembers.length > 0 && (
          <div
            data-testid="dashboard_header_admin_summary"
            className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${
              groupBg.isLightBg ? 'text-slate-800' : 'text-white/95'
            }`}
          >
            <Shield
              className={`h-3.5 w-3.5 shrink-0 ${
                groupBg.isLightBg ? 'text-slate-800' : 'text-white/90'
              }`}
            />
            <span className="truncate">
              Admin:{' '}
              {leadershipMembers
                .map((m) => (m.uid === state.currentUserId ? `${m.displayName} (You)` : m.displayName))
                .join(', ')}
            </span>
          </div>
        )}

        <div
          className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${
            groupBg.isLightBg ? 'text-slate-700' : 'text-white/90'
          }`}
        >
          <span className="truncate">
            Signed in as {state.currentUserName}
            {state.smsPreferences.phone
              ? ` • ${formatPhoneDisplay(state.smsPreferences.phone)}`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              setNameInput(state.currentUserName);
              setPhoneInput(state.smsPreferences.phone);
              setShowEditNameDialog(true);
            }}
            data-testid="edit_display_name_button"
            title="Edit your name and cell phone number"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
              groupBg.isLightBg
                ? 'bg-slate-900/10 text-slate-900 hover:bg-slate-900/20'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowAppearanceModal(true)}
            data-testid="dashboard_appearance_button"
            title="Customize your personal colors and background"
            className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition ${
              groupBg.isLightBg
                ? 'bg-slate-900/10 text-slate-900 hover:bg-slate-900/20'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>My Colors &amp; Background</span>
          </button>
        </div>

        {group && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <GroupCodePill code={group.groupCode} onCopied={onCopiedCode} />
            <QrInviteShareButton groupCode={group.groupCode} groupName={group.name} />
          </div>
        )}
      </div>

      {hasElevatedGuestRole && (
        <div
          data-testid="dashboard_guest_elevated_role_banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--rally-primary)]/35 bg-[var(--rally-surface)] p-4 shadow-2xs"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-display text-sm font-bold text-[var(--rally-on-surface)]">
              {ROLE_META[state.currentRole].label} Role Assigned
            </div>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Sign in with Google to unlock your {ROLE_META[state.currentRole].label.toLowerCase()}{' '}
              management tools, event editing, and member directory access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => actions.requestGoogleSignIn()}
            data-testid="dashboard_guest_google_signin_button"
            className="shrink-0 rounded-xl bg-[var(--rally-primary)] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            Sign In with Google
          </button>
        </div>
      )}

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
        canViewContacts={canAdmin}
        memberContactsByUid={state.memberContactsByUid}
        expanded={showAllMembers}
        onToggleExpand={() => setShowAllMembers((prev) => !prev)}
        onOpenSmsComposer={(targetPhone) => {
          setSmsTargetPhones(targetPhone ? [targetPhone] : undefined);
          setShowSmsComposer(true);
        }}
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
            Upcoming Events{events.length > 0 ? ` (${events.length})` : ''}
          </h2>
          {events.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllEvents((prev) => !prev)}
              data-testid="toggle_all_events_button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
            >
              <span>{showAllEvents ? 'Show fewer' : `Show all (${events.length})`}</span>
              {showAllEvents ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
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
            {visibleEvents.map((evt) => {
              const evtTasks = state.allTasksByEvent[evt.id] ?? [];
              const evtReminders = state.remindedTimes[evt.id] ?? [];
              const isReminded = evtReminders.length > 0;
              const isRemind30m = isReminderAt30mSet(evtReminders, evt.startEpochMs);
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
                    {isReminded && (
                      <div className="mt-1 text-xs font-medium text-[var(--rally-secondary)]">
                        {isRemind30m && evtReminders.length === 1
                          ? `In-app reminder 30m before (${formatDateTime(evtReminders[0])})`
                          : evtReminders.length === 1
                            ? `Reminder: ${formatDateTime(evtReminders[0])}`
                            : `${evtReminders.length} reminders set (next: ${formatDateTime(evtReminders[0])})`}
                      </div>
                    )}
                    {evtTasks.length > 0 && (
                      <div className="mt-1.5 text-xs font-semibold text-[var(--rally-tertiary)]">
                        {evtTasks.length} task shifts • {totalAssigned}/{totalCapacity} volunteers
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.toggleEventReminder30m(evt);
                      }}
                      aria-pressed={isRemind30m}
                      data-testid={`toggle_remind_event_${evt.id}`}
                      title={
                        isRemind30m
                          ? 'Turn off 30-minute in-app reminder'
                          : 'Remind me 30 minutes before start'
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                        isRemind30m
                          ? 'border-[var(--rally-secondary)]/50 bg-[var(--rally-secondary-container)] text-[var(--rally-on-secondary-container)] hover:brightness-95'
                          : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface)] hover:bg-[var(--rally-surface-variant)]'
                      }`}
                    >
                      {isRemind30m ? (
                        <BellRing className="h-3.5 w-3.5 text-[var(--rally-secondary)]" />
                      ) : (
                        <Bell className="h-3.5 w-3.5 text-[var(--rally-on-surface-variant)]" />
                      )}
                      <span>{isRemind30m ? 'Reminded (30m)' : 'Remind Me'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReminderEvent(evt);
                      }}
                      data-testid={`remind_event_${evt.id}`}
                      title="Custom reminder times"
                      className="shrink-0 rounded-xl p-2 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                    >
                      <Clock className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Open Tasks Needing Sign-Ups */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
            Open Tasks Needing Sign-Ups{allOpenTasks.length > 0 ? ` (${allOpenTasks.length})` : ''}
          </h2>
          {allOpenTasks.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllOpenTasks((prev) => !prev)}
              data-testid="toggle_all_open_tasks_button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
            >
              <span>{showAllOpenTasks ? 'Show fewer' : `Show all (${allOpenTasks.length})`}</span>
              {showAllOpenTasks ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
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

      {/* Recent Activity Log for Group Managers (Organizers, Admins, Creator) */}
      {canManageEvents && (
        <ActivityLog
          activityLogsState={state.activityLogsState}
          currentUserId={state.currentUserId}
          compact
          onOpenFullLog={canAdmin ? onOpenAdminPanel : undefined}
        />
      )}

      {/* Reminder Dialog */}
      <ReminderEditorDialog
        open={reminderEvent !== null}
        itemTitle={reminderEvent?.title ?? ''}
        targetEpochMs={reminderEvent?.startEpochMs ?? 0}
        currentReminderEpochMsList={
          reminderEvent ? (state.remindedTimes[reminderEvent.id] ?? []) : []
        }
        onClose={() => setReminderEvent(null)}
        onSave={(triggerMs) => {
          if (!reminderEvent) return;
          actions.scheduleOrUpdateReminder(
            reminderEvent.id,
            `Event Starting: ${reminderEvent.title}`,
            `Location: ${reminderEvent.location} (${formatDateTime(reminderEvent.startEpochMs)})`,
            triggerMs
          );
        }}
        onRemove={(triggerAtMs) => {
          if (!reminderEvent) return;
          actions.removeReminder(reminderEvent.id, triggerAtMs);
          if (triggerAtMs === undefined) {
            setReminderEvent(null);
          }
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

      {/* Edit Name & Cell Phone Dialog */}
      <ModalDialog
        open={showEditNameDialog}
        onClose={() => setShowEditNameDialog(false)}
        title="Edit Your Name & Cell Phone"
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
              disabled={
                nameInput.trim().length < 2 ||
                (Boolean(phoneInput.trim()) &&
                  !E164_PHONE_REGEX.test(normalizePhoneInput(phoneInput)))
              }
              onClick={() => {
                void actions.updateDisplayName(
                  nameInput,
                  phoneInput.trim() ? normalizePhoneInput(phoneInput) : null
                );
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
        <div className="space-y-3">
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
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Cell Phone Number
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.slice(0, 24))}
              placeholder="(555) 123-4567"
              data-testid="edit_phone_number_input"
              className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 font-mono-code text-sm focus:border-[var(--rally-primary)] focus:outline-none"
            />
            <p className="text-[11px] text-[var(--rally-on-surface-variant)]">
              Visible to your group&apos;s Creator and Admins for coordination and SMS updates.
            </p>
          </div>
        </div>
      </ModalDialog>

      {/* Outbound SMS Composer Modal */}
      <GroupSmsComposerModal
        open={showSmsComposer}
        onClose={() => {
          setShowSmsComposer(false);
          setSmsTargetPhones(undefined);
        }}
        groupName={group?.name ?? null}
        members={members}
        memberContactsByUid={state.memberContactsByUid}
        initialRecipientPhones={smsTargetPhones}
        serverConfigured={state.smsServerConfigured}
        serverStatus={state.smsServerStatus}
        onRefreshServerStatus={actions.refreshSmsServerStatus}
        isGuest={state.isGuest}
        isBusy={state.isBusy}
        onSendCloudSms={actions.sendDirectSmsBroadcast}
        onBanner={actions.showBanner}
      />

      {/* Personal Colors & Background Modal */}
      <PersonalAppearanceModal
        open={showAppearanceModal}
        onClose={() => setShowAppearanceModal(false)}
        appearance={state.personalAppearance}
        isBusy={state.isBusy}
        onUpdate={(patch) => void actions.updatePersonalAppearance(patch)}
        onReset={() => void actions.resetPersonalAppearance()}
      />
    </div>
  );
}

function GroupRosterCard({
  membersState,
  currentUserId,
  canViewContacts,
  memberContactsByUid,
  expanded,
  onToggleExpand,
  onOpenSmsComposer,
}: {
  membersState: RallyWorkspaceState['membersState'];
  currentUserId: string;
  canViewContacts: boolean;
  memberContactsByUid: Record<string, MemberContactInfo>;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenSmsComposer: (targetPhone?: string) => void;
}) {
  const [expandedLimit, setExpandedLimit] = useState(50);
  const memberLimit = expanded ? expandedLimit : 6;

  return (
    <div
      data-testid="dashboard_members_card"
      className="space-y-2.5 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--rally-primary)]" />
          <h3 className="font-display text-base font-bold">Group Admins &amp; Members</h3>
        </div>
        <div className="flex items-center gap-2">
          {canViewContacts && (
            <button
              type="button"
              onClick={() => onOpenSmsComposer(undefined)}
              data-testid="dashboard_roster_send_sms_button"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--rally-primary-container)] px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
            >
              <MessageSquareShare className="h-3.5 w-3.5" />
              <span>Send SMS</span>
            </button>
          )}
          {membersState.status === 'success' && (
            <span className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
              {membersState.data.length} / 500
            </span>
          )}
        </div>
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
              {membersState.data.slice(0, memberLimit).map((member) => (
                <DashboardMemberRow
                  key={member.uid}
                  member={member}
                  contact={canViewContacts ? memberContactsByUid[member.uid] : undefined}
                  canViewContacts={canViewContacts}
                  isCurrentUser={member.uid === currentUserId}
                  onTextMember={(phone) => onOpenSmsComposer(phone)}
                />
              ))}
              {membersState.data.length > 6 && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {expanded && membersState.data.length > expandedLimit && (
                    <button
                      type="button"
                      onClick={() => setExpandedLimit((limit) => limit + 50)}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
                    >
                      Show 50 more ({membersState.data.length - expandedLimit} remaining)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (expanded) setExpandedLimit(50);
                      onToggleExpand();
                    }}
                    data-testid="toggle_all_members_button"
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
                  >
                    <span>
                      {expanded
                        ? 'Show fewer'
                        : `Show ${Math.min(50, membersState.data.length)} of ${membersState.data.length} members`}
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
  contact,
  canViewContacts,
  isCurrentUser,
  onTextMember,
}: {
  member: GroupMember;
  contact?: MemberContactInfo;
  canViewContacts: boolean;
  isCurrentUser: boolean;
  onTextMember: (phone: string) => void;
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
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {isCurrentUser ? `${member.displayName} (You)` : member.displayName}
        </div>
        {canViewContacts && contact?.phoneNumber && (
          <div className="mt-0.5 flex items-center gap-1.5 font-mono-code text-xs text-[var(--rally-on-surface-variant)]">
            <Phone className="h-3 w-3 text-[var(--rally-primary)]" />
            <span>{formatPhoneDisplay(contact.phoneNumber)}</span>
          </div>
        )}
      </div>
      {canViewContacts && contact?.phoneNumber && (
        <button
          type="button"
          onClick={() => onTextMember(contact.phoneNumber)}
          data-testid={`dashboard_text_member_${member.uid}`}
          title={`Text ${member.displayName}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--rally-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--rally-primary)] shadow-2xs transition hover:bg-[var(--rally-primary-container)]/50"
        >
          <MessageSquareShare className="h-3 w-3" />
          <span>SMS</span>
        </button>
      )}
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
