// apps/android/app/src/main/java/com/mishran/app/data/repository/StoryRepository.kt — P2 net-new (stories).
//
// Single source of truth for the journal, a deliberate line-for-line mirror of
// CatalogRepository's ETag/offline pattern: getStories() emits the Room cache,
// refreshes with `If-None-Match` (a 200 upserts + stores the new ETag; a 304
// extends every row's freshness cutoff; any failure is swallowed so the cache
// keeps serving offline), then re-emits. No periodic worker yet — the journal
// refreshes on open + pull-to-refresh, which its update cadence comfortably
// covers (see follow-ups).
//
// Reader policy (documented decision): getStory() always tries the network
// FIRST for the flattened body, caching the full row (body column included)
// on success; only a failed fetch falls back to the cached body — so the
// reader shows fresh text whenever reachable and the best available text when
// not. Trade-off: a later list upsert REPLACEs rows without a body, evicting a
// cached one; the reader then degrades to title + excerpt, which is the same
// surface the list itself offers.
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.api.models.StoriesGet200Response
import com.mishran.api.models.Story
import com.mishran.api.models.StoryDetail
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.local.dao.StoryDao
import com.mishran.app.data.local.entity.StoryEntity
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.remote.resolveMediaUrl
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StoryRepository @Inject constructor(
    private val api: MishranApi,
    private val storyDao: StoryDao,
    private val dataStore: DataStore<Preferences>,
) {

    /**
     * Emit the cached journal, refresh from the network (conditional on the
     * stored ETag unless [force]), then emit the fresh rows. Network failures
     * never throw to the collector — same contract as CatalogRepository.
     */
    fun getStories(force: Boolean = false): Flow<List<Story>> = flow {
        emit(storyDao.getAll().map { it.toDomain() })
        refreshFromNetwork(force)
        emit(storyDao.getAll().map { it.toDomain() })
    }

    /** Network-only refresh for pull-to-refresh (no worker is scheduled yet). */
    suspend fun refreshNow(force: Boolean = true) {
        refreshFromNetwork(force)
    }

    /** Reactive latest stories (Home "From the journal" rail). */
    fun observeLatest(limit: Int): Flow<List<Story>> =
        storyDao.observeLatest(limit).map { rows -> rows.map { it.toDomain() } }

    /**
     * Reader lookup: network-first (the only place `body` comes from), caching
     * the full row on success; on failure, the cached body column if the row
     * was ever opened before. Returns null only when both miss — the caller
     * renders a not-found/offline state.
     */
    suspend fun getStory(slug: String): StoryDetail? {
        try {
            val detail = api.getStory(slug).data ?: return cachedDetail(slug)
            storyDao.upsertDetail(detail.toEntity(now() + STALE_WINDOW_MS))
            return detail
        } catch (e: Exception) {
            return cachedDetail(slug)
        }
    }

    /** Build a reader payload from whatever the cache holds (body may be null). */
    private suspend fun cachedDetail(slug: String): StoryDetail? =
        storyDao.observeBySlug(slug).first()?.toDetail()

    private suspend fun refreshFromNetwork(force: Boolean) {
        val etag = if (force) null else dataStore.data.first()[DataStoreKeys.STORIES_ETAG]
        val response: Response<StoriesGet200Response> = try {
            api.getStories(etag = etag)
        } catch (e: Exception) {
            return // offline — keep serving the cache
        }
        when (response.code()) {
            HTTP_NOT_MODIFIED -> storyDao.extendFreshness(now() + STALE_WINDOW_MS)
            else -> {
                val stories = response.body()?.data?.items ?: return
                val staleAt = now() + STALE_WINDOW_MS
                storyDao.upsertAll(stories.map { it.toEntity(staleAt) })
                response.headers()[HEADER_ETAG]?.let { newEtag ->
                    dataStore.edit { it[DataStoreKeys.STORIES_ETAG] = newEtag }
                }
            }
        }
    }

    private companion object {
        const val HTTP_NOT_MODIFIED = 304
        const val HEADER_ETAG = "ETag"
        // Matches the catalog's freshness window; there is no story worker yet,
        // so rows only go stale-beyond-purge if deleteStale were wired up.
        const val STALE_WINDOW_MS = 6L * 60 * 60 * 1000
    }
}

/** Map a freshly fetched list story to its cache row (no body on this path). */
internal fun Story.toEntity(staleAt: Long): StoryEntity = StoryEntity(
    id = id,
    slug = slug,
    title = title,
    pillar = pillar.value,
    excerpt = excerpt,
    heroImage = heroImage?.let(::resolveMediaUrl),
    publishedAt = publishedAt,
    updatedAt = updatedAt,
    staleAt = staleAt,
)

/** Map a fetched reader row to its cache row, flattened body included. */
internal fun StoryDetail.toEntity(staleAt: Long): StoryEntity = StoryEntity(
    id = id,
    slug = slug,
    title = title,
    pillar = pillar.value,
    excerpt = excerpt,
    heroImage = heroImage?.let(::resolveMediaUrl),
    publishedAt = publishedAt,
    updatedAt = updatedAt,
    body = body,
    staleAt = staleAt,
)

/** Restore a cache row to the list contract model; value-string maps back to the enum. */
internal fun StoryEntity.toDomain(): Story = Story(
    id = id,
    slug = slug,
    title = title,
    pillar = Story.Pillar.entries.firstOrNull { it.value == pillar }
        ?: Story.Pillar.journal,
    excerpt = excerpt,
    heroImage = heroImage?.let(::resolveMediaUrl), // idempotent on resolved rows
    publishedAt = publishedAt,
    updatedAt = updatedAt,
)

/** Restore a cache row to the reader contract model (offline body fallback). */
internal fun StoryEntity.toDetail(): StoryDetail = StoryDetail(
    id = id,
    slug = slug,
    title = title,
    pillar = StoryDetail.Pillar.entries.firstOrNull { it.value == pillar }
        ?: StoryDetail.Pillar.journal,
    excerpt = excerpt,
    heroImage = heroImage?.let(::resolveMediaUrl),
    publishedAt = publishedAt,
    updatedAt = updatedAt,
    body = body,
)
