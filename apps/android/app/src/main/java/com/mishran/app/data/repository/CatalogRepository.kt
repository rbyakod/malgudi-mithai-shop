// apps/android/app/src/main/java/com/mishran/app/data/repository/CatalogRepository.kt — Task 9.2.
//
// Single source of truth for the catalog. getCatalog() emits the Room cache
// immediately, then refreshes from the network with `If-None-Match` and re-emits
// the fresh rows: a 200 upserts + stores the new ETag; a 304 extends every row's
// freshness cutoff (server confirmed the cache is still valid); any network
// failure is swallowed so the cache keeps serving offline. refreshNow() exposes
// just the refresh for the WorkManager janitor + pull-to-refresh.
//
// The two-emit flow (cache → network → fresh) is deliberately chosen over a
// reactive observeAll + app-scope launch: it needs no extra scope, is fully
// unit-testable, and matches the catalog's access pattern (refresh on open +
// every 6h via the worker). Reactive re-emit-on-external-write can come later.
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.api.models.CatalogProductsGet200Response
import com.mishran.api.models.Product
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.local.dao.ProductDao
import com.mishran.app.data.local.entity.ProductEntity
import com.mishran.app.data.remote.api.MishranApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.first
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CatalogRepository @Inject constructor(
    private val api: MishranApi,
    private val productDao: ProductDao,
    private val dataStore: DataStore<Preferences>,
) {

    /**
     * Emit the cached catalog, refresh from the network (conditional on the
     * stored ETag unless [force]), then emit the fresh rows. Network failures
     * never throw to the collector — the second emit simply reflects whatever
     * the cache holds after a failed refresh (unchanged).
     */
    fun getCatalog(force: Boolean = false): Flow<List<Product>> = flow {
        emit(productDao.getAll().map { it.toDomain() })
        refreshFromNetwork(force)
        emit(productDao.getAll().map { it.toDomain() })
    }

    /** Network-only refresh for the WorkManager janitor + pull-to-refresh. */
    suspend fun refreshNow(force: Boolean = true) {
        refreshFromNetwork(force)
    }

    private suspend fun refreshFromNetwork(force: Boolean) {
        val etag = if (force) null else dataStore.data.first()[DataStoreKeys.CATALOG_ETAG]
        val response: Response<CatalogProductsGet200Response> = try {
            api.getCatalog(etag = etag)
        } catch (e: Exception) {
            return // offline — keep serving the cache
        }
        when (response.code()) {
            HTTP_NOT_MODIFIED -> productDao.extendFreshness(now() + STALE_WINDOW_MS)
            else -> {
                val products = response.body()?.data?.items ?: return
                val staleAt = now() + STALE_WINDOW_MS
                productDao.upsertAll(products.map { it.toEntity(staleAt) })
                response.headers()[HEADER_ETAG]?.let { newEtag ->
                    dataStore.edit { it[DataStoreKeys.CATALOG_ETAG] = newEtag }
                }
            }
        }
    }

    private companion object {
        const val HTTP_NOT_MODIFIED = 304
        const val HEADER_ETAG = "ETag"
        // Matches the WorkManager refresh cadence (6h) so a row is never purged
        // as stale between successful refreshes.
        const val STALE_WINDOW_MS = 6L * 60 * 60 * 1000
    }
}

/** Map a freshly fetched product to its cache row, stamping the freshness cutoff. */
internal fun Product.toEntity(staleAt: Long): ProductEntity = ProductEntity(
    id = id,
    slug = slug,
    name = name,
    family = family.value,
    displayPrice = displayPrice,
    freshnessStatus = freshnessStatus?.value,
    dietaryTags = dietaryTags.orEmpty(),
    allergens = allergens.orEmpty(),
    ingredients = ingredients,
    shelfLife = shelfLife,
    storage = storage,
    images = images.orEmpty(),
    story = story,
    karigar = karigar,
    updatedAt = updatedAt,
    staleAt = staleAt,
)

/** Restore a cache row to the contract model; value-strings map back to enums. */
internal fun ProductEntity.toDomain(): Product {
    val family = Product.Family.values()
        .firstOrNull { it.value == this.family } ?: Product.Family.classic
    val freshness = freshnessStatus?.let { status ->
        Product.FreshnessStatus.values().firstOrNull { it.value == status }
    }
    return Product(
        id = id,
        slug = slug,
        name = name,
        family = family,
        displayPrice = displayPrice,
        freshnessStatus = freshness,
        dietaryTags = dietaryTags.takeIf { it.isNotEmpty() },
        allergens = allergens.takeIf { it.isNotEmpty() },
        ingredients = ingredients,
        shelfLife = shelfLife,
        storage = storage,
        images = images.takeIf { it.isNotEmpty() },
        story = story,
        karigar = karigar,
        updatedAt = updatedAt,
    )
}

/** Epoch millis — extracted so tests can pin time if needed later. */
internal fun now(): Long = System.currentTimeMillis()
