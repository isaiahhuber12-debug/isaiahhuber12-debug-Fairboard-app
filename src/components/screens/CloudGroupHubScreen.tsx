import React, { useRef, useState } from 'react';
import {
  Camera,
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { getGroupBackgroundPresentation } from '../../lib/backgrounds';
import { type JoinedGroupRef, MemberRole, parseMemberRole } from '../../types/rally';
import {
  ConfirmDeleteDialog,
  GroupAvatar,
  OfflineStatusBadge,
  RoleBadge,
} from '../RallyComponents';
import { GroupImageDialog, GroupImageEditor } from '../GroupImageEditor';

interface CloudGroupHubScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  onSignOut: () => void;
}

export function CloudGroupHubScreen({
  state,
  actions,
  onSignOut,
}: CloudGroupHubScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupImageUrl, setNewGroupImageUrl] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [deletingGroup, setDeletingGroup] = useState<JoinedGroupRef | null>(null);
  const [editingImageGroup, setEditingImageGroup] = useState<JoinedGroupRef | null>(null);
  const groupNameInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedPreviewCode = newGroupCode.trim().toUpperCase().replace(/\s+/g, '-');
  const isCodeValid = /^[A-Z0-9_-]{4,24}$/.test(normalizedPreviewCode);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i += 1) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `RH-${suffix}`;
  };

  const handleAutoCode = () => {
    setNewGroupCode(generateCode());
  };

  const handleCreateAnother = async () => {
    const ok = await actions.createGroupWithCode(
      newGroupName,
      newGroupDescription,
      newGroupCode,
      false,
      newGroupImageUrl
    );
    if (ok) {
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupCode('');
      setNewGroupImageUrl(null);
      setCreatedCount((c) => c + 1);
      window.setTimeout(() => groupNameInputRef.current?.focus(), 20);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
            Welcome, {state.currentUserName}
          </h1>
          {state.currentUserEmail && (
            <p className="truncate text-xs text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]">
              {state.currentUserEmail}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OfflineStatusBadge />
          <button
            type="button"
            onClick={onSignOut}
            data-testid="hub_sign_out_button"
            title="Sign out"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Join Existing Group by Code */}
      <div className="rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-[var(--rally-primary)]" />
          <h2 className="font-display text-lg font-bold">Join Group by Code</h2>
        </div>

        <div className="mt-3.5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Group Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 24))}
              placeholder="e.g. RALLY26"
              data-testid="cloud_join_code_input"
              className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 font-mono-code text-sm uppercase tracking-wider focus:border-[var(--rally-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Your Display Name (Optional)
            </label>
            <input
              type="text"
              value={joinDisplayName}
              onChange={(e) => setJoinDisplayName(e.target.value.slice(0, 40))}
              placeholder={state.currentUserName}
              data-testid="cloud_join_name_input"
              className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={state.isBusy || joinCode.trim().length < 4}
            onClick={() => {
              const resolvedName = joinDisplayName.trim() || state.currentUserName;
              void actions.joinGroupByCode(joinCode, resolvedName);
            }}
            data-testid="cloud_join_button"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state.isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>Join Group</span>
            )}
          </button>
        </div>
      </div>

      {/* Create New Group & Custom Code */}
      <div className="rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5 shadow-sm">
        <div className="flex items-start gap-2.5">
          <PlusCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rally-secondary)]" />
          <div>
            <h2 className="font-display text-lg font-bold">Create New Group & Code</h2>
            <p className="text-xs text-[var(--rally-on-surface-variant)]">
              As group creator, you keep full control over admins and the group code. Supports up to
              500 members per group.
            </p>
          </div>
        </div>

        <div className="mt-3.5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Group Name
            </label>
            <input
              ref={groupNameInputRef}
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value.slice(0, 80))}
              placeholder="e.g. Fall Festival Volunteers"
              data-testid="create_group_name_input"
              className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Custom Group Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupCode}
                onChange={(e) => setNewGroupCode(e.target.value.toUpperCase().slice(0, 24))}
                placeholder="e.g. RALLY26"
                data-testid="create_group_code_input"
                className="min-w-0 flex-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 font-mono-code text-sm uppercase tracking-wider focus:border-[var(--rally-primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAutoCode}
                className="shrink-0 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-4 text-sm font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-surface-variant)]"
              >
                Auto
              </button>
            </div>
            {newGroupCode.length > 0 && !isCodeValid && (
              <p className="mt-1 text-xs font-medium text-[var(--rally-error)]">
                Use 4–24 characters: A–Z, 0–9, - or _
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value.slice(0, 240))}
              placeholder="What is your group coordinating?"
              data-testid="create_group_desc_input"
              className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Group Profile Image (Optional)
            </label>
            <div className="rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface-variant)]/25 p-3">
              <GroupImageEditor
                groupName={newGroupName || 'New Group'}
                imageUrl={newGroupImageUrl}
                isBusy={state.isBusy}
                onChangeImage={setNewGroupImageUrl}
                compact
                testIdPrefix="create_group_image"
              />
            </div>
          </div>

          {createdCount > 0 && (
            <div className="rounded-xl bg-[var(--rally-tertiary-container)] px-3.5 py-2 text-xs font-semibold text-[var(--rally-on-tertiary-container)]">
              Created {createdCount} group{createdCount === 1 ? '' : 's'} — view them below in Your Cloud Groups or add another.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={state.isBusy || newGroupName.trim().length < 2 || !isCodeValid}
              onClick={() => void handleCreateAnother()}
              data-testid="create_another_group_button"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--rally-primary)] bg-[var(--rally-surface)] px-4 text-sm font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/45 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>Create &amp; Add Another</span>
            </button>
            <button
              type="button"
              disabled={state.isBusy || newGroupName.trim().length < 2 || !isCodeValid}
              onClick={() =>
                void actions.createGroupWithCode(
                  newGroupName,
                  newGroupDescription,
                  newGroupCode,
                  true,
                  newGroupImageUrl
                )
              }
              data-testid="create_group_button"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {state.isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Create Group &amp; Launch</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Your Cloud Groups */}
      {state.joinedGroups.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <h2 className="font-display text-base font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
            Your Cloud Groups
          </h2>
          <div className="space-y-2">
            {state.joinedGroups.map((groupRef) => {
              const isGroupCreator = parseMemberRole(groupRef.role) === MemberRole.CREATOR;
              const bgSpec =
                state.groupBackgroundsById[groupRef.groupId] ?? groupRef.groupBackground ?? 'default';
              const groupBg = getGroupBackgroundPresentation(bgSpec);
              const groupImgUrl =
                groupRef.groupId in state.groupImagesById
                  ? state.groupImagesById[groupRef.groupId]
                  : (groupRef.groupImageUrl ?? null);
              return (
                <div
                  key={groupRef.groupId}
                  onClick={() => actions.switchGroup(groupRef.groupId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') actions.switchGroup(groupRef.groupId);
                  }}
                  data-testid={`joined_group_card_${groupRef.groupCode}`}
                  style={groupBg.style}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/15 p-4 text-left shadow-sm transition hover:brightness-105 ${
                    groupBg.isLightBg ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <GroupAvatar
                      groupName={groupRef.groupName}
                      imageUrl={groupImgUrl}
                      size="md"
                      tone={groupBg.isLightBg ? 'on-light' : 'on-dark'}
                      testId={`joined_group_avatar_${groupRef.groupCode}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base font-bold">
                        {groupRef.groupName}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono-code text-xs font-semibold ${
                            groupBg.isLightBg
                              ? 'bg-slate-900/10 text-slate-900'
                              : 'bg-white/15 text-white'
                          }`}
                        >
                          Code: {groupRef.groupCode}
                        </span>
                        <RoleBadge role={parseMemberRole(groupRef.role)} />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isGroupCreator && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingImageGroup(groupRef);
                          }}
                          data-testid={`edit_group_image_card_${groupRef.groupCode}`}
                          title="Set group profile image"
                          className={`rounded-lg p-2 transition ${
                            groupBg.isLightBg
                              ? 'text-slate-800 hover:bg-slate-900/10'
                              : 'text-white/90 hover:bg-white/15'
                          }`}
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingGroup(groupRef);
                          }}
                          data-testid={`delete_group_card_${groupRef.groupCode}`}
                          title="Delete group"
                          className={`rounded-lg p-2 transition ${
                            groupBg.isLightBg
                              ? 'text-red-700 hover:bg-red-900/10'
                              : 'text-red-200 hover:bg-white/15'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <ChevronRight
                      className={`h-5 w-5 ${
                        groupBg.isLightBg ? 'text-slate-700' : 'text-white/80'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deletingGroup !== null}
        title="Delete Group?"
        description={
          deletingGroup
            ? `Permanently delete "${deletingGroup.groupName}" (code ${deletingGroup.groupCode})? Members will no longer be able to open or join this group.`
            : ''
        }
        confirmLabel="Delete Group"
        isBusy={state.isBusy}
        onCancel={() => setDeletingGroup(null)}
        onConfirm={() => {
          if (deletingGroup) {
            void actions.deleteGroup(deletingGroup.groupId, deletingGroup.groupCode);
          }
          setDeletingGroup(null);
        }}
      />

      {editingImageGroup && (
        <GroupImageDialog
          key={editingImageGroup.groupId}
          open={editingImageGroup !== null}
          groupName={editingImageGroup.groupName}
          initialImageUrl={
            editingImageGroup.groupId in state.groupImagesById
              ? state.groupImagesById[editingImageGroup.groupId]
              : (editingImageGroup.groupImageUrl ?? null)
          }
          isBusy={state.isBusy}
          onClose={() => setEditingImageGroup(null)}
          onSave={(nextUrl) => {
            void actions.updateGroupImage(editingImageGroup.groupId, nextUrl).then((ok) => {
              if (ok) setEditingImageGroup(null);
            });
          }}
        />
      )}
    </div>
  );
}
