import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFriendlyErrorMessage } from '../lib/firestoreError';
import * as pollService from '../services/pollService';
import {
  type AsyncDataState,
  type GroupPoll,
  MemberRole,
  type PollBallot,
  PollStatus,
  ROLE_META,
} from '../types/rally';

export interface UseGroupPollsParams {
  groupId: string | null;
  currentRole: MemberRole;
  currentUserId: string;
  currentUserName: string;
  isGuest: boolean;
  onBanner?: (message: string) => void;
}

export function isCreatorRole(role: MemberRole | string | null | undefined): boolean {
  if (!role) return false;
  return role === MemberRole.CREATOR || String(role).toLowerCase() === 'creator';
}

export function useGroupPolls({
  groupId,
  currentRole,
  currentUserId,
  currentUserName,
  isGuest,
  onBanner,
}: UseGroupPollsParams) {
  const [pollsEntry, setPollsEntry] = useState<{
    groupId: string;
    state: AsyncDataState<GroupPoll[]>;
  } | null>(null);
  const [ownVotesEntry, setOwnVotesEntry] = useState<{
    key: string;
    map: Record<string, number>;
  } | null>(null);
  const [creatorBallotsEntry, setCreatorBallotsEntry] = useState<{
    key: string;
    map: Record<string, PollBallot[]>;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const isCreator = !isGuest && isCreatorRole(currentRole);
  const canCreatePolls = !isGuest && ROLE_META[currentRole].canManageEventsAndTasks;
  const canReopenPolls = !isGuest && ROLE_META[currentRole].canAccessAdminPanel;

  useEffect(() => {
    if (!groupId) return;
    const targetGroupId = groupId;
    return pollService.subscribeGroupPolls(
      targetGroupId,
      (polls) => {
        setPollsEntry({ groupId: targetGroupId, state: { status: 'success', data: polls } });
      },
      (err) => {
        setPollsEntry({
          groupId: targetGroupId,
          state: {
            status: 'error',
            message: getFriendlyErrorMessage(err, 'Could not load group polls'),
          },
        });
      }
    );
  }, [groupId]);

  const pollsState: AsyncDataState<GroupPoll[]> = useMemo(() => {
    if (!groupId) return { status: 'success', data: [] };
    if (pollsEntry?.groupId === groupId) return pollsEntry.state;
    return { status: 'loading' };
  }, [groupId, pollsEntry]);

  const pollIdsKey = useMemo(() => {
    if (pollsState.status !== 'success') return '';
    return pollsState.data.map((p) => p.id).join(',');
  }, [pollsState]);

  useEffect(() => {
    if (!groupId || !currentUserId || !pollIdsKey) return;
    const ids = pollIdsKey.split(',').filter(Boolean);
    const key = `${groupId}:${currentUserId}:${isGuest ? 'guest' : 'auth'}:${pollIdsKey}`;
    return pollService.subscribeOwnPollBallots(groupId, ids, currentUserId, isGuest, (map) => {
      setOwnVotesEntry({ key, map });
    });
  }, [groupId, currentUserId, isGuest, pollIdsKey]);

  const ownVotesByPollId: Record<string, number> = useMemo(() => {
    if (!groupId || !currentUserId || !pollIdsKey) return {};
    const key = `${groupId}:${currentUserId}:${isGuest ? 'guest' : 'auth'}:${pollIdsKey}`;
    if (ownVotesEntry?.key === key) return ownVotesEntry.map;
    return {};
  }, [groupId, currentUserId, isGuest, pollIdsKey, ownVotesEntry]);

  // STRICT CREATOR-ONLY FETCH:
  // Only fetch individual ballots when state.currentRole === 'creator' (MemberRole.CREATOR).
  // Regular admins, organizers, and members never query or receive individual ballots.
  useEffect(() => {
    if (!groupId || !isCreator || !pollIdsKey) return;
    const ids = pollIdsKey.split(',').filter(Boolean);
    const key = `${groupId}:creator:${pollIdsKey}`;
    return pollService.subscribeAllPollBallotsForCreator(
      groupId,
      ids,
      (map) => {
        setCreatorBallotsEntry({ key, map });
      },
      (err) => {
        onBanner?.(getFriendlyErrorMessage(err, 'Could not load Creator View ballots'));
      }
    );
  }, [groupId, isCreator, pollIdsKey, onBanner]);

  const creatorBallotsByPollId: Record<string, PollBallot[]> = useMemo(() => {
    if (!groupId || !isCreator || !pollIdsKey) return {};
    const key = `${groupId}:creator:${pollIdsKey}`;
    if (creatorBallotsEntry?.key === key) return creatorBallotsEntry.map;
    return {};
  }, [groupId, isCreator, pollIdsKey, creatorBallotsEntry]);

  const createPoll = useCallback(
    async (question: string, description: string, options: string[]): Promise<boolean> => {
      if (!groupId) return false;
      setIsMutating(true);
      try {
        await pollService.createGroupPoll(groupId, {
          question,
          description,
          options,
          authorName: currentUserName,
          authorRole: currentRole,
        });
        onBanner?.('Group poll created');
        return true;
      } catch (err) {
        onBanner?.(getFriendlyErrorMessage(err, 'Failed to create poll'));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [groupId, currentUserName, currentRole, onBanner]
  );

  const vote = useCallback(
    async (pollId: string, optionIndex: number): Promise<boolean> => {
      if (!groupId) return false;
      setIsMutating(true);
      try {
        await pollService.castPollVote(groupId, pollId, {
          userId: currentUserId,
          displayName: currentUserName,
          optionIndex,
          isGuest,
        });
        onBanner?.('Your vote was recorded anonymously');
        return true;
      } catch (err) {
        onBanner?.(getFriendlyErrorMessage(err, 'Failed to submit vote'));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [groupId, currentUserId, currentUserName, isGuest, onBanner]
  );

  const togglePollStatus = useCallback(
    async (poll: GroupPoll): Promise<void> => {
      if (!groupId) return;
      const nextStatus = poll.status === PollStatus.OPEN ? PollStatus.CLOSED : PollStatus.OPEN;
      setIsMutating(true);
      try {
        await pollService.setPollStatus(groupId, poll.id, nextStatus);
        onBanner?.(nextStatus === PollStatus.CLOSED ? 'Poll closed' : 'Poll reopened');
      } catch (err) {
        onBanner?.(getFriendlyErrorMessage(err, 'Failed to update poll status'));
      } finally {
        setIsMutating(false);
      }
    },
    [groupId, onBanner]
  );

  const deletePoll = useCallback(
    async (pollId: string): Promise<void> => {
      if (!groupId) return;
      setIsMutating(true);
      try {
        await pollService.deleteGroupPoll(groupId, pollId, isCreator);
        onBanner?.('Poll deleted');
      } catch (err) {
        onBanner?.(getFriendlyErrorMessage(err, 'Failed to delete poll'));
      } finally {
        setIsMutating(false);
      }
    },
    [groupId, isCreator, onBanner]
  );

  const canManagePollStatus = useCallback(
    (poll: GroupPoll): boolean => {
      if (isGuest) return false;
      if (poll.status === PollStatus.CLOSED) return canReopenPolls;
      return canCreatePolls;
    },
    [isGuest, canCreatePolls, canReopenPolls]
  );

  const canDeletePoll = useCallback(
    (poll: GroupPoll): boolean => {
      if (isGuest) return false;
      return canReopenPolls || poll.createdBy === currentUserId;
    },
    [isGuest, canReopenPolls, currentUserId]
  );

  return {
    pollsState,
    ownVotesByPollId,
    creatorBallotsByPollId,
    isCreator,
    canCreatePolls,
    isMutating,
    createPoll,
    vote,
    togglePollStatus,
    deletePoll,
    canManagePollStatus,
    canDeletePoll,
  };
}
