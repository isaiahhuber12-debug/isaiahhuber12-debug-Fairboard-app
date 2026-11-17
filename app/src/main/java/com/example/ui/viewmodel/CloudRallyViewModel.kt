package com.example.ui.viewmodel

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.ChannelAccessLevel
import com.example.data.model.ChatChannel
import com.example.data.model.ChatMessage
import com.example.data.model.EngagementAnalytics
import com.example.data.model.EventTask
import com.example.data.model.GroupMember
import com.example.data.model.HubNotification
import com.example.data.model.JoinedGroupRef
import com.example.data.model.MemberRole
import com.example.data.model.MessageType
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.data.model.RallyGroup
import com.example.data.remote.RallyHubRepository
import com.example.notifications.RallyNotificationHelper
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class CloudRallyViewModel(
    private val repository: RallyHubRepository,
    private val currentUserId: String,
    private val appContext: Context
) : ViewModel(), RallyWorkspaceActions {

    private val _selectedGroupId = MutableStateFlow<String?>(null)
    private val _selectedEventId = MutableStateFlow<String?>(null)
    private val _selectedChannelId = MutableStateFlow<String?>(null)
    private val _allTasksByEvent = MutableStateFlow<Map<String, List<EventTask>>>(emptyMap())
    private val _remindedIds = MutableStateFlow<Set<String>>(emptySet())
    private val _bannerMessage = MutableStateFlow<String?>(null)
    private val _isBusy = MutableStateFlow(false)

    private val seenNotificationIds = mutableSetOf<String>()
    private var notificationsInitialized = false

    init {
        viewModelScope.launch {
            repository.ensureUserProfile()
        }
    }

    private val joinedGroupsFlow: StateFlow<List<JoinedGroupRef>> = repository.observeJoinedGroups()
        .catch { error ->
            unwrapFirestoreError(error, "Error observing joined groups")
            emit(emptyList())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), emptyList())

    private val effectiveGroupIdFlow = combine(_selectedGroupId, joinedGroupsFlow) { selected, joined ->
        when {
            selected != null && joined.any { it.groupId == selected } -> selected
            else -> joined.firstOrNull()?.groupId
        }
    }

    private val activeGroupFlow: StateFlow<RallyGroup?> = effectiveGroupIdFlow
        .flatMapLatest { groupId ->
            if (groupId == null) flowOf(null)
            else repository.observeGroup(groupId)
                .catch { error ->
                    unwrapFirestoreError(error, "Error observing group")
                    emit(null)
                }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), null)

    private val membersFlow: StateFlow<UiState<List<GroupMember>>> = effectiveGroupIdFlow
        .flatMapLatest { groupId ->
            if (groupId == null) flowOf(UiState.Success(emptyList()))
            else repository.observeMembers(groupId)
                .map<List<GroupMember>, UiState<List<GroupMember>>> { UiState.Success(it) }
                .catch { error ->
                    val msg = unwrapFirestoreError(error, "Error observing members")
                    emit(UiState.Error(msg))
                }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), UiState.Loading)

    private val currentMemberRoleFlow = combine(activeGroupFlow, membersFlow, joinedGroupsFlow) { group, membersUi, joined ->
        val members = (membersUi as? UiState.Success)?.data.orEmpty()
        val memberRole = members.firstOrNull { it.uid == currentUserId }?.parsedRole()
        when {
            group != null && group.ownerId == currentUserId -> MemberRole.CREATOR
            memberRole != null -> memberRole
            else -> joined.firstOrNull { it.groupId == group?.id }?.parsedRole() ?: MemberRole.PARTICIPANT
        }
    }

    private val eventsFlow: StateFlow<UiState<List<RallyEvent>>> = effectiveGroupIdFlow
        .flatMapLatest { groupId ->
            if (groupId == null) flowOf(UiState.Success(emptyList()))
            else repository.observeEvents(groupId)
                .map<List<RallyEvent>, UiState<List<RallyEvent>>> { UiState.Success(it) }
                .catch { error ->
                    val msg = unwrapFirestoreError(error, "Error observing events")
                    emit(UiState.Error(msg))
                }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), UiState.Loading)

    private val selectedEventTasksFlow: StateFlow<UiState<List<EventTask>>> =
        combine(effectiveGroupIdFlow, _selectedEventId) { groupId, eventId -> groupId to eventId }
            .flatMapLatest { (groupId, eventId) ->
                if (groupId == null || eventId == null) flowOf(UiState.Success(emptyList()))
                else repository.observeTasksForEvent(groupId, eventId)
                    .map<List<EventTask>, UiState<List<EventTask>>> { tasks ->
                        _allTasksByEvent.value = _allTasksByEvent.value + (eventId to tasks)
                        UiState.Success(tasks)
                    }
                    .catch { error ->
                        val msg = unwrapFirestoreError(error, "Error observing event tasks")
                        emit(UiState.Error(msg))
                    }
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), UiState.Success(emptyList()))

    // Also keep tasks loaded for up to 10 upcoming events so Dashboard & Analytics stay live
    private val allGroupTasksFlow: StateFlow<Map<String, List<EventTask>>> =
        combine(effectiveGroupIdFlow, eventsFlow) { groupId, eventsUi ->
            groupId to (eventsUi as? UiState.Success)?.data.orEmpty().take(10)
        }.flatMapLatest { (groupId, events) ->
            if (groupId == null || events.isEmpty()) flowOf(emptyMap())
            else combine(
                events.map { event ->
                    repository.observeTasksForEvent(groupId, event.id)
                        .map { event.id to it }
                        .catch { error ->
                            unwrapFirestoreError(error, "Error observing tasks for ${event.id}")
                            emit(event.id to emptyList())
                        }
                }
            ) { pairs -> pairs.toMap() }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), emptyMap())

    private val channelsFlow: StateFlow<UiState<List<ChatChannel>>> =
        combine(effectiveGroupIdFlow, currentMemberRoleFlow) { groupId, role -> groupId to role }
            .flatMapLatest { (groupId, role) ->
                if (groupId == null) flowOf(UiState.Success(emptyList()))
                else repository.observeChannels(groupId, role)
                    .map<List<ChatChannel>, UiState<List<ChatChannel>>> { UiState.Success(it) }
                    .catch { error ->
                        val msg = unwrapFirestoreError(error, "Error observing channels")
                        emit(UiState.Error(msg))
                    }
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), UiState.Loading)

    private val messagesFlow: StateFlow<UiState<List<ChatMessage>>> =
        combine(effectiveGroupIdFlow, _selectedChannelId) { groupId, channelId -> groupId to channelId }
            .flatMapLatest { (groupId, channelId) ->
                if (groupId == null || channelId == null) flowOf(UiState.Success(emptyList()))
                else repository.observeMessages(groupId, channelId)
                    .map<List<ChatMessage>, UiState<List<ChatMessage>>> { UiState.Success(it) }
                    .catch { error ->
                        val msg = unwrapFirestoreError(error, "Error observing messages")
                        emit(UiState.Error(msg))
                    }
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), UiState.Success(emptyList()))

    private val notificationsFlow: StateFlow<UiState<List<HubNotification>>> =
        combine(effectiveGroupIdFlow, currentMemberRoleFlow) { groupId, role -> groupId to role }
            .flatMapLatest { (groupId, role) ->
                if (groupId == null) flowOf(UiState.Success(emptyList()))
                else repository.observeNotifications(groupId, role)
                    .map<List<HubNotification>, UiState<List<HubNotification>>> { list ->
                        dispatchLocalAlertsForNewNotifications(list)
                        UiState.Success(list)
                    }
                    .catch { error ->
                        val msg = unwrapFirestoreError(error, "Error observing notifications")
                        emit(UiState.Error(msg))
                    }
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), UiState.Loading)

    val uiState: StateFlow<RallyWorkspaceUiState> = combine(
        joinedGroupsFlow,
        activeGroupFlow,
        currentMemberRoleFlow,
        membersFlow,
        eventsFlow,
        selectedEventTasksFlow,
        allGroupTasksFlow,
        channelsFlow,
        messagesFlow,
        notificationsFlow,
        _selectedEventId,
        _selectedChannelId,
        _remindedIds,
        _bannerMessage,
        _isBusy
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        val joinedGroups = values[0] as List<JoinedGroupRef>
        val activeGroup = values[1] as RallyGroup?
        val role = values[2] as MemberRole
        val membersUi = values[3] as UiState<List<GroupMember>>
        val eventsUi = values[4] as UiState<List<RallyEvent>>
        val selectedTasksUi = values[5] as UiState<List<EventTask>>
        val allTasksMap = values[6] as Map<String, List<EventTask>>
        val channelsUi = values[7] as UiState<List<ChatChannel>>
        val messagesUi = values[8] as UiState<List<ChatMessage>>
        val notificationsUi = values[9] as UiState<List<HubNotification>>
        val selectedEventId = values[10] as String?
        val selectedChannelId = values[11] as String?
        val remindedIds = values[12] as Set<String>
        val banner = values[13] as String?
        val isBusy = values[14] as Boolean

        val members = (membersUi as? UiState.Success)?.data.orEmpty()
        val events = (eventsUi as? UiState.Success)?.data.orEmpty()
        val channels = (channelsUi as? UiState.Success)?.data.orEmpty()
        val notifications = (notificationsUi as? UiState.Success)?.data.orEmpty()
        val allTasks = allTasksMap.values.flatten()

        val user = Firebase.auth.currentUser
        val currentMember = members.firstOrNull { it.uid == currentUserId }
        val displayName = currentMember?.displayName?.takeIf { it.isNotBlank() }
            ?: user?.displayName?.takeIf { it.isNotBlank() }
            ?: user?.email?.substringBefore("@")
            ?: "Member"

        val analytics = EngagementAnalytics(
            totalMembers = members.size,
            creatorCount = members.count { it.parsedRole() == MemberRole.CREATOR },
            adminCount = members.count { it.parsedRole() == MemberRole.ADMIN },
            organizerCount = members.count { it.parsedRole() == MemberRole.ORGANIZER },
            participantCount = members.count { it.parsedRole() == MemberRole.PARTICIPANT },
            totalEvents = events.size,
            totalTasks = allTasks.size,
            totalTaskSlots = allTasks.sumOf { it.capacity.toInt() },
            filledTaskSlots = allTasks.sumOf { it.assignedCount.toInt() },
            totalMessages = channels.sumOf { it.messageCount },
            totalNotifications = notifications.size,
            channelActivity = channels.map { it.name to it.messageCount }.sortedByDescending { it.second }.take(5)
        )

        RallyWorkspaceUiState(
            isCloudMode = true,
            currentUserId = currentUserId,
            currentUserName = displayName,
            currentUserEmail = user?.email,
            activeGroup = activeGroup,
            currentRole = role,
            joinedGroups = joinedGroups,
            eventsState = eventsUi,
            selectedEventId = selectedEventId,
            selectedEventTasksState = selectedTasksUi,
            allTasksByEvent = allTasksMap,
            channelsState = channelsUi,
            selectedChannelId = selectedChannelId,
            messagesState = messagesUi,
            notificationsState = notificationsUi,
            membersState = membersUi,
            analytics = analytics,
            remindedItemIds = remindedIds,
            bannerMessage = banner,
            isBusy = isBusy
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), RallyWorkspaceUiState(isCloudMode = true, currentUserId = currentUserId))

    private fun dispatchLocalAlertsForNewNotifications(list: List<HubNotification>) {
        if (!notificationsInitialized) {
            list.forEach { seenNotificationIds.add(it.id) }
            notificationsInitialized = true
            return
        }
        list.forEach { notif ->
            if (notif.id.isNotBlank() && seenNotificationIds.add(notif.id) && notif.senderId != currentUserId) {
                RallyNotificationHelper.postNotification(
                    context = appContext,
                    id = notif.id.hashCode(),
                    title = notif.title,
                    body = notif.body,
                    type = notif.parsedType()
                )
            }
        }
    }

    override fun selectEvent(eventId: String?) {
        _selectedEventId.value = eventId
    }

    override fun selectChannel(channelId: String?) {
        _selectedChannelId.value = channelId
    }

    override fun switchGroup(groupId: String) {
        notificationsInitialized = false
        seenNotificationIds.clear()
        _selectedEventId.value = null
        _selectedChannelId.value = null
        _selectedGroupId.value = groupId
    }

    override fun joinGroupByCode(code: String, displayName: String?) {
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.joinGroupByCode(code, displayName)
            _isBusy.value = false
            res.onSuccess { newGroupId ->
                switchGroup(newGroupId)
                _bannerMessage.value = "Joined group ${RallyHubRepository.normalizeGroupCode(code)}"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to join group"
            }
        }
    }

    override fun createGroupWithCode(name: String, description: String, groupCode: String) {
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.createGroupWithCode(name, description, groupCode)
            _isBusy.value = false
            res.onSuccess { newGroupId ->
                switchGroup(newGroupId)
                _bannerMessage.value = "Group created with code ${RallyHubRepository.normalizeGroupCode(groupCode)}"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to create group"
            }
        }
    }

    override fun updateGroupCode(newCode: String) {
        val group = uiState.value.activeGroup ?: return
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.updateGroupCode(group.id, group.groupCode, newCode, group.name)
            _isBusy.value = false
            res.onSuccess { updated ->
                _bannerMessage.value = "Group code updated to $updated"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Only the group creator can change the group code"
            }
        }
    }

    override fun createEvent(
        title: String,
        description: String,
        location: String,
        category: String,
        startEpochMs: Long,
        endEpochMs: Long
    ) {
        val state = uiState.value
        val groupId = state.activeGroup?.id ?: return
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.createEvent(
                groupId = groupId,
                title = title,
                description = description,
                location = location,
                category = category,
                startEpochMs = startEpochMs,
                endEpochMs = endEpochMs,
                organizerName = state.currentUserName
            )
            _isBusy.value = false
            res.onSuccess {
                _bannerMessage.value = "Event '$title' added to calendar"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to create event"
            }
        }
    }

    override fun createTask(
        eventId: String,
        title: String,
        description: String,
        deadlineEpochMs: Long,
        capacity: Long,
        chatChannelId: String?
    ) {
        val groupId = uiState.value.activeGroup?.id ?: return
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.createTask(
                groupId = groupId,
                eventId = eventId,
                title = title,
                description = description,
                deadlineEpochMs = deadlineEpochMs,
                capacity = capacity,
                chatChannelId = chatChannelId
            )
            _isBusy.value = false
            res.onSuccess {
                _bannerMessage.value = "Task '$title' published"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to create task"
            }
        }
    }

    override fun toggleTaskSignup(eventId: String, taskId: String) {
        val state = uiState.value
        val groupId = state.activeGroup?.id ?: return
        viewModelScope.launch {
            val res = repository.toggleTaskSignup(groupId, eventId, taskId, state.currentUserName)
            res.onSuccess { claimed ->
                _bannerMessage.value = if (claimed) "Signed up for task!" else "Removed from task shift"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Could not update task signup"
            }
        }
    }

    override fun createChannel(name: String, description: String, accessLevel: ChannelAccessLevel) {
        val groupId = uiState.value.activeGroup?.id ?: return
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.createChannel(groupId, name, description, accessLevel)
            _isBusy.value = false
            res.onSuccess {
                _bannerMessage.value = "Created #${name.trim()} channel"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to create channel"
            }
        }
    }

    override fun sendMessage(channelId: String, text: String) {
        val state = uiState.value
        val groupId = state.activeGroup?.id ?: return
        viewModelScope.launch {
            val res = repository.sendMessage(
                groupId = groupId,
                channelId = channelId,
                senderName = state.currentUserName,
                senderRole = state.currentRole,
                text = text,
                messageType = MessageType.TEXT
            )
            res.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to send message"
            }
        }
    }

    override fun sendNotification(
        title: String,
        body: String,
        type: NotificationType,
        targetScope: String,
        targetRole: String,
        targetChannelId: String?,
        targetChannelName: String?,
        targetEventId: String?
    ) {
        val state = uiState.value
        val groupId = state.activeGroup?.id ?: return
        viewModelScope.launch {
            _isBusy.value = true
            val res = repository.sendNotification(
                groupId = groupId,
                title = title,
                body = body,
                notificationType = type,
                targetScope = targetScope,
                targetRole = targetRole,
                targetChannelId = targetChannelId,
                targetChannelName = targetChannelName,
                targetEventId = targetEventId,
                senderName = state.currentUserName
            )
            _isBusy.value = false
            res.onSuccess {
                _bannerMessage.value = "Alert dispatched to ${targetChannelName ?: targetRole}"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Failed to send alert"
            }
        }
    }

    override fun updateMemberRole(memberUid: String, newRole: MemberRole) {
        val groupId = uiState.value.activeGroup?.id ?: return
        viewModelScope.launch {
            val res = repository.updateMemberRole(groupId, memberUid, newRole)
            res.onSuccess {
                _bannerMessage.value = "Updated member role to ${newRole.label}"
            }.onFailure { err ->
                _bannerMessage.value = err.localizedMessage ?: "Permission denied updating role"
            }
        }
    }

    override fun toggleReminder(itemId: String, title: String, body: String, triggerAtEpochMs: Long) {
        val current = _remindedIds.value
        if (itemId in current) {
            _remindedIds.value = current - itemId
            _bannerMessage.value = "Reminder removed"
        } else {
            _remindedIds.value = current + itemId
            RallyNotificationHelper.scheduleReminder(
                context = appContext,
                reminderId = itemId,
                title = title,
                body = body,
                triggerAtEpochMs = triggerAtEpochMs
            )
            _bannerMessage.value = "Reminder scheduled for $title"
        }
    }

    override fun clearBanner() {
        _bannerMessage.value = null
    }

    override fun leaveSession() {
        _selectedGroupId.value = null
    }

    private fun unwrapFirestoreError(error: Throwable, logLabel: String): String {
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val rootError = firestoreError ?: error
        Log.w(TAG, logLabel, rootError)
        return rootError.localizedMessage ?: "Failed to sync data"
    }

    private companion object {
        const val TAG = "CloudRallyVM"
        const val STOP_TIMEOUT_MS = 5000L
    }
}
