package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.data.model.ChannelAccessLevel
import com.example.data.model.ChatChannel
import com.example.data.model.ChatMessage
import com.example.data.model.MessageType
import com.example.ui.components.RallyDateFormat
import com.example.ui.components.RoleBadge
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.example.ui.viewmodel.UiState

@Composable
fun ChatsScreen(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    modifier: Modifier = Modifier
) {
    val channels = (uiState.channelsState as? UiState.Success)?.data.orEmpty()
    val activeChannel = channels.firstOrNull { it.id == uiState.selectedChannelId }
    var showCreateChannelDialog by remember { mutableStateOf(false) }
    var editingChannel by remember { mutableStateOf<ChatChannel?>(null) }

    val canManageChannels = uiState.currentRole.canManageEventsAndTasks
    val isAdminOrCreator = uiState.currentRole.canAccessAdminPanel

    if (activeChannel != null) {
        BackHandler { actions.selectChannel(null) }
        val messages = (uiState.messagesState as? UiState.Success)?.data.orEmpty()
        ChatThreadView(
            channel = activeChannel,
            messages = messages,
            currentUid = uiState.currentUserId,
            canManageChannel = canManageChannels,
            canDeleteMessages = isAdminOrCreator,
            onBack = { actions.selectChannel(null) },
            onEditChannel = { editingChannel = activeChannel },
            onSendMessage = { text -> actions.sendMessage(activeChannel.id, text) },
            onEditMessage = { messageId, newText -> actions.editMessage(activeChannel.id, messageId, newText) },
            onDeleteMessage = { messageId -> actions.deleteMessage(activeChannel.id, messageId) },
            modifier = modifier
        )
    } else {
        Scaffold(
            floatingActionButton = {
                if (canManageChannels) {
                    FloatingActionButton(
                        onClick = { showCreateChannelDialog = true },
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.testTag("create_channel_fab")
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = "Create Group Chat")
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
                            Text("Group Channels", style = MaterialTheme.typography.headlineSmall)
                            Text(
                                text = if (canManageChannels) {
                                    "Role-scoped chats for hundreds of participants and teams."
                                } else {
                                    "Message teams in channels you belong to."
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    if (channels.isEmpty()) {
                        item {
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                                shape = MaterialTheme.shapes.medium,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "No channels available for your role yet.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(18.dp)
                                )
                            }
                        }
                    } else {
                        items(channels, key = { it.id }) { channel ->
                            ChannelCard(
                                channel = channel,
                                canEdit = canManageChannels,
                                onEdit = { editingChannel = channel },
                                onClick = { actions.selectChannel(channel.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showCreateChannelDialog) {
        ChannelEditorDialog(
            initialChannel = null,
            canUseAdminLevel = isAdminOrCreator,
            onDismiss = { showCreateChannelDialog = false },
            onSave = { name, desc, level ->
                actions.createChannel(name, desc, level)
                showCreateChannelDialog = false
            }
        )
    }

    editingChannel?.let { ch ->
        ChannelEditorDialog(
            initialChannel = ch,
            canUseAdminLevel = isAdminOrCreator,
            onDismiss = { editingChannel = null },
            onSave = { name, desc, level ->
                actions.updateChannel(ch.id, name, desc, level)
                editingChannel = null
            }
        )
    }
}

@Composable
private fun ChannelCard(
    channel: ChatChannel,
    canEdit: Boolean,
    onEdit: () -> Unit,
    onClick: () -> Unit
) {
    val level = channel.parsedAccessLevel()
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
            .testTag("channel_card_${channel.id}")
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(16.dp)
        ) {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.size(44.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (level == ChannelAccessLevel.ALL) Icons.Rounded.Forum else Icons.Rounded.Lock,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "#${channel.name}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = level.label,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                Spacer(Modifier.height(3.dp))
                Text(
                    text = channel.lastMessagePreview?.takeIf { it.isNotBlank() } ?: channel.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                text = "${channel.messageCount}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
            if (canEdit) {
                IconButton(
                    onClick = onEdit,
                    modifier = Modifier.testTag("edit_channel_${channel.id}")
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Edit,
                        contentDescription = "Edit channel",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatThreadView(
    channel: ChatChannel,
    messages: List<ChatMessage>,
    currentUid: String,
    canManageChannel: Boolean,
    canDeleteMessages: Boolean,
    onBack: () -> Unit,
    onEditChannel: () -> Unit,
    onSendMessage: (String) -> Unit,
    onEditMessage: (String, String) -> Unit,
    onDeleteMessage: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var draft by remember { mutableStateOf("") }
    var messageToEdit by remember { mutableStateOf<ChatMessage?>(null) }
    var messageToDelete by remember { mutableStateOf<ChatMessage?>(null) }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .fillMaxSize()
            .imePadding()
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 840.dp)
                .fillMaxSize()
        ) {
            // Thread Header
            Surface(
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 1.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp)
                ) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("chat_back_button")
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back to channels")
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("#${channel.name}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${channel.parsedAccessLevel().label} • ${channel.description}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    if (canManageChannel) {
                        IconButton(
                            onClick = onEditChannel,
                            modifier = Modifier.testTag("edit_active_channel_button")
                        ) {
                            Icon(Icons.Rounded.Edit, contentDescription = "Edit channel details")
                        }
                    }
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

            // Messages Stream
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (messages.isEmpty()) {
                    item {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp)
                        ) {
                            Text(
                                text = "Start the conversation in #${channel.name}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    items(messages, key = { it.id }) { msg ->
                        val isMe = msg.senderId == currentUid
                        val isAnnouncement = msg.parsedType() == MessageType.ANNOUNCEMENT
                        val canEdit = isMe || canDeleteMessages
                        MessageBubble(
                            msg = msg,
                            isMe = isMe,
                            isAnnouncement = isAnnouncement,
                            canEdit = canEdit,
                            canDelete = canDeleteMessages,
                            onEditClick = { messageToEdit = msg },
                            onDeleteClick = { messageToDelete = msg }
                        )
                    }
                }
            }

            // Composer
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            Surface(
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { draft = it.take(2000) },
                        placeholder = { Text("Message #${channel.name}") },
                        maxLines = 4,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("chat_message_input")
                    )
                    IconButton(
                        onClick = {
                            if (draft.isNotBlank()) {
                                onSendMessage(draft)
                                draft = ""
                            }
                        },
                        enabled = draft.isNotBlank(),
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (draft.isNotBlank()) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.surfaceVariant
                            )
                            .testTag("send_message_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.Send,
                            contentDescription = "Send message",
                            tint = if (draft.isNotBlank()) MaterialTheme.colorScheme.onPrimary
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }

    messageToEdit?.let { target ->
        var editedText by remember(target.id) { mutableStateOf(target.text) }
        AlertDialog(
            onDismissRequest = { messageToEdit = null },
            title = { Text("Edit Message") },
            text = {
                OutlinedTextField(
                    value = editedText,
                    onValueChange = { editedText = it.take(2000) },
                    label = { Text("Message text") },
                    maxLines = 6,
                    modifier = Modifier.fillMaxWidth().testTag("edit_message_input")
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onEditMessage(target.id, editedText)
                        messageToEdit = null
                    },
                    enabled = editedText.trim().isNotEmpty(),
                    modifier = Modifier.testTag("confirm_edit_message_button")
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { messageToEdit = null }) { Text("Cancel") }
            }
        )
    }

    messageToDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { messageToDelete = null },
            title = { Text("Delete Message") },
            text = {
                Text("Delete this message from ${target.senderName}? This action cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDeleteMessage(target.id)
                        messageToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.testTag("confirm_delete_message_button")
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { messageToDelete = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun MessageBubble(
    msg: ChatMessage,
    isMe: Boolean,
    isAnnouncement: Boolean,
    canEdit: Boolean,
    canDelete: Boolean,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    val alignment = if (isMe) Alignment.End else Alignment.Start
    val bubbleColor = when {
        isAnnouncement -> MaterialTheme.colorScheme.secondaryContainer
        isMe -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surface
    }
    val textColor = when {
        isAnnouncement -> MaterialTheme.colorScheme.onSecondaryContainer
        isMe -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurface
    }
    val timeMs = msg.createdAt?.toDate()?.time ?: System.currentTimeMillis()

    Column(
        horizontalAlignment = alignment,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = if (isMe) "You" else msg.senderName,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold
            )
            RoleBadge(role = msg.parsedRole())
            Text(
                text = RallyDateFormat.formatTime(timeMs),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (msg.updatedAt != null) {
                Text(
                    text = "• Edited",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            if (isMe && (canEdit || canDelete)) {
                MessageActionIcons(
                    messageId = msg.id,
                    canEdit = canEdit,
                    canDelete = canDelete,
                    onEditClick = onEditClick,
                    onDeleteClick = onDeleteClick
                )
            }
            Surface(
                color = bubbleColor,
                contentColor = textColor,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .widthIn(max = 320.dp)
                    .then(
                        if (!isMe && !isAnnouncement) {
                            Modifier.border(
                                1.dp,
                                MaterialTheme.colorScheme.outline.copy(alpha = 0.45f),
                                RoundedCornerShape(16.dp)
                            )
                        } else Modifier
                    )
            ) {
                Text(
                    text = msg.text,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                )
            }
            if (!isMe && (canEdit || canDelete)) {
                MessageActionIcons(
                    messageId = msg.id,
                    canEdit = canEdit,
                    canDelete = canDelete,
                    onEditClick = onEditClick,
                    onDeleteClick = onDeleteClick
                )
            }
        }
    }
}

@Composable
private fun MessageActionIcons(
    messageId: String,
    canEdit: Boolean,
    canDelete: Boolean,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (canEdit) {
            IconButton(
                onClick = onEditClick,
                modifier = Modifier.testTag("edit_message_$messageId")
            ) {
                Icon(
                    imageVector = Icons.Rounded.Edit,
                    contentDescription = "Edit message",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
        if (canDelete) {
            IconButton(
                onClick = onDeleteClick,
                modifier = Modifier.testTag("delete_message_$messageId")
            ) {
                Icon(
                    imageVector = Icons.Rounded.DeleteOutline,
                    contentDescription = "Delete message",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun ChannelEditorDialog(
    initialChannel: ChatChannel?,
    canUseAdminLevel: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, ChannelAccessLevel) -> Unit
) {
    var name by remember(initialChannel?.id) { mutableStateOf(initialChannel?.name.orEmpty()) }
    var description by remember(initialChannel?.id) { mutableStateOf(initialChannel?.description.orEmpty()) }
    var accessLevel by remember(initialChannel?.id) {
        mutableStateOf(initialChannel?.parsedAccessLevel() ?: ChannelAccessLevel.ALL)
    }

    val availableLevels = if (canUseAdminLevel) ChannelAccessLevel.entries
    else listOf(ChannelAccessLevel.ALL, ChannelAccessLevel.ORGANIZER)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialChannel == null) "Create Group Chat" else "Edit Group Chat") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(60) },
                    label = { Text("Channel Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("channel_name_input")
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it.take(240) },
                    label = { Text("Purpose / Topic") },
                    maxLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Role Access Level", style = MaterialTheme.typography.labelLarge)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    availableLevels.forEach { lvl ->
                        FilterChip(
                            selected = accessLevel == lvl,
                            onClick = { accessLevel = lvl },
                            label = { Text(lvl.label) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name, description, accessLevel) },
                enabled = name.trim().length >= 2,
                modifier = Modifier.testTag("confirm_create_channel_button")
            ) {
                Text(if (initialChannel == null) "Create Channel" else "Save Changes")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
