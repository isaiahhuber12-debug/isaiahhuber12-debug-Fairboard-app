package com.example.data.remote

import android.content.Context
import com.example.R
import com.example.data.model.ChannelAccessLevel
import com.example.data.model.ChatChannel
import com.example.data.model.ChatMessage
import com.example.data.model.EventTask
import com.example.data.model.GroupMember
import com.example.data.model.HubNotification
import com.example.data.model.JoinedGroupRef
import com.example.data.model.MemberRole
import com.example.data.model.MessageType
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.data.model.RallyGroup
import com.example.data.model.TaskStatus
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.UUID

class RallyHubRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("Google Sign-In required before accessing cloud data.")
    }

    suspend fun ensureUserProfile(): Result<Unit> = try {
        val user = auth.currentUser ?: error("Not signed in")
        val uid = user.uid
        val docRef = db.collection("users").document(uid)
        val snap = docRef.get().await()
        val displayName = (user.displayName?.takeIf { it.isNotBlank() }
            ?: user.email?.substringBefore("@")
            ?: "Member").take(60)
        val email = (user.email?.takeIf { it.isNotBlank() } ?: "$uid@rallyhub.app").take(160)
        if (!snap.exists()) {
            val payload = mapOf(
                "uid" to uid,
                "displayName" to displayName,
                "email" to email,
                "photoUrl" to user.photoUrl?.toString()?.take(500),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }
            docRef.set(payload).await()
        } else {
            docRef.update(
                mapOf(
                    "displayName" to displayName,
                    "email" to email,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        }
        Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        handleFirestoreError(e, OperationType.WRITE, "users/${auth.currentUser?.uid}")
        Result.failure(e)
    }

    fun observeJoinedGroups(): Flow<List<JoinedGroupRef>> = flow {
        val uid = requireUserId()
        val path = "users/$uid/joinedGroups"
        emitAll(
            db.collection("users").document(uid).collection("joinedGroups")
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        JoinedGroupRef::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.joinedAt?.seconds ?: 0L }
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    fun observeGroup(groupId: String): Flow<RallyGroup?> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId"
        emitAll(
            db.collection("groups").document(groupId)
                .snapshots()
                .map { snap ->
                    snap.toObject(
                        RallyGroup::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.GET, path, uid)
                }
        )
    }

    fun observeMembers(groupId: String): Flow<List<GroupMember>> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId/members"
        emitAll(
            db.collection("groups").document(groupId).collection("members")
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        GroupMember::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.parsedRole().rank }
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    fun observeEvents(groupId: String): Flow<List<RallyEvent>> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId/events"
        emitAll(
            db.collection("groups").document(groupId).collection("events")
                .orderBy("startEpochMs", Query.Direction.ASCENDING)
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        RallyEvent::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    fun observeTasksForEvent(groupId: String, eventId: String): Flow<List<EventTask>> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId/events/$eventId/tasks"
        emitAll(
            db.collection("groups").document(groupId)
                .collection("events").document(eventId)
                .collection("tasks")
                .orderBy("deadlineEpochMs", Query.Direction.ASCENDING)
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        EventTask::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    fun observeChannels(groupId: String, role: MemberRole): Flow<List<ChatChannel>> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId/channels"
        val allowedLevels = when (role) {
            MemberRole.CREATOR, MemberRole.ADMIN -> listOf("ALL", "ORGANIZER", "ADMIN")
            MemberRole.ORGANIZER -> listOf("ALL", "ORGANIZER")
            MemberRole.PARTICIPANT -> listOf("ALL")
        }
        emitAll(
            db.collection("groups").document(groupId).collection("channels")
                .whereIn("accessLevel", allowedLevels)
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        ChatChannel::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.lastMessageAt?.seconds ?: it.createdAt?.seconds ?: 0L }
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    fun observeMessages(groupId: String, channelId: String): Flow<List<ChatMessage>> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId/channels/$channelId/messages"
        emitAll(
            db.collection("groups").document(groupId)
                .collection("channels").document(channelId)
                .collection("messages")
                .orderBy("createdAt", Query.Direction.ASCENDING)
                .limitToLast(150)
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        ChatMessage::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    fun observeNotifications(groupId: String, role: MemberRole): Flow<List<HubNotification>> = flow {
        val uid = requireUserId()
        val path = "groups/$groupId/notifications"
        val allowedRoles = when (role) {
            MemberRole.CREATOR, MemberRole.ADMIN -> listOf("ALL", "PARTICIPANT", "ORGANIZER", "ADMIN")
            MemberRole.ORGANIZER -> listOf("ALL", "PARTICIPANT", "ORGANIZER")
            MemberRole.PARTICIPANT -> listOf("ALL", "PARTICIPANT")
        }
        emitAll(
            db.collection("groups").document(groupId).collection("notifications")
                .whereIn("targetRole", allowedRoles)
                .snapshots()
                .map { snap ->
                    snap.toObjects(
                        HubNotification::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .catch { error ->
                    rethrowOrLog(error, OperationType.LIST, path, uid)
                }
        )
    }

    suspend fun createGroupWithCode(
        groupName: String,
        description: String,
        rawGroupCode: String
    ): Result<String> {
        val normalizedCode = normalizeGroupCode(rawGroupCode)
        val groupId = "grp_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        return try {
            val uid = requireUserId()
            require(groupName.trim().length in 2..80) { "Group name must be 2–80 characters." }
            require(normalizedCode.matches(Regex("^[A-Z0-9_\\-]{4,24}$"))) {
                "Group code must be 4–24 characters (A–Z, 0–9, -, _)."
            }

            val existingCode = db.collection("groupCodes").document(normalizedCode).get().await()
            if (existingCode.exists()) {
                return Result.failure(IllegalArgumentException("Group code '$normalizedCode' is already taken."))
            }

            val displayName = (auth.currentUser?.displayName?.takeIf { it.isNotBlank() }
                ?: auth.currentUser?.email?.substringBefore("@")
                ?: "Creator").take(60)

            val batch = db.batch()
            val groupRef = db.collection("groups").document(groupId)
            batch.set(
                groupRef,
                mapOf(
                    "name" to groupName.trim(),
                    "description" to description.trim().take(500),
                    "groupCode" to normalizedCode,
                    "ownerId" to uid,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                db.collection("groupCodes").document(normalizedCode),
                mapOf(
                    "groupId" to groupId,
                    "groupName" to groupName.trim(),
                    "createdBy" to uid,
                    "active" to true,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                groupRef.collection("members").document(uid),
                mapOf(
                    "uid" to uid,
                    "displayName" to displayName,
                    "role" to MemberRole.CREATOR.name,
                    "tasksSignedUpCount" to 0L,
                    "messagesSentCount" to 0L,
                    "joinedAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.set(
                db.collection("users").document(uid).collection("joinedGroups").document(groupId),
                mapOf(
                    "groupId" to groupId,
                    "groupName" to groupName.trim(),
                    "groupCode" to normalizedCode,
                    "role" to MemberRole.CREATOR.name,
                    "joinedAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )

            // Default role-tiered channels
            val defaultChannels = listOf(
                Triple("general", "General Lobby", ChannelAccessLevel.ALL.name to "Community announcements & participant Q&A"),
                Triple("organizers", "Event Organizers", ChannelAccessLevel.ORGANIZER.name to "Shift leads, logistics & task coordination"),
                Triple("admins", "Admin Command", ChannelAccessLevel.ADMIN.name to "Private admin coordination & permissions")
            )
            defaultChannels.forEach { (idSuffix, title, levelPair) ->
                batch.set(
                    groupRef.collection("channels").document("ch_$idSuffix"),
                    mapOf(
                        "name" to title,
                        "description" to levelPair.second,
                        "accessLevel" to levelPair.first,
                        "createdBy" to uid,
                        "messageCount" to 0L,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }

            batch.commit().await()
            Result.success(groupId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, "groups/$groupId")
            Result.failure(e)
        }
    }

    suspend fun updateGroupCode(
        groupId: String,
        oldCode: String,
        newRawCode: String,
        groupName: String
    ): Result<String> {
        val newCode = normalizeGroupCode(newRawCode)
        return try {
            val uid = requireUserId()
            require(newCode.matches(Regex("^[A-Z0-9_\\-]{4,24}$"))) {
                "Group code must be 4–24 characters (A–Z, 0–9, -, _)."
            }
            if (newCode == oldCode) return Result.success(newCode)

            val existing = db.collection("groupCodes").document(newCode).get().await()
            if (existing.exists()) {
                return Result.failure(IllegalArgumentException("Group code '$newCode' is already in use."))
            }

            val batch = db.batch()
            if (oldCode.isNotBlank()) {
                batch.delete(db.collection("groupCodes").document(oldCode))
            }
            batch.set(
                db.collection("groupCodes").document(newCode),
                mapOf(
                    "groupId" to groupId,
                    "groupName" to groupName.trim().take(80),
                    "createdBy" to uid,
                    "active" to true,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.update(
                db.collection("groups").document(groupId),
                mapOf(
                    "groupCode" to newCode,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.update(
                db.collection("users").document(uid).collection("joinedGroups").document(groupId),
                mapOf(
                    "groupCode" to newCode,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            Result.success(newCode)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, "groups/$groupId")
            Result.failure(e)
        }
    }

    suspend fun joinGroupByCode(rawCode: String, displayNameOverride: String? = null): Result<String> {
        val code = normalizeGroupCode(rawCode)
        return try {
            val uid = requireUserId()
            require(code.matches(Regex("^[A-Z0-9_\\-]{4,24}$"))) {
                "Enter a valid 4–24 character Group Code."
            }
            val codeSnap = db.collection("groupCodes").document(code).get().await()
            if (!codeSnap.exists() || codeSnap.getBoolean("active") == false) {
                return Result.failure(IllegalArgumentException("No active group found for code '$code'."))
            }
            val groupId = codeSnap.getString("groupId")
                ?: return Result.failure(IllegalStateException("Group code is missing target group."))
            val groupName = codeSnap.getString("groupName") ?: "RallyHub Group"

            val memberRef = db.collection("groups").document(groupId).collection("members").document(uid)
            val existingMember = memberRef.get().await()
            val resolvedRole = if (existingMember.exists()) {
                existingMember.getString("role") ?: MemberRole.PARTICIPANT.name
            } else {
                MemberRole.PARTICIPANT.name
            }
            val displayName = (displayNameOverride?.trim()?.takeIf { it.isNotBlank() }
                ?: auth.currentUser?.displayName?.takeIf { it.isNotBlank() }
                ?: auth.currentUser?.email?.substringBefore("@")
                ?: "Participant").take(60)

            val batch = db.batch()
            if (!existingMember.exists()) {
                batch.set(
                    memberRef,
                    mapOf(
                        "uid" to uid,
                        "displayName" to displayName,
                        "role" to MemberRole.PARTICIPANT.name,
                        "tasksSignedUpCount" to 0L,
                        "messagesSentCount" to 0L,
                        "joinedAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }
            batch.set(
                db.collection("users").document(uid).collection("joinedGroups").document(groupId),
                mapOf(
                    "groupId" to groupId,
                    "groupName" to groupName,
                    "groupCode" to code,
                    "role" to resolvedRole,
                    "joinedAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()
            Result.success(groupId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, "groupCodes/$code")
            Result.failure(e)
        }
    }

    suspend fun updateMemberRole(
        groupId: String,
        targetMemberUid: String,
        newRole: MemberRole
    ): Result<Unit> {
        val path = "groups/$groupId/members/$targetMemberUid"
        return try {
            requireUserId()
            require(newRole != MemberRole.CREATOR) { "Creator role cannot be assigned." }
            db.document(path).update(
                mapOf(
                    "role" to newRole.name,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun createEvent(
        groupId: String,
        title: String,
        description: String,
        location: String,
        category: String,
        startEpochMs: Long,
        endEpochMs: Long,
        organizerName: String
    ): Result<String> {
        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "").take(14)}"
        val path = "groups/$groupId/events/$eventId"
        return try {
            val uid = requireUserId()
            require(title.trim().length in 2..100) { "Event title must be 2–100 characters." }
            require(location.trim().length in 1..160) { "Location is required." }
            require(endEpochMs >= startEpochMs) { "End time must be after start time." }

            db.document(path).set(
                mapOf(
                    "title" to title.trim(),
                    "description" to description.trim().take(1000),
                    "location" to location.trim(),
                    "category" to category.trim().ifBlank { "General" }.take(40),
                    "startEpochMs" to startEpochMs,
                    "endEpochMs" to endEpochMs,
                    "createdBy" to uid,
                    "organizerName" to organizerName.trim().ifBlank { "Organizer" }.take(60),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(eventId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun createTask(
        groupId: String,
        eventId: String,
        title: String,
        description: String,
        deadlineEpochMs: Long,
        capacity: Long,
        chatChannelId: String? = null
    ): Result<String> {
        val taskId = "tsk_${UUID.randomUUID().toString().replace("-", "").take(14)}"
        val path = "groups/$groupId/events/$eventId/tasks/$taskId"
        return try {
            val uid = requireUserId()
            require(title.trim().length in 2..100) { "Task title must be 2–100 characters." }
            require(capacity in 1L..50L) { "Capacity must be between 1 and 50." }

            val payload = mapOf(
                "eventId" to eventId,
                "title" to title.trim(),
                "description" to description.trim().take(600),
                "deadlineEpochMs" to deadlineEpochMs,
                "capacity" to capacity,
                "assignedCount" to 0L,
                "assignedUids" to emptyList<String>(),
                "assignedNames" to emptyList<String>(),
                "status" to TaskStatus.OPEN.name,
                "chatChannelId" to chatChannelId?.takeIf { it.isNotBlank() },
                "createdBy" to uid,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.document(path).set(payload).await()
            Result.success(taskId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun toggleTaskSignup(
        groupId: String,
        eventId: String,
        taskId: String,
        memberDisplayName: String
    ): Result<Boolean> {
        val path = "groups/$groupId/events/$eventId/tasks/$taskId"
        return try {
            val uid = requireUserId()
            val taskRef = db.document(path)
            val signedUpNow = db.runTransaction { tx ->
                val snap = tx.get(taskRef)
                val capacity = snap.getLong("capacity") ?: 1L
                val status = snap.getString("status") ?: TaskStatus.OPEN.name
                if (status == TaskStatus.COMPLETED.name) {
                    throw IllegalStateException("Task is already completed.")
                }
                val currentUids = (snap.get("assignedUids") as? List<*>)
                    ?.filterIsInstance<String>()
                    ?.toMutableList() ?: mutableListOf()
                val currentNames = (snap.get("assignedNames") as? List<*>)
                    ?.filterIsInstance<String>()
                    ?.toMutableList() ?: mutableListOf()

                val isClaimed = uid in currentUids
                if (isClaimed) {
                    val idx = currentUids.indexOf(uid)
                    currentUids.removeAt(idx)
                    if (idx in currentNames.indices) currentNames.removeAt(idx)
                    tx.update(
                        taskRef,
                        mapOf(
                            "assignedUids" to currentUids,
                            "assignedNames" to currentNames,
                            "assignedCount" to currentUids.size.toLong(),
                            "status" to TaskStatus.OPEN.name,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                    false
                } else {
                    if (currentUids.size >= capacity) {
                        throw IllegalStateException("This task shift is already full.")
                    }
                    currentUids.add(uid)
                    currentNames.add(memberDisplayName.take(60))
                    val nextStatus = if (currentUids.size >= capacity) TaskStatus.FILLED.name else TaskStatus.OPEN.name
                    tx.update(
                        taskRef,
                        mapOf(
                            "assignedUids" to currentUids,
                            "assignedNames" to currentNames,
                            "assignedCount" to currentUids.size.toLong(),
                            "status" to nextStatus,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                    true
                }
            }.await()

            // Non-blocking activity counter increment
            try {
                val delta = if (signedUpNow) 1L else -1L
                val memberRef = db.collection("groups").document(groupId).collection("members").document(uid)
                val memberSnap = memberRef.get().await()
                val cur = memberSnap.getLong("tasksSignedUpCount") ?: 0L
                val nextCount = maxOf(0L, cur + delta)
                memberRef.update(
                    mapOf(
                        "tasksSignedUpCount" to nextCount,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } catch (_: Exception) {
                // Analytics counter is best-effort
            }

            Result.success(signedUpNow)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun createChannel(
        groupId: String,
        name: String,
        description: String,
        accessLevel: ChannelAccessLevel,
        eventId: String? = null
    ): Result<String> {
        val channelId = "ch_${UUID.randomUUID().toString().replace("-", "").take(12)}"
        val path = "groups/$groupId/channels/$channelId"
        return try {
            val uid = requireUserId()
            require(name.trim().length in 2..60) { "Channel name must be 2–60 characters." }

            val payload = mapOf(
                "name" to name.trim(),
                "description" to description.trim().take(300),
                "accessLevel" to accessLevel.name,
                "eventId" to eventId?.takeIf { it.isNotBlank() },
                "createdBy" to uid,
                "messageCount" to 0L,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.document(path).set(payload).await()
            Result.success(channelId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun sendMessage(
        groupId: String,
        channelId: String,
        senderName: String,
        senderRole: MemberRole,
        text: String,
        messageType: MessageType = MessageType.TEXT
    ): Result<Unit> {
        val msgId = "msg_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        val msgPath = "groups/$groupId/channels/$channelId/messages/$msgId"
        return try {
            val uid = requireUserId()
            val trimmed = text.trim()
            require(trimmed.length in 1..2000) { "Message must be 1–2000 characters." }

            val channelRef = db.collection("groups").document(groupId).collection("channels").document(channelId)
            val msgRef = channelRef.collection("messages").document(msgId)

            val batch = db.batch()
            batch.set(
                msgRef,
                mapOf(
                    "channelId" to channelId,
                    "senderId" to uid,
                    "senderName" to senderName.take(60),
                    "senderRole" to senderRole.name,
                    "text" to trimmed,
                    "messageType" to messageType.name,
                    "createdAt" to FieldValue.serverTimestamp()
                )
            )
            batch.update(
                channelRef,
                mapOf(
                    "messageCount" to FieldValue.increment(1),
                    "lastMessagePreview" to trimmed.take(160),
                    "lastMessageAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()

            try {
                db.collection("groups").document(groupId).collection("members").document(uid)
                    .update(
                        mapOf(
                            "messagesSentCount" to FieldValue.increment(1),
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    ).await()
            } catch (_: Exception) {
            }

            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, msgPath)
            Result.failure(e)
        }
    }

    suspend fun sendNotification(
        groupId: String,
        title: String,
        body: String,
        notificationType: NotificationType,
        targetScope: String,
        targetRole: String,
        targetChannelId: String? = null,
        targetChannelName: String? = null,
        targetEventId: String? = null,
        senderName: String,
        scheduledForEpochMs: Long? = null
    ): Result<String> {
        val notifId = "ntf_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        val path = "groups/$groupId/notifications/$notifId"
        return try {
            val uid = requireUserId()
            require(title.trim().length in 2..100) { "Notification title must be 2–100 characters." }
            require(body.trim().length in 2..600) { "Notification body must be 2–600 characters." }

            val payload = mapOf(
                "title" to title.trim(),
                "body" to body.trim(),
                "notificationType" to notificationType.name,
                "targetScope" to targetScope,
                "targetRole" to targetRole,
                "targetChannelId" to targetChannelId?.takeIf { it.isNotBlank() },
                "targetChannelName" to targetChannelName?.takeIf { it.isNotBlank() },
                "targetEventId" to targetEventId?.takeIf { it.isNotBlank() },
                "senderId" to uid,
                "senderName" to senderName.take(60),
                "scheduledForEpochMs" to scheduledForEpochMs,
                "createdAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.document(path).set(payload).await()
            Result.success(notifId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    private fun rethrowOrLog(
        error: Throwable,
        operationType: OperationType,
        path: String,
        expectedUid: String
    ): Nothing {
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val exceptionToLog = firestoreError ?: (error as? Exception)
        if (exceptionToLog != null && auth.currentUser?.uid == expectedUid) {
            handleFirestoreError(exceptionToLog, operationType, path)
        }
        throw error
    }

    companion object {
        fun normalizeGroupCode(raw: String): String =
            raw.trim().uppercase().replace(" ", "-")
    }
}
