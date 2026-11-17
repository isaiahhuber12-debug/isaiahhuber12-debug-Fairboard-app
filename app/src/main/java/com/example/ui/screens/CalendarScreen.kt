package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.data.model.ChatChannel
import com.example.data.model.EventTask
import com.example.data.model.RallyEvent
import com.example.ui.components.RallyDateFormat
import com.example.ui.theme.CoralSecondary
import com.example.ui.theme.EmeraldTertiary
import com.example.ui.viewmodel.RallyWorkspaceActions
import com.example.ui.viewmodel.RallyWorkspaceUiState
import com.example.ui.viewmodel.UiState
import java.util.Calendar

@Composable
fun CalendarScreen(
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    modifier: Modifier = Modifier
) {
    val events = (uiState.eventsState as? UiState.Success)?.data.orEmpty()
    val selectedEvent = events.firstOrNull { it.id == uiState.selectedEventId }
    val channels = (uiState.channelsState as? UiState.Success)?.data.orEmpty()

    var showCreateEventDialog by remember { mutableStateOf(false) }
    var showCreateTaskForEventId by remember { mutableStateOf<String?>(null) }

    if (selectedEvent != null) {
        BackHandler { actions.selectEvent(null) }
        val tasks = when (val tState = uiState.selectedEventTasksState) {
            is UiState.Success -> tState.data
            else -> uiState.allTasksByEvent[selectedEvent.id].orEmpty()
        }
        EventDetailView(
            event = selectedEvent,
            tasks = tasks,
            uiState = uiState,
            actions = actions,
            onBack = { actions.selectEvent(null) },
            onAddTask = { showCreateTaskForEventId = selectedEvent.id },
            modifier = modifier
        )
    } else {
        CalendarOverviewView(
            events = events,
            uiState = uiState,
            actions = actions,
            onOpenCreateEvent = { showCreateEventDialog = true },
            onSelectEvent = { actions.selectEvent(it) },
            modifier = modifier
        )
    }

    if (showCreateEventDialog) {
        CreateEventDialog(
            onDismiss = { showCreateEventDialog = false },
            onCreate = { title, desc, loc, cat, startMs, endMs ->
                actions.createEvent(title, desc, loc, cat, startMs, endMs)
                showCreateEventDialog = false
            }
        )
    }

    showCreateTaskForEventId?.let { targetEventId ->
        CreateTaskDialog(
            channels = channels,
            onDismiss = { showCreateTaskForEventId = null },
            onCreate = { title, desc, deadlineMs, capacity, channelId ->
                actions.createTask(targetEventId, title, desc, deadlineMs, capacity, channelId)
                showCreateTaskForEventId = null
            }
        )
    }
}

@Composable
private fun CalendarOverviewView(
    events: List<RallyEvent>,
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    onOpenCreateEvent: () -> Unit,
    onSelectEvent: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var displayedMonthOffset by remember { mutableIntStateOf(0) }
    var selectedDayKey by remember { mutableStateOf<String?>(null) }

    val calendarMonth = remember(displayedMonthOffset) {
        Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.MONTH, displayedMonthOffset)
        }
    }
    val eventDayKeys = remember(events) {
        events.map { RallyDateFormat.dayKey(it.startEpochMs) }.toSet()
    }
    val filteredEvents = remember(events, selectedDayKey) {
        if (selectedDayKey == null) events
        else events.filter { RallyDateFormat.dayKey(it.startEpochMs) == selectedDayKey }
    }

    Scaffold(
        floatingActionButton = {
            if (uiState.currentRole.canManageEventsAndTasks) {
                FloatingActionButton(
                    onClick = onOpenCreateEvent,
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.testTag("create_event_fab")
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = "Create Event")
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
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier
                    .widthIn(max = 840.dp)
                    .fillMaxSize()
            ) {
                // Month Grid Card
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
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                IconButton(
                                    onClick = { displayedMonthOffset -= 1 },
                                    modifier = Modifier.testTag("prev_month_button")
                                ) {
                                    Icon(Icons.Rounded.ChevronLeft, contentDescription = "Previous month")
                                }
                                Text(
                                    text = RallyDateFormat.formatMonthYear(calendarMonth),
                                    style = MaterialTheme.typography.titleLarge
                                )
                                IconButton(
                                    onClick = { displayedMonthOffset += 1 },
                                    modifier = Modifier.testTag("next_month_button")
                                ) {
                                    Icon(Icons.Rounded.ChevronRight, contentDescription = "Next month")
                                }
                            }

                            Spacer(Modifier.height(6.dp))
                            Row(modifier = Modifier.fillMaxWidth()) {
                                listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat").forEach { day ->
                                    Text(
                                        text = day,
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                            Spacer(Modifier.height(6.dp))

                            val year = calendarMonth.get(Calendar.YEAR)
                            val month = calendarMonth.get(Calendar.MONTH)
                            val firstDayOfWeek = calendarMonth.get(Calendar.DAY_OF_WEEK) - 1
                            val daysInMonth = calendarMonth.getActualMaximum(Calendar.DAY_OF_MONTH)
                            val totalCells = ((firstDayOfWeek + daysInMonth + 6) / 7) * 7
                            val todayKey = RallyDateFormat.dayKey(System.currentTimeMillis())

                            for (rowStart in 0 until totalCells step 7) {
                                Row(modifier = Modifier.fillMaxWidth()) {
                                    for (offset in 0 until 7) {
                                        val cellIndex = rowStart + offset
                                        val dayNum = cellIndex - firstDayOfWeek + 1
                                        if (dayNum in 1..daysInMonth) {
                                            val key = RallyDateFormat.dayKey(year, month, dayNum)
                                            val hasEvents = key in eventDayKeys
                                            val isSelected = key == selectedDayKey
                                            val isToday = key == todayKey
                                            Box(
                                                contentAlignment = Alignment.Center,
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .aspectRatio(1.1f)
                                                    .padding(2.dp)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(
                                                        when {
                                                            isSelected -> MaterialTheme.colorScheme.primary
                                                            isToday -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)
                                                            else -> Color.Transparent
                                                        }
                                                    )
                                                    .clickable {
                                                        selectedDayKey = if (isSelected) null else key
                                                    }
                                            ) {
                                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(
                                                        text = dayNum.toString(),
                                                        style = MaterialTheme.typography.bodyMedium,
                                                        fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                                                        color = if (isSelected) MaterialTheme.colorScheme.onPrimary
                                                        else MaterialTheme.colorScheme.onSurface
                                                    )
                                                    if (hasEvents) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(5.dp)
                                                                .clip(CircleShape)
                                                                .background(
                                                                    if (isSelected) Color.White else CoralSecondary
                                                                )
                                                        )
                                                    }
                                                }
                                            }
                                        } else {
                                            Spacer(Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Filter Header
                item {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (selectedDayKey == null) "All Scheduled Events (${filteredEvents.size})"
                            else "Selected Day Events (${filteredEvents.size})",
                            style = MaterialTheme.typography.titleLarge
                        )
                        if (selectedDayKey != null) {
                            TextButton(onClick = { selectedDayKey = null }) {
                                Text("Show All")
                            }
                        }
                    }
                }

                if (filteredEvents.isEmpty()) {
                    item {
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "No events scheduled for this view.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(18.dp)
                            )
                        }
                    }
                } else {
                    items(filteredEvents, key = { it.id }) { event ->
                        val eventTasks = uiState.allTasksByEvent[event.id].orEmpty()
                        val isReminded = event.id in uiState.remindedItemIds
                        Surface(
                            color = MaterialTheme.colorScheme.surface,
                            shape = MaterialTheme.shapes.medium,
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelectEvent(event.id) }
                                .testTag("calendar_event_${event.id}")
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
                                    Surface(
                                        color = MaterialTheme.colorScheme.primaryContainer,
                                        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = event.category,
                                            style = MaterialTheme.typography.labelSmall,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                    IconButton(
                                        onClick = {
                                            actions.toggleReminder(
                                                itemId = event.id,
                                                title = "Event Starting: ${event.title}",
                                                body = "${event.location} at ${RallyDateFormat.formatTime(event.startEpochMs)}",
                                                triggerAtEpochMs = event.startEpochMs - 15 * 60_000L
                                            )
                                        }
                                    ) {
                                        Icon(
                                            imageVector = if (isReminded) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone,
                                            contentDescription = "Set event reminder",
                                            tint = if (isReminded) CoralSecondary else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                Text(
                                    text = event.title,
                                    style = MaterialTheme.typography.titleLarge
                                )
                                if (event.description.isNotBlank()) {
                                    Text(
                                        text = event.description,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.Schedule, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(
                                            text = RallyDateFormat.formatDateTime(event.startEpochMs),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(
                                            text = event.location,
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                }
                                Text(
                                    text = if (eventTasks.isEmpty()) "Tap to view details & tasks"
                                    else "${eventTasks.size} volunteer tasks • Tap to sign up",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EventDetailView(
    event: RallyEvent,
    tasks: List<EventTask>,
    uiState: RallyWorkspaceUiState,
    actions: RallyWorkspaceActions,
    onBack: () -> Unit,
    onAddTask: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isReminded = event.id in uiState.remindedItemIds
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.fillMaxSize()
    ) {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .widthIn(max = 840.dp)
                .fillMaxSize()
        ) {
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier.testTag("event_detail_back")
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back to calendar")
                        }
                        Text("Event & Tasks", style = MaterialTheme.typography.titleLarge)
                    }
                    OutlinedButton(
                        onClick = {
                            actions.toggleReminder(
                                itemId = event.id,
                                title = "Event Starting: ${event.title}",
                                body = "${event.location} at ${RallyDateFormat.formatTime(event.startEpochMs)}",
                                triggerAtEpochMs = event.startEpochMs - 15 * 60_000L
                            )
                        }
                    ) {
                        Icon(
                            imageVector = if (isReminded) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(if (isReminded) "Reminded" else "Remind Me")
                    }
                }
            }

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
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Text(event.title, style = MaterialTheme.typography.headlineSmall)
                        Text(
                            text = "${RallyDateFormat.formatDateTime(event.startEpochMs)} – ${RallyDateFormat.formatTime(event.endEpochMs)}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "Location: ${event.location} • Lead: ${event.organizerName}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (event.description.isNotBlank()) {
                            Text(event.description, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            item {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Task Sign-Ups (${tasks.size})",
                        style = MaterialTheme.typography.titleLarge
                    )
                    if (uiState.currentRole.canManageEventsAndTasks) {
                        Button(
                            onClick = onAddTask,
                            modifier = Modifier.testTag("add_task_button")
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Add Task")
                        }
                    }
                }
            }

            if (tasks.isEmpty()) {
                item {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "No tasks created for this event yet.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(18.dp)
                        )
                    }
                }
            } else {
                items(tasks, key = { it.id }) { task ->
                    val claimed = uiState.currentUserId in task.assignedUids
                    val isFull = task.assignedCount >= task.capacity
                    val taskReminded = task.id in uiState.remindedItemIds
                    val progress = if (task.capacity <= 0L) 0f
                    else (task.assignedCount.toFloat() / task.capacity.toFloat()).coerceIn(0f, 1f)

                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = MaterialTheme.shapes.medium,
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (claimed) EmeraldTertiary else MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                        ),
                        modifier = Modifier.fillMaxWidth()
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
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(task.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(
                                        text = "Deadline: ${RallyDateFormat.formatDateTime(task.deadlineEpochMs)} (${RallyDateFormat.countdownLabel(task.deadlineEpochMs)})",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = CoralSecondary
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        actions.toggleReminder(
                                            itemId = task.id,
                                            title = "Task Deadline: ${task.title}",
                                            body = "Shift deadline for ${event.title}",
                                            triggerAtEpochMs = task.deadlineEpochMs - 30 * 60_000L
                                        )
                                    }
                                ) {
                                    Icon(
                                        imageVector = if (taskReminded) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone,
                                        contentDescription = "Task deadline reminder",
                                        tint = if (taskReminded) CoralSecondary else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            if (task.description.isNotBlank()) {
                                Text(task.description, style = MaterialTheme.typography.bodyMedium)
                            }

                            LinearProgressIndicator(
                                progress = { progress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(7.dp)
                                    .clip(RoundedCornerShape(999.dp))
                            )

                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "${task.assignedCount}/${task.capacity} slots filled",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Button(
                                    onClick = { actions.toggleTaskSignup(event.id, task.id) },
                                    enabled = claimed || !isFull,
                                    modifier = Modifier.testTag("task_signup_button_${task.id}")
                                ) {
                                    if (claimed) {
                                        Icon(Icons.Rounded.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Leave Shift")
                                    } else if (isFull) {
                                        Text("Shift Full")
                                    } else {
                                        Text("Sign Up")
                                    }
                                }
                            }

                            if (task.assignedNames.isNotEmpty()) {
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    task.assignedNames.forEach { volunteer ->
                                        Surface(
                                            color = MaterialTheme.colorScheme.surfaceVariant,
                                            shape = RoundedCornerShape(999.dp)
                                        ) {
                                            Text(
                                                text = volunteer,
                                                style = MaterialTheme.typography.labelSmall,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CreateEventDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String, String, String, Long, Long) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Main Event") }
    var daysFromNow by remember { mutableIntStateOf(1) }
    var durationHours by remember { mutableIntStateOf(2) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Calendar Event") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it.take(100) },
                    label = { Text("Event Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("event_title_input")
                )
                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it.take(160) },
                    label = { Text("Location / Venue") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("event_location_input")
                )
                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it.take(40) },
                    label = { Text("Category") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it.take(500) },
                    label = { Text("Description") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Schedule Offset", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(0 to "Today", 1 to "+1 Day", 3 to "+3 Days", 7 to "+7 Days").forEach { (d, label) ->
                        FilterChip(
                            selected = daysFromNow == d,
                            onClick = { daysFromNow = d },
                            label = { Text(label) }
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(1, 2, 4).forEach { hrs ->
                        FilterChip(
                            selected = durationHours == hrs,
                            onClick = { durationHours = hrs },
                            label = { Text("${hrs}h") }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val startMs = System.currentTimeMillis() + (daysFromNow * 24L + 2L) * 3_600_000L
                    val endMs = startMs + durationHours * 3_600_000L
                    onCreate(title, description, location, category, startMs, endMs)
                },
                enabled = title.trim().length >= 2 && location.trim().isNotEmpty(),
                modifier = Modifier.testTag("confirm_create_event_button")
            ) {
                Text("Publish Event")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun CreateTaskDialog(
    channels: List<ChatChannel>,
    onDismiss: () -> Unit,
    onCreate: (String, String, Long, Long, String?) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var capacityText by remember { mutableStateOf("5") }
    var deadlineHours by remember { mutableLongStateOf(12L) }
    var selectedChannelId by remember { mutableStateOf(channels.firstOrNull()?.id) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Event Task") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it.take(100) },
                    label = { Text("Task Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("task_title_input")
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it.take(400) },
                    label = { Text("Instructions") },
                    maxLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = capacityText,
                    onValueChange = { capacityText = it.filter { ch -> ch.isDigit() }.take(2) },
                    label = { Text("Volunteer Capacity (1–50)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("task_capacity_input")
                )
                Text("Deadline Window", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(2L to "+2h", 12L to "+12h", 24L to "+24h", 48L to "+48h").forEach { (h, label) ->
                        FilterChip(
                            selected = deadlineHours == h,
                            onClick = { deadlineHours = h },
                            label = { Text(label) }
                        )
                    }
                }
                if (channels.isNotEmpty()) {
                    Text("Linked Team Chat", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        channels.take(3).forEach { ch ->
                            FilterChip(
                                selected = selectedChannelId == ch.id,
                                onClick = { selectedChannelId = ch.id },
                                label = { Text("#${ch.name}") }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            val capacity = capacityText.toLongOrNull()?.coerceIn(1L, 50L) ?: 1L
            Button(
                onClick = {
                    val deadlineMs = System.currentTimeMillis() + deadlineHours * 3_600_000L
                    onCreate(title, description, deadlineMs, capacity, selectedChannelId)
                },
                enabled = title.trim().length >= 2,
                modifier = Modifier.testTag("confirm_create_task_button")
            ) {
                Text("Add Task")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
