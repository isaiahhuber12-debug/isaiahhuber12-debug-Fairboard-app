package com.example.data.model

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

enum class MemberRole(val label: String, val rank: Int) {
    PARTICIPANT("Participant", 1),
    ORGANIZER("Organizer", 2),
    ADMIN("Admin", 3),
    CREATOR("Creator", 4);

    val canManageEventsAndTasks: Boolean get() = rank >= ORGANIZER.rank
    val canSendTargetedUpdates: Boolean get() = rank >= ORGANIZER.rank
    val canSendGlobalAnnouncements: Boolean get() = rank >= ADMIN.rank
    val canAccessAdminPanel: Boolean get() = rank >= ADMIN.rank
    val canCreateAdmins: Boolean get() = rank >= ADMIN.rank
    val isCreator: Boolean get() = this == CREATOR

    companion object {
        fun fromRaw(raw: String?): MemberRole =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: PARTICIPANT
    }
}

enum class ChannelAccessLevel(val label: String) {
    ALL("All Members"),
    ORGANIZER("Organizers & Admins"),
    ADMIN("Admins Only");

    companion object {
        fun fromRaw(raw: String?): ChannelAccessLevel =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: ALL
    }
}

enum class TaskStatus(val label: String) {
    OPEN("Open"),
    FILLED("Filled"),
    COMPLETED("Completed");

    companion object {
        fun fromRaw(raw: String?): TaskStatus =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: OPEN
    }
}

enum class NotificationType(val label: String) {
    ANNOUNCEMENT("Announcement"),
    TASK_UPDATE("Task Update"),
    DEADLINE_REMINDER("Deadline Reminder");

    companion object {
        fun fromRaw(raw: String?): NotificationType =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: ANNOUNCEMENT
    }
}

enum class MessageType {
    TEXT,
    ANNOUNCEMENT,
    TASK_UPDATE;

    companion object {
        fun fromRaw(raw: String?): MessageType =
            entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: TEXT
    }
}

@Keep
@IgnoreExtraProperties
data class UserProfile(
    @DocumentId val id: String = "",
    val uid: String = "",
    val displayName: String = "",
    val email: String = "",
    val photoUrl: String? = null,
    val activeGroupId: String? = null,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class JoinedGroupRef(
    @DocumentId val id: String = "",
    val groupId: String = "",
    val groupName: String = "",
    val groupCode: String = "",
    val role: String = MemberRole.PARTICIPANT.name,
    @ServerTimestamp val joinedAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun parsedRole(): MemberRole = MemberRole.fromRaw(role)
}

@Keep
@IgnoreExtraProperties
data class GroupCodeEntry(
    @DocumentId val code: String = "",
    val groupId: String = "",
    val groupName: String = "",
    val createdBy: String = "",
    val active: Boolean = true,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class RallyGroup(
    @DocumentId val id: String = "",
    val name: String = "",
    val description: String = "",
    val groupCode: String = "",
    val ownerId: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class GroupMember(
    @DocumentId val id: String = "",
    val uid: String = "",
    val displayName: String = "",
    val role: String = MemberRole.PARTICIPANT.name,
    val tasksSignedUpCount: Long = 0L,
    val messagesSentCount: Long = 0L,
    @ServerTimestamp val joinedAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun parsedRole(): MemberRole = MemberRole.fromRaw(role)
}

@Keep
@IgnoreExtraProperties
data class RallyEvent(
    @DocumentId val id: String = "",
    val title: String = "",
    val description: String = "",
    val location: String = "",
    val category: String = "General",
    val startEpochMs: Long = 0L,
    val endEpochMs: Long = 0L,
    val createdBy: String = "",
    val organizerName: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class EventTask(
    @DocumentId val id: String = "",
    val eventId: String = "",
    val title: String = "",
    val description: String = "",
    val deadlineEpochMs: Long = 0L,
    val capacity: Long = 1L,
    val assignedCount: Long = 0L,
    val assignedUids: List<String> = emptyList(),
    val assignedNames: List<String> = emptyList(),
    val status: String = TaskStatus.OPEN.name,
    val chatChannelId: String? = null,
    val createdBy: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun parsedStatus(): TaskStatus = TaskStatus.fromRaw(status)
}

@Keep
@IgnoreExtraProperties
data class ChatChannel(
    @DocumentId val id: String = "",
    val name: String = "",
    val description: String = "",
    val accessLevel: String = ChannelAccessLevel.ALL.name,
    val eventId: String? = null,
    val createdBy: String = "",
    val messageCount: Long = 0L,
    val lastMessagePreview: String? = null,
    val lastMessageAt: Timestamp? = null,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun parsedAccessLevel(): ChannelAccessLevel = ChannelAccessLevel.fromRaw(accessLevel)
}

@Keep
@IgnoreExtraProperties
data class ChatMessage(
    @DocumentId val id: String = "",
    val channelId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val senderRole: String = MemberRole.PARTICIPANT.name,
    val text: String = "",
    val messageType: String = MessageType.TEXT.name,
    @ServerTimestamp val createdAt: Timestamp? = null
) {
    fun parsedRole(): MemberRole = MemberRole.fromRaw(senderRole)
    fun parsedType(): MessageType = MessageType.fromRaw(messageType)
}

@Keep
@IgnoreExtraProperties
data class HubNotification(
    @DocumentId val id: String = "",
    val title: String = "",
    val body: String = "",
    val notificationType: String = NotificationType.ANNOUNCEMENT.name,
    val targetScope: String = "ALL",
    val targetRole: String = "ALL",
    val targetChannelId: String? = null,
    val targetChannelName: String? = null,
    val targetEventId: String? = null,
    val senderId: String = "",
    val senderName: String = "",
    val scheduledForEpochMs: Long? = null,
    @ServerTimestamp val createdAt: Timestamp? = null
) {
    fun parsedType(): NotificationType = NotificationType.fromRaw(notificationType)
}

data class EngagementAnalytics(
    val totalMembers: Int = 0,
    val creatorCount: Int = 0,
    val adminCount: Int = 0,
    val organizerCount: Int = 0,
    val participantCount: Int = 0,
    val totalEvents: Int = 0,
    val totalTasks: Int = 0,
    val totalTaskSlots: Int = 0,
    val filledTaskSlots: Int = 0,
    val totalMessages: Long = 0L,
    val totalNotifications: Int = 0,
    val channelActivity: List<Pair<String, Long>> = emptyList()
) {
    val fillRatePercent: Int
        get() = if (totalTaskSlots <= 0) 0 else ((filledTaskSlots * 100f) / totalTaskSlots).toInt().coerceIn(0, 100)
}
