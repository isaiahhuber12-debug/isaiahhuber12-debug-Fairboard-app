import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import { formatTime } from '../../lib/dateFormat';
import {
  CHANNEL_ACCESS_LABELS,
  ChannelAccessLevel,
  type ChatChannel,
  type ChatMessage,
  MessageType,
  parseChannelAccessLevel,
  parseMemberRole,
  parseMessageType,
  ROLE_META,
} from '../../types/rally';
import { ConfirmDeleteDialog, ModalDialog, RoleBadge } from '../RallyComponents';

interface ChatsScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
}

export function ChatsScreen({ state, actions }: ChatsScreenProps) {
  const channels = state.channelsState.status === 'success' ? state.channelsState.data : [];
  const activeChannel = channels.find((c) => c.id === state.selectedChannelId) ?? null;

  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false);
  const [duplicatingChannel, setDuplicatingChannel] = useState<ChatChannel | null>(null);
  const [editingChannel, setEditingChannel] = useState<ChatChannel | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<ChatChannel | null>(null);

  const canManageChannels = ROLE_META[state.currentRole].canManageEventsAndTasks;
  const isAdminOrCreator = ROLE_META[state.currentRole].canAccessAdminPanel;
  const smsMessagesActive = state.smsPreferences.enabled && state.smsPreferences.forMessages;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      {activeChannel ? (
        <ChatThreadView
          channel={activeChannel}
          messages={state.messagesState.status === 'success' ? state.messagesState.data : []}
          currentUid={state.currentUserId}
          canManageChannel={canManageChannels}
          canDeleteChannel={isAdminOrCreator}
          canDeleteMessages={isAdminOrCreator}
          smsMessagesActive={smsMessagesActive}
          onBack={() => actions.selectChannel(null)}
          onEditChannel={() => setEditingChannel(activeChannel)}
          onDeleteChannel={() => setDeletingChannel(activeChannel)}
          onSendMessage={(text) => void actions.sendMessage(activeChannel.id, text)}
          onEditMessage={(msgId, newText) =>
            void actions.editMessage(activeChannel.id, msgId, newText)
          }
          onDeleteMessage={(msgId) => void actions.deleteMessage(activeChannel.id, msgId)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--rally-canvas-text,var(--rally-on-surface))]">
                Group Channels
              </h1>
              <p className="text-xs text-[var(--rally-canvas-text-muted,var(--rally-on-surface-variant))]">
                {isAdminOrCreator
                  ? 'Create, customize, and delete different messaging groups after use.'
                  : canManageChannels
                    ? 'Role-scoped messaging channels for participants and teams.'
                    : 'Message teams in channels you belong to.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {smsMessagesActive && (
                <span
                  data-testid="chats_sms_active_badge"
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--rally-tertiary-container)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--rally-on-tertiary-container)]"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>SMS Push On</span>
                </span>
              )}
              {canManageChannels && (
                <button
                  type="button"
                  onClick={() => setShowCreateChannelDialog(true)}
                  data-testid="create_channel_fab"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Channel</span>
                </button>
              )}
            </div>
          </div>

          {channels.length === 0 ? (
            <div className="rounded-2xl bg-[var(--rally-surface-variant)]/50 p-5 text-sm text-[var(--rally-on-surface-variant)]">
              No channels available for your role yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {channels.map((channel) => {
                const level = parseChannelAccessLevel(channel.accessLevel);
                return (
                  <div
                    key={channel.id}
                    onClick={() => actions.selectChannel(channel.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') actions.selectChannel(channel.id);
                    }}
                    data-testid={`channel_card_${channel.id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 transition hover:border-[var(--rally-primary)]/45 hover:shadow-sm"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]">
                      {level === ChannelAccessLevel.ALL ? (
                        <MessageSquare className="h-5 w-5" />
                      ) : (
                        <Lock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold">#{channel.name}</span>
                        <span className="rounded-md bg-[var(--rally-surface-variant)] px-2 py-0.5 text-[11px] font-medium text-[var(--rally-on-surface-variant)]">
                          {CHANNEL_ACCESS_LABELS[level]}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--rally-on-surface-variant)]">
                        {channel.lastMessagePreview?.trim() || channel.description}
                      </p>
                    </div>
                    <span className="font-mono-code text-xs font-bold text-[var(--rally-primary)]">
                      {channel.messageCount}
                    </span>
                    {canManageChannels && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDuplicatingChannel(channel);
                            setShowCreateChannelDialog(true);
                          }}
                          data-testid={`duplicate_channel_${channel.id}`}
                          title="Duplicate channel"
                          className="rounded-lg p-1.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChannel(channel);
                          }}
                          data-testid={`edit_channel_${channel.id}`}
                          title="Edit channel"
                          className="rounded-lg p-1.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isAdminOrCreator && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingChannel(channel);
                            }}
                            data-testid={`delete_channel_${channel.id}`}
                            title="Delete channel after usage"
                            className="rounded-lg p-1.5 text-[var(--rally-error)] hover:bg-[var(--rally-error)]/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Channel Dialog */}
      <ChannelEditorDialog
        open={showCreateChannelDialog}
        initialChannel={null}
        prefillChannel={duplicatingChannel}
        canUseAdminLevel={isAdminOrCreator}
        isBusy={state.isBusy}
        onClose={() => {
          setShowCreateChannelDialog(false);
          setDuplicatingChannel(null);
        }}
        onSave={(name, desc, level) => {
          void actions.createChannel(name, desc, level);
          setShowCreateChannelDialog(false);
          setDuplicatingChannel(null);
        }}
        onSaveAndAnother={(name, desc, level) => actions.createChannel(name, desc, level)}
      />

      {/* Edit Channel Dialog */}
      <ChannelEditorDialog
        open={editingChannel !== null}
        initialChannel={editingChannel}
        canUseAdminLevel={isAdminOrCreator}
        isBusy={state.isBusy}
        onClose={() => setEditingChannel(null)}
        onSave={(name, desc, level) => {
          if (editingChannel) {
            void actions.updateChannel(editingChannel.id, name, desc, level);
          }
          setEditingChannel(null);
        }}
      />

      {/* Delete Channel Confirmation Dialog */}
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
    </div>
  );
}

function ChatThreadView({
  channel,
  messages,
  currentUid,
  canManageChannel,
  canDeleteChannel,
  canDeleteMessages,
  smsMessagesActive,
  onBack,
  onEditChannel,
  onDeleteChannel,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
}: {
  channel: ChatChannel;
  messages: ChatMessage[];
  currentUid: string;
  canManageChannel: boolean;
  canDeleteChannel: boolean;
  canDeleteMessages: boolean;
  smsMessagesActive: boolean;
  onBack: () => void;
  onEditChannel: () => void;
  onDeleteChannel: () => void;
  onSendMessage: (text: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onDeleteMessage: (messageId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [messageToEdit, setMessageToEdit] = useState<ChatMessage | null>(null);
  const [editedText, setEditedText] = useState('');
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(draft);
    setDraft('');
  };

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[460px] flex-col overflow-hidden rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] shadow-sm md:h-[calc(100vh-7.5rem)]">
      {/* Thread Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--rally-outline)]/50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            data-testid="chat_back_button"
            aria-label="Back to channels"
            className="rounded-xl p-2 hover:bg-[var(--rally-surface-variant)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-base font-bold">#{channel.name}</span>
              {smsMessagesActive && (
                <span className="hidden items-center gap-1 rounded-md bg-[var(--rally-tertiary-container)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rally-on-tertiary-container)] sm:inline-flex">
                  <Smartphone className="h-3 w-3" />
                  SMS
                </span>
              )}
            </div>
            <div className="truncate text-xs text-[var(--rally-on-surface-variant)]">
              {CHANNEL_ACCESS_LABELS[parseChannelAccessLevel(channel.accessLevel)]} •{' '}
              {channel.description}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canManageChannel && (
            <button
              type="button"
              onClick={onEditChannel}
              data-testid="edit_active_channel_button"
              title="Edit channel details"
              className="rounded-xl p-2 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDeleteChannel && (
            <button
              type="button"
              onClick={onDeleteChannel}
              data-testid="delete_active_channel_button"
              title="Delete channel after usage"
              className="rounded-xl p-2 text-[var(--rally-error)] hover:bg-[var(--rally-error)]/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--rally-on-surface-variant)]">
            Start the conversation in #{channel.name}
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUid;
            const isAnnouncement = parseMessageType(msg.messageType) === MessageType.ANNOUNCEMENT;
            const canEdit = isMe || canDeleteMessages;
            const bubbleClass = isAnnouncement
              ? 'bg-[var(--rally-secondary-container)] text-[var(--rally-on-secondary-container)]'
              : isMe
                ? 'bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                : 'border border-[var(--rally-outline)]/55 bg-[var(--rally-surface)] text-[var(--rally-on-surface)]';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <RoleBadge role={parseMemberRole(msg.senderRole)} />
                  <span className="text-[11px] text-[var(--rally-on-surface-variant)]">
                    {formatTime(msg.createdAtMs)}
                  </span>
                  {msg.updatedAtMs && (
                    <span className="text-[11px] text-[var(--rally-on-surface-variant)]">
                      • Edited
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isMe && (canEdit || canDeleteMessages) && (
                    <MessageActions
                      messageId={msg.id}
                      canEdit={canEdit}
                      canDelete={canDeleteMessages}
                      onEdit={() => {
                        setEditedText(msg.text);
                        setMessageToEdit(msg);
                      }}
                      onDelete={() => setMessageToDelete(msg)}
                    />
                  )}
                  <div
                    className={`max-w-[340px] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[440px] ${bubbleClass}`}
                  >
                    {msg.text}
                  </div>
                  {!isMe && (canEdit || canDeleteMessages) && (
                    <MessageActions
                      messageId={msg.id}
                      canEdit={canEdit}
                      canDelete={canDeleteMessages}
                      onEdit={() => {
                        setEditedText(msg.text);
                        setMessageToEdit(msg);
                      }}
                      onDelete={() => setMessageToDelete(msg)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-[var(--rally-outline)]/50 bg-[var(--rally-surface)] p-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          placeholder={`Message #${channel.name}`}
          data-testid="chat_message_input"
          className="min-w-0 flex-1 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          data-testid="send_message_button"
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rally-primary)] text-white transition hover:brightness-110 disabled:bg-[var(--rally-surface-variant)] disabled:text-[var(--rally-on-surface-variant)]"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Edit Message Modal */}
      <ModalDialog
        open={messageToEdit !== null}
        onClose={() => setMessageToEdit(null)}
        title="Edit Message"
        footer={
          <>
            <button
              type="button"
              onClick={() => setMessageToEdit(null)}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!editedText.trim()}
              onClick={() => {
                if (messageToEdit) onEditMessage(messageToEdit.id, editedText);
                setMessageToEdit(null);
              }}
              data-testid="confirm_edit_message_button"
              className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-45"
            >
              Save
            </button>
          </>
        }
      >
        <textarea
          rows={4}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value.slice(0, 2000))}
          data-testid="edit_message_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </ModalDialog>

      {/* Delete Message Modal */}
      <ModalDialog
        open={messageToDelete !== null}
        onClose={() => setMessageToDelete(null)}
        title="Delete Message"
        footer={
          <>
            <button
              type="button"
              onClick={() => setMessageToDelete(null)}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (messageToDelete) onDeleteMessage(messageToDelete.id);
                setMessageToDelete(null);
              }}
              data-testid="confirm_delete_message_button"
              className="rounded-xl bg-[var(--rally-error)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm">
          Delete this message from {messageToDelete?.senderName}? This action cannot be undone.
        </p>
      </ModalDialog>
    </div>
  );
}

function MessageActions({
  messageId,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  messageId: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center">
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          data-testid={`edit_message_${messageId}`}
          title="Edit message"
          className="rounded-lg p-1 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          data-testid={`delete_message_${messageId}`}
          title="Delete message"
          className="rounded-lg p-1 text-[var(--rally-error)] hover:bg-[var(--rally-error-container)]/50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ChannelEditorDialog({
  open,
  initialChannel,
  prefillChannel = null,
  canUseAdminLevel,
  isBusy = false,
  onClose,
  onSave,
  onSaveAndAnother,
}: {
  open: boolean;
  initialChannel: ChatChannel | null;
  prefillChannel?: ChatChannel | null;
  canUseAdminLevel: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, accessLevel: ChannelAccessLevel) => void;
  onSaveAndAnother?: (
    name: string,
    description: string,
    accessLevel: ChannelAccessLevel
  ) => Promise<boolean>;
}) {
  if (!open) return null;
  return (
    <ChannelEditorDialogBody
      key={initialChannel?.id ?? (prefillChannel ? `dup_${prefillChannel.id}` : 'new_channel')}
      initialChannel={initialChannel}
      prefillChannel={prefillChannel}
      canUseAdminLevel={canUseAdminLevel}
      isBusy={isBusy}
      onClose={onClose}
      onSave={onSave}
      onSaveAndAnother={onSaveAndAnother}
    />
  );
}

function ChannelEditorDialogBody({
  initialChannel,
  prefillChannel = null,
  canUseAdminLevel,
  isBusy = false,
  onClose,
  onSave,
  onSaveAndAnother,
}: {
  initialChannel: ChatChannel | null;
  prefillChannel?: ChatChannel | null;
  canUseAdminLevel: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, accessLevel: ChannelAccessLevel) => void;
  onSaveAndAnother?: (
    name: string,
    description: string,
    accessLevel: ChannelAccessLevel
  ) => Promise<boolean>;
}) {
  const seed = initialChannel ?? prefillChannel;
  const [name, setName] = useState(() =>
    initialChannel
      ? initialChannel.name
      : prefillChannel
        ? `${prefillChannel.name} Copy`.slice(0, 60)
        : ''
  );
  const [description, setDescription] = useState(() => seed?.description ?? '');
  const [accessLevel, setAccessLevel] = useState<ChannelAccessLevel>(() =>
    seed ? parseChannelAccessLevel(seed.accessLevel) : ChannelAccessLevel.ALL
  );
  const [addedCount, setAddedCount] = useState(0);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const availableLevels = canUseAdminLevel
    ? [ChannelAccessLevel.ALL, ChannelAccessLevel.ORGANIZER, ChannelAccessLevel.ADMIN]
    : [ChannelAccessLevel.ALL, ChannelAccessLevel.ORGANIZER];

  const canSubmit = !isBusy && name.trim().length >= 2;

  const handleCreateAnother = async () => {
    if (!canSubmit || !onSaveAndAnother) return;
    const ok = await onSaveAndAnother(name, description, accessLevel);
    if (ok) {
      setName('');
      setDescription('');
      setAddedCount((c) => c + 1);
      window.setTimeout(() => nameInputRef.current?.focus(), 20);
    }
  };

  return (
    <ModalDialog
      open
      onClose={onClose}
      title={initialChannel ? 'Edit Group Chat' : 'Create Group Chat'}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            {addedCount > 0 && !initialChannel ? 'Done' : 'Cancel'}
          </button>
          {!initialChannel && onSaveAndAnother && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleCreateAnother()}
              data-testid="confirm_create_another_channel_button"
              className="rounded-xl border border-[var(--rally-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/50 disabled:opacity-45"
            >
              Create &amp; Add Another
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSave(name, description, accessLevel)}
            data-testid="confirm_create_channel_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-45"
          >
            {initialChannel ? 'Save Changes' : 'Create Channel'}
          </button>
        </div>
      }
    >
      {addedCount > 0 && !initialChannel && (
        <div className="rounded-xl bg-[var(--rally-tertiary-container)] px-3.5 py-2 text-xs font-semibold text-[var(--rally-on-tertiary-container)]">
          Created {addedCount} channel{addedCount === 1 ? '' : 's'} — add another channel below.
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Channel Name
        </label>
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          data-testid="channel_name_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Purpose / Topic
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 240))}
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Role Access Level
        </div>
        <div className="flex flex-col gap-1.5">
          {availableLevels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setAccessLevel(lvl)}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                accessLevel === lvl
                  ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                  : 'border-[var(--rally-outline)] hover:bg-[var(--rally-surface-variant)]/50'
              }`}
            >
              {CHANNEL_ACCESS_LABELS[lvl]}
            </button>
          ))}
        </div>
      </div>
    </ModalDialog>
  );
}
