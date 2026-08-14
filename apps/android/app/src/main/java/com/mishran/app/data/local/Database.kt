// apps/android/app/src/main/java/com/mishran/app/data/local/Database.kt — Tasks 9.1 / 10.1 / 11.1 / 11.3.
//
// Room database for the offline-first catalog + local cart + order cache +
// push dedup ledger. v2 added cart_items; v3 the orders cache; v4 the
// notifications_seen table; destructive fallback is still acceptable
// pre-launch. exportSchema is off for now — flip on (and configure
// room.schemaLocation) once the schema stabilizes so migration tests can
// golden-file it.
package com.mishran.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.mishran.app.data.local.dao.CartDao
import com.mishran.app.data.local.dao.NotificationSeenDao
import com.mishran.app.data.local.dao.OrderDao
import com.mishran.app.data.local.dao.ProductDao
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.local.entity.NotificationSeenEntity
import com.mishran.app.data.local.entity.OrderEntity
import com.mishran.app.data.local.entity.ProductEntity

@TypeConverters(Converters::class)
@Database(
    entities = [
        ProductEntity::class,
        CartItemEntity::class,
        OrderEntity::class,
        NotificationSeenEntity::class,
    ],
    version = 4,
    exportSchema = false,
)
abstract class MishranDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
    abstract fun cartDao(): CartDao
    abstract fun orderDao(): OrderDao
    abstract fun notificationSeenDao(): NotificationSeenDao
}

/**
 * List<String> <-> String for Room columns (dietaryTags / allergens / images).
 * Pipe-joined: values are simple tokens / URLs and never contain the delimiter.
 * An empty list round-trips through "" -> emptyList().
 */
class Converters {

    @TypeConverter
    fun fromStringList(value: List<String>): String = value.joinToString(DELIMITER)

    @TypeConverter
    fun toStringList(value: String): List<String> =
        if (value.isEmpty()) emptyList() else value.split(DELIMITER)

    private companion object {
        const val DELIMITER = "|"
    }
}
