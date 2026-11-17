package com.example.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Alarm
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material.icons.rounded.TaskAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.ApprovalStatus
import com.example.data.model.ChatChannel
import com.example.data.model.HubNotification
import com.example.data.model.MemberRole
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.notifications.RallyNotificationHelper
import com.example.ui.components.DateTimePickerField
import com.example.ui.components.RallyDateFormat
import com.example.ui.theme.AmberContainer
import com.example.ui.theme.AmberWarning
import com.example.ui.theme.CoralSecondary
import com.example.ui.theme.EmeraldTertiary
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.example.ui.viewmodel.UiState

@Composable
fun NotificationsScreen(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var hasPermission by remember {
        mutableStateOf(RallyNotificationHelper.hasNotificationPermission(context))
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { granted -> hasPermission = granted }
    )

    val notifications = (uiState.notificationsState as? UiState.Success)?.data.orEmpty()
    val channels = (uiState.channelsState as? UiState.Success)?.data.orEmpty()
    val events = (uiState.eventsState as? UiState.Success)?.data.orEmpty()

    var filterType by remember { mutableStateOf<NotificationType?>(null) }
    var showComposerDialog by remember { mutableStateOf(false) }
    var editingNotification by remember { mutableStateOf<HubNotification?>(null) }
    var deletingNotification by remember { mutableStateOf<HubNotification?>(null) }

    val isAdminOrCreator = uiState.currentRole.canAccessAdminPanel
    val pendingNotifications = remember(notifications) {
        notifications.filter { it.parsedApprovalStatus() == ApprovalStatus.PENDING }
    }
    val approvedNotifications = remember(notifications, filterType) {
        val approved = notifications.filter { it.parsedApprovalStatus() == ApprovalStatus.APPROVED }
        if (filterType == null) approved else approved.filter { it.parsedType() == filterType }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showComposerDialog = true },
                containerColor = CoralSecondary,
                contentColor = androidx.compose.ui.graphics.Color.White,
                modifier = Modifier.testTag("compose_notification_fab")
            ) {
                Icon(Icons.Rounded.Send, contentDescription = "Send Alert or Submit Announcement")
            }
        },
        modifier = modifier
    ) { innerPadding ->
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier
                    .widthIn(max = 840.dp)
                    .fillMaxSize()
            ) {
                item {
                    Column {
                        Text("Alerts & Reminders", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            text = if (isAdminOrCreator) {
                                "Broadcast announcements, approve member announcements, and manage group alerts."
                            } else {
                                "View group alerts or submit an announcement to everyone (Admin approval required)."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (!hasPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    item {
                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.padding(14.dp)
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Enable Push & Deadline Alerts",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Allow notifications so announcements and task reminders appear immediately.",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                                Spacer(Modifier.width(10.dp))
                                Button(
                                    onClick = {
                                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                    },
                                    modifier = Modifier.testTag("enable_notifications_button")
                                ) {
                                    Text("Enable")
                                }
                            }
                        }
                    }
                }

                // Pending Admin Approval Section
                if (pendingNotifications.isNotEmpty()) {
                    item {
                        Text(
                            text = if (isAdminOrCreator) "Pending Admin Approval (${pendingNotifications.size})"
                            else "Your Submissions Awaiting Admin Approval (${pendingNotifications.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = AmberWarning
                        )
                    }
                    items(pendingNotifications, key = { "pending_${it.id}" }) { item ->
                        val canEditItem = isAdminOrCreator ||
                            (item.senderId == uiState.currentUserId && item.parsedApprovalStatus() == ApprovalStatus.PENDING)
                        NotificationItemCard(
                            notification = item,
                            canApprove = isAdminOrCreator,
                            canEdit = canEditItem,
                            canDelete = isAdminOrCreator,
                            onApprove = { actions.approveNotification(item.id) },
                            onEdit = { editingNotification = item },
                            onDelete = { deletingNotification = item }
                        )
                    }
                }

                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            FilterChip(
                                selected = filterType == null,
                                onClick = { filterType = null },
                                label = { Text("All (${approvedNotifications.size})") }
                            )
                        }
                        items(NotificationType.entries) { type ->
                            FilterChip(
                                selected = filterType == type,
                                onClick = { filterType = if (filterType == type) null else type },
                                label = { Text(type.label) }
                            )
                        }
                    }
                }

                if (approvedNotifications.isEmpty()) {
                    item {
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "No notifications in this category yet.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(18.dp)
                            )
                        }
                    }
                } else {
                    items(approvedNotifications, key = { it.id }) { item ->
                        val canEditItem = isAdminOrCreator ||
                            (uiState.currentRole.canSendTargetedUpdates && item.parsedType() != NotificationType.ANNOUNCEMENT)
                        NotificationItemCard(
                            notification = item,
                            canApprove = false,
                            canEdit = canEditItem,
                            canDelete = isAdminOrCreator,
                            onApprove = {},
                            onEdit = { editingNotification = item },
                            onDelete = { deletingNotification = item }
                        )
                    }
                }
            }
        }
    }

    if (showComposerDialog) {
        NotificationComposerDialog(
            currentRole = uiState.currentRole,
            initialNotification = null,
            channels = channels,
            events = events,
            onDismiss = { showComposerDialog = false },
            onSend = { title, body, type, targetScope, targetRole, channelId, channelName, eventId, scheduledMs ->
                actions.sendNotification(
                    title = title,
                    body = body,
                    type = type,
                    targetScope = targetScope,
                    targetRole = targetRole,
                    targetChannelId = channelId,
                    targetChannelName = channelName,
                    targetEventId = eventId,
                    scheduledForEpochMs = scheduledMs
                )
                showComposerDialog = false
            }
        )
    }

    editingNotification?.let { target ->
        NotificationComposerDialog(
            currentRole = uiState.currentRole,
            initialNotification = target,
            channels = channels,
            events = events,
            onDismiss = { editingNotification = null },
            onSend = { title, body, type, targetScope, targetRole, channelId, channelName, eventId, scheduledMs ->
                actions.updateNotification(
                    notificationId = target.id,
                    title = title,
                    body = body,
                    type = type,
                    targetScope = targetScope,
                    targetRole = targetRole,
                    targetChannelId = channelId,
                    targetChannelName = channelName,
                    targetEventId = eventId,
                    scheduledForEpochMs = scheduledMs
                )
                editingNotification = null
            }
        )
    }

    deletingNotification?.let { target ->
        AlertDialog(
            onDismissRequest = { deletingNotification = null },
            title = { Text("Delete Announcement / Alert") },
            text = { Text("Delete \"${target.title}\"? This will remove it for all group members.") },
            confirmButton = {
                Button(
                    onClick = {
                        actions.deleteNotification(target.id)
                        deletingNotification = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.testTag("confirm_delete_notification_button")
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingNotification = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun NotificationItemCard(
    notification: HubNotification,
    canApprove: Boolean,
    canEdit: Boolean,
    canDelete: Boolean,
    onApprove: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val type = notification.parsedType()
    val isPending = notification.parsedApprovalStatus() == ApprovalStatus.PENDING
    val (icon, accent) = when {
        isPending -> Icons.Rounded.HourglassTop to AmberWarning
        type == NotificationType.ANNOUNCEMENT -> Icons.Rounded.Campaign to CoralSecondary
        type == NotificationType.TASK_UPDATE -> Icons.Rounded.TaskAlt to EmeraldTertiary
        else -> Icons.Rounded.Alarm to MaterialTheme.colorScheme.primary
    }
    val timeMs = notification.createdAt?.toDate()?.time ?: System.currentTimeMillis()
    val targetLabel = when {
        isPending -> "Pending Admin Approval"
        notification.targetScope == "CHANNEL" -> "#${notification.targetChannelName ?: "Team"}"
        notification.targetScope == "ROLE" -> "${notification.targetRole}S"
        else -> "All Members"
    }

    Surface(
        color = if (isPending) AmberContainer.copy(alpha = 0.35f) else MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.medium,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isPending) AmberWarning.copy(alpha = 0.7f)
            else MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            modifier = Modifier.padding(16.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(24.dp)
            )
            Spacer(Modifier.width(12.dp))
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Surface(
                        color = if (isPending) AmberContainer else MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = "${type.label} • $targetLabel",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                        )
                    }
                    Text(
                        text = RallyDateFormat.formatDateTime(timeMs),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = notification.body,
                    style = MaterialTheme.typography.bodyMedium
                )
                notification.scheduledForEpochMs?.let { scheduledMs ->
                    Text(
                        text = "Scheduled: ${RallyDateFormat.formatDateTime(scheduledMs)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = buildString {
                            append("Sent by ${notification.senderName}")
                            if (notification.updatedAt != null) append(" • Edited")
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (canEdit) {
                            IconButton(
                                onClick = onEdit,
                                modifier = Modifier.testTag("edit_notification_${notification.id}")
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Edit,
                                    contentDescription = "Edit alert",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        if (canDelete) {
                            IconButton(
                                onClick = onDelete,
                                modifier = Modifier.testTag("delete_notification_${notification.id}")
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.DeleteOutline,
                                    contentDescription = "Delete alert",
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
                if (canApprove) {
                    Spacer(Modifier.height(4.dp))
                    Button(
                        onClick = onApprove,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("approve_notification_${notification.id}")
                    ) {
                        Icon(Icons.Rounded.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Approve & Post to Everyone")
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationComposerDialog(
    currentRole: MemberRole,
    initialNotification: HubNotification? = null,
    channels: List<ChatChannel>,
    events: List<RallyEvent>,
    onDismiss: () -> Unit,
    onSend: (
        title: String,
        body: String,
        type: NotificationType,
        targetScope: String,
        targetRole: String,
        channelId: String?,
        channelName: String?,
        eventId: String?,
        scheduledForEpochMs: Long?
    ) -> Unit
) {
    val isAdminOrCreator = currentRole.canAccessAdminPanel
    val availableTypes = when {
        isAdminOrCreator -> NotificationType.entries
        currentRole.canSendTargetedUpdates -> listOf(
            NotificationType.TASK_UPDATE,
            NotificationType.DEADLINE_REMINDER,
            NotificationType.ANNOUNCEMENT
        )
        else -> listOf(NotificationType.ANNOUNCEMENT)
    }

    var title by remember(initialNotification?.id) { mutableStateOf(initialNotification?.title.orEmpty()) }
    var body by remember(initialNotification?.id) { mutableStateOf(initialNotification?.body.orEmpty()) }
    var selectedType by remember(initialNotification?.id) {
        mutableStateOf(
            initialNotification?.parsedType()
                ?: availableTypes.first()
        )
    }
    var targetRole by remember(initialNotification?.id) {
        mutableStateOf(
            initialNotification?.targetRole?.takeIf { it != "ADMIN" || initialNotification.parsedApprovalStatus() == ApprovalStatus.APPROVED }
                ?: "ALL"
        )
    }
    var selectedChannel by remember(initialNotification?.id) {
        mutableStateOf(
            channels.firstOrNull { it.id == initialNotification?.targetChannelId } ?: channels.firstOrNull()
        )
    }
    var selectedEvent by remember(initialNotification?.id) {
        mutableStateOf(
            events.firstOrNull { it.id == initialNotification?.targetEventId } ?: events.firstOrNull()
        )
    }
    var includeSchedule by remember(initialNotification?.id) {
        mutableStateOf(initialNotification?.scheduledForEpochMs != null)
    }
    var scheduledEpochMs by remember(initialNotification?.id) {
        mutableLongStateOf(initialNotification?.scheduledForEpochMs ?: (System.currentTimeMillis() + 3_600_000L))
    }

    val willRequireApproval = selectedType == NotificationType.ANNOUNCEMENT && !isAdminOrCreator

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                when {
                    initialNotification != null -> "Edit Announcement / Alert"
                    willRequireApproval -> "Submit Announcement for Approval"
                    else -> "Targeted Alert Dispatcher"
                }
            )
        },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                if (availableTypes.size > 1 && initialNotification == null) {
                    Text("Notification Type", style = MaterialTheme.typography.labelLarge)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        availableTypes.forEach { t ->
                            val label = if (t == NotificationType.ANNOUNCEMENT && !isAdminOrCreator) {
                                "${t.label} (Needs Admin Approval)"
                            } else t.label
                            FilterChip(
                                selected = selectedType == t,
                                onClick = { selectedType = t },
                                label = { Text(label) }
                            )
                        }
                    }
                }

                if (willRequireApproval) {
                    Surface(
                        color = AmberContainer,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "This announcement will be sent to Admins first and posted to everyone once approved.",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                } else if (selectedType == NotificationType.TASK_UPDATE && channels.isNotEmpty()) {
                    Text("Target Group Chat", style = MaterialTheme.typography.labelLarge)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(channels, key = { it.id }) { ch ->
                            FilterChip(
                                selected = selectedChannel?.id == ch.id,
                                onClick = { selectedChannel = ch },
                                label = { Text("#${ch.name}") }
                            )
                        }
                    }
                } else if (selectedType == NotificationType.DEADLINE_REMINDER && events.isNotEmpty()) {
                    Text("Related Event", style = MaterialTheme.typography.labelLarge)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(events, key = { it.id }) { evt ->
                            FilterChip(
                                selected = selectedEvent?.id == evt.id,
                                onClick = { selectedEvent = evt },
                                label = { Text(evt.title) }
                            )
                        }
                    }
                } else if (selectedType == NotificationType.ANNOUNCEMENT && isAdminOrCreator) {
                    Text("Audience Scope", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("ALL" to "All Users", "ORGANIZER" to "Organizers+", "ADMIN" to "Admins").forEach { (r, label) ->
                            FilterChip(
                                selected = targetRole == r,
                                onClick = { targetRole = r },
                                label = { Text(label) }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it.take(100) },
                    label = { Text("Alert Headline") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("notif_title_input")
                )
                OutlinedTextField(
                    value = body,
                    onValueChange = { body = it.take(600) },
                    label = { Text("Message") },
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth().testTag("notif_body_input")
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Checkbox(
                        checked = includeSchedule,
                        onCheckedChange = { includeSchedule = it },
                        modifier = Modifier.testTag("notif_schedule_checkbox")
                    )
                    Text("Attach / Edit Target Date & Time", style = MaterialTheme.typography.bodyMedium)
                }

                if (includeSchedule) {
                    DateTimePickerField(
                        label = "Scheduled Date & Time",
                        epochMs = scheduledEpochMs,
                        onDateTimeSelected = { scheduledEpochMs = it },
                        testTagPrefix = "notif_schedule"
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val scope = when {
                        willRequireApproval -> "ALL"
                        selectedType == NotificationType.TASK_UPDATE -> if (selectedChannel != null) "CHANNEL" else "ALL"
                        selectedType == NotificationType.ANNOUNCEMENT -> if (targetRole == "ALL") "ALL" else "ROLE"
                        else -> "ALL"
                    }
                    val resolvedRole = when {
                        willRequireApproval -> "ADMIN"
                        selectedType == NotificationType.TASK_UPDATE -> when (selectedChannel?.accessLevel) {
                            "ADMIN" -> "ADMIN"
                            "ORGANIZER" -> "ORGANIZER"
                            else -> "ALL"
                        }
                        selectedType == NotificationType.ANNOUNCEMENT -> targetRole
                        else -> "ALL"
                    }
                    onSend(
                        title,
                        body,
                        selectedType,
                        scope,
                        resolvedRole,
                        if (selectedType == NotificationType.TASK_UPDATE) selectedChannel?.id else null,
                        if (selectedType == NotificationType.TASK_UPDATE) selectedChannel?.name else null,
                        if (selectedType == NotificationType.DEADLINE_REMINDER) selectedEvent?.id else null,
                        if (includeSchedule) scheduledEpochMs else null
                    )
                },
                enabled = title.trim().length >= 2 && body.trim().length >= 2,
                modifier = Modifier.testTag("confirm_send_notif_button")
            ) {
                Text(
                    when {
                        initialNotification != null -> "Save Changes"
                        willRequireApproval -> "Submit for Approval"
                        else -> "Send Alert"
                    }
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
