package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.data.model.MemberRole
import com.example.ui.theme.AmberContainer
import com.example.ui.theme.AmberWarning
import com.example.ui.theme.CobaltContainer
import com.example.ui.theme.CobaltPrimary
import com.example.ui.theme.CoralContainer
import com.example.ui.theme.CoralSecondary
import com.example.ui.theme.EmeraldContainer
import com.example.ui.theme.EmeraldTertiary
import com.example.ui.theme.OnCobaltContainer
import com.example.ui.theme.OnCoralContainer
import com.example.ui.theme.OnEmeraldContainer
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Composable
fun RoleBadge(
    role: MemberRole,
    modifier: Modifier = Modifier
) {
    val (bg, fg) = when (role) {
        MemberRole.CREATOR -> CoralContainer to OnCoralContainer
        MemberRole.ADMIN -> CobaltContainer to OnCobaltContainer
        MemberRole.ORGANIZER -> EmeraldContainer to OnEmeraldContainer
        MemberRole.PARTICIPANT -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        color = bg,
        contentColor = fg,
        shape = RoundedCornerShape(999.dp),
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            if (role == MemberRole.CREATOR || role == MemberRole.ADMIN) {
                Icon(
                    imageVector = Icons.Rounded.Shield,
                    contentDescription = null,
                    modifier = Modifier.size(12.dp)
                )
                Spacer(Modifier.width(4.dp))
            }
            Text(
                text = role.label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun GroupCodePill(
    code: String,
    onCopied: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val clipboard = LocalClipboardManager.current
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
            .minimumInteractiveComponentSize()
            .clip(RoundedCornerShape(10.dp))
            .clickable {
                clipboard.setText(AnnotatedString(code))
                onCopied?.invoke()
            }
            .testTag("group_code_pill")
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
        ) {
            Text(
                text = code,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.width(6.dp))
            Icon(
                imageVector = Icons.Rounded.ContentCopy,
                contentDescription = "Copy group code",
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

@Composable
fun MetricStatTile(
    label: String,
    value: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        shape = MaterialTheme.shapes.medium,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Box(
                modifier = Modifier
                    .width(24.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(accent)
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun FillRateRing(
    percent: Int,
    filled: Int,
    total: Int,
    modifier: Modifier = Modifier
) {
    val primary = CobaltPrimary
    val track = MaterialTheme.colorScheme.surfaceVariant
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(76.dp)) {
            Canvas(modifier = Modifier.size(76.dp)) {
                val strokeWidth = 8.dp.toPx()
                val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
                val topLeft = Offset(strokeWidth / 2f, strokeWidth / 2f)
                drawArc(
                    color = track,
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )
                drawArc(
                    color = primary,
                    startAngle = -90f,
                    sweepAngle = (percent.coerceIn(0, 100) / 100f) * 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )
            }
            Text(
                text = "$percent%",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(Modifier.width(16.dp))
        Column {
            Text(
                text = "Task Coverage",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "$filled of $total volunteer slots filled",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun EngagementBarChart(
    items: List<Pair<String, Long>>,
    modifier: Modifier = Modifier
) {
    if (items.isEmpty()) {
        Text(
            text = "No channel activity recorded yet.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        return
    }
    val maxVal = maxOf(1L, items.maxOf { it.second })
    val barColors = listOf(CobaltPrimary, CoralSecondary, EmeraldTertiary, AmberWarning)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = modifier.fillMaxWidth()) {
        items.forEachIndexed { index, (name, count) ->
            val ratio = (count.toFloat() / maxVal.toFloat()).coerceIn(0.05f, 1f)
            val color = barColors[index % barColors.size]
            Column {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "#$name",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "$count msgs",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(ratio)
                            .height(8.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(color)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateTimePickerField(
    label: String,
    epochMs: Long,
    onDateTimeSelected: (Long) -> Unit,
    modifier: Modifier = Modifier,
    testTagPrefix: String = "datetime"
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Text(text = label, style = MaterialTheme.typography.labelLarge)
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedButton(
                onClick = { showDatePicker = true },
                modifier = Modifier
                    .weight(1f)
                    .minimumInteractiveComponentSize()
                    .testTag("${testTagPrefix}_date_button")
            ) {
                Icon(Icons.Rounded.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    text = RallyDateFormat.formatDateFull(epochMs),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            OutlinedButton(
                onClick = { showTimePicker = true },
                modifier = Modifier
                    .weight(0.85f)
                    .minimumInteractiveComponentSize()
                    .testTag("${testTagPrefix}_time_button")
            ) {
                Icon(Icons.Rounded.Schedule, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    text = RallyDateFormat.formatTime(epochMs),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }

    if (showDatePicker) {
        val localCal = remember(epochMs) { Calendar.getInstance().apply { timeInMillis = epochMs } }
        val initialUtcMs = remember(epochMs) {
            Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                clear()
                set(
                    localCal.get(Calendar.YEAR),
                    localCal.get(Calendar.MONTH),
                    localCal.get(Calendar.DAY_OF_MONTH)
                )
            }.timeInMillis
        }
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = initialUtcMs)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { selectedUtcMs ->
                            val utcCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                                timeInMillis = selectedUtcMs
                            }
                            val updatedLocal = Calendar.getInstance().apply {
                                timeInMillis = epochMs
                                set(Calendar.YEAR, utcCal.get(Calendar.YEAR))
                                set(Calendar.MONTH, utcCal.get(Calendar.MONTH))
                                set(Calendar.DAY_OF_MONTH, utcCal.get(Calendar.DAY_OF_MONTH))
                            }
                            onDateTimeSelected(updatedLocal.timeInMillis)
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("Apply Date")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showTimePicker) {
        val localCal = remember(epochMs) { Calendar.getInstance().apply { timeInMillis = epochMs } }
        val timePickerState = rememberTimePickerState(
            initialHour = localCal.get(Calendar.HOUR_OF_DAY),
            initialMinute = localCal.get(Calendar.MINUTE),
            is24Hour = false
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Select Time") },
            text = {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth()) {
                    TimePicker(state = timePickerState)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val updatedLocal = Calendar.getInstance().apply {
                            timeInMillis = epochMs
                            set(Calendar.HOUR_OF_DAY, timePickerState.hour)
                            set(Calendar.MINUTE, timePickerState.minute)
                            set(Calendar.SECOND, 0)
                            set(Calendar.MILLISECOND, 0)
                        }
                        onDateTimeSelected(updatedLocal.timeInMillis)
                        showTimePicker = false
                    }
                ) {
                    Text("Apply Time")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
fun ReminderEditorDialog(
    itemTitle: String,
    targetEpochMs: Long,
    currentReminderEpochMs: Long?,
    onDismiss: () -> Unit,
    onSave: (Long) -> Unit,
    onRemove: () -> Unit
) {
    var triggerMs by remember(currentReminderEpochMs, targetEpochMs) {
        mutableLongStateOf(
            currentReminderEpochMs ?: maxOf(System.currentTimeMillis() + 60_000L, targetEpochMs - 15 * 60_000L)
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (currentReminderEpochMs != null) "Edit Reminder Time" else "Set Reminder Time") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = itemTitle,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text("Quick Offsets", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(15 to "15m before", 60 to "1h before", 1440 to "1d before").forEach { (mins, label) ->
                        val presetMs = maxOf(System.currentTimeMillis() + 60_000L, targetEpochMs - mins * 60_000L)
                        FilterChip(
                            selected = kotlin.math.abs(triggerMs - presetMs) < 60_000L,
                            onClick = { triggerMs = presetMs },
                            label = { Text(label) }
                        )
                    }
                }
                DateTimePickerField(
                    label = "Reminder Date & Time",
                    epochMs = triggerMs,
                    onDateTimeSelected = { triggerMs = it },
                    testTagPrefix = "reminder_picker"
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(triggerMs) },
                modifier = Modifier.testTag("save_reminder_button")
            ) {
                Text("Save Reminder")
            }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (currentReminderEpochMs != null) {
                    TextButton(
                        onClick = onRemove,
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.testTag("remove_reminder_button")
                    ) {
                        Icon(Icons.Rounded.DeleteOutline, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Remove")
                    }
                }
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        }
    )
}

object RallyDateFormat {
    private val dateShort = SimpleDateFormat("MMM d", Locale.getDefault())
    private val dateFull = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    private val dateTimeShort = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
    private val timeShort = SimpleDateFormat("h:mm a", Locale.getDefault())
    private val monthYear = SimpleDateFormat("MMMM yyyy", Locale.getDefault())

    fun formatDate(epochMs: Long): String = dateShort.format(Date(epochMs))
    fun formatDateFull(epochMs: Long): String = dateFull.format(Date(epochMs))
    fun formatDateTime(epochMs: Long): String = dateTimeShort.format(Date(epochMs))
    fun formatTime(epochMs: Long): String = timeShort.format(Date(epochMs))
    fun formatMonthYear(cal: Calendar): String = monthYear.format(cal.time)

    fun dayKey(epochMs: Long): String {
        val cal = Calendar.getInstance().apply { timeInMillis = epochMs }
        return "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.MONTH)}-${cal.get(Calendar.DAY_OF_MONTH)}"
    }

    fun dayKey(year: Int, month: Int, dayOfMonth: Int): String = "$year-$month-$dayOfMonth"

    fun countdownLabel(targetEpochMs: Long): String {
        val diffMs = targetEpochMs - System.currentTimeMillis()
        if (diffMs <= 0L) return "Now / Passed"
        val minutes = diffMs / 60_000L
        val hours = minutes / 60L
        val days = hours / 24L
        return when {
            days >= 1L -> "in ${days}d ${hours % 24}h"
            hours >= 1L -> "in ${hours}h ${minutes % 60}m"
            else -> "in ${minutes}m"
        }
    }
}
