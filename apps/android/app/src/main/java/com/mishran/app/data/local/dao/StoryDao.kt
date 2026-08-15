// apps/android/app/src/main/java/com/mishran/app/data/local/dao/StoryDao.kt — P2 net-new (stories).
//
// Room DAO for the offline journal cache — a deliberate mirror of ProductDao
// (observe/get + upsert + freshness janitor) so the ETag/offline pattern reads
// identically across the two caches. `observeLatest` additionally serves the
// Home "From the journal" rail with the three newest rows; ordering is
// publishedAt DESC (ISO-8601 sorts lexicographically), falling back to rowid
// for rows whose publish date is null so they never crowd out dated ones.
package com.mishran.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.mishran.app.data.local.entity.StoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StoryDao {

    /** Reactive journal, newest first; re-emits on every upsert. */
    @Query("SELECT * FROM stories ORDER BY publishedAt IS NULL, publishedAt DESC")
    fun observeAll(): Flow<List<StoryEntity>>

    /** The newest [limit] rows — the Home "From the journal" rail. */
    @Query(
        """
        SELECT * FROM stories
        ORDER BY publishedAt IS NULL, publishedAt DESC
        LIMIT :limit
        """,
    )
    fun observeLatest(limit: Int): Flow<List<StoryEntity>>

    /** Reactive single story for the reader; null if absent. */
    @Query("SELECT * FROM stories WHERE slug = :slug LIMIT 1")
    fun observeBySlug(slug: String): Flow<StoryEntity?>

    /** One-shot newest-first snapshot (refresh path). */
    @Query("SELECT * FROM stories ORDER BY publishedAt IS NULL, publishedAt DESC")
    suspend fun getAll(): List<StoryEntity>

    /** Insert-or-replace list rows (body left null — the list endpoint omits it). */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(stories: List<StoryEntity>)

    /** Insert-or-replace a full reader row, `body` included. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDetail(story: StoryEntity)

    /** Remove rows past their freshness window. Returns rows deleted. */
    @Query("DELETE FROM stories WHERE staleAt < :now")
    suspend fun deleteStale(now: Long): Int

    /** Push every row's freshness cutoff out (called on a 304 — cache still valid). */
    @Query("UPDATE stories SET staleAt = :staleAt")
    suspend fun extendFreshness(staleAt: Long)

    @Query("SELECT COUNT(*) FROM stories")
    suspend fun count(): Int
}
