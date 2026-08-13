// apps/android/app/src/main/java/com/mishran/app/data/local/dao/CartDao.kt — Task 10.1.
//
// Room DAO for the local cart. observeItems backs the cart screen (re-emits on
// every mutation); the suspend one-shots serve the repository. There is no
// server cart in v1 — this table is the cart.
package com.mishran.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.mishran.app.data.local.entity.CartItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CartDao {

    /** Live cart, oldest line first; re-emits on every mutation. */
    @Query("SELECT * FROM cart_items ORDER BY addedAt ASC")
    fun observeItems(): Flow<List<CartItemEntity>>

    /** Insert-or-replace a line (add + setQuantity share the path). */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: CartItemEntity)

    @Query("DELETE FROM cart_items WHERE productId = :productId")
    suspend fun delete(productId: String)

    /** One-shot line lookup for quantity stacking. */
    @Query("SELECT * FROM cart_items WHERE productId = :productId LIMIT 1")
    suspend fun findByProductId(productId: String): CartItemEntity?

    @Query("DELETE FROM cart_items")
    suspend fun clear()

    @Query("SELECT COUNT(*) FROM cart_items")
    suspend fun count(): Int
}
