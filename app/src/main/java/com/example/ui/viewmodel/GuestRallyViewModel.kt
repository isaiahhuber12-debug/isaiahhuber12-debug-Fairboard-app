package com.example.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.GuestSessionEntity
import com.example.data.local.LocalChannelEntity
import com.example.data.local.LocalEventEntity
import com.example.data.local.LocalMessageEntity
import com.example.data.local.LocalNotificationEntity
import com.example.data.local.LocalRallyDao
import com.example.data.local.LocalRallyDatabase
import com.example.data.local.LocalTaskEntity
import com.example.data.model.ApprovalStatus
import com.example.data.model.ChannelAccessLevel
import com.example.data.model.ChatChannel
import com.example.data.model.ChatMessage
import com.example.data.model.EngagementAnalytics
import com.example.data.model.EventTask
import com.example.data.model.HubNotification
import com.example.data.model.MemberRole
import com.example.data.model.MessageType
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.data.model.RallyGroup
import com.example.data.model.TaskStatus
import com.example.data.remote.RallyHubRepository
import com.example.notifications.RallyNotificationHelper
import com.google.firebase.Timestamp
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Date
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class GuestRallyViewModel(
    private val dao: LocalRallyDao,
    private val appContext: Context
) : ViewModel(), RallyWorkspaceActions {

    constructor(context: Context) : this(
        LocalRallyDatabase.getInstance(context).dao(),
        context.applicationContext
    )

    private val _selectedEventId = MutableStateFlow<String?>(null)
    private val _selectedChannelId = MutableStateFlow<String?>(null)
    private val _remindedTimes = MutableStateFlow<Map<String, Long>>(emptyMap())
    private val _bannerMessage = MutableStateFlow<String?>(null)

    val activeSession: StateFlow<GuestSessionEntity?> = dao.observeLatestSession()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000L), null)

    private val eventsFlow = activeSession.flatMapLatest { session ->
        if (session == null) flowOf(emptyList())
        else dao.observeEvents(session.groupCode)
    }

    private val allTasksFlow = activeSession.flatMapLatest { session ->
        if (session == null) flowOf(emptyList())
        else dao.observeAllTasks(session.groupCode)
    }

    private val channelsFlow = activeSession.flatMapLatest { session ->
        if (session == null) flowOf(emptyList())
        else dao.observeChannels(session.groupCode)
    }

    private val messagesFlow = combine(activeSession, _selectedChannelId) { session, channelId ->
        session to channelId
    }.flatMapLatest { (session, channelId) ->
        if (session == null || channelId == null) flowOf(emptyList())
        else dao.observeMessages(session.groupCode, channelId)
    }

    private val notificationsFlow = activeSession.flatMapLatest { session ->
        if (session == null) flowOf(emptyList())
        else dao.observeNotifications(session.groupCode)
    }

    val uiState: StateFlow<RallyWorkspaceUiState> = combine(
        activeSession,
        eventsFlow,
        allTasksFlow,
        channelsFlow,
        messagesFlow,
        notificationsFlow,
        _selectedEventId,
        _selectedChannelId,
        _remindedTimes,
        _bannerMessage
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        val session = values[0] as GuestSessionEntity?
        val eventEntities = values[1] as List<LocalEventEntity>
        val taskEntities = values[2] as List<LocalTaskEntity>
        val channelEntities = values[3] as List<LocalChannelEntity>
        val messageEntities = values[4] as List<LocalMessageEntity>
        val notifEntities = values[5] as List<LocalNotificationEntity>
        val selectedEventId = values[6] as String?
        val selectedChannelId = values[7] as String?
        val remindedTimes = values[8] as Map<String, Long>
        val banner = values[9] as String?

        val events = eventEntities.map {
            RallyEvent(
                id = it.id,
                title = it.title,
                description = it.description,
                location = it.location,
                category = it.category,
                startEpochMs = it.startEpochMs,
                endEpochMs = it.endEpochMs,
                organizerName = it.organizerName
            )
        }
        val tasks = taskEntities.map { t ->
            val uids = t.assignedUidsCsv.split(",").filter { it.isNotBlank() }
            val names = t.assignedNamesCsv.split(",").filter { it.isNotBlank() }
            EventTask(
                id = t.id,
                eventId = t.eventId,
                title = t.title,
                description = t.description,
                deadlineEpochMs = t.deadlineEpochMs,
                capacity = t.capacity,
                assignedCount = t.assignedCount,
                assignedUids = uids,
                assignedNames = names,
                status = t.status
            )
        }
        val tasksByEvent = tasks.groupBy { it.eventId }
        val selectedTasks = if (selectedEventId != null) tasksByEvent[selectedEventId].orEmpty() else emptyList()

        val channels = channelEntities.map {
            ChatChannel(
                id = it.id,
                name = it.name,
                description = it.description,
                accessLevel = it.accessLevel,
                messageCount = it.messageCount,
                lastMessagePreview = it.lastMessagePreview
            )
        }
        val messages = messageEntities.map {
            ChatMessage(
                id = it.id,
                channelId = it.channelId,
                senderId = it.senderId,
                senderName = it.senderName,
                senderRole = it.senderRole,
                text = it.text,
                messageType = it.messageType,
                createdAt = Timestamp(Date(it.createdAtMs))
            )
        }
        val notifications = notifEntities.map {
            HubNotification(
                id = it.id,
                title = it.title,
                body = it.body,
                notificationType = it.notificationType,
                targetScope = it.targetScope,
                targetChannelName = it.targetChannelName,
                senderId = session?.participantId ?: "",
                senderName = it.senderName,
                scheduledForEpochMs = it.scheduledForEpochMs,
                approvalStatus = it.approvalStatus,
                createdAt = Timestamp(Date(it.createdAtMs))
            )
        }

        val group = session?.let {
            RallyGroup(
                id = it.groupCode,
                name = it.groupName,
                description = "Participant Group Session (On-Device). Sign in with Google as Admin for live cloud sync.",
                groupCode = it.groupCode
            )
        }

        val analytics = EngagementAnalytics(
            totalMembers = 1,
            participantCount = 1,
            totalEvents = events.size,
            totalTasks = tasks.size,
            totalTaskSlots = tasks.sumOf { it.capacity.toInt() },
            filledTaskSlots = tasks.sumOf { it.assignedCount.toInt() },
            totalMessages = channels.sumOf { it.messageCount },
            totalNotifications = notifications.size,
            channelActivity = channels.map { it.name to it.messageCount }
        )

        RallyWorkspaceUiState(
            isCloudMode = false,
            currentUserId = session?.participantId ?: "",
            currentUserName = session?.displayName ?: "Participant",
            activeGroup = group,
            currentRole = MemberRole.PARTICIPANT,
            eventsState = UiState.Success(events),
            selectedEventId = selectedEventId,
            selectedEventTasksState = UiState.Success(selectedTasks),
            allTasksByEvent = tasksByEvent,
            channelsState = UiState.Success(channels),
            selectedChannelId = selectedChannelId,
            messagesState = UiState.Success(messages),
            notificationsState = UiState.Success(notifications),
            membersState = UiState.Success(emptyList()),
            analytics = analytics,
            remindedItemIds = remindedTimes.keys,
            remindedTimes = remindedTimes,
            bannerMessage = banner
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000L), RallyWorkspaceUiState(isCloudMode = false))

    fun joinGuestGroup(rawCode: String, displayName: String) {
        val code = RallyHubRepository.normalizeGroupCode(rawCode)
        if (!code.matches(Regex("^[A-Z0-9_\\-]{4,24}$"))) {
            _bannerMessage.value = "Group Code must be 4–24 characters (A–Z, 0–9, -, _)."
            return
        }
        val cleanName = displayName.trim().ifBlank { "Participant" }.take(60)
        val participantId = "guest_${UUID.randomUUID().toString().take(8)}"

        viewModelScope.launch {
            dao.upsertSession(
                GuestSessionEntity(
                    groupCode = code,
                    groupName = "Group $code",
                    displayName = cleanName,
                    participantId = participantId,
                    lastActiveAtMs = System.currentTimeMillis()
                )
            )
            if (dao.countEvents(code) == 0) {
                seedInitialWorkspace(code)
            }
            _bannerMessage.value = "Joined Group $code as $cleanName"
        }
    }

    private suspend fun seedInitialWorkspace(code: String) {
        val now = System.currentTimeMillis()
        val evt1 = "evt_${code}_1"
        val evt2 = "evt_${code}_2"
        dao.insertEvents(
            listOf(
                LocalEventEntity(
                    id = evt1,
                    groupCode = code,
                    title = "Kickoff & Check-In Briefing",
                    description = "Participant orientation, badge pickup, and zone briefings.",
                    location = "Main Atrium",
                    category = "Orientation",
                    startEpochMs = now + 2 * 3_600_000L,
                    endEpochMs = now + 4 * 3_600_000L,
                    organizerName = "Lead Organizer"
                ),
                LocalEventEntity(
                    id = evt2,
                    groupCode = code,
                    title = "Community Rally & Breakouts",
                    description = "Main stage assembly followed by group workshops.",
                    location = "Hall B",
                    category = "Main Event",
                    startEpochMs = now + 26 * 3_600_000L,
                    endEpochMs = now + 29 * 3_600_000L,
                    organizerName = "Operations Team"
                )
            )
        )
        dao.insertTasks(
            listOf(
                LocalTaskEntity(
                    id = "tsk_${code}_1",
                    groupCode = code,
                    eventId = evt1,
                    title = "Registration Desk Greeter",
                    description = "Welcome participants and verify group check-in badges.",
                    deadlineEpochMs = now + 90 * 60_000L,
                    capacity = 8,
                    assignedCount = 3,
                    assignedUidsCsv = "seed_1,seed_2,seed_3",
                    assignedNamesCsv = "Jordan,Maya,Devon",
                    status = TaskStatus.OPEN.name
                ),
                LocalTaskEntity(
                    id = "tsk_${code}_2",
                    groupCode = code,
                    eventId = evt2,
                    title = "Stage AV & Mic Runner",
                    description = "Coordinate wireless mics during Q&A sessions.",
                    deadlineEpochMs = now + 24 * 3_600_000L,
                    capacity = 4,
                    assignedCount = 1,
                    assignedUidsCsv = "seed_4",
                    assignedNamesCsv = "Priya",
                    status = TaskStatus.OPEN.name
                )
            )
        )
        val chGeneral = "ch_${code}_general"
        val chVolunteers = "ch_${code}_volunteers"
        dao.insertChannels(
            listOf(
                LocalChannelEntity(
                    id = chGeneral,
                    groupCode = code,
                    name = "General Lobby",
                    description = "Group-wide coordination and updates for $code",
                    accessLevel = ChannelAccessLevel.ALL.name,
                    messageCount = 1,
                    lastMessagePreview = "Welcome to Group $code! Check the Calendar to sign up for tasks."
                ),
                LocalChannelEntity(
                    id = chVolunteers,
                    groupCode = code,
                    name = "Shift Volunteers",
                    description = "Real-time task team chat",
                    accessLevel = ChannelAccessLevel.ALL.name,
                    messageCount = 0,
                    lastMessagePreview = "Coordinate shift handoffs here"
                )
            )
        )
        dao.insertMessages(
            listOf(
                LocalMessageEntity(
                    id = "msg_${code}_welcome",
                    groupCode = code,
                    channelId = chGeneral,
                    senderId = "system_org",
                    senderName = "Group Organizer",
                    senderRole = MemberRole.ORGANIZER.name,
                    text = "Welcome to Group $code! Tap the Calendar tab to claim open task shifts and set deadline reminders.",
                    messageType = MessageType.ANNOUNCEMENT.name,
                    createdAtMs = now - 60_000L
                )
            )
        )
        dao.insertNotifications(
            listOf(
                LocalNotificationEntity(
                    id = "ntf_${code}_1",
                    groupCode = code,
                    title = "Joined Group $code (Local Mode)",
                    body = "You're viewing on-device workspace mode. Admins can sign in with Google to enable live cloud sync across Android & iOS.",
                    notificationType = NotificationType.ANNOUNCEMENT.name,
                    targetScope = "ALL",
                    targetChannelName = null,
                    senderName = "RallyHub",
                    createdAtMs = now
                )
            )
        )
    }

    override fun selectEvent(eventId: String?) { _selectedEventId.value = eventId }
    override fun selectChannel(channelId: String?) { _selectedChannelId.value = channelId }
    override fun switchGroup(groupId: String) {}
    override fun joinGroupByCode(code: String, displayName: String?) {
        joinGuestGroup(code, displayName ?: uiState.value.currentUserName)
    }
    override fun createGroupWithCode(name: String, description: String, groupCode: String) {
        _bannerMessage.value = "Sign in with Google as Admin to create cloud group codes."
    }
    override fun updateGroupCode(newCode: String) {
        _bannerMessage.value = "Only Admins or the Group Creator can modify group codes."
    }
    override fun updateGroupDetails(name: String, description: String) {
        _bannerMessage.value = "Only Admins or the Group Creator can edit group details."
    }
    override fun updateDisplayName(newDisplayName: String) {
        val session = activeSession.value ?: return
        val clean = newDisplayName.trim().take(60)
        if (clean.isEmpty()) return
        viewModelScope.launch {
            dao.upsertSession(session.copy(displayName = clean, lastActiveAtMs = System.currentTimeMillis()))
            _bannerMessage.value = "Display name updated"
        }
    }
    override fun createEvent(title: String, description: String, location: String, category: String, startEpochMs: Long, endEpochMs: Long) {
        _bannerMessage.value = "Event creation requires Organizer or Admin sign-in."
    }
    override fun updateEvent(eventId: String, title: String, description: String, location: String, category: String, startEpochMs: Long, endEpochMs: Long) {
        _bannerMessage.value = "Editing events requires Organizer or Admin sign-in."
    }
    override fun createTask(eventId: String, title: String, description: String, deadlineEpochMs: Long, capacity: Long, chatChannelId: String?) {
        _bannerMessage.value = "Task creation requires Organizer or Admin sign-in."
    }
    override fun updateTask(eventId: String, taskId: String, title: String, description: String, deadlineEpochMs: Long, capacity: Long, status: TaskStatus, chatChannelId: String?) {
        _bannerMessage.value = "Editing tasks requires Organizer or Admin sign-in."
    }

    override fun toggleTaskSignup(eventId: String, taskId: String) {
        val session = activeSession.value ?: return
        viewModelScope.launch {
            val task = dao.getTask(taskId) ?: return@launch
            val uids = task.assignedUidsCsv.split(",").filter { it.isNotBlank() }.toMutableList()
            val names = task.assignedNamesCsv.split(",").filter { it.isNotBlank() }.toMutableList()
            val claimed = session.participantId in uids
            if (claimed) {
                val idx = uids.indexOf(session.participantId)
                uids.removeAt(idx)
                if (idx in names.indices) names.removeAt(idx)
            } else {
                if (uids.size >= task.capacity) {
                    _bannerMessage.value = "Task is already full"
                    return@launch
                }
                uids.add(session.participantId)
                names.add(session.displayName)
            }
            val nextStatus = if (uids.size >= task.capacity) TaskStatus.FILLED.name else TaskStatus.OPEN.name
            dao.insertTasks(
                listOf(
                    task.copy(
                        assignedUidsCsv = uids.joinToString(","),
                        assignedNamesCsv = names.joinToString(","),
                        assignedCount = uids.size.toLong(),
                        status = nextStatus
                    )
                )
            )
            _bannerMessage.value = if (!claimed) "Signed up for ${task.title}" else "Left ${task.title}"
        }
    }

    override fun createChannel(name: String, description: String, accessLevel: ChannelAccessLevel) {
        _bannerMessage.value = "Creating new role-restricted channels requires Admin/Organizer sign-in."
    }

    override fun updateChannel(channelId: String, name: String, description: String, accessLevel: ChannelAccessLevel) {
        _bannerMessage.value = "Editing channels requires Admin/Organizer sign-in."
    }

    override fun sendMessage(channelId: String, text: String) {
        val session = activeSession.value ?: return
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            dao.insertMessages(
                listOf(
                    LocalMessageEntity(
                        id = "msg_${UUID.randomUUID().toString().take(12)}",
                        groupCode = session.groupCode,
                        channelId = channelId,
                        senderId = session.participantId,
                        senderName = session.displayName,
                        senderRole = MemberRole.PARTICIPANT.name,
                        text = trimmed,
                        messageType = MessageType.TEXT.name,
                        createdAtMs = System.currentTimeMillis()
                    )
                )
            )
            dao.getChannel(channelId)?.let { ch ->
                dao.insertChannels(
                    listOf(
                        ch.copy(
                            messageCount = ch.messageCount + 1L,
                            lastMessagePreview = trimmed.take(160)
                        )
                    )
                )
            }
        }
    }

    override fun editMessage(channelId: String, messageId: String, newText: String) {
        val session = activeSession.value ?: return
        val trimmed = newText.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            val msg = dao.getMessage(messageId) ?: return@launch
            if (msg.senderId != session.participantId) {
                _bannerMessage.value = "You can only edit your own messages."
                return@launch
            }
            dao.insertMessages(listOf(msg.copy(text = trimmed)))
            _bannerMessage.value = "Message updated"
        }
    }

    override fun deleteMessage(channelId: String, messageId: String) {
        _bannerMessage.value = "Only an Admin can delete messages."
    }

    override fun sendNotification(
        title: String,
        body: String,
        type: NotificationType,
        targetScope: String,
        targetRole: String,
        targetChannelId: String?,
        targetChannelName: String?,
        targetEventId: String?,
        scheduledForEpochMs: Long?
    ) {
        val session = activeSession.value ?: return
        if (type != NotificationType.ANNOUNCEMENT) {
            _bannerMessage.value = "Task updates and reminders require Organizer or Admin sign-in."
            return
        }
        viewModelScope.launch {
            dao.insertNotifications(
                listOf(
                    LocalNotificationEntity(
                        id = "ntf_${UUID.randomUUID().toString().take(12)}",
                        groupCode = session.groupCode,
                        title = title.trim(),
                        body = body.trim(),
                        notificationType = NotificationType.ANNOUNCEMENT.name,
                        targetScope = "ALL",
                        targetChannelName = null,
                        senderName = session.displayName,
                        scheduledForEpochMs = scheduledForEpochMs,
                        approvalStatus = ApprovalStatus.PENDING.name,
                        createdAtMs = System.currentTimeMillis()
                    )
                )
            )
            _bannerMessage.value = "Saved as Pending Admin Approval (Sign in with Google as Admin to approve & post to cloud)"
        }
    }

    override fun updateNotification(
        notificationId: String,
        title: String,
        body: String,
        type: NotificationType,
        targetScope: String,
        targetRole: String,
        targetChannelId: String?,
        targetChannelName: String?,
        targetEventId: String?,
        scheduledForEpochMs: Long?
    ) {
        _bannerMessage.value = "Editing cloud alerts requires Organizer or Admin sign-in."
    }

    override fun approveNotification(notificationId: String) {
        _bannerMessage.value = "Only a signed-in Admin can approve announcements before posting."
    }

    override fun deleteNotification(notificationId: String) {
        _bannerMessage.value = "Only an Admin can delete announcements."
    }

    override fun updateMemberRole(memberUid: String, newRole: MemberRole) {
        _bannerMessage.value = "Member permission management requires Admin sign-in."
    }

    override fun toggleReminder(itemId: String, title: String, body: String, triggerAtEpochMs: Long) {
        val current = _remindedTimes.value
        if (itemId in current) {
            removeReminder(itemId)
        } else {
            scheduleOrUpdateReminder(itemId, title, body, triggerAtEpochMs)
        }
    }

    override fun scheduleOrUpdateReminder(itemId: String, title: String, body: String, triggerAtEpochMs: Long) {
        _remindedTimes.value = _remindedTimes.value + (itemId to triggerAtEpochMs)
        RallyNotificationHelper.scheduleReminder(appContext, itemId, title, body, triggerAtEpochMs)
        _bannerMessage.value = "Reminder set for $title"
    }

    override fun removeReminder(itemId: String) {
        _remindedTimes.value = _remindedTimes.value - itemId
        _bannerMessage.value = "Reminder removed"
    }

    override fun clearBanner() { _bannerMessage.value = null }

    override fun leaveSession() {
        viewModelScope.launch {
            dao.clearSessions()
            _selectedEventId.value = null
            _selectedChannelId.value = null
        }
    }
}
