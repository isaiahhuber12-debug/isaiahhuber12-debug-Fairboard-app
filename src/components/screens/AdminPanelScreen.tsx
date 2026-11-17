import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Megaphone,
  Search,
  UserCog,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import {
  type GroupMember,
  MemberRole,
  parseMemberRole,
  type RallyGroup,
  ROLE_META,
} from '../../types/rally';
import {
  EngagementBarChart,
  FillRateRing,
  GroupCodePill,
  MetricStatTile,
  NotificationComposerDialog,
  RoleBadge,
} from '../RallyComponents';

interface AdminPanelScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  onCopiedCode: () => void;
}

export function AdminPanelScreen({
  state,
  actions,
  onCopiedCode,
}: AdminPanelScreenProps) {
  const group = state.activeGroup;
  const members = useMemo(
    () => (state.membersState.status === 'success' ? state.membersState.data : []),
    [state.membersState]
  );
  const channels = state.channelsState.status === 'success' ? state.channelsState.data : [];
  const events = state.eventsState.status === 'success' ? state.eventsState.data : [];
  const isCreator = ROLE_META[state.currentRole].isCreator;

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRole | null>(null);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        const matchesQuery =
          !searchQuery.trim() ||
          m.displayName.toLowerCase().includes(searchQuery.trim().toLowerCase());
        const matchesRole = roleFilter === null || parseMemberRole(m.role) === roleFilter;
        return matchesQuery && matchesRole;
      }),
    [members, searchQuery, roleFilter]
  );

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">Admin Command Panel</h1>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            {isCreator
              ? 'Group Creator: Full control over admins, group settings, and permissions.'
              : 'Admin: Can edit group details & codes, create admins, and approve/delete posts. Only Creator can demote existing admins.'}
          </p>
        </div>
        <RoleBadge role={state.currentRole} />
      </div>

      {/* Group Settings & Invite Code Card */}
      {group && (
        <GroupSettingsCard
          key={`${group.id}_${group.name}_${group.description}_${group.groupCode}`}
          group={group}
          isBusy={state.isBusy}
          onCopiedCode={onCopiedCode}
          onSaveDetails={(n, d) => void actions.updateGroupDetails(n, d)}
          onSaveCode={(c) => void actions.updateGroupCode(c)}
        />
      )}

      {/* Broadcast Quick Action */}
      <button
        type="button"
        onClick={() => setShowBroadcastDialog(true)}
        data-testid="admin_broadcast_button"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
      >
        <Megaphone className="h-4 w-4" />
        <span>Send Broadcast / Targeted Notification</span>
      </button>

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

      {/* Member Permissions */}
      <div className="space-y-3 pt-1">
        <h2 className="font-display text-lg font-bold">Member Permissions ({members.length})</h2>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants, organizers, admins..."
            data-testid="member_search_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRoleFilter(null)}
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
                onClick={() => setRoleFilter(active ? null : role)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)]'
                }`}
              >
                {ROLE_META[role].label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <MemberPermissionRow
              key={member.uid}
              member={member}
              viewerIsCreator={isCreator}
              viewerUid={state.currentUserId}
              onAssignRole={(newRole) => void actions.updateMemberRole(member.uid, newRole)}
            />
          ))}
        </div>
      </div>

      {/* Broadcast Composer Dialog */}
      <NotificationComposerDialog
        open={showBroadcastDialog}
        currentRole={state.currentRole}
        initialNotification={null}
        channels={channels}
        events={events}
        onClose={() => setShowBroadcastDialog(false)}
        onSend={(params) => {
          void actions.sendNotification(params);
          setShowBroadcastDialog(false);
        }}
      />
    </div>
  );
}

function MemberPermissionRow({
  member,
  viewerIsCreator,
  viewerUid,
  onAssignRole,
}: {
  member: GroupMember;
  viewerIsCreator: boolean;
  viewerUid: string;
  onAssignRole: (role: MemberRole) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const memberRole = parseMemberRole(member.role);

  const canEdit =
    memberRole !== MemberRole.CREATOR &&
    member.uid !== viewerUid &&
    (viewerIsCreator || memberRole !== MemberRole.ADMIN);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-sm font-bold">
            {member.uid === viewerUid ? `${member.displayName} (You)` : member.displayName}
          </span>
          <RoleBadge role={memberRole} />
        </div>
        <div className="mt-1 text-xs text-[var(--rally-on-surface-variant)]">
          {member.tasksSignedUpCount} tasks • {member.messagesSentCount} messages
        </div>
      </div>

      <div className="relative shrink-0">
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              data-testid={`manage_role_${member.uid}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--rally-surface-variant)]"
            >
              <UserCog className="h-4 w-4" />
              <span>Role</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-1 shadow-lg">
                {[MemberRole.PARTICIPANT, MemberRole.ORGANIZER, MemberRole.ADMIN].map(
                  (targetRole) => (
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
                  )
                )}
              </div>
            )}
          </>
        ) : memberRole === MemberRole.CREATOR ? (
          <span className="text-xs font-bold text-[var(--rally-secondary)]">Owner</span>
        ) : memberRole === MemberRole.ADMIN && !viewerIsCreator ? (
          <span className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
            Creator Lock
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GroupSettingsCard({
  group,
  isBusy,
  onCopiedCode,
  onSaveDetails,
  onSaveCode,
}: {
  group: RallyGroup;
  isBusy: boolean;
  onCopiedCode: () => void;
  onSaveDetails: (name: string, description: string) => void;
  onSaveCode: (code: string) => void;
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
        <GroupCodePill code={group.groupCode} onCopied={onCopiedCode} />
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

