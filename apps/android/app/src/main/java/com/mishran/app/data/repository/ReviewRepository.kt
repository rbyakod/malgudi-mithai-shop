// apps/android/app/src/main/java/com/mishran/app/data/repository/ReviewRepository.kt — B11.
//
// Read-only client for the public GET /reviews (moderation-approved reviews
// for one product, newest first). No cache on purpose: reviews are a PDP
// garnish fetched fresh per visit, tiny, and public — a failure simply hides
// the section (web parity, no empty state), which the null return encodes.
// Returns the app-local ReviewsResponse page (see its kdoc in MishranApi.kt
// for why the generated ReviewsGet200Response can't cross this app's Moshi).
package com.mishran.app.data.repository

import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.remote.api.ReviewsResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReviewRepository @Inject constructor(
    private val api: MishranApi,
) {
    /**
     * First page of approved reviews for [productId]. Returns null on any
     * failure (offline, 4xx/5xx) so callers hide the section silently.
     */
    suspend fun getProductReviews(productId: String, pageSize: Int = 5): ReviewsResponse.Page? =
        try {
            api.getReviews(productId = productId, page = 1, pageSize = pageSize).data
        } catch (e: Exception) {
            null
        }
}
