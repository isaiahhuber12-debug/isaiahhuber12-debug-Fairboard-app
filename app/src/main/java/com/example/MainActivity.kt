package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.rounded.AdminPanelSettings
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Dashboard
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.auth.attemptAutoSignIn
import com.example.auth.authStateFlow
import com.example.auth.onGoogleSignInClicked
import com.example.auth.signOutFromGoogle
import com.example.data.remote.RallyHubRepository
import com.example.notifications.RallyNotificationHelper
import com.example.ui.components.RoleBadge
import com.example.ui.screens.AdminPanelScreen
import com.example.ui.screens.AuthAndJoinScreen
import com.example.ui.screens.CalendarScreen
import com.example.ui.screens.ChatsScreen
import com.example.ui.screens.CloudGroupHubScreen
import com.example.ui.screens.DashboardScreen
import com.example.ui.screens.NotificationsScreen
import com.example.ui.theme.RallyHubTheme
import com.example.ui.viewmodel.CloudRallyViewModel
import com.example.ui.viewmodel.GuestRallyViewModel
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore

private enum class HubTab(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector
) {
    DASHBOARD("dashboard", R.string.nav_dashboard, Icons.Rounded.Dashboard),
    CALENDAR("calendar", R.string.nav_calendar, Icons.Rounded.CalendarMonth),
    CHATS("chats", R.string.nav_chats, Icons.Rounded.Forum),
    ALERTS("alerts", R.string.nav_alerts, Icons.Rounded.Notifications),
    ADMIN("admin", R.string.nav_admin, Icons.Rounded.AdminPanelSettings)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        RallyNotificationHelper.ensureChannels(this)
        setContent {
            RallyHubTheme {
                AppNavigation()
            }
        }
    }
}

@Composable
fun AppNavigation() {
    val auth = Firebase.auth
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    LaunchedEffect(Unit) {
        attemptAutoSignIn(
            context = context,
            credentialManager = credentialManager,
            onAuthSuccess = {},
            onUnauthenticated = {},
            scope = scope
        )
    }

    val user = currentUser
    if (user == null) {
        GuestOrJoinHost(
            onAuthSuccess = {}
        )
    } else {
        key(user.uid) {
            CloudWorkspaceHost(
                currentUserId = user.uid,
                onSignOut = {
                    signOutFromGoogle(credentialManager, scope)
                }
            )
        }
    }
}

@Composable
private fun GuestOrJoinHost(
    onAuthSuccess: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }
    val guestViewModel: GuestRallyViewModel = viewModel(
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY])
                GuestRallyViewModel(app)
            }
        }
    )
    val uiState by guestViewModel.uiState.collectAsStateWithLifecycle()
    var showAdminSignInDialog by remember { mutableStateOf(false) }
    var authErrorBanner by remember { mutableStateOf<String?>(null) }

    if (uiState.activeGroup == null) {
        AuthAndJoinScreen(
            onJoinWithGroupCode = { code, name ->
                guestViewModel.joinGuestGroup(code, name)
            },
            onGoogleAuthSuccess = onAuthSuccess,
            initialBanner = uiState.bannerMessage ?: authErrorBanner
        )
    } else {
        RallyWorkspaceScaffold(
            uiState = uiState,
            actions = guestViewModel,
            onSwitchOrLeave = { guestViewModel.leaveSession() },
            onRequestAdminSignIn = { showAdminSignInDialog = true }
        )
    }

    if (showAdminSignInDialog) {
        AlertDialog(
            onDismissRequest = { showAdminSignInDialog = false },
            title = { Text("Admin & Cloud Sign-In") },
            text = {
                Text(
                    "Sign in with Google to access Admin controls, create custom group codes, and sync live across Android and iOS."
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showAdminSignInDialog = false
                        onGoogleSignInClicked(
                            context = context,
                            credentialManager = credentialManager,
                            onAuthSuccess = onAuthSuccess,
                            onAuthError = { msg -> authErrorBanner = msg },
                            scope = scope
                        )
                    },
                    modifier = Modifier.testTag("dialog_google_signin_button")
                ) {
                    Text(stringResource(R.string.sign_in_with_google))
                }
            },
            dismissButton = {
                TextButton(onClick = { showAdminSignInDialog = false }) {
                    Text("Stay in Local Mode")
                }
            }
        )
    }
}

@Composable
private fun CloudWorkspaceHost(
    currentUserId: String,
    onSignOut: () -> Unit
) {
    val viewModel: CloudRallyViewModel = viewModel(
        key = currentUserId,
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY])
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                CloudRallyViewModel(RallyHubRepository(db), currentUserId, app)
            }
        }
    )
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    if (uiState.activeGroup == null) {
        Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                CloudGroupHubScreen(
                    uiState = uiState,
                    actions = viewModel,
                    onSignOut = onSignOut
                )
            }
        }
    } else {
        RallyWorkspaceScaffold(
            uiState = uiState,
            actions = viewModel,
            onSwitchOrLeave = { viewModel.leaveSession() },
            onSignOut = onSignOut
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RallyWorkspaceScaffold(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    onSwitchOrLeave: () -> Unit,
    onSignOut: (() -> Unit)? = null,
    onRequestAdminSignIn: (() -> Unit)? = null
) {
    var selectedTab by rememberSaveable { mutableStateOf(HubTab.DASHBOARD) }
    val snackbarHostState = remember { SnackbarHostState() }

    val visibleTabs = remember(uiState.currentRole, uiState.isCloudMode) {
        if (uiState.isCloudMode && uiState.currentRole.canAccessAdminPanel) {
            HubTab.entries
        } else {
            listOf(HubTab.DASHBOARD, HubTab.CALENDAR, HubTab.CHATS, HubTab.ALERTS)
        }
    }

    LaunchedEffect(visibleTabs) {
        if (selectedTab !in visibleTabs) {
            selectedTab = HubTab.DASHBOARD
        }
    }

    LaunchedEffect(uiState.bannerMessage) {
        val msg = uiState.bannerMessage
        if (!msg.isNullOrBlank()) {
            snackbarHostState.showSnackbar(msg)
            actions.clearBanner()
        }
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val useRail = maxWidth >= 600.dp

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = uiState.activeGroup?.name ?: stringResource(R.string.app_name),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )
                            RoleBadge(role = uiState.currentRole)
                        }
                    },
                    actions = {
                        IconButton(
                            onClick = onSwitchOrLeave,
                            modifier = Modifier.testTag("switch_group_button")
                        ) {
                            Icon(Icons.Rounded.SwapHoriz, contentDescription = "Switch group")
                        }
                        if (onSignOut != null) {
                            IconButton(
                                onClick = onSignOut,
                                modifier = Modifier.testTag("sign_out_button")
                            ) {
                                Icon(Icons.AutoMirrored.Rounded.ExitToApp, contentDescription = "Sign out")
                            }
                        } else if (onRequestAdminSignIn != null) {
                            TextButton(
                                onClick = onRequestAdminSignIn,
                                modifier = Modifier.testTag("topbar_admin_signin_button")
                            ) {
                                Text("Admin")
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )
            },
            bottomBar = {
                if (!useRail) {
                    NavigationBar(windowInsets = WindowInsets.navigationBars) {
                        visibleTabs.forEach { tab ->
                            NavigationBarItem(
                                selected = selectedTab == tab,
                                onClick = { selectedTab = tab },
                                icon = { Icon(tab.icon, contentDescription = stringResource(tab.labelRes)) },
                                label = { Text(stringResource(tab.labelRes)) },
                                modifier = Modifier.testTag("nav_${tab.route}")
                            )
                        }
                    }
                }
            },
            modifier = Modifier.fillMaxSize()
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (useRail) {
                    NavigationRail(modifier = Modifier.fillMaxHeight()) {
                        Spacer(Modifier.weight(0.1f))
                        visibleTabs.forEach { tab ->
                            NavigationRailItem(
                                selected = selectedTab == tab,
                                onClick = { selectedTab = tab },
                                icon = { Icon(tab.icon, contentDescription = stringResource(tab.labelRes)) },
                                label = { Text(stringResource(tab.labelRes)) },
                                modifier = Modifier.testTag("rail_${tab.route}")
                            )
                        }
                        Spacer(Modifier.weight(1f))
                    }
                }

                Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    when (selectedTab) {
                        HubTab.DASHBOARD -> DashboardScreen(
                            uiState = uiState,
                            actions = actions,
                            onOpenEvent = { eventId ->
                                actions.selectEvent(eventId)
                                selectedTab = HubTab.CALENDAR
                            },
                            onOpenNotifications = { selectedTab = HubTab.ALERTS },
                            onRequestAdminSignIn = onRequestAdminSignIn,
                            onCopiedCode = { /* clipboard handles copy; snackbar optional */ }
                        )
                        HubTab.CALENDAR -> CalendarScreen(
                            uiState = uiState,
                            actions = actions
                        )
                        HubTab.CHATS -> ChatsScreen(
                            uiState = uiState,
                            actions = actions
                        )
                        HubTab.ALERTS -> NotificationsScreen(
                            uiState = uiState,
                            actions = actions
                        )
                        HubTab.ADMIN -> AdminPanelScreen(
                            uiState = uiState,
                            actions = actions,
                            onCopiedCode = {}
                        )
                    }
                }
            }
        }
    }
}
