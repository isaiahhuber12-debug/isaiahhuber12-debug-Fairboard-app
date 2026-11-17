import React, { useState } from 'react';
import {
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  PlusCircle,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { parseMemberRole } from '../../types/rally';
import { RoleBadge } from '../RallyComponents';

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

  const normalizedPreviewCode = newGroupCode.trim().toUpperCase().replace(/\s+/g, '-');
  const isCodeValid = /^[A-Z0-9_-]{4,24}$/.test(normalizedPreviewCode);

  const handleAutoCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i += 1) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewGroupCode(`RH-${suffix}`);
  };

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">
            Welcome, {state.currentUserName}
          </h1>
          {state.currentUserEmail && (
            <p className="truncate text-xs text-[var(--rally-on-surface-variant)]">
              {state.currentUserEmail}
            </p>
          )}
        </div>
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
              As group creator, you keep full control over admins and the group code.
            </p>
          </div>
        </div>

        <div className="mt-3.5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Group Name
            </label>
            <input
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

          <button
            type="button"
            disabled={state.isBusy || newGroupName.trim().length < 2 || !isCodeValid}
            onClick={() =>
              void actions.createGroupWithCode(newGroupName, newGroupDescription, newGroupCode)
            }
            data-testid="create_group_button"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--rally-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state.isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>Create Group & Launch</span>
            )}
          </button>
        </div>
      </div>

      {/* Your Cloud Groups */}
      {state.joinedGroups.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <h2 className="font-display text-base font-bold">Your Cloud Groups</h2>
          <div className="space-y-2">
            {state.joinedGroups.map((groupRef) => (
              <button
                key={groupRef.groupId}
                type="button"
                onClick={() => actions.switchGroup(groupRef.groupId)}
                data-testid={`joined_group_card_${groupRef.groupCode}`}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 text-left transition hover:border-[var(--rally-primary)]/50 hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-semibold">
                    {groupRef.groupName}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono-code text-xs font-semibold text-[var(--rally-primary)]">
                      Code: {groupRef.groupCode}
                    </span>
                    <RoleBadge role={parseMemberRole(groupRef.role)} />
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--rally-on-surface-variant)]" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
