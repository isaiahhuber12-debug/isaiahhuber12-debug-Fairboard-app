import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Megaphone,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import type { useAiCoordinator } from '../../hooks/useAiCoordinator';
import {
  NOTIFICATION_TYPE_LABELS,
  NotificationType,
  ROLE_META,
} from '../../types/rally';

interface AiCoordinatorSheetProps {
  open: boolean;
  onClose: () => void;
  ai: ReturnType<typeof useAiCoordinator>;
  workspaceState: RallyWorkspaceState;
  workspaceActions: RallyWorkspaceActions;
}

export function AiCoordinatorSheet({
  open,
  onClose,
  ai,
  workspaceState,
  workspaceActions,
}: AiCoordinatorSheetProps) {
  const [promptInput, setPromptInput] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isBusy =
    ai.streamStatus === 'loading' ||
    ai.streamStatus === 'streaming' ||
    ai.draftState.status === 'loading';

  const quickPrompts = useMemo(() => {
    if (ROLE_META[workspaceState.currentRole].canManageEventsAndTasks) {
      return [
        'Summarize schedule & open volunteer shifts',
        'Which tasks need more volunteers urgently?',
        'Suggest a check-in day coordination plan',
      ];
    }
    return [
      'What events are coming up next?',
      'Which open tasks can I join right now?',
      'Summarize recent group announcements',
    ];
  }, [workspaceState.currentRole]);

  const lastMessageText = ai.messages[ai.messages.length - 1]?.text;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.messages.length, lastMessageText]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const errorText =
    ai.streamError || (ai.draftState.status === 'error' ? ai.draftState.message : null);

  const handleAsk = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isBusy || !promptInput.trim()) return;
    const query = promptInput;
    setPromptInput('');
    void ai.askCoordinator(query, workspaceState);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Gemini AI Coordinator"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="ai_coordinator_sheet"
        className="flex h-full w-full max-w-lg flex-col border-l border-[var(--rally-outline)] bg-[var(--rally-surface)] text-[var(--rally-on-surface)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--rally-outline)]/60 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold">Gemini AI Coordinator</h2>
              <p className="truncate text-xs text-[var(--rally-on-surface-variant)]">
                Grounded in your live events, shifts, and announcements
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {ai.messages.length > 0 && (
              <button
                type="button"
                onClick={ai.clearConversation}
                data-testid="ai_clear_chat_button"
                title="Reset conversation"
                className="rounded-lg p-2 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              data-testid="ai_close_sheet_button"
              aria-label="Close Gemini AI Coordinator"
              className="rounded-lg p-2 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Error & Draft Area */}
        <div className="space-y-2 px-4 pt-3">
          {errorText && (
            <div
              data-testid="ai_error_banner"
              className="flex items-center justify-between gap-2 rounded-xl bg-[var(--rally-error-container)] px-3 py-2 text-xs font-medium text-[var(--rally-on-error-container)]"
            >
              <span>{errorText}</span>
              <button
                type="button"
                onClick={ai.clearError}
                className="shrink-0 font-bold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {ai.draftState.status === 'loading' && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--rally-primary-container)]/60 px-3 py-2.5 text-xs font-medium text-[var(--rally-on-primary-container)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating structured announcement draft...</span>
            </div>
          )}

          {ai.draftState.status === 'ready' && (
            <div
              data-testid="ai_draft_card"
              className="space-y-2 rounded-2xl border border-[var(--rally-secondary)]/50 bg-[var(--rally-secondary-container)]/60 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--rally-secondary)]">
                  AI Announcement Draft ({NOTIFICATION_TYPE_LABELS[ai.draftState.draft.type]})
                </span>
                <button
                  type="button"
                  onClick={ai.clearDraft}
                  className="text-xs font-semibold text-[var(--rally-on-surface-variant)] hover:underline"
                >
                  Discard
                </button>
              </div>
              <div className="font-display text-sm font-bold">{ai.draftState.draft.title}</div>
              <p className="text-xs">{ai.draftState.draft.body}</p>
              {(() => {
                const draft = ai.draftState.draft;
                const needsApproval = !ROLE_META[workspaceState.currentRole].canAccessAdminPanel;
                const resolvedType = needsApproval ? NotificationType.ANNOUNCEMENT : draft.type;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      void workspaceActions.sendNotification({
                        title: draft.title,
                        body: draft.body,
                        type: resolvedType,
                        targetScope: 'ALL',
                        targetRole: needsApproval ? 'ADMIN' : 'ALL',
                        targetChannelId: null,
                        targetChannelName: null,
                        targetEventId: null,
                        scheduledForEpochMs: null,
                      });
                      ai.clearDraft();
                      onClose();
                    }}
                    data-testid="ai_post_draft_button"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110"
                  >
                    <Megaphone className="h-4 w-4" />
                    <span>
                      {needsApproval
                        ? 'Submit Draft for Admin Approval'
                        : 'Post Announcement Now'}
                    </span>
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Messages / Starter Prompts */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {ai.messages.length === 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-[var(--rally-on-surface-variant)]">
                Ask Gemini about {workspaceState.activeGroup?.name ?? 'your group'}:
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((suggestion, idx) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void ai.askCoordinator(suggestion, workspaceState)}
                    data-testid={`ai_quick_prompt_${idx}`}
                    className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-2 text-left text-xs font-medium text-[var(--rally-on-surface)] transition hover:border-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/35 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            ai.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
              >
                <span className="mb-1 px-1 text-[11px] font-medium text-[var(--rally-on-surface-variant)]">
                  {msg.isUser ? 'You' : 'Gemini Coordinator'}
                </span>
                <div
                  className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.isUser
                      ? 'bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                      : 'bg-[var(--rally-surface-variant)]/70 text-[var(--rally-on-surface)]'
                  }`}
                >
                  {msg.text === '' && msg.isStreaming ? (
                    <span className="inline-flex items-center gap-2 text-xs">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Thinking...
                    </span>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input & Draft Actions */}
        <div className="space-y-2 border-t border-[var(--rally-outline)]/60 p-4">
          <form onSubmit={handleAsk} className="flex items-center gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value.slice(0, 1000))}
              disabled={isBusy}
              placeholder="Ask Gemini or enter announcement topic..."
              data-testid="ai_prompt_input"
              className="min-w-0 flex-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isBusy || !promptInput.trim()}
              data-testid="ai_send_prompt_button"
              aria-label="Ask Gemini"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary)] text-white transition hover:brightness-110 disabled:bg-[var(--rally-surface-variant)] disabled:text-[var(--rally-on-surface-variant)]"
            >
              {ai.streamStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              const topic =
                promptInput.trim() || 'Upcoming event reminder and open volunteer shifts';
              void ai.generateStructuredDraft(topic, workspaceState);
            }}
            data-testid="ai_generate_draft_button"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/40 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate Structured Announcement Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
}
