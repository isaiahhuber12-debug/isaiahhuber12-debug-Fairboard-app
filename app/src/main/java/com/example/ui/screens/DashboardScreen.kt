package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.Group
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.data.model.ApprovalStatus
import com.example.data.model.EventTask
import com.example.data.model.GroupMember
import com.example.data.model.HubNotification
import com.example.data.model.MemberRole
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.ui.components.GroupCodePill
import com.example.ui.components.MetricStatTile
import com.example.ui.components.RallyDateFormat
import com.example.ui.components.ReminderEditorDialog
import com.example.ui.components.RoleBadge
import com.example.ui.theme.AmberContainer
import com.example.ui.theme.AmberWarning
import com.example.ui.theme.CobaltPrimary
import com.example.ui.theme.CobaltPrimaryDark
import com.example.ui.theme.CoralSecondary
import com.example.ui.theme.EmeraldTertiary
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.example.ui.viewmodel.UiState

@Composable
fun DashboardScreen(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    onOpenEvent: (String) -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenAiCoordinator: () -> Unit,
    onRequestAdminSignIn: (() -> Unit)? = null,
    onCopiedCode: () -> Unit,
    modifier: Modifier = Modifier
) {
    val group = uiState.activeGroup
    val events = (uiState.eventsState as? UiState.Success)?.data.orEmpty()
    val members = (uiState.membersState as? UiState.Success)?.data.orEmpty()
    val leadershipMembers = remember(members) {
        members.filter { it.parsedRole() == MemberRole.CREATOR || it.parsedRole() == MemberRole.ADMIN }
    }
    val notifications = (uiState.notificationsState as? UiState.Success)?.data.orEmpty()
    val latestAnnouncement = notifications.firstOrNull {
        it.parsedType() == NotificationType.ANNOUNCEMENT && it.parsedApprovalStatus() == ApprovalStatus.APPROVED
    } ?: notifications.firstOrNull { it.parsedApprovalStatus() == ApprovalStatus.APPROVED }

    val pendingCount = if (uiState.currentRole.canAccessAdminPanel) {
        notifications.count { it.parsedApprovalStatus() == ApprovalStatus.PENDING }
    } else 0

    val allTasks = uiState.allTasksByEvent.values.flatten()
    val openTasks = allTasks.filter { it.assignedCount < it.capacity }.take(4)

    var reminderEvent by remember { mutableStateOf<RallyEvent?>(null) }
    var deleteSpotlightNotif by remember { mutableStateOf<HubNotification?>(null) }
    var showEditNameDialog by remember { mutableStateOf(false) }
    var showAllMembers by remember { mutableStateOf(false) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.fillMaxSize()
    ) {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .widthIn(max = 840.dp)
                .fillMaxSize()
        ) {
            // Live Group Header Banner
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(Brush.linearGradient(listOf(CobaltPrimary, CobaltPrimaryDark)))
                        .padding(20.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = if (uiState.isCloudMode) Icons.Rounded.CloudDone else Icons.Rounded.CloudOff,
                                    contentDescription = null,
                                    tint = Color.White.copy(alpha = 0.85f),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = if (uiState.isCloudMode) "Live Cloud Sync" else "Local Participant Mode",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                            }
                            RoleBadge(role = uiState.currentRole)
                        }

                        Text(
                            text = group?.name ?: "RallyHub Group",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White
                        )

                        if (!group?.description.isNullOrBlank()) {
                            Text(
                                text = group?.description.orEmpty(),
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.86f),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        if (leadershipMembers.isNotEmpty()) {
                            val leaderSummary = leadershipMembers.joinToString(", ") { member ->
                                if (member.uid == uiState.currentUserId) "${member.displayName} (You)"
                                else member.displayName
                            }
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.testTag("dashboard_header_admin_summary")
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Shield,
                                    contentDescription = null,
                                    tint = Color.White.copy(alpha = 0.9f),
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = "Admin: $leaderSummary",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color.White.copy(alpha = 0.94f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = "Signed in as ${uiState.currentUserName}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color.White.copy(alpha = 0.92f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                IconButton(
                                    onClick = { showEditNameDialog = true },
                                    modifier = Modifier.testTag("edit_display_name_button")
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Edit,
                                        contentDescription = "Edit display name",
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            if (group != null) {
                                GroupCodePill(code = group.groupCode, onCopied = onCopiedCode)
                            }
                            if (!uiState.isCloudMode && onRequestAdminSignIn != null) {
                                FilledTonalButton(
                                    onClick = onRequestAdminSignIn,
                                    modifier = Modifier.testTag("dashboard_admin_signin_button")
                                ) {
                                    Text("Admin Sign-In")
                                }
                            }
                        }
                    }
                }
            }

            // Gemini AI Coordinator Callout Card
            item {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f),
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onOpenAiCoordinator)
                        .testTag("dashboard_ai_coordinator_card")
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.padding(14.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.AutoAwesome,
                                contentDescription = null,
                                tint = CobaltPrimary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "Gemini AI Coordinator",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Summarize events, spot open shifts, or draft announcements with Gemini.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        Spacer(Modifier.width(8.dp))
                        FilledTonalButton(
                            onClick = onOpenAiCoordinator,
                            modifier = Modifier.testTag("dashboard_open_ai_button")
                        ) {
                            Text("Ask AI")
                        }
                    }
                }
            }

            // Admin Pending Approval Banner
            if (pendingCount > 0) {
                item {
                    Surface(
                        color = AmberContainer,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onOpenNotifications)
                            .testTag("dashboard_pending_approval_banner")
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.padding(14.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.HourglassTop,
                                    contentDescription = null,
                                    tint = AmberWarning
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    text = "$pendingCount member announcement(s) waiting for Admin approval",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            TextButton(onClick = onOpenNotifications) {
                                Text("Review")
                            }
                        }
                    }
                }
            }

            // Metrics Grid
            item {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    MetricStatTile(
                        label = "Members",
                        value = uiState.analytics.totalMembers.toString(),
                        accent = CobaltPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    MetricStatTile(
                        label = "Events",
                        value = uiState.analytics.totalEvents.toString(),
                        accent = EmeraldTertiary,
                        modifier = Modifier.weight(1f)
                    )
                    MetricStatTile(
                        label = "Fill Rate",
                        value = "${uiState.analytics.fillRatePercent}%",
                        accent = CoralSecondary,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Group Admins & Members Roster (visible to all roles)
            item {
                GroupRosterCard(
                    membersState = uiState.membersState,
                    currentUserId = uiState.currentUserId,
                    expanded = showAllMembers,
                    onToggleExpand = { showAllMembers = !showAllMembers }
                )
            }

            // Latest Pinned Approved Announcement
            if (latestAnnouncement != null) {
                item {
                    AnnouncementSpotlightCard(
                        notification = latestAnnouncement,
                        canDelete = uiState.currentRole.canAccessAdminPanel,
                        onDelete = { deleteSpotlightNotif = latestAnnouncement },
                        onClick = onOpenNotifications
                    )
                }
            }

            // Upcoming Events
            item {
                Text(
                    text = "Upcoming Events",
                    style = MaterialTheme.typography.titleLarge
                )
            }

            if (events.isEmpty()) {
                item {
                    EmptyDashboardCard(
                        message = if (uiState.currentRole.canManageEventsAndTasks)
                            "No events scheduled yet. Open the Calendar tab to create your first event."
                        else
                            "No upcoming events posted by organizers yet."
                    )
                }
            } else {
                items(events.take(4), key = { it.id }) { event ->
                    UpcomingEventCard(
                        event = event,
                        tasks = uiState.allTasksByEvent[event.id].orEmpty(),
                        isReminded = event.id in uiState.remindedItemIds,
                        remindedAtMs = uiState.remindedTimes[event.id],
                        onRemindClick = { reminderEvent = event },
                        onClick = { onOpenEvent(event.id) }
                    )
                }
            }

            // Open Volunteer Tasks
            item {
                Text(
                    text = "Open Tasks Needing Sign-Ups",
                    style = MaterialTheme.typography.titleLarge
                )
            }

            if (openTasks.isEmpty()) {
                item {
                    EmptyDashboardCard("All current event tasks are filled or none are posted yet.")
                }
            } else {
                items(openTasks, key = { it.id }) { task ->
                    QuickTaskCard(
                        task = task,
                        currentUid = uiState.currentUserId,
                        onToggleSignup = { actions.toggleTaskSignup(task.eventId, task.id) }
                    )
                }
            }
        }
    }

    reminderEvent?.let { target ->
        ReminderEditorDialog(
            itemTitle = target.title,
            targetEpochMs = target.startEpochMs,
            currentReminderEpochMs = uiState.remindedTimes[target.id],
            onDismiss = { reminderEvent = null },
            onSave = { triggerMs ->
                actions.scheduleOrUpdateReminder(
                    itemId = target.id,
                    title = "Event Starting: ${target.title}",
                    body = "Location: ${target.location} (${RallyDateFormat.formatTime(target.startEpochMs)})",
                    triggerAtEpochMs = triggerMs
                )
                reminderEvent = null
            },
            onRemove = {
                actions.removeReminder(target.id)
                reminderEvent = null
            }
        )
    }

    deleteSpotlightNotif?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteSpotlightNotif = null },
            title = { Text("Delete Announcement") },
            text = { Text("Delete \"${target.title}\"? Only Admins can delete announcements.") },
            confirmButton = {
                Button(
                    onClick = {
                        actions.deleteNotification(target.id)
                        deleteSpotlightNotif = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.testTag("confirm_delete_spotlight_button")
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteSpotlightNotif = null }) { Text("Cancel") }
            }
        )
    }

    if (showEditNameDialog) {
        var nameInput by remember(uiState.currentUserName) { mutableStateOf(uiState.currentUserName) }
        AlertDialog(
            onDismissRequest = { showEditNameDialog = false },
            title = { Text("Edit Your Display Name") },
            text = {
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it.take(50) },
                    label = { Text("Display Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("edit_display_name_input")
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        actions.updateDisplayName(nameInput)
                        showEditNameDialog = false
                    },
                    enabled = nameInput.trim().length >= 2,
                    modifier = Modifier.testTag("confirm_display_name_button")
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditNameDialog = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun AnnouncementSpotlightCard(
    notification: HubNotification,
    canDelete: Boolean,
    onDelete: () -> Unit,
    onClick: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.65f),
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag("announcement_spotlight")
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            modifier = Modifier.padding(16.dp)
        ) {
            Icon(
                imageVector = Icons.Rounded.Campaign,
                contentDescription = null,
                modifier = Modifier.size(24.dp)
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = notification.body,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "From ${notification.senderName}",
                    style = MaterialTheme.typography.labelMedium
                )
            }
            if (canDelete) {
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.testTag("delete_spotlight_button")
                ) {
                    Icon(
                        imageVector = Icons.Rounded.DeleteOutline,
                        contentDescription = "Delete announcement",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun UpcomingEventCard(
    event: RallyEvent,
    tasks: List<EventTask>,
    isReminded: Boolean,
    remindedAtMs: Long?,
    onRemindClick: () -> Unit,
    onClick: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.medium,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag("dashboard_event_${event.id}")
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(16.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = event.category.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                    Text(
                        text = RallyDateFormat.countdownLabel(event.startEpochMs),
                        style = MaterialTheme.typography.labelMedium,
                        color = CoralSecondary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = event.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Rounded.Schedule,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "${RallyDateFormat.formatDateTime(event.startEpochMs)} • ${event.location}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (remindedAtMs != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Reminder: ${RallyDateFormat.formatDateTime(remindedAtMs)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = CoralSecondary
                    )
                }
                if (tasks.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "${tasks.size} task shifts • ${tasks.sumOf { it.assignedCount }}/${tasks.sumOf { it.capacity }} volunteers",
                        style = MaterialTheme.typography.labelMedium,
                        color = EmeraldTertiary
                    )
                }
            }
            IconButton(
                onClick = onRemindClick,
                modifier = Modifier.testTag("remind_event_${event.id}")
            ) {
                Icon(
                    imageVector = if (isReminded) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone,
                    contentDescription = "Set or edit event reminder",
                    tint = if (isReminded) CoralSecondary else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun QuickTaskCard(
    task: EventTask,
    currentUid: String,
    onToggleSignup: () -> Unit
) {
    val isSignedUp = currentUid in task.assignedUids
    val progress = if (task.capacity <= 0L) 0f else (task.assignedCount.toFloat() / task.capacity.toFloat()).coerceIn(0f, 1f)
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.medium,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = task.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Deadline: ${RallyDateFormat.formatDateTime(task.deadlineEpochMs)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Button(
                    onClick = onToggleSignup,
                    modifier = Modifier.testTag("quick_signup_${task.id}")
                ) {
                    if (isSignedUp) {
                        Icon(Icons.Rounded.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Joined")
                    } else {
                        Text("Sign Up")
                    }
                }
            }
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp))
            )
            Text(
                text = "${task.assignedCount} of ${task.capacity} slots claimed",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun GroupRosterCard(
    membersState: UiState<List<GroupMember>>,
    currentUserId: String,
    expanded: Boolean,
    onToggleExpand: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("dashboard_members_card")
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Group,
                        contentDescription = null,
                        tint = CobaltPrimary
                    )
                    Text(
                        text = "Group Admins & Members",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                if (membersState is UiState.Success) {
                    Text(
                        text = "${membersState.data.size} total",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            when (membersState) {
                is UiState.Loading -> {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Text(
                        text = "Syncing group admins and members...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                is UiState.Error -> {
                    Text(
                        text = membersState.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                is UiState.Success -> {
                    val allMembers = membersState.data
                    if (allMembers.isEmpty()) {
                        Text(
                            text = "No members synced yet.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        val visibleMembers = if (expanded || allMembers.size <= 6) {
                            allMembers
                        } else {
                            allMembers.take(6)
                        }
                        visibleMembers.forEach { member ->
                            DashboardMemberRow(
                                member = member,
                                isCurrentUser = member.uid == currentUserId
                            )
                        }
                        if (allMembers.size > 6) {
                            TextButton(
                                onClick = onToggleExpand,
                                modifier = Modifier
                                    .align(Alignment.End)
                                    .testTag("toggle_all_members_button")
                            ) {
                                Text(
                                    if (expanded) "Show fewer"
                                    else "Show all ${allMembers.size} members"
                                )
                                Spacer(Modifier.width(4.dp))
                                Icon(
                                    imageVector = if (expanded) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardMemberRow(
    member: GroupMember,
    isCurrentUser: Boolean
) {
    val role = member.parsedRole()
    val isLeadership = role == MemberRole.CREATOR || role == MemberRole.ADMIN
    val initial = member.displayName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"

    Surface(
        color = if (isLeadership) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.28f)
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        },
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("dashboard_member_row_${member.uid}")
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(if (isLeadership) CobaltPrimary else MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Text(
                    text = initial,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (isLeadership) Color.White else MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isCurrentUser) "${member.displayName} (You)" else member.displayName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isLeadership || isCurrentUser) FontWeight.SemiBold else FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            RoleBadge(role = role)
        }
    }
}

@Composable
private fun EmptyDashboardCard(message: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(16.dp)
        )
    }
}
