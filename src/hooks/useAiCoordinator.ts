import { useCallback, useState } from 'react';
import type { RallyWorkspaceState } from './useRallyWorkspace';
import { formatDateTime, formatTime } from '../lib/dateFormat';
import {
  type AiAnnouncementDraft,
  type AiChatMessage,
  ApprovalStatus,
  CHANNEL_ACCESS_LABELS,
  NOTIFICATION_TYPE_LABELS,
  parseApprovalStatus,
  parseChannelAccessLevel,
  parseNotificationType,
  ROLE_META,
} from '../types/rally';

export type AiStreamStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error';
export type AiDraftStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; draft: AiAnnouncementDraft }
  | { status: 'error'; message: string };

function buildWorkspaceContextPrompt(workspace: RallyWorkspaceState): string {
  const group = workspace.activeGroup;
  const events = workspace.eventsState.status === 'success' ? workspace.eventsState.data : [];
  const channels = workspace.channelsState.status === 'success' ? workspace.channelsState.data : [];
  const notifications = (
    workspace.notificationsState.status === 'success' ? workspace.notificationsState.data : []
  ).filter((n) => parseApprovalStatus(n.approvalStatus) === ApprovalStatus.APPROVED);

  const lines: string[] = [
    '=== Active RallyHub Group Context ===',
    `Group Name: ${group?.name ?? 'RallyHub Group'}`,
  ];
  if (group?.description) {
    lines.push(`Description: ${group.description}`);
  }
  lines.push(`Group Invite Code: ${group?.groupCode ?? 'N/A'}`);
  lines.push(
    `User Name: ${workspace.currentUserName} | Role: ${ROLE_META[workspace.currentRole].label}`
  );
  lines.push(
    `Analytics: ${workspace.analytics.totalMembers} members, ` +
      `${workspace.analytics.totalEvents} events, ` +
      `${workspace.analytics.filledTaskSlots}/${workspace.analytics.totalTaskSlots} volunteer slots filled ` +
      `(${workspace.analytics.fillRatePercent}%)`
  );

  if (events.length > 0) {
    lines.push('\nUpcoming Events:');
    for (const evt of events.slice(0, 8)) {
      const tasks = workspace.allTasksByEvent[evt.id] ?? [];
      lines.push(
        `- ${evt.title} (${evt.category}) at ${evt.location} | ` +
          `${formatDateTime(evt.startEpochMs)} to ${formatTime(evt.endEpochMs)}`
      );
      for (const t of tasks.slice(0, 5)) {
        lines.push(
          `  * Task '${t.title}': ${t.assignedCount}/${t.capacity} filled, ` +
            `deadline ${formatDateTime(t.deadlineEpochMs)}`
        );
      }
    }
  }

  if (channels.length > 0) {
    lines.push(
      '\nChannels: ' +
        channels
          .map((c) => `#${c.name} (${CHANNEL_ACCESS_LABELS[parseChannelAccessLevel(c.accessLevel)]})`)
          .join(', ')
    );
  }

  if (notifications.length > 0) {
    lines.push('\nRecent Approved Alerts:');
    for (const notif of notifications.slice(0, 5)) {
      const label = NOTIFICATION_TYPE_LABELS[parseNotificationType(notif.notificationType)];
      lines.push(`- [${label}] ${notif.title}: ${notif.body}`);
    }
  }

  return lines.join('\n');
}

export function useAiCoordinator() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [streamStatus, setStreamStatus] = useState<AiStreamStatus>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<AiDraftStatus>({ status: 'idle' });

  const askCoordinator = useCallback(
    async (userPrompt: string, workspaceState: RallyWorkspaceState) => {
      const trimmed = userPrompt.trim();
      if (!trimmed) return;
      if (streamStatus === 'loading' || streamStatus === 'streaming') return;

      const userMsg: AiChatMessage = {
        id: crypto.randomUUID(),
        isUser: true,
        text: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const placeholder: AiChatMessage = {
        id: assistantId,
        isUser: false,
        text: '',
        isStreaming: true,
      };

      const priorHistory = messages.slice(-6).map((m) => ({
        isUser: m.isUser,
        text: m.text,
      }));

      setMessages((prev) => [...prev, userMsg, placeholder]);
      setStreamStatus('loading');
      setStreamError(null);

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            contextPrompt: buildWorkspaceContextPrompt(workspaceState),
            history: priorHistory,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        if (!res.body) {
          throw new Error('Streaming response body unavailable.');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const evt of events) {
            const line = evt
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!line) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            const payload = JSON.parse(jsonStr) as {
              text?: string;
              done?: boolean;
              error?: string;
            };
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (payload.text) {
              accumulated += payload.text;
              setStreamStatus('streaming');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: accumulated, isStreaming: true } : m
                )
              );
            }
          }
        }

        const finalText = accumulated.trim();
        if (!finalText) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setStreamStatus('error');
          setStreamError('Gemini returned an empty response.');
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: finalText, isStreaming: false } : m
            )
          );
          setStreamStatus('success');
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setStreamStatus('error');
        setStreamError(
          err instanceof Error ? err.message : 'Unable to reach Gemini right now.'
        );
      }
    },
    [messages, streamStatus]
  );

  const generateStructuredDraft = useCallback(
    async (topicPrompt: string, workspaceState: RallyWorkspaceState) => {
      const trimmed = topicPrompt.trim();
      if (!trimmed) return;
      setDraftState({ status: 'loading' });

      try {
        const res = await fetch('/api/ai/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: trimmed,
            contextPrompt: buildWorkspaceContextPrompt(workspaceState),
          }),
        });
        const data = (await res.json()) as {
          title?: string;
          body?: string;
          type?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        if (!data.title || !data.body) {
          throw new Error('Generated draft was missing a title or body.');
        }
        setDraftState({
          status: 'ready',
          draft: {
            title: data.title,
            body: data.body,
            type: parseNotificationType(data.type),
          },
        });
      } catch (err) {
        setDraftState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to generate announcement draft.',
        });
      }
    },
    []
  );

  const clearDraft = useCallback(() => setDraftState({ status: 'idle' }), []);
  const clearError = useCallback(() => {
    setStreamError(null);
    if (streamStatus === 'error') setStreamStatus('idle');
    setDraftState((prev) => (prev.status === 'error' ? { status: 'idle' } : prev));
  }, [streamStatus]);
  const clearConversation = useCallback(() => {
    setMessages([]);
    setStreamStatus('idle');
    setStreamError(null);
  }, []);

  return {
    messages,
    streamStatus,
    streamError,
    draftState,
    askCoordinator,
    generateStructuredDraft,
    clearDraft,
    clearError,
    clearConversation,
  };
}
