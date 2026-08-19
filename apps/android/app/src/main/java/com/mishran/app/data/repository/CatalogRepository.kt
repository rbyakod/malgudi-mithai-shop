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
import com.mishran.app.data.remote.resolveMediaUrl
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
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

    /** Reactive single product for the detail screen; null while absent. */
    fun observeProduct(slug: String): Flow<Product?> =
        productDao.observeBySlug(slug).map { it?.toDomain() }

    /**
     * Reactive featured products (Home best-sellers rail). Empty until the
     * catalog carries at least one flagged row — the caller decides the
     * fallback slice. Re-emits on every catalog upsert, like [getCatalog].
     */
    fun observeFeatured(): Flow<List<Product>> =
        productDao.observeFeatured().map { rows -> rows.map { it.toDomain() } }

    /**
     * One-shot product lookup for the detail screen: Room first, then a single
     * network fetch (cached back with the same freshness window) when the row
     * is not on disk yet — e.g. a deep link into a cold cache. Returns null
     * when both miss (offline first run); the caller renders a not-found state.
     */
    suspend fun getProduct(slug: String): Product? {
        productDao.observeBySlug(slug).first()?.let { return it.toDomain() }
        return try {
            api.getProduct(slug).data.also { product ->
                productDao.upsertAll(listOf(product.toEntity(now() + STALE_WINDOW_MS)))
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Same-family siblings for the PDP cross-sell rail ("More from the X
     * collection"): the Room cache answers when it holds any of that family;
     * a cold cache (a deep link straight into the PDP) triggers ONE catalog
     * refresh — seeding the shared cache for later screens too — and the
     * re-read answers. Both reads run through [crossSellSiblings], so the
     * current product is excluded and the rail is capped at
     * [CROSS_SELL_LIMIT]. Network failure on a cold cache yields empty (the
     * rail hides — never an error surface). Mirrors iOS loadCrossSell().
     */
    suspend fun getFamilySiblings(
        family: Product.Family,
        excludeSlug: String,
    ): List<Product> {
        suspend fun siblings(): List<Product> =
            crossSellSiblings(productDao.getAll().map { it.toDomain() }, family, excludeSlug)
        siblings().takeIf { it.isNotEmpty() }?.let { return it }
        refreshFromNetwork(force = false)
        return siblings()
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
    weight = weight,
    featured = featured,
    freshnessStatus = freshnessStatus?.value,
    dietaryTags = dietaryTags.orEmpty(),
    allergens = allergens.orEmpty(),
    ingredients = ingredients,
    shelfLife = shelfLife,
    storage = storage,
    // Relative media paths ("/api/media/file/…") become absolute URLs so
    // Coil can load them; toDomain() re-resolves for rows cached before this.
    images = images.orEmpty().map(::resolveMediaUrl),
    story = story,
    karigar = karigar,
    leadTime = leadTime,
    karigarName = karigarName,
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
        weight = weight,
        featured = featured,
        freshnessStatus = freshness,
        dietaryTags = dietaryTags.takeIf { it.isNotEmpty() },
        allergens = allergens.takeIf { it.isNotEmpty() },
        ingredients = ingredients,
        shelfLife = shelfLife,
        storage = storage,
        images = images.takeIf { it.isNotEmpty() }?.map(::resolveMediaUrl),
        story = story,
        karigar = karigar,
        leadTime = leadTime,
        karigarName = karigarName,
        updatedAt = updatedAt,
    )
}

/** Epoch millis — extracted so tests can pin time if needed later. */
internal fun now(): Long = System.currentTimeMillis()

/** How many same-family cards the PDP cross-sell rail shows (web + iOS cap). */
internal const val CROSS_SELL_LIMIT = 4

/**
 * The cross-sell rail's slice of the catalog: same [family] as the open
 * product, the current product ([excludeSlug]) dropped, capped at
 * [CROSS_SELL_LIMIT]. Pure — one function owns the rail's rules on every path
 * (cache hit and post-refresh alike).
 */
internal fun crossSellSiblings(
    catalog: List<Product>,
    family: Product.Family,
    excludeSlug: String,
): List<Product> = catalog.filter { it.family == family && it.slug != excludeSlug }
    .take(CROSS_SELL_LIMIT)
