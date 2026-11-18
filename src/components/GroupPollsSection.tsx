import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Eye,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Unlock,
  Users,
  Vote,
  X,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../hooks/useRallyWorkspace';
import { useGroupPolls } from '../hooks/useGroupPolls';
import { formatDateTime } from '../lib/dateFormat';
import { POLL_CONSTRAINTS } from '../services/pollService';
import {
  type GroupPoll,
  MemberRole,
  type PollBallot,
  PollStatus,
  ROLE_META,
} from '../types/rally';
import { ConfirmDeleteDialog, ModalDialog } from './RallyComponents';

interface GroupPollsSectionProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  compact?: boolean;
  onOpenPollsTab?: () => void;
}

type PollFilter = 'ALL' | PollStatus;

export function GroupPollsSection({
  state,
  actions,
  compact = false,
  onOpenPollsTab,
}: GroupPollsSectionProps) {
  const groupId = state.activeGroup?.id ?? null;

  const {
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
  } = useGroupPolls({
    groupId,
    currentRole: state.currentRole,
    currentUserId: state.currentUserId,
    currentUserName: state.currentUserName,
    isGuest: state.isGuest,
    onBanner: actions.showBanner,
  });

  const [filter, setFilter] = useState<PollFilter>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingPoll, setDeletingPoll] = useState<GroupPoll | null>(null);

  const polls = useMemo(
    () => (pollsState.status === 'success' ? pollsState.data : []),
    [pollsState]
  );

  const filteredPolls = useMemo(() => {
    const base =
      filter === 'ALL' ? polls : polls.filter((poll) => poll.status === filter);
    return compact ? base.slice(0, 3) : base;
  }, [polls, filter, compact]);

  const openCount = useMemo(
    () => polls.filter((p) => p.status === PollStatus.OPEN).length,
    [polls]
  );

  return (
    <section data-testid="group_polls_section" className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          {compact ? (
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
                Group Polls{polls.length > 0 ? ` (${polls.length})` : ''}
              </h2>
              {openCount > 0 && (
                <span className="text-xs font-semibold text-[var(--rally-tertiary)] tabular-nums">
                  {openCount} open
                </span>
              )}
            </div>
          ) : (
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
                Group Polls
              </h1>
              <p className="text-xs text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]">
                {isCreator
                  ? 'Create polls and inspect Creator View voter breakdowns while keeping public results anonymous.'
                  : 'Vote once per poll. Public totals and percentages remain completely anonymous.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {compact && onOpenPollsTab && polls.length > 0 && (
            <button
              type="button"
              onClick={onOpenPollsTab}
              data-testid="dashboard_view_all_polls_button"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
            >
              <BarChart3 className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
              <span>{polls.length > 3 ? `All Polls (${polls.length})` : 'Open Polls'}</span>
            </button>
          )}
          {canCreatePolls && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              data-testid="create_poll_button"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>New Poll</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar (Full view when polls exist) */}
      {!compact && polls.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'ALL', label: `All (${polls.length})` },
              { id: PollStatus.OPEN, label: `Open (${openCount})` },
              { id: PollStatus.CLOSED, label: `Closed (${polls.length - openCount})` },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                data-testid={`poll_filter_${tab.id.toLowerCase()}`}
                className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading / Error / Empty / List */}
      {pollsState.status === 'loading' && (
        <div className="rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 text-xs text-[var(--rally-on-surface-variant)]">
          Loading group polls...
        </div>
      )}

      {pollsState.status === 'error' && (
        <div className="rounded-2xl border border-[var(--rally-error)]/40 bg-[var(--rally-error-container)]/50 p-4 text-xs font-semibold text-[var(--rally-error)]">
          {pollsState.message}
        </div>
      )}

      {pollsState.status === 'success' && filteredPolls.length === 0 && (
        <div className="rounded-2xl border border-[var(--rally-outline)]/60 bg-[var(--rally-surface)] p-5 text-sm text-[var(--rally-on-surface-variant)]">
          {polls.length === 0
            ? canCreatePolls
              ? 'No group polls created yet. Create a poll to gather quick anonymous votes from your members.'
              : 'No active polls in this group yet.'
            : 'No polls match the selected filter.'}
        </div>
      )}

      {pollsState.status === 'success' && filteredPolls.length > 0 && (
        <div className="space-y-3">
          {filteredPolls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              myVoteIndex={poll.id in ownVotesByPollId ? ownVotesByPollId[poll.id] : null}
              isCreator={isCreator}
              creatorBallots={isCreator ? (creatorBallotsByPollId[poll.id] ?? []) : []}
              canManageStatus={canManagePollStatus(poll)}
              canDelete={canDeletePoll(poll)}
              isMutating={isMutating}
              onVote={(optionIndex) => vote(poll.id, optionIndex)}
              onToggleStatus={() => void togglePollStatus(poll)}
              onRequestDelete={() => setDeletingPoll(poll)}
            />
          ))}
        </div>
      )}

      {/* Create Poll Modal */}
      <CreatePollModal
        open={showCreateModal}
        isBusy={isMutating}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (question, description, options) => {
          const ok = await createPoll(question, description, options);
          if (ok) setShowCreateModal(false);
          return ok;
        }}
      />

      {/* Delete Poll Confirmation */}
      <ConfirmDeleteDialog
        open={deletingPoll !== null}
        title="Delete Poll?"
        description={
          deletingPoll
            ? `Permanently delete "${deletingPoll.question}" and its ${deletingPoll.totalVotes} recorded vote(s)? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Poll"
        isBusy={isMutating}
        onCancel={() => setDeletingPoll(null)}
        onConfirm={() => {
          if (deletingPoll) {
            void deletePoll(deletingPoll.id);
          }
          setDeletingPoll(null);
        }}
      />
    </section>
  );
}

function PollCard({
  poll,
  myVoteIndex,
  isCreator,
  creatorBallots,
  canManageStatus,
  canDelete,
  isMutating,
  onVote,
  onToggleStatus,
  onRequestDelete,
}: {
  poll: GroupPoll;
  myVoteIndex: number | null;
  isCreator: boolean;
  creatorBallots: PollBallot[];
  canManageStatus: boolean;
  canDelete: boolean;
  isMutating: boolean;
  onVote: (optionIndex: number) => Promise<boolean>;
  onToggleStatus: () => void;
  onRequestDelete: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submittingVote, setSubmittingVote] = useState(false);

  const hasVoted = myVoteIndex !== null;
  const isOpen = poll.status === PollStatus.OPEN;
  const showResults = hasVoted || !isOpen || isCreator;
  const canCastVote = isOpen && !hasVoted;

  const ballotsByOption = useMemo(() => {
    const grouped: Record<number, PollBallot[]> = {};
    if (!isCreator) return grouped;
    for (const ballot of creatorBallots) {
      if (!grouped[ballot.optionIndex]) {
        grouped[ballot.optionIndex] = [];
      }
      grouped[ballot.optionIndex].push(ballot);
    }
    return grouped;
  }, [isCreator, creatorBallots]);

  const handleCastVote = async () => {
    if (!canCastVote || selectedIndex === null || submittingVote || isMutating) return;
    setSubmittingVote(true);
    try {
      const ok = await onVote(selectedIndex);
      if (ok) {
        setSelectedIndex(null);
      }
    } finally {
      setSubmittingVote(false);
    }
  };

  const authorRoleLabel =
    ROLE_META[
      (poll.createdByRole in ROLE_META
        ? poll.createdByRole
        : MemberRole.ORGANIZER) as MemberRole
    ]?.label ?? 'Organizer';

  return (
    <article
      data-testid={`poll_card_${poll.id}`}
      className="space-y-3.5 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 sm:p-5"
    >
      {/* Top Meta + Actions */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span
              data-testid={`poll_status_${poll.id}`}
              className={`font-bold uppercase tracking-wider ${
                isOpen ? 'text-[var(--rally-tertiary)]' : 'text-[var(--rally-on-surface-variant)]'
              }`}
            >
              {isOpen ? 'Open Poll' : 'Closed'}
            </span>
            <span className="text-[var(--rally-on-surface-variant)]">•</span>
            <span className="font-medium text-[var(--rally-on-surface-variant)]">
              By {poll.createdByName} ({authorRoleLabel})
            </span>
            {poll.createdAtMs > 0 && (
              <>
                <span className="text-[var(--rally-on-surface-variant)]">•</span>
                <span className="text-[var(--rally-on-surface-variant)]">
                  {formatDateTime(poll.createdAtMs)}
                </span>
              </>
            )}
          </div>
          <h3 className="font-display text-base font-bold leading-snug text-[var(--rally-on-surface)] sm:text-lg">
            {poll.question}
          </h3>
          {poll.description && (
            <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)] sm:text-sm">
              {poll.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canManageStatus && (
            <button
              type="button"
              disabled={isMutating}
              onClick={onToggleStatus}
              data-testid={`toggle_poll_status_${poll.id}`}
              title={isOpen ? 'Close poll to new votes' : 'Reopen poll'}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
            >
              {isOpen ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-[var(--rally-on-surface-variant)]" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-[var(--rally-primary)]" />
                  <span>Reopen</span>
                </>
              )}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={isMutating}
              onClick={onRequestDelete}
              data-testid={`delete_poll_${poll.id}`}
              title="Delete poll"
              aria-label="Delete poll"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--rally-error)] transition hover:bg-[var(--rally-error-container)]/55 disabled:opacity-45"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((optionLabel, idx) => {
          const count = poll.optionCounts[idx] ?? 0;
          const pct =
            poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
          const isMyVote = myVoteIndex === idx;
          const isSelected = selectedIndex === idx;
          const optionBallots = isCreator ? (ballotsByOption[idx] ?? []) : [];

          return (
            <div
              key={`${poll.id}_opt_${idx}`}
              className={`overflow-hidden rounded-xl border transition ${
                isMyVote
                  ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)]/25'
                  : isSelected && canCastVote
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)]/20'
                    : 'border-[var(--rally-outline)]/70 bg-[var(--rally-bg)]/35'
              }`}
            >
              {canCastVote ? (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  aria-pressed={isSelected}
                  data-testid={`poll_${poll.id}_option_${idx}`}
                  className="relative flex min-h-[46px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        isSelected
                          ? 'border-[var(--rally-primary)] bg-[var(--rally-primary)]'
                          : 'border-[var(--rally-outline)] bg-[var(--rally-surface)]'
                      }`}
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="text-sm font-medium text-[var(--rally-on-surface)]">
                      {optionLabel}
                    </span>
                  </div>
                  {showResults && (
                    <span className="shrink-0 font-mono-code text-xs font-semibold tabular-nums text-[var(--rally-on-surface-variant)]">
                      {count} ({pct}%)
                    </span>
                  )}
                </button>
              ) : (
                <div
                  data-testid={`poll_${poll.id}_result_${idx}`}
                  className="relative px-3.5 py-2.5"
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-300 ${
                      isMyVote
                        ? 'bg-[var(--rally-primary)]/15'
                        : 'bg-[var(--rally-surface-variant)]/55'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {isMyVote && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--rally-primary)]" />
                      )}
                      <span
                        className={`text-sm ${
                          isMyVote
                            ? 'font-bold text-[var(--rally-on-surface)]'
                            : 'font-medium text-[var(--rally-on-surface)]'
                        }`}
                      >
                        {optionLabel}
                      </span>
                      {isMyVote && (
                        <span className="shrink-0 text-[11px] font-bold text-[var(--rally-primary)]">
                          Your vote
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-mono-code text-xs tabular-nums">
                      <span className="font-bold text-[var(--rally-on-surface)]">
                        {pct}%
                      </span>
                      <span className="ml-1.5 text-[var(--rally-on-surface-variant)]">
                        ({count} {count === 1 ? 'vote' : 'votes'})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Creator-Only Breakdown Under Each Poll Option */}
              {isCreator && (
                <div
                  data-testid={`creator_view_option_${poll.id}_${idx}`}
                  className="border-t border-[var(--rally-outline)]/45 bg-[var(--rally-surface)]/80 px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--rally-secondary)]">
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    <span>Creator View: Who Voted for What</span>
                    <span className="font-mono-code tabular-nums text-[var(--rally-on-surface-variant)]">
                      ({optionBallots.length})
                    </span>
                  </div>
                  {optionBallots.length === 0 ? (
                    <p className="mt-1 text-[11px] text-[var(--rally-on-surface-variant)]">
                      No votes for this option yet.
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-medium text-[var(--rally-on-surface)]">
                      {optionBallots.map((b) => (
                        <span key={b.userId} className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3 text-[var(--rally-primary)]" />
                          <span>{b.displayName}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vote CTA or Anonymous Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rally-outline)]/45 pt-2.5">
        <div className="flex items-center gap-1.5 text-xs text-[var(--rally-on-surface-variant)]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--rally-tertiary)]" />
          <span className="tabular-nums">
            {poll.totalVotes} total {poll.totalVotes === 1 ? 'vote' : 'votes'} •{' '}
            {isCreator
              ? 'Public view is anonymous (Creator View enabled for you)'
              : 'Anonymous poll (only totals & percentages shown)'}
          </span>
        </div>

        {canCastVote && (
          <button
            type="button"
            disabled={selectedIndex === null || submittingVote || isMutating}
            onClick={() => void handleCastVote()}
            data-testid={`submit_vote_${poll.id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Vote className="h-4 w-4" />
            <span>{submittingVote ? 'Submitting...' : 'Submit Vote'}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function CreatePollModal({
  open,
  isBusy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isBusy: boolean;
  onClose: () => void;
  onSubmit: (question: string, description: string, options: string[]) => Promise<boolean>;
}) {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedOptions = options
    .map((o) => o.trim().slice(0, POLL_CONSTRAINTS.OPTION_MAX))
    .filter((o) => o.length >= POLL_CONSTRAINTS.OPTION_MIN);

  const canSubmit =
    !isBusy &&
    question.trim().length >= POLL_CONSTRAINTS.QUESTION_MIN &&
    trimmedOptions.length >= POLL_CONSTRAINTS.MIN_OPTIONS;

  const handleClose = () => {
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < POLL_CONSTRAINTS.QUESTION_MIN) {
      setErrorMsg(`Please enter a question (at least ${POLL_CONSTRAINTS.QUESTION_MIN} characters).`);
      return;
    }
    if (trimmedOptions.length < POLL_CONSTRAINTS.MIN_OPTIONS) {
      setErrorMsg(`Please enter at least ${POLL_CONSTRAINTS.MIN_OPTIONS} non-empty options.`);
      return;
    }
    setErrorMsg(null);
    const ok = await onSubmit(question, description, trimmedOptions);
    if (ok) {
      setQuestion('');
      setDescription('');
      setOptions(['', '']);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      title="Create Group Poll"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleClose}
            className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={(e) => void handleSubmit(e)}
            data-testid="confirm_create_poll_button"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-4 w-4" />
            <span>{isBusy ? 'Creating...' : 'Create Poll'}</span>
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
        <p className="text-xs leading-relaxed text-[var(--rally-on-surface-variant)]">
          Members can vote once. Public results stay completely anonymous with only counts and
          percentages visible.
        </p>

        {errorMsg && (
          <div className="rounded-xl bg-[var(--rally-secondary-container)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-secondary-container)]">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Poll Question <span className="text-[var(--rally-secondary)]">*</span>
          </label>
          <input
            type="text"
            maxLength={POLL_CONSTRAINTS.QUESTION_MAX}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Which day works best for setup?"
            data-testid="poll_question_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Context / Notes (Optional)
          </label>
          <textarea
            rows={2}
            maxLength={POLL_CONSTRAINTS.DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any extra details for voters..."
            data-testid="poll_description_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              Options ({options.length}/{POLL_CONSTRAINTS.MAX_OPTIONS})
            </label>
            {options.length < POLL_CONSTRAINTS.MAX_OPTIONS && (
              <button
                type="button"
                onClick={() => setOptions((prev) => [...prev, ''])}
                data-testid="add_poll_option_button"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Option</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={POLL_CONSTRAINTS.OPTION_MAX}
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  data-testid={`poll_option_input_${idx}`}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
                />
                {options.length > POLL_CONSTRAINTS.MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, optIdx) => optIdx !== idx))
                    }
                    aria-label={`Remove option ${idx + 1}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </ModalDialog>
  );
}
