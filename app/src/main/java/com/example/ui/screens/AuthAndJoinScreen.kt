package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.GroupAdd
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import com.example.R
import com.example.auth.onGoogleSignInClicked
import com.example.ui.theme.CobaltPrimary
import com.example.ui.theme.CobaltPrimaryDark
import com.example.ui.theme.CoralSecondary

@Composable
fun AuthAndJoinScreen(
    onPrepareJoinWithCode: (code: String, displayName: String) -> Unit,
    onPrepareStandardSignIn: () -> Unit,
    onAuthCancelledOrFailed: () -> Unit,
    onGoogleAuthSuccess: () -> Unit,
    initialBanner: String? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    var groupCode by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var isJoiningWithCode by remember { mutableStateOf(false) }
    var isGoogleSigningIn by remember { mutableStateOf(false) }
    var errorMessage by remember(initialBanner) { mutableStateOf(initialBanner) }

    val anyBusy = isJoiningWithCode || isGoogleSigningIn

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .safeDrawingPadding()
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 18.dp)
        ) {
            Column(
                modifier = Modifier.widthIn(max = 560.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                // Hero Header
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(CobaltPrimary, CobaltPrimaryDark)
                            )
                        )
                        .padding(22.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = CoralSecondary,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.size(40.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Rounded.Bolt,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = stringResource(R.string.app_name),
                                    style = MaterialTheme.typography.headlineMedium,
                                    color = Color.White
                                )
                                Text(
                                    text = "Live Events • Tasks • Group Chats",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.White.copy(alpha = 0.84f)
                                )
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            HeroHighlightChip(Icons.Rounded.CalendarMonth, "Event Calendar")
                            HeroHighlightChip(Icons.Rounded.Forum, "Role Chats")
                            HeroHighlightChip(Icons.Rounded.VerifiedUser, "Task Shifts")
                        }
                    }
                }

                if (!errorMessage.isNullOrBlank()) {
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMessage.orEmpty(),
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }

                // Card 1: Join a Live Cloud Group via Group Code + Display Name
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    tonalElevation = 2.dp,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(20.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.GroupAdd,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = stringResource(R.string.join_group_title),
                                    style = MaterialTheme.typography.titleLarge
                                )
                                Text(
                                    text = stringResource(R.string.join_group_subtitle),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        OutlinedTextField(
                            value = groupCode,
                            onValueChange = { groupCode = it.uppercase().take(24) },
                            label = { Text(stringResource(R.string.group_code_hint)) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                capitalization = KeyboardCapitalization.Characters
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("group_code_input")
                        )

                        OutlinedTextField(
                            value = displayName,
                            onValueChange = { displayName = it.take(40) },
                            label = { Text(stringResource(R.string.display_name_hint)) },
                            placeholder = { Text("Optional (defaults to your Google name)") },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("guest_name_input")
                        )

                        Button(
                            onClick = {
                                val normalized = groupCode.trim().uppercase().replace(" ", "-")
                                if (!normalized.matches(Regex("^[A-Z0-9_\\-]{4,24}$"))) {
                                    errorMessage = "Enter a 4–24 character Group Code (letters, numbers, - or _)."
                                } else {
                                    errorMessage = null
                                    isJoiningWithCode = true
                                    onPrepareJoinWithCode(normalized, displayName.trim())
                                    onGoogleSignInClicked(
                                        context = context,
                                        credentialManager = credentialManager,
                                        onAuthSuccess = {
                                            isJoiningWithCode = false
                                            onGoogleAuthSuccess()
                                        },
                                        onAuthError = { msg ->
                                            isJoiningWithCode = false
                                            onAuthCancelledOrFailed()
                                            errorMessage = msg
                                        },
                                        scope = scope,
                                        onAuthCancelled = {
                                            isJoiningWithCode = false
                                            onAuthCancelledOrFailed()
                                        }
                                    )
                                }
                            },
                            enabled = !anyBusy,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("join_with_code_button")
                        ) {
                            if (isJoiningWithCode) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                                Spacer(Modifier.width(10.dp))
                                Text("Signing in to join...")
                            } else {
                                Text(stringResource(R.string.join_with_code_button))
                            }
                        }
                    }
                }

                // Card 2: Admin & Cloud Organizer Sign-In (Google via Credential Manager)
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large,
                    tonalElevation = 1.dp,
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(20.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.AdminPanelSettings,
                                contentDescription = null,
                                tint = CoralSecondary
                            )
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = stringResource(R.string.admin_sign_in_title),
                                    style = MaterialTheme.typography.titleLarge
                                )
                                Text(
                                    text = stringResource(R.string.admin_sign_in_subtitle),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))

                        OutlinedButton(
                            onClick = {
                                errorMessage = null
                                isGoogleSigningIn = true
                                onPrepareStandardSignIn()
                                onGoogleSignInClicked(
                                    context = context,
                                    credentialManager = credentialManager,
                                    onAuthSuccess = {
                                        isGoogleSigningIn = false
                                        onGoogleAuthSuccess()
                                    },
                                    onAuthError = { msg ->
                                        isGoogleSigningIn = false
                                        onAuthCancelledOrFailed()
                                        errorMessage = msg
                                    },
                                    scope = scope,
                                    onAuthCancelled = {
                                        isGoogleSigningIn = false
                                        onAuthCancelledOrFailed()
                                    }
                                )
                            },
                            enabled = !anyBusy,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.primary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("google_sign_in_button")
                        ) {
                            if (isGoogleSigningIn) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp
                                )
                                Spacer(Modifier.width(10.dp))
                                Text("Signing in...")
                            } else {
                                Text(stringResource(R.string.sign_in_with_google))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HeroHighlightChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String
) {
    Surface(
        color = Color.White.copy(alpha = 0.16f),
        contentColor = Color.White,
        shape = RoundedCornerShape(999.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(5.dp))
            Text(text = label, style = MaterialTheme.typography.labelMedium)
        }
    }
}
