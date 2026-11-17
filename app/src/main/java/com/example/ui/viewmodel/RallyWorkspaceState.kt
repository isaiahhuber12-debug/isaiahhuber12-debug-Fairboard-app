package com.example.ui.viewmodel

import com.example.data.model.ChannelAccessLevel
import com.example.data.model.ChatChannel
import com.example.data.model.ChatMessage
import com.example.data.model.EngagementAnalytics
import com.example.data.model.EventTask
import com.example.data.model.GroupMember
import com.example.data.model.HubNotification
import com.example.data.model.JoinedGroupRef
import com.example.data.model.MemberRole
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.data.model.RallyGroup

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

data class RallyWorkspaceUiState(
    val isCloudMode: Boolean = false,
    val currentUserId: String = "",
    val currentUserName: String = "Participant",
    val currentUserEmail: String? = null,
    val activeGroup: RallyGroup? = null,
    val currentRole: MemberRole = MemberRole.PARTICIPANT,
    val joinedGroups: List<JoinedGroupRef> = emptyList(),
    val eventsState: UiState<List<RallyEvent>> = UiState.Loading,
    val selectedEventId: String? = null,
    val selectedEventTasksState: UiState<List<EventTask>> = UiState.Success(emptyList()),
    val allTasksByEvent: Map<String, List<EventTask>> = emptyMap(),
    val channelsState: UiState<List<ChatChannel>> = UiState.Loading,
    val selectedChannelId: String? = null,
    val messagesState: UiState<List<ChatMessage>> = UiState.Success(emptyList()),
    val notificationsState: UiState<List<HubNotification>> = UiState.Loading,
    val membersState: UiState<List<GroupMember>> = UiState.Success(emptyList()),
    val analytics: EngagementAnalytics = EngagementAnalytics(),
    val remindedItemIds: Set<String> = emptySet(),
    val bannerMessage: String? = null,
    val isBusy: Boolean = false
)

interface RallyWorkspaceActions {
    fun selectEvent(eventId: String?)
    fun selectChannel(channelId: String?)
    fun switchGroup(groupId: String)
    fun joinGroupByCode(code: String, displayName: String?)
    fun createGroupWithCode(name: String, description: String, groupCode: String)
    fun updateGroupCode(newCode: String)
    fun createEvent(
        title: String,
        description: String,
        location: String,
        category: String,
        startEpochMs: Long,
        endEpochMs: Long
    )
    fun createTask(
        eventId: String,
        title: String,
        description: String,
        deadlineEpochMs: Long,
        capacity: Long,
        chatChannelId: String?
    )
    fun toggleTaskSignup(eventId: String, taskId: String)
    fun createChannel(name: String, description: String, accessLevel: ChannelAccessLevel)
    fun sendMessage(channelId: String, text: String)
    fun sendNotification(
        title: String,
        body: String,
        type: NotificationType,
        targetScope: String,
        targetRole: String,
        targetChannelId: String?,
        targetChannelName: String?,
        targetEventId: String?
    )
    fun updateMemberRole(memberUid: String, newRole: MemberRole)
    fun toggleReminder(itemId: String, title: String, body: String, triggerAtEpochMs: Long)
    fun clearBanner()
    fun leaveSession()
}
