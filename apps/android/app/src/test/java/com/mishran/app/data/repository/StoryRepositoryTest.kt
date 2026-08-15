// apps/android/app/src/test/java/com/mishran/app/data/repository/StoryRepositoryTest.kt — P2 net-new (stories).
//
// JVM unit tests for the journal's offline-first refresh path — the same
// harness as CatalogRepositoryTest (mocked DataStore routing edit{} through a
// real MutablePreferences; Retrofit Responses constructed on the JVM for 200
// and 304). Also covers the reader's network-first + cached-body-fallback
// policy and the Story ↔ StoryEntity mappers. NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import androidx.datastore.preferences.core.preferencesOf
import com.mishran.api.models.StoriesGet200Response
import com.mishran.api.models.StoriesGet200ResponseData
import com.mishran.api.models.Story
import com.mishran.api.models.StoryDetail
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.local.dao.StoryDao
import com.mishran.app.data.local.entity.StoryEntity
import com.mishran.app.data.remote.api.MishranApi
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class StoryRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var storyDao: StoryDao
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var repository: StoryRepository

    /** In-memory stand-in for the Room table, mutated by mocked upserts. */
    private val table = mutableListOf<StoryEntity>()

    /** Captures whatever the repository persists through dataStore.edit. */
    private val writtenPrefs = mutablePreferencesOf()

    private val wireStory = Story(
        id = "story-1",
        slug = "the-karigar",
        title = "The Karigar",
        pillar = Story.Pillar.karigar,
        excerpt = "A portrait of the hands behind the halwa.",
        heroImage = "/api/media/file/hero.png",
        publishedAt = "2026-07-30T09:00:00Z",
        updatedAt = "2026-07-30T09:00:00Z",
    )

    private val wireDetail = StoryDetail(
        id = "story-1",
        slug = "the-karigar",
        title = "The Karigar",
        pillar = StoryDetail.Pillar.karigar,
        excerpt = "A portrait of the hands behind the halwa.",
        heroImage = "https://cdn.mishran.in/hero.png",
        publishedAt = "2026-07-30T09:00:00Z",
        updatedAt = "2026-07-30T09:00:00Z",
        body = "First paragraph.\nSecond paragraph.",
    )

    private val wireListResponse = StoriesGet200Response(
        data = StoriesGet200ResponseData(
            items = listOf(wireStory),
            total = 1,
            page = 1,
            pageSize = 50,
        ),
    )

    @Before
    fun setUp() {
        api = mockk()
        storyDao = mockk()
        dataStore = mockk()
        repository = StoryRepository(api, storyDao, dataStore)

        every { dataStore.data } returns flowOf(
            preferencesOf(DataStoreKeys.STORIES_ETAG to STORED_ETAG),
        )
        coEvery { dataStore.updateData(any()) } coAnswers {
            val updated = firstArg<suspend (Preferences) -> Preferences>().invoke(writtenPrefs)
            writtenPrefs.clear()
            @Suppress("UNCHECKED_CAST")
            updated.asMap().forEach { (key, value) ->
                writtenPrefs[key as Preferences.Key<Any>] = value
            }
            updated
        }
        coEvery { storyDao.getAll() } answers { table.toList() }
        coEvery { storyDao.upsertAll(any()) } coAnswers {
            table.clear()
            table.addAll(firstArg<List<StoryEntity>>())
        }
        coEvery { storyDao.upsertDetail(any()) } coAnswers {
            val row = firstArg<StoryEntity>()
            table.removeAll { it.id == row.id }
            table += row
        }
        coEvery { storyDao.extendFreshness(any()) } just Runs
        every { storyDao.observeBySlug(any()) } returns flowOf(null)
    }

    private fun stubApi(response: Response<StoriesGet200Response>) {
        coEvery {
            api.getStories(etag = any(), pillar = any(), page = any(), pageSize = any())
        } returns response
    }

    private fun ok200(etag: String? = NEW_ETAG): Response<StoriesGet200Response> =
        if (etag == null) {
            Response.success(wireListResponse)
        } else {
            Response.success(wireListResponse, okhttp3.Headers.headersOf("ETag", etag))
        }

    private fun notModified304(): Response<StoriesGet200Response> {
        val raw = okhttp3.Response.Builder()
            .request(okhttp3.Request.Builder().url("http://localhost/").build())
            .code(304)
            .message("Not Modified")
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .build()
        return Response.error("".toResponseBody("application/json".toMediaType()), raw)
    }

    // ---- list refresh (ETag path) -----------------------------------------

    @Test
    fun `200 upserts the fetched rows and stores the new ETag`() = runTest {
        stubApi(ok200())
        repository.refreshNow()
        coVerify(exactly = 1) { storyDao.upsertAll(any()) }
        // The cached domain copy carries the RESOLVED hero URL.
        assertEquals(listOf(wireStory.copy(heroImage = RESOLVED_HERO)), table.map { it.toDomain() })
        assertEquals(NEW_ETAG, writtenPrefs[DataStoreKeys.STORIES_ETAG])
    }

    @Test
    fun `list upserts carry a null body — the reader owns that column`() = runTest {
        stubApi(ok200())
        repository.refreshNow()
        assertNull(table.single().body)
    }

    @Test
    fun `304 extends freshness instead of re-downloading the body`() = runTest {
        stubApi(notModified304())
        repository.refreshNow()
        coVerify(exactly = 0) { storyDao.upsertAll(any()) }
        coVerify(exactly = 1) { storyDao.extendFreshness(any()) }
    }

    @Test
    fun `network failure is swallowed so the cache keeps serving`() = runTest {
        coEvery {
            api.getStories(etag = any(), pillar = any(), page = any(), pageSize = any())
        } throws java.io.IOException("offline")
        repository.refreshNow() // must not throw
        coVerify(exactly = 0) { storyDao.upsertAll(any()) }
    }

    @Test
    fun `non-force refresh replays the stored ETag as If-None-Match`() = runTest {
        val etagSlot = io.mockk.slot<String?>()
        coEvery {
            api.getStories(
                etag = captureNullable(etagSlot),
                pillar = any(),
                page = any(),
                pageSize = any(),
            )
        } returns notModified304()
        repository.refreshNow(force = false)
        assertEquals(STORED_ETAG, etagSlot.captured)
    }

    @Test
    fun `force refresh sends no ETag`() = runTest {
        val etagSlot = io.mockk.slot<String?>()
        coEvery {
            api.getStories(
                etag = captureNullable(etagSlot),
                pillar = any(),
                page = any(),
                pageSize = any(),
            )
        } returns ok200()
        repository.refreshNow(force = true)
        assertNull(etagSlot.captured)
    }

    @Test
    fun `getStories emits cache first then the refreshed rows`() = runTest {
        stubApi(ok200())
        val emissions = repository.getStories().toList()
        assertEquals(2, emissions.size)
        assertEquals(emptyList<Story>(), emissions[0])
        assertEquals(listOf(wireStory.copy(heroImage = RESOLVED_HERO)), emissions[1])
    }

    // ---- reader (network-first + cached-body fallback) --------------------

    @Test
    fun `getStory fetches from the network and caches the body`() = runTest {
        coEvery { api.getStory("the-karigar") } returns
            com.mishran.api.models.StoriesSlugGet200Response(data = wireDetail)

        assertEquals(wireDetail, repository.getStory("the-karigar"))
        coVerify(exactly = 1) { storyDao.upsertDetail(any()) }
        assertEquals("First paragraph.\nSecond paragraph.", table.single().body)
    }

    @Test
    fun `getStory falls back to the cached body when offline`() = runTest {
        table += wireDetail.toEntity(staleAt = 0L)
        every { storyDao.observeBySlug("the-karigar") } returns flowOf(table.first())
        coEvery { api.getStory(any()) } throws java.io.IOException("offline")

        val detail = repository.getStory("the-karigar")
        assertEquals(wireDetail, detail)
        coVerify(exactly = 0) { storyDao.upsertDetail(any()) }
    }

    @Test
    fun `getStory returns null when cache and network both miss`() = runTest {
        every { storyDao.observeBySlug(any()) } returns flowOf(null)
        coEvery { api.getStory(any()) } throws java.io.IOException("offline")

        assertNull(repository.getStory("missing-story"))
    }

    // ---- mappers ----------------------------------------------------------

    @Test
    fun `relative hero images resolve to absolute URLs in the cache row`() {
        val row = wireStory.toEntity(staleAt = 0L)
        assertEquals("http://10.0.2.2:3000/api/media/file/hero.png", row.heroImage)
    }

    @Test
    fun `entity round-trips back to an equal story`() {
        val row = wireStory.toEntity(staleAt = 123L).copy(
            heroImage = "https://cdn.mishran.in/hero.png", // already absolute
        )
        assertEquals(
            wireStory.copy(heroImage = "https://cdn.mishran.in/hero.png"),
            row.toDomain(),
        )
    }

    @Test
    fun `unknown pillar values fall back to journal instead of crashing`() {
        val row = wireStory.toEntity(staleAt = 0L).copy(pillar = "new-pillar")
        assertEquals(Story.Pillar.journal, row.toDomain().pillar)
    }

    private companion object {
        const val STORED_ETAG = "\"stories-v1\""
        const val NEW_ETAG = "\"stories-v2\""
        /** The debug BuildConfig origin the relative hero path resolves against. */
        const val RESOLVED_HERO = "http://10.0.2.2:3000/api/media/file/hero.png"
    }
}
