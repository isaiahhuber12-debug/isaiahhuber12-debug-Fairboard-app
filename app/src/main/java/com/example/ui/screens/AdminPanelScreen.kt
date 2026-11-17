package com.example.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.ManageAccounts
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.example.data.model.ChatChannel
import com.example.data.model.GroupMember
import com.example.data.model.MemberRole
import com.example.data.model.RallyEvent
import com.example.ui.components.EngagementBarChart
import com.example.ui.components.FillRateRing
import com.example.ui.components.GroupCodePill
import com.example.ui.components.MetricStatTile
import com.example.ui.components.RoleBadge
import com.example.ui.theme.CobaltPrimary
import com.example.ui.theme.CoralSecondary
import com.example.ui.theme.EmeraldTertiary
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.example.ui.viewmodel.UiState

@Composable
fun AdminPanelScreen(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    onCopiedCode: () -> Unit,
    modifier: Modifier = Modifier
) {
    val group = uiState.activeGroup
    val members = (uiState.membersState as? UiState.Success)?.data.orEmpty()
    val channels = (uiState.channelsState as? UiState.Success)?.data.orEmpty()
    val events = (uiState.eventsState as? UiState.Success)?.data.orEmpty()
    val isCreator = uiState.currentRole.isCreator

    var nameInput by remember(group?.name) { mutableStateOf(group?.name.orEmpty()) }
    var descriptionInput by remember(group?.description) { mutableStateOf(group?.description.orEmpty()) }
    var newCodeInput by remember(group?.groupCode) { mutableStateOf(group?.groupCode.orEmpty()) }
    var searchQuery by remember { mutableStateOf("") }
    var roleFilter by remember { mutableStateOf<MemberRole?>(null) }
    var showBroadcastDialog by remember { mutableStateOf(false) }

    val filteredMembers = remember(members, searchQuery, roleFilter) {
        members.filter { member ->
            val matchesQuery = searchQuery.isBlank() ||
                member.displayName.contains(searchQuery, ignoreCase = true)
            val matchesRole = roleFilter == null || member.parsedRole() == roleFilter
            matchesQuery && matchesRole
        }
    }

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
            item {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Admin Command Panel", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            text = if (isCreator)
                                "Group Creator: Full control over admins, group settings, and permissions."
                            else
                                "Admin: Can edit group details & codes, create admins, and approve/delete posts. Only Creator can demote existing admins.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    RoleBadge(role = uiState.currentRole)
                }
            }

            // Group Details & Invite Code Management Card (Editable by Admin & Creator)
            if (group != null) {
                item {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = MaterialTheme.shapes.large,
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.padding(18.dp)
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Group Settings & Invite Code", style = MaterialTheme.typography.titleLarge)
                                GroupCodePill(code = group.groupCode, onCopied = onCopiedCode)
                            }
                            OutlinedTextField(
                                value = nameInput,
                                onValueChange = { nameInput = it.take(80) },
                                label = { Text("Group Name") },
                                singleLine = true,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("edit_group_name_input")
                            )
                            OutlinedTextField(
                                value = descriptionInput,
                                onValueChange = { descriptionInput = it.take(500) },
                                label = { Text("Group Description") },
                                maxLines = 3,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("edit_group_desc_input")
                            )
                            Button(
                                onClick = { actions.updateGroupDetails(nameInput, descriptionInput) },
                                enabled = !uiState.isBusy && nameInput.trim().length >= 2 &&
                                    (nameInput.trim() != group.name || descriptionInput.trim() != group.description),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .testTag("save_group_details_button")
                            ) {
                                Text("Save Group Details")
                            }
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                OutlinedTextField(
                                    value = newCodeInput,
                                    onValueChange = { newCodeInput = it.uppercase().take(24) },
                                    label = { Text("Custom Group Code") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                                    modifier = Modifier
                                        .weight(1f)
                                        .testTag("edit_group_code_input")
                                )
                                Button(
                                    onClick = { actions.updateGroupCode(newCodeInput) },
                                    enabled = !uiState.isBusy && newCodeInput.trim().length >= 4 && newCodeInput != group.groupCode,
                                    modifier = Modifier
                                        .height(54.dp)
                                        .testTag("save_group_code_button")
                                ) {
                                    Text("Update Code")
                                }
                            }
                        }
                    }
                }
            }

            // Broadcast Announcement Quick Action
            item {
                Button(
                    onClick = { showBroadcastDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("admin_broadcast_button")
                ) {
                    Icon(Icons.Rounded.Campaign, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Send Broadcast / Targeted Notification")
                }
            }

            // Engagement Analytics Card
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Text("Engagement Analytics", style = MaterialTheme.typography.titleLarge)

                        FillRateRing(
                            percent = uiState.analytics.fillRatePercent,
                            filled = uiState.analytics.filledTaskSlots,
                            total = uiState.analytics.totalTaskSlots
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            MetricStatTile(
                                label = "Messages",
                                value = uiState.analytics.totalMessages.toString(),
                                accent = CobaltPrimary,
                                modifier = Modifier.weight(1f)
                            )
                            MetricStatTile(
                                label = "Alerts Sent",
                                value = uiState.analytics.totalNotifications.toString(),
                                accent = CoralSecondary,
                                modifier = Modifier.weight(1f)
                            )
                            MetricStatTile(
                                label = "Admins",
                                value = (uiState.analytics.creatorCount + uiState.analytics.adminCount).toString(),
                                accent = EmeraldTertiary,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Text("Channel Activity", style = MaterialTheme.typography.titleMedium)
                        EngagementBarChart(items = uiState.analytics.channelActivity)
                    }
                }
            }

            // Member Role Management Header
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Member Permissions (${members.size})",
                        style = MaterialTheme.typography.titleLarge
                    )
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                        placeholder = { Text("Search participants, organizers, admins...") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("member_search_input")
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            FilterChip(
                                selected = roleFilter == null,
                                onClick = { roleFilter = null },
                                label = { Text("All (${members.size})") }
                            )
                        }
                        items(MemberRole.entries) { role ->
                            FilterChip(
                                selected = roleFilter == role,
                                onClick = { roleFilter = if (roleFilter == role) null else role },
                                label = { Text(role.label) }
                            )
                        }
                    }
                }
            }

            items(filteredMembers, key = { it.uid }) { member ->
                MemberPermissionRow(
                    member = member,
                    viewerIsCreator = isCreator,
                    viewerUid = uiState.currentUserId,
                    onAssignRole = { newRole -> actions.updateMemberRole(member.uid, newRole) }
                )
            }
        }
    }

    if (showBroadcastDialog) {
        NotificationComposerDialog(
            currentRole = uiState.currentRole,
            initialNotification = null,
            channels = channels,
            events = events,
            onDismiss = { showBroadcastDialog = false },
            onSend = { title, body, type, scope, role, chId, chName, evtId, scheduledMs ->
                actions.sendNotification(title, body, type, scope, role, chId, chName, evtId, scheduledMs)
                showBroadcastDialog = false
            }
        )
    }
}

@Composable
private fun MemberPermissionRow(
    member: GroupMember,
    viewerIsCreator: Boolean,
    viewerUid: String,
    onAssignRole: (MemberRole) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val memberRole = member.parsedRole()
    val canEdit = when {
        memberRole == MemberRole.CREATOR -> false
        member.uid == viewerUid -> false
        viewerIsCreator -> true
        memberRole == MemberRole.ADMIN -> false // Only creator can demote an existing admin
        else -> true // Admins can promote Participants/Organizers (including to Admin)
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
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.padding(14.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = if (member.uid == viewerUid) "${member.displayName} (You)" else member.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    RoleBadge(role = memberRole)
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${member.tasksSignedUpCount} tasks • ${member.messagesSentCount} messages",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Box {
                if (canEdit) {
                    OutlinedButton(
                        onClick = { expanded = true },
                        modifier = Modifier.testTag("manage_role_${member.uid}")
                    ) {
                        Icon(Icons.Rounded.ManageAccounts, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Role")
                    }
                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        listOf(MemberRole.PARTICIPANT, MemberRole.ORGANIZER, MemberRole.ADMIN).forEach { targetRole ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        if (targetRole == memberRole) "${targetRole.label} (Current)"
                                        else "Set as ${targetRole.label}"
                                    )
                                },
                                onClick = {
                                    expanded = false
                                    if (targetRole != memberRole) onAssignRole(targetRole)
                                }
                            )
                        }
                    }
                } else if (memberRole == MemberRole.CREATOR) {
                    Text(
                        text = "Owner",
                        style = MaterialTheme.typography.labelMedium,
                        color = CoralSecondary
                    )
                } else if (memberRole == MemberRole.ADMIN && !viewerIsCreator) {
                    Text(
                        text = "Creator Lock",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
