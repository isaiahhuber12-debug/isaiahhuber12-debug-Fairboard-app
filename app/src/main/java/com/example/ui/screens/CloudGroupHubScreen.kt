package com.example.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.rounded.AddCircleOutline
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.example.data.model.JoinedGroupRef
import com.example.ui.components.RoleBadge
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState

@Composable
fun CloudGroupHubScreen(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    var joinCode by remember { mutableStateOf("") }
    var newGroupName by remember { mutableStateOf("") }
    var newGroupCode by remember { mutableStateOf("") }
    var newGroupDescription by remember { mutableStateOf("") }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.fillMaxSize()
    ) {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .widthIn(max = 640.dp)
                .fillMaxSize()
        ) {
            item {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Welcome, ${uiState.currentUserName}",
                            style = MaterialTheme.typography.headlineSmall
                        )
                        uiState.currentUserEmail?.let {
                            Text(
                                text = it,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    IconButton(
                        onClick = onSignOut,
                        modifier = Modifier.testTag("hub_sign_out_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ExitToApp,
                            contentDescription = "Sign out"
                        )
                    }
                }
            }

            // Join Existing Group by Code
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    tonalElevation = 2.dp,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.Key, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(8.dp))
                            Text("Join Group by Code", style = MaterialTheme.typography.titleLarge)
                        }
                        OutlinedTextField(
                            value = joinCode,
                            onValueChange = { joinCode = it.uppercase().take(24) },
                            label = { Text("Group Code") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("cloud_join_code_input")
                        )
                        Button(
                            onClick = { actions.joinGroupByCode(joinCode, uiState.currentUserName) },
                            enabled = !uiState.isBusy && joinCode.trim().length >= 4,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("cloud_join_button")
                        ) {
                            if (uiState.isBusy) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Join Group")
                            }
                        }
                    }
                }
            }

            // Create New Group & Custom Group Code (Creator gets full control)
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    tonalElevation = 1.dp,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Rounded.AddCircleOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.secondary
                            )
                            Spacer(Modifier.width(8.dp))
                            Column {
                                Text("Create New Group & Code", style = MaterialTheme.typography.titleLarge)
                                Text(
                                    text = "As group creator, you keep full control over admins and the group code.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        OutlinedTextField(
                            value = newGroupName,
                            onValueChange = { newGroupName = it.take(80) },
                            label = { Text("Group Name") },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("create_group_name_input")
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            OutlinedTextField(
                                value = newGroupCode,
                                onValueChange = { newGroupCode = it.uppercase().take(24) },
                                label = { Text("Custom Group Code") },
                                placeholder = { Text("e.g. RALLY26") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("create_group_code_input")
                            )
                            OutlinedButton(
                                onClick = {
                                    val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
                                    val suffix = (1..5).map { chars.random() }.joinToString("")
                                    newGroupCode = "RH-$suffix"
                                },
                                modifier = Modifier.height(54.dp)
                            ) {
                                Text("Auto")
                            }
                        }
                        OutlinedTextField(
                            value = newGroupDescription,
                            onValueChange = { newGroupDescription = it.take(240) },
                            label = { Text("Description (Optional)") },
                            maxLines = 2,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("create_group_desc_input")
                        )
                        Button(
                            onClick = {
                                actions.createGroupWithCode(newGroupName, newGroupDescription, newGroupCode)
                            },
                            enabled = !uiState.isBusy && newGroupName.trim().length >= 2 && newGroupCode.trim().length >= 4,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("create_group_button")
                        ) {
                            Text("Create Group & Launch")
                        }
                    }
                }
            }

            if (uiState.joinedGroups.isNotEmpty()) {
                item {
                    Text(
                        text = "Your Cloud Groups",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                items(uiState.joinedGroups, key = { it.groupId }) { groupRef ->
                    JoinedGroupCard(
                        groupRef = groupRef,
                        onClick = { actions.switchGroup(groupRef.groupId) }
                    )
                }
            }
        }
    }
}

@Composable
private fun JoinedGroupCard(
    groupRef: JoinedGroupRef,
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
            .testTag("joined_group_card_${groupRef.groupCode}")
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.padding(16.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = groupRef.groupName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Code: ${groupRef.groupCode}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    RoleBadge(role = groupRef.parsedRole())
                }
            }
            Icon(
                imageVector = Icons.Rounded.ChevronRight,
                contentDescription = "Open group"
            )
        }
    }
}
