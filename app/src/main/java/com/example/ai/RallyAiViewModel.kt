package com.example.ai

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.ApprovalStatus
import com.example.data.model.NotificationType
import com.example.ui.components.RallyDateFormat
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.example.ui.viewmodel.UiState
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.util.UUID

private const val TAG = "RallyAiViewModel"
private const val AI_MODEL_NAME = "gemini-3.8-flash"
private const val AI_TIMEOUT_MS = 60_000L

data class AiChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val isUser: Boolean,
    val text: String,
    val isStreaming: Boolean = false
)

data class AiAnnouncementDraft(
    val title: String,
    val body: String,
    val type: NotificationType
)

sealed interface AiDraftUiState {
    data object Idle : AiDraftUiState
    data object Loading : AiDraftUiState
    data class Ready(val draft: AiAnnouncementDraft) : AiDraftUiState
    data class Error(val message: String) : AiDraftUiState
}

sealed interface AiStreamUiState {
    data object Idle : AiStreamUiState
    data object Loading : AiStreamUiState
    data class Streaming(val text: String) : AiStreamUiState
    data class Success(val text: String) : AiStreamUiState
    data class Error(val message: String) : AiStreamUiState
}

data class RallyAiScreenState(
    val messages: List<AiChatMessage> = emptyList(),
    val streamState: AiStreamUiState = AiStreamUiState.Idle,
    val draftState: AiDraftUiState = AiDraftUiState.Idle
)

class RallyAiViewModel : ViewModel() {

    private val chatModel by lazy {
        Firebase.ai.generativeModel(
            modelName = AI_MODEL_NAME,
            systemInstruction = content {
                text(
                    "You are the RallyHub Event & Volunteer Coordination Assistant. " +
                        "Help event organizers, admins, and participants understand schedules, " +
                        "volunteer shift coverage, group channels, and announcements. " +
                        "Be concise, practical, accurate to the group snapshot provided, and never invent dates or shift counts not present in the context."
                )
            }
        )
    }

    private val draftSchema by lazy {
        Schema.obj(
            properties = mapOf(
                "title" to Schema.string(description = "Short, clear headline under 80 characters"),
                "body" to Schema.string(description = "Helpful announcement or alert message body under 450 characters"),
                "type" to Schema.enumeration(
                    values = listOf("ANNOUNCEMENT", "TASK_UPDATE", "DEADLINE_REMINDER"),
                    description = "Best matching notification category"
                )
            )
        )
    }

    private val draftModel by lazy {
        Firebase.ai.generativeModel(
            modelName = AI_MODEL_NAME,
            generationConfig = generationConfig {
                responseMimeType = "application/json"
                responseSchema = draftSchema
            }
        )
    }

    private val _state = MutableStateFlow(RallyAiScreenState())
    val state: StateFlow<RallyAiScreenState> = _state.asStateFlow()

    fun askCoordinator(userPrompt: String, workspaceState: RallyWorkspaceUiState) {
        val trimmed = userPrompt.trim()
        if (trimmed.isEmpty()) return
        if (_state.value.streamState is AiStreamUiState.Loading ||
            _state.value.streamState is AiStreamUiState.Streaming
        ) {
            return
        }

        val userMessage = AiChatMessage(isUser = true, text = trimmed)
        val assistantMsgId = UUID.randomUUID().toString()
        val placeholderAssistant = AiChatMessage(
            id = assistantMsgId,
            isUser = false,
            text = "",
            isStreaming = true
        )

        val priorMessages = _state.value.messages.takeLast(6)

        _state.update { current ->
            current.copy(
                messages = current.messages + userMessage + placeholderAssistant,
                streamState = AiStreamUiState.Loading
            )
        }

        viewModelScope.launch {
            val accumulated = StringBuilder()
            try {
                val contextPrompt = buildWorkspaceContextPrompt(workspaceState)
                val historyPrompt = if (priorMessages.isNotEmpty()) {
                    buildString {
                        appendLine("Recent conversation:")
                        priorMessages.forEach { msg ->
                            val speaker = if (msg.isUser) "User" else "Assistant"
                            appendLine("$speaker: ${msg.text}")
                        }
                        appendLine()
                    }
                } else ""

                val fullPrompt = buildString {
                    appendLine(contextPrompt)
                    appendLine()
                    append(historyPrompt)
                    appendLine("User request: $trimmed")
                }

                withTimeout(AI_TIMEOUT_MS) {
                    chatModel.generateContentStream(fullPrompt).collect { chunk ->
                        val chunkText = chunk.text.orEmpty()
                        if (chunkText.isNotEmpty()) {
                            accumulated.append(chunkText)
                            val snapshot = accumulated.toString()
                            _state.update { current ->
                                current.copy(
                                    messages = current.messages.map { item ->
                                        if (item.id == assistantMsgId) {
                                            item.copy(text = snapshot, isStreaming = true)
                                        } else item
                                    },
                                    streamState = AiStreamUiState.Streaming(snapshot)
                                )
                            }
                        }
                    }
                }

                val finalText = accumulated.toString().trim()
                if (finalText.isNotBlank()) {
                    _state.update { current ->
                        current.copy(
                            messages = current.messages.map { item ->
                                if (item.id == assistantMsgId) {
                                    item.copy(text = finalText, isStreaming = false)
                                } else item
                            },
                            streamState = AiStreamUiState.Success(finalText)
                        )
                    }
                } else {
                    removeStreamingPlaceholder(assistantMsgId)
                    _state.update {
                        it.copy(streamState = AiStreamUiState.Error("Gemini returned an empty response."))
                    }
                }
            } catch (e: TimeoutCancellationException) {
                Log.e(TAG, "Gemini streaming request timed out", e)
                removeStreamingPlaceholder(assistantMsgId)
                _state.update {
                    it.copy(
                        streamState = AiStreamUiState.Error(
                            "Gemini request timed out after 60 seconds. Please try again."
                        )
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Gemini streaming request failed", e)
                removeStreamingPlaceholder(assistantMsgId)
                _state.update {
                    it.copy(
                        streamState = AiStreamUiState.Error(
                            e.localizedMessage ?: "Unable to reach Gemini right now."
                        )
                    )
                }
            }
        }
    }

    fun generateStructuredDraft(topicPrompt: String, workspaceState: RallyWorkspaceUiState) {
        val trimmed = topicPrompt.trim()
        if (trimmed.isEmpty()) return

        _state.update { it.copy(draftState = AiDraftUiState.Loading) }

        viewModelScope.launch {
            try {
                val contextPrompt = buildWorkspaceContextPrompt(workspaceState)
                val fullPrompt = buildString {
                    appendLine(contextPrompt)
                    appendLine()
                    appendLine(
                        "Write a clear, engaging group announcement or alert based on this request: $trimmed"
                    )
                }

                val response = withTimeout(AI_TIMEOUT_MS) {
                    draftModel.generateContent(fullPrompt)
                }

                val rawJson = response.text
                    ?: throw IllegalStateException("Gemini returned an empty JSON response.")
                val json = JSONObject(rawJson)
                val title = json.optString("title").trim().take(100)
                val body = json.optString("body").trim().take(600)
                val typeRaw = json.optString("type", "ANNOUNCEMENT")
                val parsedType = NotificationType.fromRaw(typeRaw)

                if (title.isBlank() || body.isBlank()) {
                    throw IllegalStateException("Generated draft was missing a title or body.")
                }

                _state.update {
                    it.copy(
                        draftState = AiDraftUiState.Ready(
                            AiAnnouncementDraft(title = title, body = body, type = parsedType)
                        )
                    )
                }
            } catch (e: TimeoutCancellationException) {
                Log.e(TAG, "Gemini structured draft timed out", e)
                _state.update {
                    it.copy(
                        draftState = AiDraftUiState.Error(
                            "Draft generation timed out after 60 seconds. Please try again."
                        )
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Gemini structured draft failed", e)
                _state.update {
                    it.copy(
                        draftState = AiDraftUiState.Error(
                            e.localizedMessage ?: "Failed to generate announcement draft."
                        )
                    )
                }
            }
        }
    }

    fun clearDraft() {
        _state.update { it.copy(draftState = AiDraftUiState.Idle) }
    }

    fun clearError() {
        _state.update {
            val nextStream = if (it.streamState is AiStreamUiState.Error) AiStreamUiState.Idle else it.streamState
            val nextDraft = if (it.draftState is AiDraftUiState.Error) AiDraftUiState.Idle else it.draftState
            it.copy(streamState = nextStream, draftState = nextDraft)
        }
    }

    fun clearConversation() {
        _state.update {
            it.copy(
                messages = emptyList(),
                streamState = AiStreamUiState.Idle
            )
        }
    }

    private fun removeStreamingPlaceholder(placeholderId: String) {
        _state.update { current ->
            current.copy(messages = current.messages.filterNot { it.id == placeholderId })
        }
    }

    private fun buildWorkspaceContextPrompt(workspace: RallyWorkspaceUiState): String {
        val group = workspace.activeGroup
        val events = (workspace.eventsState as? UiState.Success)?.data.orEmpty()
        val channels = (workspace.channelsState as? UiState.Success)?.data.orEmpty()
        val notifications = (workspace.notificationsState as? UiState.Success)?.data.orEmpty()
            .filter { it.parsedApprovalStatus() == ApprovalStatus.APPROVED }

        return buildString {
            appendLine("=== Active RallyHub Group Context ===")
            appendLine("Group Name: ${group?.name ?: "RallyHub Group"}")
            if (!group?.description.isNullOrBlank()) {
                appendLine("Description: ${group?.description}")
            }
            appendLine("Group Invite Code: ${group?.groupCode ?: "N/A"}")
            appendLine("User Name: ${workspace.currentUserName} | Role: ${workspace.currentRole.label}")
            appendLine(
                "Analytics: ${workspace.analytics.totalMembers} members, " +
                    "${workspace.analytics.totalEvents} events, " +
                    "${workspace.analytics.filledTaskSlots}/${workspace.analytics.totalTaskSlots} volunteer slots filled " +
                    "(${workspace.analytics.fillRatePercent}%)"
            )

            if (events.isNotEmpty()) {
                appendLine("\nUpcoming Events:")
                events.take(8).forEach { evt ->
                    val tasks = workspace.allTasksByEvent[evt.id].orEmpty()
                    appendLine(
                        "- ${evt.title} (${evt.category}) at ${evt.location} | " +
                            "${RallyDateFormat.formatDateTime(evt.startEpochMs)} to ${RallyDateFormat.formatTime(evt.endEpochMs)}"
                    )
                    tasks.take(5).forEach { t ->
                        appendLine(
                            "  * Task '${t.title}': ${t.assignedCount}/${t.capacity} filled, " +
                                "deadline ${RallyDateFormat.formatDateTime(t.deadlineEpochMs)}"
                        )
                    }
                }
            }

            if (channels.isNotEmpty()) {
                appendLine("\nChannels: " + channels.joinToString { "#${it.name} (${it.parsedAccessLevel().label})" })
            }

            if (notifications.isNotEmpty()) {
                appendLine("\nRecent Approved Alerts:")
                notifications.take(5).forEach { notif ->
                    appendLine("- [${notif.parsedType().label}] ${notif.title}: ${notif.body}")
                }
            }
        }
    }
}
