package com.example.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.example.MainActivity
import com.example.R
import com.example.data.model.NotificationType

object RallyNotificationHelper {

    const val CHANNEL_ANNOUNCEMENTS = "rallyhub_announcements"
    const val CHANNEL_TASKS = "rallyhub_tasks"
    const val CHANNEL_REMINDERS = "rallyhub_reminders"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_ANNOUNCEMENTS,
                    context.getString(R.string.notif_channel_announcements),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "High-priority group announcements from administrators"
                },
                NotificationChannel(
                    CHANNEL_TASKS,
                    context.getString(R.string.notif_channel_tasks),
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Targeted updates for your volunteer teams and chat groups"
                },
                NotificationChannel(
                    CHANNEL_REMINDERS,
                    context.getString(R.string.notif_channel_reminders),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Upcoming task deadlines and event start reminders"
                }
            )
            manager.createNotificationChannels(channels)
        }
    }

    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    fun postNotification(
        context: Context,
        id: Int,
        title: String,
        body: String,
        type: NotificationType
    ) {
        if (!hasNotificationPermission(context)) return
        ensureChannels(context)

        val channelId = when (type) {
            NotificationType.ANNOUNCEMENT -> CHANNEL_ANNOUNCEMENTS
            NotificationType.TASK_UPDATE -> CHANNEL_TASKS
            NotificationType.DEADLINE_REMINDER -> CHANNEL_REMINDERS
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(
                if (type == NotificationType.TASK_UPDATE) NotificationCompat.PRIORITY_DEFAULT
                else NotificationCompat.PRIORITY_HIGH
            )
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (se: SecurityException) {
            Log.w("RallyNotif", "Notification permission missing: ${se.message}")
        }
    }

    fun scheduleReminder(
        context: Context,
        reminderId: String,
        title: String,
        body: String,
        triggerAtEpochMs: Long
    ) {
        ensureChannels(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra(ReminderReceiver.EXTRA_TITLE, title)
            putExtra(ReminderReceiver.EXTRA_BODY, body)
            putExtra(ReminderReceiver.EXTRA_ID, reminderId.hashCode())
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminderId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val safeTrigger = maxOf(triggerAtEpochMs, System.currentTimeMillis() + 3_000L)
        alarmManager.set(AlarmManager.RTC_WAKEUP, safeTrigger, pendingIntent)
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "RallyHub Reminder"
        val body = intent.getStringExtra(EXTRA_BODY) ?: "An upcoming event or task deadline is approaching."
        val id = intent.getIntExtra(EXTRA_ID, System.currentTimeMillis().toInt())
        RallyNotificationHelper.postNotification(
            context = context,
            id = id,
            title = title,
            body = body,
            type = NotificationType.DEADLINE_REMINDER
        )
    }

    companion object {
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_BODY = "extra_body"
        const val EXTRA_ID = "extra_id"
    }
}
