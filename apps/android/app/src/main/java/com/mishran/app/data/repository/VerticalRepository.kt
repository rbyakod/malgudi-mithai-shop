// apps/android/app/src/main/java/com/mishran/app/data/repository/VerticalRepository.kt — P2 net-new (verticals).
//
// Network-only fetchers for the three non-mithai catalog verticals (snacks /
// QSR / merch). Deliberately NOT Room-cached, unlike products + stories: these
// are browse-y, low-stakes surfaces where a loading/error/retry state is
// cheaper than a second ETag/offline pipeline, and their lists already carry
// every field the detail screens need. The MishranApi methods still return
// Retrofit Responses (ETag-ready), so a later offline pass can adopt the
// CatalogRepository pattern without touching call sites.
//
// Results are surfaced as Kotlin Result — the ViewModels fold them into
// loading/content/error UI states. Media URLs are resolved to absolute form
// at this boundary, as everywhere else.
package com.mishran.app.data.repository

import com.mishran.api.models.Merch
import com.mishran.api.models.QsrItem
import com.mishran.api.models.Snack
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.remote.resolveMediaUrl
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VerticalRepository @Inject constructor(
    private val api: MishranApi,
) {

    /** Retail snacks, server order. Fails only on network/HTTP error. */
    suspend fun getSnacks(): Result<List<Snack>> = runCatching {
        api.getSnacks().body()?.data?.items.orEmpty().map(::resolveSnackMedia)
    }

    /** One snack by slug — the detail screen's fresh fetch. */
    suspend fun getSnack(slug: String): Result<Snack> = runCatching {
        resolveSnackMedia(api.getSnack(slug).data ?: error("Empty snack response"))
    }

    /** QSR counter-menu items, server order. */
    suspend fun getQsrItems(): Result<List<QsrItem>> = runCatching {
        api.getQsrItems().body()?.data?.items.orEmpty().map(::resolveQsrMedia)
    }

    /** One QSR item by slug. */
    suspend fun getQsrItem(slug: String): Result<QsrItem> = runCatching {
        resolveQsrMedia(api.getQsrItem(slug).data ?: error("Empty QSR response"))
    }

    /** Merch products, server order. */
    suspend fun getMerch(): Result<List<Merch>> = runCatching {
        api.getMerch().body()?.data?.items.orEmpty().map(::resolveMerchMedia)
    }

    /** One merch product by slug. */
    suspend fun getMerchItem(slug: String): Result<Merch> = runCatching {
        resolveMerchMedia(api.getMerchItem(slug).data ?: error("Empty merch response"))
    }

    // Media resolution: copies with absolute image URLs (idempotent).

    private fun resolveSnackMedia(snack: Snack): Snack = snack.copy(
        images = snack.images.orEmpty().map(::resolveMediaUrl).takeIf { it.isNotEmpty() },
    )

    private fun resolveQsrMedia(item: QsrItem): QsrItem = item.copy(
        image = item.image?.let(::resolveMediaUrl),
    )

    private fun resolveMerchMedia(merch: Merch): Merch = merch.copy(
        images = merch.images.orEmpty().map(::resolveMediaUrl).takeIf { it.isNotEmpty() },
    )
}
