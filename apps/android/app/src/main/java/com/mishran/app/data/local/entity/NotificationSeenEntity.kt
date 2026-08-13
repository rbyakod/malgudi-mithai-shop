// apps/android/app/src/main/java/com/mishran/app/data/local/entity/NotificationSeenEntity.kt — Task 11.3.
//
// Push dedup ledger: one row per event_id the app has already surfaced.
// FCM delivery is at-least-once, so the service checks this table before
// posting a notification; rows older than 30 days are purged on write.
package com.mishran.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notifications_seen")
data class NotificationSeenEntity(
    /** The push's event_id — the dedup key. */
    @PrimaryKey val eventId: String,
    val seenAt: Long,
)
