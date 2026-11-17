package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ai.AiChatMessage
import com.example.ai.AiDraftUiState
import com.example.ai.AiStreamUiState
import com.example.ai.RallyAiViewModel
import com.example.data.model.NotificationType
import com.example.ui.theme.CobaltContainer
import com.example.ui.theme.CobaltPrimary
import com.example.ui.theme.CoralSecondary
import com.example.ui.theme.OnCobaltContainer
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AiCoordinatorBottomSheet(
    aiViewModel: RallyAiViewModel,
    workspaceState: RallyWorkspaceUiState,
    workspaceActions: RallyWorkspaceActions,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val aiState by aiViewModel.state.collectAsStateWithLifecycle()
    var promptInput by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    val isBusy = aiState.streamState is AiStreamUiState.Loading ||
        aiState.streamState is AiStreamUiState.Streaming ||
        aiState.draftState is AiDraftUiState.Loading

    val quickPrompts = remember(workspaceState.currentRole) {
        if (workspaceState.currentRole.canManageEventsAndTasks) {
            listOf(
                "Summarize schedule & open volunteer shifts",
                "Which tasks need more volunteers urgently?",
                "Suggest a check-in day coordination plan"
            )
        } else {
            listOf(
                "What events are coming up next?",
                "Which open tasks can I join right now?",
                "Summarize recent group announcements"
            )
        }
    }

    LaunchedEffect(aiState.messages.size) {
        if (aiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(aiState.messages.size - 1)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = Modifier.testTag("ai_coordinator_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 420.dp, max = 660.dp)
                .imePadding()
                .padding(horizontal = 16.dp)
        ) {
            // Sheet Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Surface(
                        color = CobaltContainer,
                        contentColor = OnCobaltContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Rounded.AutoAwesome,
                                contentDescription = null,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            text = stringResource(R.string.ai_coordinator_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = stringResource(R.string.ai_coordinator_subtitle),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (aiState.messages.isNotEmpty()) {
                    IconButton(
                        onClick = { aiViewModel.clearConversation() },
                        modifier = Modifier.testTag("ai_clear_chat_button")
                    ) {
                        Icon(Icons.Rounded.Refresh, contentDescription = "Reset conversation")
                    }
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.testTag("ai_close_sheet_button")
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close Gemini AI Coordinator")
                }
            }

            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            Spacer(Modifier.height(10.dp))

            // Error Banner (Transparent error surfacing per Firebase AI Logic contract)
            val errorText = (aiState.streamState as? AiStreamUiState.Error)?.message
                ?: (aiState.draftState as? AiDraftUiState.Error)?.message
            if (!errorText.isNullOrBlank()) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .testTag("ai_error_banner")
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = errorText,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { aiViewModel.clearError() }) {
                            Text("Dismiss")
                        }
                    }
                }
            }

            // Structured Draft Card (when ready)
            when (val draftState = aiState.draftState) {
                is AiDraftUiState.Loading -> {
                    Surface(
                        color = CobaltContainer.copy(alpha = 0.5f),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.padding(12.dp)
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            Text("Generating structured announcement draft...", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                is AiDraftUiState.Ready -> {
                    val draft = draftState.draft
                    val needsApproval = !workspaceState.currentRole.canAccessAdminPanel
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f),
                        shape = MaterialTheme.shapes.medium,
                        border = BorderStroke(1.dp, CoralSecondary.copy(alpha = 0.5f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp)
                            .testTag("ai_draft_card")
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "AI Announcement Draft (${draft.type.label})",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = CoralSecondary,
                                    fontWeight = FontWeight.Bold
                                )
                                TextButton(onClick = { aiViewModel.clearDraft() }) {
                                    Text("Discard")
                                }
                            }
                            Text(
                                text = draft.title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = draft.body,
                                style = MaterialTheme.typography.bodySmall
                            )
                            Button(
                                onClick = {
                                    val resolvedType = if (workspaceState.currentRole.canAccessAdminPanel) {
                                        draft.type
                                    } else {
                                        NotificationType.ANNOUNCEMENT
                                    }
                                    workspaceActions.sendNotification(
                                        title = draft.title,
                                        body = draft.body,
                                        type = resolvedType,
                                        targetScope = "ALL",
                                        targetRole = if (needsApproval) "ADMIN" else "ALL",
                                        targetChannelId = null,
                                        targetChannelName = null,
                                        targetEventId = null,
                                        scheduledForEpochMs = null
                                    )
                                    aiViewModel.clearDraft()
                                    onDismiss()
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("ai_post_draft_button")
                            ) {
                                Icon(Icons.Rounded.Campaign, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(if (needsApproval) "Submit Draft for Admin Approval" else "Post Announcement Now")
                            }
                        }
                    }
                }
                else -> Unit
            }

            // Messages or Starter Chips
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (aiState.messages.isEmpty()) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = "Ask Gemini about ${workspaceState.activeGroup?.name ?: "your group"}:",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                quickPrompts.forEachIndexed { idx, suggestion ->
                                    FilterChip(
                                        selected = false,
                                        enabled = !isBusy,
                                        onClick = {
                                            aiViewModel.askCoordinator(suggestion, workspaceState)
                                        },
                                        label = { Text(suggestion) },
                                        modifier = Modifier.testTag("ai_quick_prompt_$idx")
                                    )
                                }
                            }
                        }
                    }
                } else {
                    items(aiState.messages, key = { it.id }) { msg ->
                        AiMessageBubble(message = msg)
                    }
                }
            }

            // Input & Draft Actions
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            Spacer(Modifier.height(8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = promptInput,
                    onValueChange = { promptInput = it.take(1000) },
                    placeholder = { Text("Ask Gemini or enter announcement topic...") },
                    maxLines = 3,
                    enabled = !isBusy,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("ai_prompt_input")
                )
                IconButton(
                    onClick = {
                        val query = promptInput
                        promptInput = ""
                        aiViewModel.askCoordinator(query, workspaceState)
                    },
                    enabled = !isBusy && promptInput.isNotBlank(),
                    modifier = Modifier
                        .size(48.dp)
                        .testTag("ai_send_prompt_button")
                ) {
                    if (aiState.streamState is AiStreamUiState.Loading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.Send,
                            contentDescription = "Ask Gemini",
                            tint = if (promptInput.isNotBlank()) CobaltPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(Modifier.height(6.dp))
            OutlinedButton(
                onClick = {
                    val topic = promptInput.takeIf { it.isNotBlank() }
                        ?: "Upcoming event reminder and open volunteer shifts"
                    aiViewModel.generateStructuredDraft(topic, workspaceState)
                },
                enabled = !isBusy,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("ai_generate_draft_button")
            ) {
                Icon(Icons.Rounded.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Generate Structured Announcement Draft")
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun AiMessageBubble(message: AiChatMessage) {
    val bgColor = if (message.isUser) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
    }
    val fgColor = if (message.isUser) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    Column(
        horizontalAlignment = if (message.isUser) Alignment.End else Alignment.Start,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = if (message.isUser) "You" else "Gemini Coordinator",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
        )
        Surface(
            color = bgColor,
            contentColor = fgColor,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth(0.92f)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                if (message.text.isEmpty() && message.isStreaming) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        Text("Thinking...", style = MaterialTheme.typography.bodySmall)
                    }
                } else {
                    Text(
                        text = message.text,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}
