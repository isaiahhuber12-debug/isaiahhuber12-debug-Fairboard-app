import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Plus,
} from 'lucide-react';
import type { RallyWorkspaceActions, RallyWorkspaceState } from '../../hooks/useRallyWorkspace';
import {
  countdownLabel,
  dayKey,
  dayKeyFromEpoch,
  formatDateTime,
  formatMonthYear,
  formatTime,
} from '../../lib/dateFormat';
import {
  type ChatChannel,
  type EventTask,
  parseTaskStatus,
  type RallyEvent,
  ROLE_META,
  TASK_STATUS_LABELS,
  TaskStatus,
} from '../../types/rally';
import {
  DateTimePickerField,
  ModalDialog,
  ReminderEditorDialog,
} from '../RallyComponents';

interface CalendarReminderTarget {
  itemId: string;
  title: string;
  notifTitle: string;
  notifBody: string;
  targetEpochMs: number;
}

interface CalendarScreenProps {
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
}

export function CalendarScreen({ state, actions }: CalendarScreenProps) {
  const events = state.eventsState.status === 'success' ? state.eventsState.data : [];
  const channels = state.channelsState.status === 'success' ? state.channelsState.data : [];
  const selectedEvent = events.find((e) => e.id === state.selectedEventId) ?? null;

  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RallyEvent | null>(null);
  const [showCreateTaskForEventId, setShowCreateTaskForEventId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<EventTask | null>(null);
  const [reminderTarget, setReminderTarget] = useState<CalendarReminderTarget | null>(null);

  const canManage = ROLE_META[state.currentRole].canManageEventsAndTasks;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      {selectedEvent ? (
        <EventDetailView
          event={selectedEvent}
          tasks={
            state.selectedEventTasksState.status === 'success'
              ? state.selectedEventTasksState.data
              : (state.allTasksByEvent[selectedEvent.id] ?? [])
          }
          state={state}
          actions={actions}
          canManage={canManage}
          onBack={() => actions.selectEvent(null)}
          onEditEvent={() => setEditingEvent(selectedEvent)}
          onAddTask={() => setShowCreateTaskForEventId(selectedEvent.id)}
          onEditTask={(task) => setEditingTask(task)}
          onOpenReminderEditor={setReminderTarget}
        />
      ) : (
        <CalendarOverviewView
          events={events}
          state={state}
          canManage={canManage}
          onOpenCreateEvent={() => setShowCreateEventDialog(true)}
          onEditEvent={(evt) => setEditingEvent(evt)}
          onOpenReminderEditor={setReminderTarget}
          onSelectEvent={(id) => actions.selectEvent(id)}
        />
      )}

      {/* Create Event Modal */}
      <EventEditorDialog
        open={showCreateEventDialog}
        initialEvent={null}
        onClose={() => setShowCreateEventDialog(false)}
        onSave={(title, desc, loc, cat, startMs, endMs) => {
          void actions.createEvent(title, desc, loc, cat, startMs, endMs);
          setShowCreateEventDialog(false);
        }}
      />

      {/* Edit Event Modal */}
      <EventEditorDialog
        open={editingEvent !== null}
        initialEvent={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={(title, desc, loc, cat, startMs, endMs) => {
          if (editingEvent) {
            void actions.updateEvent(editingEvent.id, title, desc, loc, cat, startMs, endMs);
          }
          setEditingEvent(null);
        }}
      />

      {/* Create Task Modal */}
      <TaskEditorDialog
        open={showCreateTaskForEventId !== null}
        initialTask={null}
        channels={channels}
        onClose={() => setShowCreateTaskForEventId(null)}
        onSave={(title, desc, deadlineMs, capacity, _, channelId) => {
          if (showCreateTaskForEventId) {
            void actions.createTask(
              showCreateTaskForEventId,
              title,
              desc,
              deadlineMs,
              capacity,
              channelId
            );
          }
          setShowCreateTaskForEventId(null);
        }}
      />

      {/* Edit Task Modal */}
      <TaskEditorDialog
        open={editingTask !== null}
        initialTask={editingTask}
        channels={channels}
        onClose={() => setEditingTask(null)}
        onSave={(title, desc, deadlineMs, capacity, status, channelId) => {
          if (editingTask) {
            void actions.updateTask(
              editingTask.eventId,
              editingTask.id,
              title,
              desc,
              deadlineMs,
              capacity,
              status,
              channelId
            );
          }
          setEditingTask(null);
        }}
      />

      {/* Reminder Editor Modal */}
      <ReminderEditorDialog
        open={reminderTarget !== null}
        itemTitle={reminderTarget?.title ?? ''}
        targetEpochMs={reminderTarget?.targetEpochMs ?? 0}
        currentReminderEpochMs={
          reminderTarget ? (state.remindedTimes[reminderTarget.itemId] ?? null) : null
        }
        onClose={() => setReminderTarget(null)}
        onSave={(triggerMs) => {
          if (reminderTarget) {
            actions.scheduleOrUpdateReminder(
              reminderTarget.itemId,
              reminderTarget.notifTitle,
              reminderTarget.notifBody,
              triggerMs
            );
          }
          setReminderTarget(null);
        }}
        onRemove={() => {
          if (reminderTarget) {
            actions.removeReminder(reminderTarget.itemId);
          }
          setReminderTarget(null);
        }}
      />
    </div>
  );
}

function CalendarOverviewView({
  events,
  state,
  canManage,
  onOpenCreateEvent,
  onEditEvent,
  onOpenReminderEditor,
  onSelectEvent,
}: {
  events: RallyEvent[];
  state: RallyWorkspaceState;
  canManage: boolean;
  onOpenCreateEvent: () => void;
  onEditEvent: (evt: RallyEvent) => void;
  onOpenReminderEditor: (target: CalendarReminderTarget) => void;
  onSelectEvent: (eventId: string) => void;
}) {
  const [displayedMonthOffset, setDisplayedMonthOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + displayedMonthOffset);
    return d;
  }, [displayedMonthOffset]);

  const eventDayKeys = useMemo(
    () => new Set(events.map((e) => dayKeyFromEpoch(e.startEpochMs))),
    [events]
  );

  const filteredEvents = useMemo(
    () =>
      selectedDayKey
        ? events.filter((e) => dayKeyFromEpoch(e.startEpochMs) === selectedDayKey)
        : events,
    [events, selectedDayKey]
  );

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfWeek = monthDate.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const [nowMs] = useState(() => Date.now());
  const todayKey = dayKeyFromEpoch(nowMs);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Event Calendar</h1>
          <p className="text-xs text-[var(--rally-on-surface-variant)]">
            Browse scheduled events, filter by day, or sign up for task shifts.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onOpenCreateEvent}
            data-testid="create_event_fab"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            <span>Create Event</span>
          </button>
        )}
      </div>

      {/* Month Grid Card */}
      <div className="rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDisplayedMonthOffset((o) => o - 1)}
            data-testid="prev_month_button"
            aria-label="Previous month"
            className="rounded-xl p-2 text-[var(--rally-on-surface)] hover:bg-[var(--rally-surface-variant)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-lg font-bold">{formatMonthYear(monthDate)}</h2>
          <button
            type="button"
            onClick={() => setDisplayedMonthOffset((o) => o + 1)}
            data-testid="next_month_button"
            aria-label="Next month"
            className="rounded-xl p-2 text-[var(--rally-on-surface)] hover:bg-[var(--rally-surface-variant)]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-[var(--rally-on-surface-variant)]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - firstDayOfWeek + 1;
            if (dayNum < 1 || dayNum > daysInMonth) {
              return <div key={`empty_${idx}`} className="h-11" />;
            }
            const key = dayKey(year, month, dayNum);
            const hasEvents = eventDayKeys.has(key);
            const isSelected = key === selectedDayKey;
            const isToday = key === todayKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDayKey(isSelected ? null : key)}
                className={`flex h-11 flex-col items-center justify-center rounded-xl text-sm transition ${
                  isSelected
                    ? 'bg-[var(--rally-primary)] font-bold text-white'
                    : isToday
                      ? 'bg-[var(--rally-primary-container)]/65 font-bold text-[var(--rally-on-primary-container)]'
                      : 'text-[var(--rally-on-surface)] hover:bg-[var(--rally-surface-variant)]/50'
                }`}
              >
                <span>{dayNum}</span>
                {hasEvents && (
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-[var(--rally-secondary)]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Header */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="font-display text-lg font-bold">
          {selectedDayKey === null
            ? `All Scheduled Events (${filteredEvents.length})`
            : `Selected Day Events (${filteredEvents.length})`}
        </h2>
        {selectedDayKey !== null && (
          <button
            type="button"
            onClick={() => setSelectedDayKey(null)}
            className="rounded-lg px-3 py-1 text-xs font-semibold text-[var(--rally-primary)] hover:bg-[var(--rally-primary-container)]/40"
          >
            Show All
          </button>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl bg-[var(--rally-surface-variant)]/50 p-5 text-sm text-[var(--rally-on-surface-variant)]">
          No events scheduled for this view.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((evt) => {
            const evtTasks = state.allTasksByEvent[evt.id] ?? [];
            const reminderMs = state.remindedTimes[evt.id] ?? null;
            const isReminded = reminderMs !== null;

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectEvent(evt.id);
                }}
                data-testid={`calendar_event_${evt.id}`}
                className="cursor-pointer space-y-2 rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-4 transition hover:border-[var(--rally-primary)]/45 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-[var(--rally-primary-container)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--rally-on-primary-container)]">
                    {evt.category}
                  </span>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditEvent(evt);
                        }}
                        data-testid={`edit_event_${evt.id}`}
                        title="Edit event"
                        className="rounded-lg p-1.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenReminderEditor({
                          itemId: evt.id,
                          title: evt.title,
                          notifTitle: `Event Starting: ${evt.title}`,
                          notifBody: `${evt.location} at ${formatTime(evt.startEpochMs)}`,
                          targetEpochMs: evt.startEpochMs,
                        });
                      }}
                      data-testid={`calendar_remind_event_${evt.id}`}
                      title="Configure event reminder"
                      className="rounded-lg p-1.5 hover:bg-[var(--rally-surface-variant)]"
                    >
                      {isReminded ? (
                        <BellRing className="h-4 w-4 text-[var(--rally-secondary)]" />
                      ) : (
                        <Bell className="h-4 w-4 text-[var(--rally-on-surface-variant)]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="font-display text-lg font-bold">{evt.title}</div>
                {evt.description && (
                  <p className="text-sm text-[var(--rally-on-surface-variant)]">{evt.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--rally-on-surface-variant)]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(evt.startEpochMs)} – {formatTime(evt.endEpochMs)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {evt.location}
                  </span>
                </div>

                {reminderMs !== null && (
                  <div className="text-xs font-medium text-[var(--rally-secondary)]">
                    Reminder: {formatDateTime(reminderMs)}
                  </div>
                )}

                <div className="pt-0.5 text-xs font-semibold text-[var(--rally-primary)]">
                  {evtTasks.length === 0
                    ? 'Click to view details & tasks'
                    : `${evtTasks.length} volunteer tasks • Click to sign up`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventDetailView({
  event,
  tasks,
  state,
  actions,
  canManage,
  onBack,
  onEditEvent,
  onAddTask,
  onEditTask,
  onOpenReminderEditor,
}: {
  event: RallyEvent;
  tasks: EventTask[];
  state: RallyWorkspaceState;
  actions: RallyWorkspaceActions;
  canManage: boolean;
  onBack: () => void;
  onEditEvent: () => void;
  onAddTask: () => void;
  onEditTask: (task: EventTask) => void;
  onOpenReminderEditor: (target: CalendarReminderTarget) => void;
}) {
  const eventReminderMs = state.remindedTimes[event.id] ?? null;
  const isEventReminded = eventReminderMs !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            data-testid="event_detail_back"
            aria-label="Back to calendar"
            className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] p-2 hover:bg-[var(--rally-surface-variant)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-xl font-bold">Event & Tasks</h1>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={onEditEvent}
              data-testid="detail_edit_event_button"
              title="Edit event details"
              className="rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] p-2 text-[var(--rally-on-surface)] hover:bg-[var(--rally-surface-variant)]"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onOpenReminderEditor({
                itemId: event.id,
                title: event.title,
                notifTitle: `Event Starting: ${event.title}`,
                notifBody: `${event.location} at ${formatTime(event.startEpochMs)}`,
                targetEpochMs: event.startEpochMs,
              })
            }
            data-testid="detail_remind_event_button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--rally-surface-variant)]"
          >
            {isEventReminded ? (
              <BellRing className="h-4 w-4 text-[var(--rally-secondary)]" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            <span>{isEventReminded ? 'Edit Reminder' : 'Remind Me'}</span>
          </button>
        </div>
      </div>

      {/* Event Info Card */}
      <div className="space-y-2 rounded-3xl border border-[var(--rally-outline)]/65 bg-[var(--rally-surface)] p-5">
        <h2 className="font-display text-2xl font-bold">{event.title}</h2>
        <div className="text-sm font-semibold text-[var(--rally-primary)]">
          {formatDateTime(event.startEpochMs)} – {formatTime(event.endEpochMs)}
        </div>
        <div className="text-xs text-[var(--rally-on-surface-variant)]">
          Location: {event.location} • Lead: {event.organizerName}
        </div>
        {eventReminderMs !== null && (
          <div className="text-xs font-semibold text-[var(--rally-secondary)]">
            Reminder set for {formatDateTime(eventReminderMs)}
          </div>
        )}
        {event.description && <p className="pt-1 text-sm">{event.description}</p>}
      </div>

      {/* Tasks Header */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="font-display text-lg font-bold">Task Sign-Ups ({tasks.length})</h3>
        {canManage && (
          <button
            type="button"
            onClick={onAddTask}
            data-testid="add_task_button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            <span>Add Task</span>
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl bg-[var(--rally-surface-variant)]/50 p-5 text-sm text-[var(--rally-on-surface-variant)]">
          No tasks created for this event yet.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const claimed = task.assignedUids.includes(state.currentUserId);
            const isFull = task.assignedCount >= task.capacity;
            const taskReminderMs = state.remindedTimes[task.id] ?? null;
            const taskReminded = taskReminderMs !== null;
            const pct =
              task.capacity <= 0
                ? 0
                : Math.min(100, Math.round((task.assignedCount / task.capacity) * 100));

            return (
              <div
                key={task.id}
                className={`space-y-3 rounded-2xl border bg-[var(--rally-surface)] p-4 ${
                  claimed ? 'border-[var(--rally-tertiary)]' : 'border-[var(--rally-outline)]/65'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-bold">{task.title}</div>
                    <div className="text-xs font-medium text-[var(--rally-secondary)]">
                      Deadline: {formatDateTime(task.deadlineEpochMs)} (
                      {countdownLabel(task.deadlineEpochMs)})
                    </div>
                    {taskReminderMs !== null && (
                      <div className="text-xs font-medium text-[var(--rally-primary)]">
                        Reminder: {formatDateTime(taskReminderMs)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => onEditTask(task)}
                        data-testid={`edit_task_${task.id}`}
                        title="Edit task"
                        className="rounded-lg p-1.5 text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenReminderEditor({
                          itemId: task.id,
                          title: task.title,
                          notifTitle: `Task Deadline: ${task.title}`,
                          notifBody: `Shift deadline for ${event.title}`,
                          targetEpochMs: task.deadlineEpochMs,
                        })
                      }
                      data-testid={`remind_task_${task.id}`}
                      title="Configure task deadline reminder"
                      className="rounded-lg p-1.5 hover:bg-[var(--rally-surface-variant)]"
                    >
                      {taskReminded ? (
                        <BellRing className="h-4 w-4 text-[var(--rally-secondary)]" />
                      ) : (
                        <Bell className="h-4 w-4 text-[var(--rally-on-surface-variant)]" />
                      )}
                    </button>
                  </div>
                </div>

                {task.description && (
                  <p className="text-sm text-[var(--rally-on-surface-variant)]">
                    {task.description}
                  </p>
                )}

                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--rally-surface-variant)]">
                  <div
                    className="h-full rounded-full bg-[var(--rally-primary)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--rally-on-surface-variant)]">
                    {task.assignedCount}/{task.capacity} slots filled •{' '}
                    {TASK_STATUS_LABELS[parseTaskStatus(task.status)]}
                  </span>
                  <button
                    type="button"
                    disabled={!claimed && isFull}
                    onClick={() => void actions.toggleTaskSignup(event.id, task.id)}
                    data-testid={`task_signup_button_${task.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      claimed
                        ? 'bg-[var(--rally-tertiary-container)] text-[var(--rally-on-tertiary-container)] hover:brightness-95'
                        : 'bg-[var(--rally-primary)] text-white hover:brightness-110'
                    }`}
                  >
                    {claimed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Leave Shift</span>
                      </>
                    ) : isFull ? (
                      <span>Shift Full</span>
                    ) : (
                      <span>Sign Up</span>
                    )}
                  </button>
                </div>

                {task.assignedNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.assignedNames.map((volunteer, idx) => (
                      <span
                        key={`${volunteer}_${idx}`}
                        className="rounded-full bg-[var(--rally-surface-variant)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--rally-on-surface-variant)]"
                      >
                        {volunteer}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventEditorDialog({
  open,
  initialEvent,
  onClose,
  onSave,
}: {
  open: boolean;
  initialEvent: RallyEvent | null;
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    location: string,
    category: string,
    startEpochMs: number,
    endEpochMs: number
  ) => void;
}) {
  if (!open) return null;
  return (
    <EventEditorDialogBody
      key={initialEvent?.id ?? 'new_event'}
      initialEvent={initialEvent}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function EventEditorDialogBody({
  initialEvent,
  onClose,
  onSave,
}: {
  initialEvent: RallyEvent | null;
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    location: string,
    category: string,
    startEpochMs: number,
    endEpochMs: number
  ) => void;
}) {
  const [mountNow] = useState(() => Date.now());
  const [title, setTitle] = useState(() => initialEvent?.title ?? '');
  const [description, setDescription] = useState(() => initialEvent?.description ?? '');
  const [location, setLocation] = useState(() => initialEvent?.location ?? '');
  const [category, setCategory] = useState(() => initialEvent?.category ?? 'Main Event');
  const [startEpochMs, setStartEpochMs] = useState(
    () => initialEvent?.startEpochMs ?? mountNow + 26 * 3_600_000
  );
  const [endEpochMs, setEndEpochMs] = useState(
    () =>
      initialEvent?.endEpochMs ??
      (initialEvent?.startEpochMs ?? mountNow + 26 * 3_600_000) + 2 * 3_600_000
  );

  const canSave =
    title.trim().length >= 2 && location.trim().length >= 1 && endEpochMs > startEpochMs;

  return (
    <ModalDialog
      open
      onClose={onClose}
      title={initialEvent ? 'Edit Event & Schedule' : 'Create Calendar Event'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave(title, description, location, category, startEpochMs, endEpochMs)
            }
            data-testid="confirm_create_event_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-45"
          >
            {initialEvent ? 'Save Changes' : 'Publish Event'}
          </button>
        </>
      }
    >
      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Event Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          data-testid="event_title_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Location / Venue
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value.slice(0, 160))}
          data-testid="event_location_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Category
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value.slice(0, 40))}
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <DateTimePickerField
        label="Start Date & Time"
        epochMs={startEpochMs}
        onChange={(nextStart) => {
          setStartEpochMs(nextStart);
          if (endEpochMs <= nextStart) {
            setEndEpochMs(nextStart + 2 * 3_600_000);
          }
        }}
        testTagPrefix="event_start"
      />

      <DateTimePickerField
        label="End Date & Time"
        epochMs={endEpochMs}
        onChange={(nextEnd) => {
          setEndEpochMs(nextEnd > startEpochMs ? nextEnd : startEpochMs + 3_600_000);
        }}
        testTagPrefix="event_end"
      />
    </ModalDialog>
  );
}

function TaskEditorDialog({
  open,
  initialTask,
  channels,
  onClose,
  onSave,
}: {
  open: boolean;
  initialTask: EventTask | null;
  channels: ChatChannel[];
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    deadlineEpochMs: number,
    capacity: number,
    status: TaskStatus,
    chatChannelId: string | null
  ) => void;
}) {
  if (!open) return null;
  return (
    <TaskEditorDialogBody
      key={initialTask?.id ?? 'new_task'}
      initialTask={initialTask}
      channels={channels}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function TaskEditorDialogBody({
  initialTask,
  channels,
  onClose,
  onSave,
}: {
  initialTask: EventTask | null;
  channels: ChatChannel[];
  onClose: () => void;
  onSave: (
    title: string,
    description: string,
    deadlineEpochMs: number,
    capacity: number,
    status: TaskStatus,
    chatChannelId: string | null
  ) => void;
}) {
  const minCap = Math.max(1, initialTask?.assignedCount ?? 1);
  const [title, setTitle] = useState(() => initialTask?.title ?? '');
  const [description, setDescription] = useState(() => initialTask?.description ?? '');
  const [capacityText, setCapacityText] = useState(() => String(initialTask?.capacity ?? 5));
  const [deadlineEpochMs, setDeadlineEpochMs] = useState(
    () => initialTask?.deadlineEpochMs ?? Date.now() + 12 * 3_600_000
  );
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(() =>
    initialTask ? parseTaskStatus(initialTask.status) : TaskStatus.OPEN
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    () => initialTask?.chatChannelId ?? channels[0]?.id ?? null
  );

  const parsedCap = Math.min(50, Math.max(minCap, Number.parseInt(capacityText, 10) || minCap));

  return (
    <ModalDialog
      open
      onClose={onClose}
      title={initialTask ? 'Edit Task & Deadline' : 'Add Event Task'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={title.trim().length < 2}
            onClick={() =>
              onSave(
                title,
                description,
                deadlineEpochMs,
                parsedCap,
                selectedStatus,
                selectedChannelId
              )
            }
            data-testid="confirm_create_task_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-45"
          >
            {initialTask ? 'Save Changes' : 'Add Task'}
          </button>
        </>
      }
    >
      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Task Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          data-testid="task_title_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Instructions
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 400))}
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
          Volunteer Capacity ({minCap}–50)
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={capacityText}
          onChange={(e) => setCapacityText(e.target.value.replace(/\D/g, '').slice(0, 2))}
          data-testid="task_capacity_input"
          className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 font-mono-code text-sm focus:border-[var(--rally-primary)] focus:outline-none"
        />
      </div>

      <DateTimePickerField
        label="Task Deadline Date & Time"
        epochMs={deadlineEpochMs}
        onChange={setDeadlineEpochMs}
        testTagPrefix="task_deadline"
      />

      {initialTask && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Task Status
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(TaskStatus).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                  selectedStatus === st
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] text-[var(--rally-on-surface-variant)]'
                }`}
              >
                {TASK_STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            Linked Team Chat
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannelId(ch.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  selectedChannelId === ch.id
                    ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                    : 'border-[var(--rally-outline)] text-[var(--rally-on-surface-variant)]'
                }`}
              >
                #{ch.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
