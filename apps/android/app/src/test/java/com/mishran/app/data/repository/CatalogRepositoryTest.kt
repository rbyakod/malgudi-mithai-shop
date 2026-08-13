// apps/android/app/src/test/java/com/mishran/app/data/repository/CatalogRepositoryTest.kt — Task 9.2.
//
// JVM unit tests for the offline-first refresh path. Retrofit's `Response` is
// constructible on the JVM for both 200 (Response.success + headers) and 304
// (Response.error), so the conditional-GET logic is testable without Android.
// The mocked DataStore routes `edit {}` transforms into a real
// MutablePreferences so the stored ETag is observable. NOTE: source-complete
// (no SDK).
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.mutablePreferencesOf
import androidx.datastore.preferences.core.preferencesOf
import com.mishran.api.models.CatalogProductsGet200Response
import com.mishran.api.models.CatalogProductsGet200ResponseData
import com.mishran.api.models.Product
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.local.dao.ProductDao
import com.mishran.app.data.local.entity.ProductEntity
import com.mishran.app.data.remote.api.MishranApi
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
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

class CatalogRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var productDao: ProductDao
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var repository: CatalogRepository

    /** In-memory stand-in for the Room table, mutated by mocked upsertAll. */
    private val table = mutableListOf<ProductEntity>()

    /** Captures whatever the repository persists through dataStore.edit. */
    private val writtenPrefs = mutablePreferencesOf()

    private val wireProduct = Product(
        id = "prod-1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        family = Product.Family.classic,
        freshnessStatus = Product.FreshnessStatus.madeMinusDaily,
    )

    private val wireResponse = CatalogProductsGet200Response(
        data = CatalogProductsGet200ResponseData(
            items = listOf(wireProduct),
            total = 1,
            page = 1,
            pageSize = 50,
        ),
    )

    @Before
    fun setUp() {
        api = mockk()
        productDao = mockk()
        dataStore = mockk()
        repository = CatalogRepository(api, productDao, dataStore)

        every { dataStore.data } returns flowOf(
            preferencesOf(DataStoreKeys.CATALOG_ETAG to STORED_ETAG),
        )
        coEvery { dataStore.edit(any()) } coAnswers {
            firstArg<suspend (MutablePreferences) -> Unit>().invoke(writtenPrefs)
            writtenPrefs
        }
        every { productDao.getAll() } answers { table.toList() }
        coEvery { productDao.upsertAll(any()) } coAnswers {
            table.clear()
            table.addAll(firstArg<List<ProductEntity>>())
        }
        coEvery { productDao.extendFreshness(any()) } just Runs
    }

    private fun stubApi(response: Response<CatalogProductsGet200Response>) {
        coEvery {
            api.getCatalog(
                etag = any(), family = any(), freshnessStatus = any(),
                dietaryTags = any(), query = any(), page = any(), pageSize = any(),
            )
        } returns response
    }

    private fun ok200(etag: String? = NEW_ETAG) = if (etag == null) {
        Response.success(wireResponse)
    } else {
        Response.success(wireResponse, okhttp3.Headers.headersOf("ETag", etag))
    }

    private fun notModified304(): Response<CatalogProductsGet200Response> =
        Response.error(304, "".toResponseBody("application/json".toMediaType()))

    @Test
    fun `200 upserts the fetched rows and stores the new ETag`() = runTest {
        stubApi(ok200())
        repository.refreshNow()
        verify(exactly = 1) { productDao.upsertAll(any()) }
        assertEquals(listOf(wireProduct), table.map { it.toDomain() })
        assertEquals(NEW_ETAG, writtenPrefs[DataStoreKeys.CATALOG_ETAG])
    }

    @Test
    fun `upserted rows are stamped with the 6h freshness window`() = runTest {
        stubApi(ok200())
        val before = System.currentTimeMillis()
        repository.refreshNow()
        val staleAt = table.single().staleAt
        assert(staleAt >= before && staleAt <= before + SIX_HOURS_MS + 5_000) {
            "staleAt $staleAt not within [now, now+6h]"
        }
    }

    @Test
    fun `304 extends freshness instead of re-downloading the body`() = runTest {
        stubApi(notModified304())
        repository.refreshNow()
        verify(exactly = 0) { productDao.upsertAll(any()) }
        verify(exactly = 1) { productDao.extendFreshness(any()) }
    }

    @Test
    fun `network failure is swallowed so the cache keeps serving`() = runTest {
        coEvery {
            api.getCatalog(
                etag = any(), family = any(), freshnessStatus = any(),
                dietaryTags = any(), query = any(), page = any(), pageSize = any(),
            )
        } throws java.io.IOException("offline")
        repository.refreshNow() // must not throw
        verify(exactly = 0) { productDao.upsertAll(any()) }
    }

    @Test
    fun `non-force refresh replays the stored ETag as If-None-Match`() = runTest {
        val etagSlot = slot<String?>()
        coEvery {
            api.getCatalog(
                etag = captureNullable(etagSlot), family = any(), freshnessStatus = any(),
                dietaryTags = any(), query = any(), page = any(), pageSize = any(),
            )
        } returns notModified304()
        repository.refreshNow(force = false)
        assertEquals(STORED_ETAG, etagSlot.captured)
    }

    @Test
    fun `force refresh sends no ETag`() = runTest {
        val etagSlot = slot<String?>()
        coEvery {
            api.getCatalog(
                etag = captureNullable(etagSlot), family = any(), freshnessStatus = any(),
                dietaryTags = any(), query = any(), page = any(), pageSize = any(),
            )
        } returns ok200()
        repository.refreshNow(force = true)
        assertNull(etagSlot.captured)
    }

    @Test
    fun `200 without an ETag header writes nothing to DataStore`() = runTest {
        stubApi(ok200(etag = null))
        repository.refreshNow()
        assertNull(writtenPrefs[DataStoreKeys.CATALOG_ETAG])
    }

    @Test
    fun `getCatalog emits cache first then the refreshed rows`() = runTest {
        stubApi(ok200())
        val emissions = repository.getCatalog().toList()
        assertEquals(2, emissions.size)
        assertEquals(emptyList<Product>(), emissions[0])
        assertEquals(listOf(wireProduct), emissions[1])
    }

    private companion object {
        const val STORED_ETAG = "\"catalog-v1\""
        const val NEW_ETAG = "\"catalog-v2\""
        const val SIX_HOURS_MS = 6L * 60 * 60 * 1000
    }
}
