import React from 'react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { GroupPollsSection } from '../GroupPollsSection';

interface PollsScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
}

export function PollsScreen({ state, actions }: PollsScreenProps) {
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      <GroupPollsSection state={state} actions={actions} />
    </div>
  );
}
