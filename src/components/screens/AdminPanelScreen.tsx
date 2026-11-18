import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  Lock,
  LogIn,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareShare,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserMinus,
  X,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { formatPhoneDisplay } from '../../services/smsService';
import {
  ActivityAction,
  CHANNEL_ACCESS_LABELS,
  ChannelAccessLevel,
  type ChatChannel,
  type GroupMember,
  type MemberContactInfo,
  MemberRole,
  parseActivityAction,
  parseChannelAccessLevel,
  parseMemberRole,
  type RallyGroup,
  ROLE_META,
} from '../../types/rally';
import {
  ConfirmDeleteDialog,
  EngagementBarChart,
  FillRateRing,
  GroupAvatar,
  GroupCodePill,
  MetricStatTile,
  NotificationComposerDialog,
  RoleBadge,
} from '../RallyComponents';
import { ActivityLog } from '../ActivityLog';
import { AdminAuditLog, isSensitiveAuditAction } from '../AdminAuditLog';
import { PersonalAppearanceCard } from '../BackgroundCustomizerCard';
import { GroupImageEditor } from '../GroupImageEditor';
import { GroupSmsComposerModal } from '../GroupSmsComposerModal';
import { QrInviteShareButton } from '../QrInviteShareModal';

export type AdminPanelSubTab = 'controls' | 'audit';

interface AdminPanelScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  onCopiedCode: () => void;
  activeSubTab?: AdminPanelSubTab;
  onSubTabChange?: (tab: AdminPanelSubTab) => void;
}

export function AdminPanelScreen({
  state,
  actions,
  onCopiedCode,
  activeSubTab,
  onSubTabChange,
}: AdminPanelScreenProps) {
  const group = state.activeGroup;
  const members = useMemo(
    () => (state.membersState.status === 'success' ? state.membersState.data : []),
    [state.membersState]
  );
  const channels = state.channelsState.status === 'success' ? state.channelsState.data : [];
  const events = state.eventsState.status === 'success' ? state.eventsState.data : [];
  const isCreator = ROLE_META[state.currentRole].isCreator;

  const [internalTab, setInternalTab] = useState<AdminPanelSubTab>('controls');
  const currentTab: AdminPanelSubTab = activeSubTab ?? internalTab;
  const setCurrentTab = (next: AdminPanelSubTab) => {
    setInternalTab(next);
    onSubTabChange?.(next);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRole | null>(null);
  const [visibleMemberLimit, setVisibleMemberLimit] = useState(50);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [showSmsComposer, setShowSmsComposer] = useState(false);
  const [smsTargetPhones, setSmsTargetPhones] = useState<string[] | undefined>(undefined);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<ChatChannel | null>(null);
  const [deletingMember, setDeletingMember] = useState<GroupMember | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelAccess, setNewChannelAccess] = useState<ChannelAccessLevel>(
    ChannelAccessLevel.ALL
  );

  const membersWithPhoneCount = useMemo(
    () =>
      members.filter((m) => Boolean(state.memberContactsByUid[m.uid]?.phoneNumber)).length,
    [members, state.memberContactsByUid]
  );

  const sensitiveAuditCount = useMemo(() => {
    const logs = state.activityLogsState.status === 'success' ? state.activityLogsState.data : [];
    const baseCount = logs.filter((entry) => isSensitiveAuditAction(entry.action)).length;
    const hasRecordedGroupCreated = logs.some(
      (entry) => parseActivityAction(entry.action) === ActivityAction.GROUP_CREATED
    );
    return baseCount + (group && group.createdAtMs > 0 && !hasRecordedGroupCreated ? 1 : 0);
  }, [state.activityLogsState, group]);

  const roleCounts = useMemo(() => {
    const counts: Record<MemberRole, number> = {
      [MemberRole.CREATOR]: 0,
      [MemberRole.ADMIN]: 0,
      [MemberRole.ORGANIZER]: 0,
      [MemberRole.PARTICIPANT]: 0,
    };
    for (const m of members) {
      counts[parseMemberRole(m.role)] += 1;
    }
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return members.filter((m) => {
      const memberRole = parseMemberRole(m.role);
      const roleLabel = ROLE_META[memberRole].label.toLowerCase();
      const contact = state.memberContactsByUid[m.uid];
      const phoneStr = (contact?.phoneNumber ?? '').toLowerCase();
      const phoneDigits = phoneStr.replace(/\D/g, '');
      const emailStr = (contact?.email ?? '').toLowerCase();
      const matchesQuery =
        !q ||
        m.displayName.toLowerCase().includes(q) ||
        roleLabel.includes(q) ||
        memberRole.toLowerCase().includes(q) ||
        phoneStr.includes(q) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits)) ||
        emailStr.includes(q);
      const matchesRole = roleFilter === null || memberRole === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [members, searchQuery, roleFilter, state.memberContactsByUid]);

  const handleCreateQuickChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newChannelName.trim().length < 2) return;
    const ok = await actions.createChannel(newChannelName, newChannelDesc, newChannelAccess);
    if (ok) {
      setNewChannelName('');
      setNewChannelDesc('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
            Admin Command Panel
          </h1>
          <p className="text-xs text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]">
            {isCreator
              ? 'Group Creator: Full control over admins, group settings, member contacts, and messaging channels.'
              : 'Admin: Can edit group details & codes, manage messaging channels, create admins, and approve/delete posts.'}
          </p>
        </div>
        <RoleBadge role={state.currentRole} />
      </div>

      {state.isGuest ? (
        <div className="space-y-4">
          <section
            data-testid="admin_guest_upgrade_card"
            className="space-y-3 rounded-3xl border border-[var(--rally-primary)]/35 bg-[var(--rally-surface)] p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-primary)]">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold">
                  Admin Role Assigned — Sign In with Google to Unlock Controls
                </h2>
                <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
                  You have been assigned the{' '}
                  <strong className="font-semibold text-[var(--rally-on-surface)]">
                    {ROLE_META[state.currentRole].label}
                  </strong>{' '}
                  role in {group?.name ?? 'this group'}. Because you joined with a Group Code
                  without an email, sign in with Google to verify your identity before accessing
                  private member phone numbers, assigning roles, managing channels, or reviewing the
                  audit log.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => actions.requestGoogleSignIn()}
              data-testid="admin_guest_google_signin_button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In with Google to Activate Admin Tools</span>
            </button>
          </section>

          <PersonalAppearanceCard
            appearance={state.personalAppearance}
            isBusy={state.isBusy}
            onUpdate={(patch) => void actions.updatePersonalAppearance(patch)}
            onReset={() => void actions.resetPersonalAppearance()}
          />
        </div>
      ) : (
        <>

      {/* Admin Sub-Tab Switcher */}
      <div
        role="tablist"
        aria-label="Admin Panel Sections"
        className="flex gap-2 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'controls'}
          onClick={() => setCurrentTab('controls')}
          data-testid="admin_tab_controls"
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition sm:text-sm ${
            currentTab === 'controls'
              ? 'bg-[var(--rally-primary)] text-white shadow-sm'
              : 'text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/60'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span>Admin Controls</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'audit'}
          onClick={() => setCurrentTab('audit')}
          data-testid="admin_tab_audit_log"
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition sm:text-sm ${
            currentTab === 'audit'
              ? 'bg-[var(--rally-primary)] text-white shadow-sm'
              : 'text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/60'
          }`}
        >
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Audit Log</span>
          {sensitiveAuditCount > 0 && (
            <span
              data-testid="admin_tab_audit_count"
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                currentTab === 'audit'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface)]'
              }`}
            >
              {sensitiveAuditCount}
            </span>
          )}
        </button>
      </div>

      {currentTab === 'audit' ? (
        <AdminAuditLog
          activityLogsState={state.activityLogsState}
          activeGroup={group}
          members={members}
          currentUserId={state.currentUserId}
          isBusy={state.isBusy}
          onExportCsv={(opts) => void actions.exportAuditLogCsv(opts)}
        />
      ) : (
        <>
      {/* Group Settings & Invite Code Card */}
      {group && (
        <GroupSettingsCard
          key={`${group.id}_${group.name}_${group.description}_${group.groupCode}`}
          group={group}
          isCreator={isCreator}
          groupImageUrl={group.groupImageUrl ?? state.groupImagesById[group.id] ?? null}
          isBusy={state.isBusy}
          onCopiedCode={onCopiedCode}
          onSaveDetails={(n, d) => void actions.updateGroupDetails(n, d)}
          onSaveCode={(c) => void actions.updateGroupCode(c)}
          onSaveImage={(url) => void actions.updateGroupImage(group.id, url)}
        />
      )}

      {/* Personal Colors & Background Customizer (Isolated to Current User) */}
      <PersonalAppearanceCard
        appearance={state.personalAppearance}
        isBusy={state.isBusy}
        onUpdate={(patch) => void actions.updatePersonalAppearance(patch)}
        onReset={() => void actions.resetPersonalAppearance()}
      />

      {/* Messaging Channels Manager (Create & Delete Messaging Groups) */}
      <section
        data-testid="admin_messaging_channels_card"
        className="space-y-4 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Messaging Channels</h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Create different role-scoped messaging groups and delete channels when finished.
            </p>
          </div>
          <span className="rounded-lg bg-[var(--rally-surface-variant)] px-2.5 py-1 text-xs font-semibold text-[var(--rally-on-surface-variant)]">
            {channels.length} {channels.length === 1 ? 'channel' : 'channels'}
          </span>
        </div>

        <form
          onSubmit={(e) => void handleCreateQuickChannel(e)}
          className="grid gap-2.5 rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-surface-variant)]/30 p-3.5 sm:grid-cols-12"
        >
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value.slice(0, 60))}
            placeholder="Channel name (e.g. logistics-team)"
            data-testid="admin_new_channel_name_input"
            className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none sm:col-span-4"
          />
          <input
            type="text"
            value={newChannelDesc}
            onChange={(e) => setNewChannelDesc(e.target.value.slice(0, 200))}
            placeholder="Topic / purpose (optional)"
            data-testid="admin_new_channel_desc_input"
            className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none sm:col-span-4"
          />
          <select
            value={newChannelAccess}
            onChange={(e) => setNewChannelAccess(e.target.value as ChannelAccessLevel)}
            data-testid="admin_new_channel_access_select"
            className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-2.5 py-2 text-xs font-semibold focus:border-[var(--rally-primary)] focus:outline-none sm:col-span-2"
          >
            <option value={ChannelAccessLevel.ALL}>All Members</option>
            <option value={ChannelAccessLevel.ORGANIZER}>Organizers+</option>
            <option value={ChannelAccessLevel.ADMIN}>Admins Only</option>
          </select>
          <button
            type="submit"
            disabled={state.isBusy || newChannelName.trim().length < 2}
            data-testid="admin_create_channel_button"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-[var(--rally-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45 sm:col-span-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create</span>
          </button>
        </form>

        {channels.length > 0 && (
          <div className="divide-y divide-[var(--rally-outline)]/40 rounded-2xl border border-[var(--rally-outline)]/50">
            {channels.map((ch) => {
              const lvl = parseChannelAccessLevel(ch.accessLevel);
              return (
                <div
                  key={ch.id}
                  data-testid={`admin_channel_row_${ch.id}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
                      {lvl === ChannelAccessLevel.ALL ? (
                        <MessageSquare className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-display text-sm font-bold">#{ch.name}</span>
                        <span className="rounded bg-[var(--rally-surface-variant)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rally-on-surface-variant)]">
                          {CHANNEL_ACCESS_LABELS[lvl]}
                        </span>
                      </div>
                      <div className="truncate text-xs text-[var(--rally-on-surface-variant)]">
                        {ch.messageCount} messages{ch.description ? ` • ${ch.description}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={state.isBusy}
                    onClick={() => setDeletingChannel(ch)}
                    data-testid={`admin_delete_channel_${ch.id}`}
                    title="Delete channel after usage"
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--rally-error)]/35 px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-error)] transition hover:bg-[var(--rally-error)]/10 disabled:opacity-45"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Broadcast & Outbound SMS Quick Actions */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setShowBroadcastDialog(true)}
          data-testid="admin_broadcast_button"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Megaphone className="h-4 w-4" />
          <span>Send In-App Broadcast</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSmsTargetPhones(undefined);
            setShowSmsComposer(true);
          }}
          data-testid="admin_send_sms_button"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rally-secondary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <MessageSquareShare className="h-4 w-4" />
          <span>
            Send SMS to Phone Numbers
            {membersWithPhoneCount > 0 ? ` (${membersWithPhoneCount})` : ''}
          </span>
        </button>
      </div>

      {/* Engagement Analytics */}
      <div className="space-y-4 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5">
        <h2 className="font-display text-lg font-bold">Engagement Analytics</h2>
        <FillRateRing
          percent={state.analytics.fillRatePercent}
          filled={state.analytics.filledTaskSlots}
          total={state.analytics.totalTaskSlots}
        />

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <MetricStatTile
            label="Messages"
            value={String(state.analytics.totalMessages)}
            accentColor="#1B4DFF"
          />
          <MetricStatTile
            label="Alerts Sent"
            value={String(state.analytics.totalNotifications)}
            accentColor="#FF5A36"
          />
          <MetricStatTile
            label="Admins"
            value={String(state.analytics.creatorCount + state.analytics.adminCount)}
            accentColor="#0F9D76"
          />
        </div>

        <div className="space-y-2">
          <h3 className="font-display text-sm font-bold">Channel Activity</h3>
          <EngagementBarChart items={state.analytics.channelActivity} />
        </div>
      </div>

      {/* Record-Keeping Exports (CSV) */}
      {group && (
        <section
          data-testid="admin_csv_export_card"
          className="space-y-3 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Record-Keeping Exports (CSV)</h2>
                <p className="text-xs text-[var(--rally-on-surface-variant)]">
                  Download spreadsheet-ready CSV files of the administrative audit trail and group
                  membership roster.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              disabled={state.isBusy || state.activityLogsState.status === 'loading'}
              onClick={() =>
                void actions.exportAuditLogCsv({ scope: 'SENSITIVE', sortOrder: 'desc' })
              }
              data-testid="admin_export_audit_csv_button"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/40 px-3.5 py-2.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
            >
              <Download className="h-4 w-4 text-[var(--rally-primary)]" />
              <span>Audit Log CSV ({sensitiveAuditCount})</span>
            </button>

            <button
              type="button"
              disabled={state.isBusy || state.membersState.status === 'loading'}
              onClick={() => actions.exportMembersCsv(members)}
              data-testid="admin_export_members_csv_button"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/40 px-3.5 py-2.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
            >
              <Download className="h-4 w-4 text-[var(--rally-primary)]" />
              <span>Membership CSV ({members.length})</span>
            </button>

            <button
              type="button"
              disabled={
                state.isBusy ||
                state.membersState.status === 'loading' ||
                state.activityLogsState.status === 'loading'
              }
              onClick={() => void actions.exportCombinedRecordsCsv()}
              data-testid="admin_export_combined_csv_button"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--rally-primary)] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
            >
              <Download className="h-4 w-4" />
              <span>Combined Archive CSV</span>
            </button>
          </div>
        </section>
      )}

      {/* Group Activity Log */}
      <ActivityLog
        activityLogsState={state.activityLogsState}
        currentUserId={state.currentUserId}
      />

      {/* Member Directory, Contact Info & Permissions */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
              Member Directory &amp; Contacts ({members.length} / 500)
            </h2>
            <p className="text-xs text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]">
              Creator &amp; Admin view: member names, cell phone numbers, sign-in method, and role
              permissions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(searchQuery.trim() || roleFilter !== null) && (
              <span
                data-testid="member_filter_match_count"
                className="text-xs font-semibold text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]"
              >
                Showing {filteredMembers.length} of {members.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSmsTargetPhones(undefined);
                setShowSmsComposer(true);
              }}
              data-testid="member_roster_send_sms_button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary-container)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
            >
              <MessageSquareShare className="h-3.5 w-3.5" />
              <span>Text Members ({membersWithPhoneCount})</span>
            </button>
            <button
              type="button"
              disabled={state.isBusy || members.length === 0}
              onClick={() => actions.exportMembersCsv(members)}
              data-testid="member_roster_export_csv_button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
              <span>Download Member Roster</span>
            </button>
            {(searchQuery.trim() || roleFilter !== null) && filteredMembers.length > 0 && (
              <button
                type="button"
                disabled={state.isBusy}
                onClick={() => actions.exportMembersCsv(filteredMembers)}
                data-testid="member_roster_export_filtered_csv_button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
              >
                <Download className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
                <span>Export Filtered ({filteredMembers.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleMemberLimit(50);
            }}
            placeholder="Search members by name, phone number, email, or role..."
            aria-label="Filter group members by name, phone number, email, or role"
            data-testid="member_search_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2.5 pl-10 pr-10 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setVisibleMemberLimit(50);
              }}
              aria-label="Clear member search"
              data-testid="member_search_clear_button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--rally-on-surface-variant)] transition hover:bg-[var(--rally-surface-variant)] hover:text-[var(--rally-on-surface)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRoleFilter(null);
              setVisibleMemberLimit(50);
            }}
            data-testid="member_role_filter_all"
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              roleFilter === null
                ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)]'
            }`}
          >
            All ({members.length})
          </button>
          {Object.values(MemberRole).map((role) => {
            const active = roleFilter === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setRoleFilter(active ? null : role);
                  setVisibleMemberLimit(50);
                }}
                data-testid={`member_role_filter_${role.toLowerCase()}`}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)]'
                }`}
              >
                {ROLE_META[role].label} ({roleCounts[role]})
              </button>
            );
          })}
        </div>

        {filteredMembers.length === 0 ? (
          <div
            data-testid="member_search_empty_state"
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 text-sm text-[var(--rally-on-surface-variant)]"
          >
            <span>No members match your current name or role filter.</span>
            {(searchQuery.trim() || roleFilter !== null) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter(null);
                  setVisibleMemberLimit(50);
                }}
                data-testid="member_search_reset_filters_button"
                className="rounded-xl border border-[var(--rally-outline)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/40"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMembers.slice(0, visibleMemberLimit).map((member) => (
              <MemberPermissionRow
                key={member.uid}
                member={member}
                contact={state.memberContactsByUid[member.uid]}
                viewerIsCreator={isCreator}
                viewerUid={state.currentUserId}
                isBusy={state.isBusy}
                onAssignRole={(newRole) => void actions.updateMemberRole(member.uid, newRole)}
                onRemoveMember={() => setDeletingMember(member)}
                onTextMember={(phone) => {
                  setSmsTargetPhones([phone]);
                  setShowSmsComposer(true);
                }}
                onCopiedPhone={() => actions.showBanner('Member phone number copied')}
              />
            ))}
          </div>
        )}

        {filteredMembers.length > visibleMemberLimit && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setVisibleMemberLimit((limit) => limit + 50)}
              data-testid="admin_show_more_members_button"
              className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-4 py-2 text-xs font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/40"
            >
              Show 50 more ({filteredMembers.length - visibleMemberLimit} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Broadcast Composer Dialog */}
      <NotificationComposerDialog
        open={showBroadcastDialog}
        currentRole={state.currentRole}
        initialNotification={null}
        channels={channels}
        events={events}
        isBusy={state.isBusy}
        onClose={() => setShowBroadcastDialog(false)}
        onSend={(params) => {
          void actions.sendNotification(params);
          setShowBroadcastDialog(false);
        }}
        onSendAndAnother={(params) => actions.sendNotification(params)}
      />

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
        onBanner={actions.showBanner}
      />

      {/* Delete Group (Creator Only) */}
      {group && isCreator && (
        <div className="space-y-3 rounded-3xl border border-[var(--rally-error)]/35 bg-[var(--rally-surface)] p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--rally-error)]">
              Delete Group
            </h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              When this event community is finished, permanently delete the group and retire its
              invite code ({group.groupCode}).
            </p>
          </div>
          <button
            type="button"
            disabled={state.isBusy}
            onClick={() => setShowDeleteGroupDialog(true)}
            data-testid="admin_delete_group_button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--rally-error)]/45 px-4 text-xs font-semibold text-[var(--rally-error)] transition hover:bg-[var(--rally-error)]/10 disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete This Group</span>
          </button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={showDeleteGroupDialog && group !== null}
        title="Delete Group?"
        description={
          group
            ? `Permanently delete "${group.name}" and retire invite code ${group.groupCode}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Group"
        isBusy={state.isBusy}
        onCancel={() => setShowDeleteGroupDialog(false)}
        onConfirm={() => {
          if (group) {
            void actions.deleteGroup(group.id, group.groupCode);
          }
          setShowDeleteGroupDialog(false);
        }}
      />

      <ConfirmDeleteDialog
        open={deletingChannel !== null}
        title="Delete Messaging Channel?"
        description={
          deletingChannel
            ? `Permanently delete #${deletingChannel.name} and its ${deletingChannel.messageCount} message(s)? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Channel"
        isBusy={state.isBusy}
        onCancel={() => setDeletingChannel(null)}
        onConfirm={() => {
          if (deletingChannel) {
            void actions.deleteChannel(deletingChannel.id);
          }
          setDeletingChannel(null);
        }}
      />

      <ConfirmDeleteDialog
        open={deletingMember !== null}
        title="Remove Group Member?"
        description={
          deletingMember
            ? `Remove ${deletingMember.displayName} (${ROLE_META[parseMemberRole(deletingMember.role)].label}) from ${group?.name ?? 'this group'}? They will lose access immediately and this removal will be recorded in the Audit Log.`
            : ''
        }
        confirmLabel="Remove Member"
        isBusy={state.isBusy}
        onCancel={() => setDeletingMember(null)}
        onConfirm={() => {
          if (deletingMember) {
            void actions.removeMember(deletingMember.uid);
          }
          setDeletingMember(null);
        }}
      />
        </>
      )}
        </>
      )}
    </div>
  );
}

function MemberPermissionRow({
  member,
  contact,
  viewerIsCreator,
  viewerUid,
  isBusy,
  onAssignRole,
  onRemoveMember,
  onTextMember,
  onCopiedPhone,
}: {
  member: GroupMember;
  contact?: MemberContactInfo;
  viewerIsCreator: boolean;
  viewerUid: string;
  isBusy: boolean;
  onAssignRole: (role: MemberRole) => void;
  onRemoveMember: () => void;
  onTextMember: (phone: string) => void;
  onCopiedPhone: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const memberRole = parseMemberRole(member.role);
  const isGuestMember =
    contact?.authMethod === 'CODE_GUEST' || member.uid.startsWith('guest_');

  const canEditRole =
    memberRole !== MemberRole.CREATOR &&
    member.uid !== viewerUid &&
    (viewerIsCreator || memberRole !== MemberRole.ADMIN);

  const canRemove =
    memberRole !== MemberRole.CREATOR &&
    member.uid !== viewerUid &&
    (viewerIsCreator || memberRole !== MemberRole.ADMIN);

  const handleCopyPhone = async () => {
    if (!contact?.phoneNumber || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(contact.phoneNumber);
      setCopiedPhone(true);
      onCopiedPhone();
      window.setTimeout(() => setCopiedPhone(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      data-testid={`admin_member_row_${member.uid}`}
      className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-3.5 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-sm font-bold">
            {member.uid === viewerUid ? `${member.displayName} (You)` : member.displayName}
          </span>
          <RoleBadge role={memberRole} />
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              isGuestMember
                ? 'bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)]'
                : 'bg-[var(--rally-surface-variant)] text-[var(--rally-on-surface-variant)]'
            }`}
          >
            {isGuestMember ? 'Group Code Join' : 'Google Account'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {contact?.phoneNumber ? (
            <div className="inline-flex items-center gap-1.5 font-mono-code font-semibold text-[var(--rally-on-surface)]">
              <Phone className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
              <a
                href={`tel:${contact.phoneNumber}`}
                data-testid={`member_phone_${member.uid}`}
                className="hover:underline"
              >
                {formatPhoneDisplay(contact.phoneNumber)}
              </a>
              <button
                type="button"
                onClick={() => void handleCopyPhone()}
                title="Copy phone number"
                className="rounded p-0.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)] hover:text-[var(--rally-on-surface)]"
              >
                {copiedPhone ? (
                  <Check className="h-3 w-3 text-[var(--rally-tertiary)]" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--rally-on-surface-variant)]">
              <Phone className="h-3.5 w-3.5 opacity-60" />
              <span>No cell phone on file yet</span>
            </span>
          )}

          {contact?.email && (
            <span className="inline-flex items-center gap-1 text-[var(--rally-on-surface-variant)]">
              <Mail className="h-3.5 w-3.5 opacity-75" />
              <span className="truncate">{contact.email}</span>
            </span>
          )}
        </div>

        <div className="text-[11px] text-[var(--rally-on-surface-variant)]">
          {member.tasksSignedUpCount} tasks • {member.messagesSentCount} messages
        </div>
      </div>

      <div className="relative flex shrink-0 flex-wrap items-center gap-1.5">
        {contact?.phoneNumber && (
          <button
            type="button"
            onClick={() => onTextMember(contact.phoneNumber)}
            data-testid={`text_member_${member.uid}`}
            title={`Send SMS to ${member.displayName}`}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--rally-primary-container)] px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-on-primary-container)] transition hover:brightness-95"
          >
            <MessageSquareShare className="h-3.5 w-3.5" />
            <span>Text</span>
          </button>
        )}

        {canEditRole && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setMenuOpen((o) => !o)}
            data-testid={`manage_role_${member.uid}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
          >
            <UserCog className="h-4 w-4" />
            <span>Role</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}

        {canRemove && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setMenuOpen(false);
              onRemoveMember();
            }}
            data-testid={`remove_member_${member.uid}`}
            title={`Remove ${member.displayName} from group`}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--rally-error)]/35 px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-error)] transition hover:bg-[var(--rally-error)]/10 disabled:opacity-45"
          >
            <UserMinus className="h-3.5 w-3.5" />
            <span>Remove</span>
          </button>
        )}

        {menuOpen && canEditRole && (
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-1 shadow-lg">
            {[MemberRole.PARTICIPANT, MemberRole.ORGANIZER, MemberRole.ADMIN].map((targetRole) => (
              <button
                key={targetRole}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (targetRole !== memberRole) onAssignRole(targetRole);
                }}
                className="block w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-[var(--rally-surface-variant)]"
              >
                {targetRole === memberRole
                  ? `${ROLE_META[targetRole].label} (Current)`
                  : `Set as ${ROLE_META[targetRole].label}`}
              </button>
            ))}
          </div>
        )}

        {memberRole === MemberRole.CREATOR && (
          <span className="text-xs font-bold text-[var(--rally-secondary)]">Owner</span>
        )}
        {memberRole === MemberRole.ADMIN && !viewerIsCreator && member.uid !== viewerUid && (
          <span className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
            Creator Lock
          </span>
        )}
      </div>
    </div>
  );
}

function GroupSettingsCard({
  group,
  isCreator,
  groupImageUrl,
  isBusy,
  onCopiedCode,
  onSaveDetails,
  onSaveCode,
  onSaveImage,
}: {
  group: RallyGroup;
  isCreator: boolean;
  groupImageUrl: string | null;
  isBusy: boolean;
  onCopiedCode: () => void;
  onSaveDetails: (name: string, description: string) => void;
  onSaveCode: (code: string) => void;
  onSaveImage: (imageUrl: string | null) => void;
}) {
  const [nameInput, setNameInput] = useState(group.name);
  const [descriptionInput, setDescriptionInput] = useState(group.description);
  const [newCodeInput, setNewCodeInput] = useState(group.groupCode);

  const normalizedCode = newCodeInput
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 12);
  const canSaveDetails = !isBusy && nameInput.trim().length > 0;
  const canSaveCode = !isBusy && normalizedCode.length >= 4 && normalizedCode !== group.groupCode;

  return (
    <div className="space-y-4 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">Group Settings & Invite Code</h2>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            Update community identity or rotate the join code.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GroupCodePill code={group.groupCode} onCopied={onCopiedCode} />
          <QrInviteShareButton groupCode={group.groupCode} groupName={group.name} />
        </div>
      </div>

      {/* Group Profile Image */}
      <div className="rounded-2xl border border-[var(--rally-outline)]/50 bg-[var(--rally-surface-variant)]/25 p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--rally-on-surface-variant)]">
            Group Profile Image
          </span>
          {!isCreator && (
            <span className="text-[11px] font-medium text-[var(--rally-on-surface-variant)]">
              Creator-only setting
            </span>
          )}
        </div>
        {isCreator ? (
          <GroupImageEditor
            groupName={group.name}
            imageUrl={groupImageUrl}
            isBusy={isBusy}
            onChangeImage={onSaveImage}
            testIdPrefix="admin_group_image"
          />
        ) : (
          <div className="flex items-center gap-3">
            <GroupAvatar
              groupName={group.name}
              imageUrl={groupImageUrl}
              size="lg"
              testId="admin_group_image_readonly"
            />
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              Only the Group Creator can upload or change the group&apos;s hub profile image.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--rally-on-surface-variant)]">
            Group Name
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={80}
            data-testid="admin_group_name_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/40 px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--rally-on-surface-variant)]">
            Group Description
          </label>
          <textarea
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            rows={2}
            maxLength={300}
            data-testid="admin_group_description_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/40 px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={!canSaveDetails}
          onClick={() => onSaveDetails(nameInput.trim(), descriptionInput.trim())}
          data-testid="admin_save_details_button"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--rally-primary)] px-4 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
        >
          Save Group Details
        </button>
      </div>

      <div className="border-t border-[var(--rally-outline)]/60 pt-4">
        <label className="mb-1 block text-xs font-semibold text-[var(--rally-on-surface-variant)]">
          Rotate Invite Code (4–12 uppercase letters/digits)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={normalizedCode}
            onChange={(e) => setNewCodeInput(e.target.value)}
            maxLength={12}
            data-testid="admin_group_code_input"
            className="min-w-[160px] flex-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface-variant)]/40 px-3.5 py-2 font-mono-code text-sm font-bold tracking-wider uppercase focus:border-[var(--rally-primary)] focus:outline-none"
          />
          <button
            type="button"
            disabled={!canSaveCode}
            onClick={() => onSaveCode(normalizedCode)}
            data-testid="admin_update_code_button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--rally-primary)] px-4 text-xs font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/50 disabled:opacity-45"
          >
            Update Code
          </button>
        </div>
      </div>
    </div>
  );
}

