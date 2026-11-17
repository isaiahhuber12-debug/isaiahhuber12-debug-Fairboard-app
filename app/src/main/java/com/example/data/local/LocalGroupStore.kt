package com.example.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "guest_sessions")
data class GuestSessionEntity(
    @PrimaryKey val groupCode: String,
    val groupName: String,
    val displayName: String,
    val participantId: String,
    val lastActiveAtMs: Long
)

@Entity(tableName = "local_events")
data class LocalEventEntity(
    @PrimaryKey val id: String,
    val groupCode: String,
    val title: String,
    val description: String,
    val location: String,
    val category: String,
    val startEpochMs: Long,
    val endEpochMs: Long,
    val organizerName: String
)

@Entity(tableName = "local_tasks")
data class LocalTaskEntity(
    @PrimaryKey val id: String,
    val groupCode: String,
    val eventId: String,
    val title: String,
    val description: String,
    val deadlineEpochMs: Long,
    val capacity: Long,
    val assignedCount: Long,
    val assignedUidsCsv: String,
    val assignedNamesCsv: String,
    val status: String
)

@Entity(tableName = "local_channels")
data class LocalChannelEntity(
    @PrimaryKey val id: String,
    val groupCode: String,
    val name: String,
    val description: String,
    val accessLevel: String,
    val messageCount: Long,
    val lastMessagePreview: String
)

@Entity(tableName = "local_messages")
data class LocalMessageEntity(
    @PrimaryKey val id: String,
    val groupCode: String,
    val channelId: String,
    val senderId: String,
    val senderName: String,
    val senderRole: String,
    val text: String,
    val messageType: String,
    val createdAtMs: Long
)

@Entity(tableName = "local_notifications")
data class LocalNotificationEntity(
    @PrimaryKey val id: String,
    val groupCode: String,
    val title: String,
    val body: String,
    val notificationType: String,
    val targetScope: String,
    val targetChannelName: String?,
    val senderName: String,
    val scheduledForEpochMs: Long? = null,
    val approvalStatus: String = "APPROVED",
    val createdAtMs: Long
)

@Dao
interface LocalRallyDao {
    @Query("SELECT * FROM guest_sessions ORDER BY lastActiveAtMs DESC LIMIT 1")
    fun observeLatestSession(): Flow<GuestSessionEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSession(session: GuestSessionEntity)

    @Query("DELETE FROM guest_sessions")
    suspend fun clearSessions()

    @Query("SELECT * FROM local_events WHERE groupCode = :code ORDER BY startEpochMs ASC")
    fun observeEvents(code: String): Flow<List<LocalEventEntity>>

    @Query("SELECT COUNT(*) FROM local_events WHERE groupCode = :code")
    suspend fun countEvents(code: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvents(events: List<LocalEventEntity>)

    @Query("SELECT * FROM local_tasks WHERE groupCode = :code AND eventId = :eventId ORDER BY deadlineEpochMs ASC")
    fun observeTasksForEvent(code: String, eventId: String): Flow<List<LocalTaskEntity>>

    @Query("SELECT * FROM local_tasks WHERE groupCode = :code ORDER BY deadlineEpochMs ASC")
    fun observeAllTasks(code: String): Flow<List<LocalTaskEntity>>

    @Query("SELECT * FROM local_tasks WHERE id = :taskId LIMIT 1")
    suspend fun getTask(taskId: String): LocalTaskEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTasks(tasks: List<LocalTaskEntity>)

    @Query("SELECT * FROM local_channels WHERE groupCode = :code")
    fun observeChannels(code: String): Flow<List<LocalChannelEntity>>

    @Query("SELECT * FROM local_channels WHERE id = :channelId LIMIT 1")
    suspend fun getChannel(channelId: String): LocalChannelEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChannels(channels: List<LocalChannelEntity>)

    @Query("SELECT * FROM local_messages WHERE groupCode = :code AND channelId = :channelId ORDER BY createdAtMs ASC")
    fun observeMessages(code: String, channelId: String): Flow<List<LocalMessageEntity>>

    @Query("SELECT * FROM local_messages WHERE id = :messageId LIMIT 1")
    suspend fun getMessage(messageId: String): LocalMessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessages(messages: List<LocalMessageEntity>)

    @Query("SELECT * FROM local_notifications WHERE groupCode = :code ORDER BY createdAtMs DESC")
    fun observeNotifications(code: String): Flow<List<LocalNotificationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotifications(notifications: List<LocalNotificationEntity>)
}

@Database(
    entities = [
        GuestSessionEntity::class,
        LocalEventEntity::class,
        LocalTaskEntity::class,
        LocalChannelEntity::class,
        LocalMessageEntity::class,
        LocalNotificationEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class LocalRallyDatabase : RoomDatabase() {
    abstract fun dao(): LocalRallyDao

    companion object {
        @Volatile
        private var INSTANCE: LocalRallyDatabase? = null

        fun getInstance(context: Context): LocalRallyDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    LocalRallyDatabase::class.java,
                    "rallyhub_local.db"
                ).fallbackToDestructiveMigration(true).build().also { INSTANCE = it }
            }
        }
    }
}
