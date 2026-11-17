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
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material.icons.rounded.TaskAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.ChatChannel
import com.example.data.model.HubNotification
import com.example.data.model.NotificationType
import com.example.data.model.RallyEvent
import com.example.notifications.RallyNotificationHelper
import com.example.ui.components.RallyDateFormat
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

    val filtered = remember(notifications, filterType) {
        if (filterType == null) notifications
        else notifications.filter { it.parsedType() == filterType }
    }

    Scaffold(
        floatingActionButton = {
            if (uiState.currentRole.canSendTargetedUpdates) {
                FloatingActionButton(
                    onClick = { showComposerDialog = true },
                    containerColor = CoralSecondary,
                    contentColor = androidx.compose.ui.graphics.Color.White,
                    modifier = Modifier.testTag("compose_notification_fab")
                ) {
                    Icon(Icons.Rounded.Send, contentDescription = "Send Targeted Alert")
                }
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
                            text = "Real-time announcements, group task updates, and deadline alerts.",
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

                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            FilterChip(
                                selected = filterType == null,
                                onClick = { filterType = null },
                                label = { Text("All (${notifications.size})") }
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

                if (filtered.isEmpty()) {
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
                    items(filtered, key = { it.id }) { item ->
                        NotificationItemCard(item)
                    }
                }
            }
        }
    }

    if (showComposerDialog) {
        NotificationComposerDialog(
            canSendGlobalAnnouncement = uiState.currentRole.canSendGlobalAnnouncements,
            channels = channels,
            events = events,
            onDismiss = { showComposerDialog = false },
            onSend = { title, body, type, targetScope, targetRole, channelId, channelName, eventId ->
                actions.sendNotification(
                    title = title,
                    body = body,
                    type = type,
                    targetScope = targetScope,
                    targetRole = targetRole,
                    targetChannelId = channelId,
                    targetChannelName = channelName,
                    targetEventId = eventId
                )
                showComposerDialog = false
            }
        )
    }
}

@Composable
private fun NotificationItemCard(notification: HubNotification) {
    val type = notification.parsedType()
    val (icon, accent) = when (type) {
        NotificationType.ANNOUNCEMENT -> Icons.Rounded.Campaign to CoralSecondary
        NotificationType.TASK_UPDATE -> Icons.Rounded.TaskAlt to EmeraldTertiary
        NotificationType.DEADLINE_REMINDER -> Icons.Rounded.Alarm to MaterialTheme.colorScheme.primary
    }
    val timeMs = notification.createdAt?.toDate()?.time ?: System.currentTimeMillis()
    val targetLabel = when (notification.targetScope) {
        "CHANNEL" -> "#${notification.targetChannelName ?: "Team"}"
        "ROLE" -> "${notification.targetRole}S"
        else -> "All Members"
    }

    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.medium,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
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
                        color = MaterialTheme.colorScheme.surfaceVariant,
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
                Text(
                    text = "Sent by ${notification.senderName}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun NotificationComposerDialog(
    canSendGlobalAnnouncement: Boolean,
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
        eventId: String?
    ) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var selectedType by remember {
        mutableStateOf(
            if (canSendGlobalAnnouncement) NotificationType.ANNOUNCEMENT else NotificationType.TASK_UPDATE
        )
    }
    var targetRole by remember { mutableStateOf("ALL") }
    var selectedChannel by remember { mutableStateOf(channels.firstOrNull()) }
    var selectedEvent by remember { mutableStateOf(events.firstOrNull()) }

    val availableTypes = if (canSendGlobalAnnouncement) NotificationType.entries
    else listOf(NotificationType.TASK_UPDATE, NotificationType.DEADLINE_REMINDER)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Targeted Alert Dispatcher") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                Text("Notification Type", style = MaterialTheme.typography.labelLarge)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    availableTypes.forEach { t ->
                        FilterChip(
                            selected = selectedType == t,
                            onClick = { selectedType = t },
                            label = { Text(t.label) }
                        )
                    }
                }

                if (selectedType == NotificationType.TASK_UPDATE && channels.isNotEmpty()) {
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
                } else if (selectedType == NotificationType.ANNOUNCEMENT) {
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
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val scope = when (selectedType) {
                        NotificationType.TASK_UPDATE -> if (selectedChannel != null) "CHANNEL" else "ALL"
                        NotificationType.ANNOUNCEMENT -> if (targetRole == "ALL") "ALL" else "ROLE"
                        NotificationType.DEADLINE_REMINDER -> "ALL"
                    }
                    val resolvedRole = when (selectedType) {
                        NotificationType.TASK_UPDATE -> when (selectedChannel?.accessLevel) {
                            "ADMIN" -> "ADMIN"
                            "ORGANIZER" -> "ORGANIZER"
                            else -> "ALL"
                        }
                        NotificationType.ANNOUNCEMENT -> targetRole
                        NotificationType.DEADLINE_REMINDER -> "ALL"
                    }
                    onSend(
                        title,
                        body,
                        selectedType,
                        scope,
                        resolvedRole,
                        if (selectedType == NotificationType.TASK_UPDATE) selectedChannel?.id else null,
                        if (selectedType == NotificationType.TASK_UPDATE) selectedChannel?.name else null,
                        if (selectedType == NotificationType.DEADLINE_REMINDER) selectedEvent?.id else null
                    )
                },
                enabled = title.trim().length >= 2 && body.trim().length >= 2,
                modifier = Modifier.testTag("confirm_send_notif_button")
            ) {
                Text("Send Alert")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
