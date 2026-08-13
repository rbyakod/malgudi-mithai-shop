// apps/android/app/src/main/java/com/mishran/app/data/local/dao/NotificationSeenDao.kt — Task 11.3.
//
// Dedup queries for the push ledger: exists() gates the notification post,
// purgeOlderThan() trims the table to a 30-day sliding window.
package com.mishran.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.mishran.app.data.local.entity.NotificationSeenEntity

@Dao
interface NotificationSeenDao {

    @Query("SELECT EXISTS(SELECT 1 FROM notifications_seen WHERE eventId = :eventId)")
    suspend fun exists(eventId: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: NotificationSeenEntity)

    @Query("DELETE FROM notifications_seen WHERE seenAt < :cutoffEpochMs")
    suspend fun purgeOlderThan(cutoffEpochMs: Long): Int

    @Query("SELECT COUNT(*) FROM notifications_seen")
    suspend fun count(): Int
}
