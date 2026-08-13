// apps/android/app/src/main/java/com/mishran/app/data/local/dao/OrderDao.kt — Task 11.1.
//
// Order cache queries. observeAll feeds the orders tab (newest first, capped
// at the page size the repository fetches); replaceAll gives the refresh a
// transactional clear+insert so cancelled/removed orders drop out atomically.
package com.mishran.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.mishran.app.data.local.entity.OrderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OrderDao {

    @Query("SELECT * FROM orders ORDER BY createdAtEpoch DESC LIMIT 20")
    fun observeAll(): Flow<List<OrderEntity>>

    @Query("SELECT * FROM orders WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): OrderEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(orders: List<OrderEntity>)

    @Query("DELETE FROM orders")
    suspend fun deleteAll()

    /** Atomic clear+insert — a refresh either fully lands or leaves the cache alone. */
    @Transaction
    suspend fun replaceAll(orders: List<OrderEntity>) {
        deleteAll()
        insertAll(orders)
    }

    @Query("SELECT COUNT(*) FROM orders")
    suspend fun count(): Int
}
