// apps/android/app/src/main/java/com/mishran/app/data/local/dao/ProductDao.kt — Task 9.1.
//
// Room DAO for the offline catalog cache. `observeAll`/`observeBySlug` back the
// reactive catalog + detail screens (Flow re-emits on every upsert); the suspend
// variants serve the repository's one-shot refresh path. `deleteStale(now)` is
// the janitor the periodic refresh worker calls to drop rows past their
// freshness window — a policy knob, not called on every render (see CatalogRepository).
package com.mishran.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.mishran.app.data.local.entity.ProductEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ProductDao {

    /** Reactive full catalog, name-sorted; re-emits on every upsert. */
    @Query("SELECT * FROM products ORDER BY name ASC")
    fun observeAll(): Flow<List<ProductEntity>>

    /**
     * Reactive featured products (the Home best-sellers rail), name-sorted.
     * Empty when nothing is flagged yet — the caller falls back to a plain
     * slice of [observeAll]. `featured = 1` misses NULL (unflagged /
     * pre-migration rows), which is the intent.
     */
    @Query("SELECT * FROM products WHERE featured = 1 ORDER BY name ASC")
    fun observeFeatured(): Flow<List<ProductEntity>>

    /** Reactive single product for the detail screen; null if absent. */
    @Query("SELECT * FROM products WHERE slug = :slug LIMIT 1")
    fun observeBySlug(slug: String): Flow<ProductEntity?>

    /** One-shot full catalog snapshot (refresh path). */
    @Query("SELECT * FROM products ORDER BY name ASC")
    suspend fun getAll(): List<ProductEntity>

    /** Insert-or-replace the freshly fetched page; REPLACE drops stale columns. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(products: List<ProductEntity>)

    /** Remove rows whose freshness window has elapsed. Returns rows deleted. */
    @Query("DELETE FROM products WHERE staleAt < :now")
    suspend fun deleteStale(now: Long): Int

    /** Push every row's freshness cutoff out to [staleAt] (called on a 304 — server confirms the cache is still valid). */
    @Query("UPDATE products SET staleAt = :staleAt")
    suspend fun extendFreshness(staleAt: Long)

    @Query("SELECT COUNT(*) FROM products")
    suspend fun count(): Int
}
