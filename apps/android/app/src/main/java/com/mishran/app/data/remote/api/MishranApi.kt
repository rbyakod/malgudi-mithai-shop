// apps/android/app/src/main/java/com/mishran/app/data/remote/api/MishranApi.kt — Task 7.3.
//
// Retrofit interface for the Mishran mobile v1 contract. Method return types
// are the OpenAPI-generated wrapper models (packages/api-contract …/models),
// which mirror the backend's universal `{ "data": T }` success envelope, so a
// successful `verifyOtp` yields `AuthOtpVerifyPost200Response` whose `.data` is
// the `OtpVerifyResponse` (access/refresh tokens + customer).
//
// Every method here maps 1:1 to a real route under /api/mobile/v1/* — see
// packages/api-contract/openapi.yaml. The plan's draft listed a couple of
// shapes that do not exist on the backend (a `category`/`tier` catalog filter,
// bare `List<Address>` / `Address` returns, an `account/me` PATCH); those have
// been corrected to the actual contract below.
package com.mishran.app.data.remote.api

import com.mishran.api.models.AddressInput
import com.mishran.api.models.AddressesGet200Response
import com.mishran.api.models.AddressesPost201Response
import com.mishran.api.models.AuthLogoutPost200Response
import com.mishran.api.models.BrandGet200Response
import com.mishran.api.models.AuthOtpSendPost200Response
import com.mishran.api.models.AuthOtpVerifyPost200Response
import com.mishran.api.models.AuthRefreshPost200Response
import com.mishran.api.models.CartEstimatePost200Response
import com.mishran.api.models.CartEstimateRequest
import com.mishran.api.models.CartValidatePost200Response
import com.mishran.api.models.CartValidateRequest
import com.mishran.api.models.CatalogMerchGet200Response
import com.mishran.api.models.CatalogMerchSlugGet200Response
import com.mishran.api.models.CatalogProductsGet200Response
import com.mishran.api.models.CatalogProductsSlugGet200Response
import com.mishran.api.models.CatalogQsrGet200Response
import com.mishran.api.models.CatalogQsrSlugGet200Response
import com.mishran.api.models.CatalogServiceableGet200Response
import com.mishran.api.models.CatalogSnacksGet200Response
import com.mishran.api.models.CatalogSnacksSlugGet200Response
import com.mishran.api.models.HeroGet200Response
import com.mishran.api.models.NotificationsRegisterDevicePost200Response
import com.mishran.api.models.NotificationsRegisterDevicePostRequest
import com.mishran.api.models.OtpSendRequest
import com.mishran.api.models.OtpVerifyRequest
import com.mishran.api.models.OrdersGet200Response
import com.mishran.api.models.OrdersIdGet200Response
import com.mishran.api.models.PaymentsRazorpayCreateOrderPost200Response
import com.mishran.api.models.PaymentsRazorpayVerifyPost200Response
import com.mishran.api.models.RazorpayCreateOrderRequest
import com.mishran.api.models.RazorpayVerifyRequest
import com.mishran.api.models.StoriesGet200Response
import com.mishran.api.models.StoriesSlugGet200Response
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface MishranApi {

    // ---- Auth (Task 8.x) -------------------------------------------------

    /** Send an OTP to `phone`. `phone` is E.164 (e.g. +919876543210). */
    @POST("auth/otp/send")
    suspend fun sendOtp(@Body body: OtpSendRequest): AuthOtpSendPost200Response

    /** Verify the 6-digit code; returns access + refresh tokens on success. */
    @POST("auth/otp/verify")
    suspend fun verifyOtp(@Body body: OtpVerifyRequest): AuthOtpVerifyPost200Response

    /**
     * Exchange a refresh token for a fresh access/refresh pair. The refresh
     * token travels as a bearer on the Authorization header (the body is empty
     * by contract). Used by [com.mishran.app.data.sync.TokenRefreshAuthenticator].
     */
    @POST("auth/refresh")
    suspend fun refresh(
        @Header("Authorization") refreshBearer: String,
    ): AuthRefreshPost200Response

    /** Revoke the current refresh token. */
    @POST("auth/logout")
    suspend fun logout(
        @Header("Authorization") refreshBearer: String,
    ): AuthLogoutPost200Response

    // ---- Catalog (Task 9.x) ---------------------------------------------

    /**
     * Paginated catalog. Returns a raw [Response] so the caller can read the
     * `ETag` header and replay it as `If-None-Match` to earn 304s.
     *
     * Filters are passed as raw strings (not the generated enums) because
     * Retrofit serializes `@Query` via `toString()`, which yields the enum
     * constant name ("sugarMinusFree") rather than the JSON value
     * ("sugar-free"). Callers pass `Product.Family.X.value` etc.
     */
    @GET("catalog/products")
    suspend fun getCatalog(
        @Header("If-None-Match") etag: String? = null,
        @Query("family") family: String? = null,
        @Query("freshnessStatus") freshnessStatus: String? = null,
        @Query("dietaryTags") dietaryTags: List<String>? = null,
        @Query("q") query: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): Response<CatalogProductsGet200Response>

    @GET("catalog/products/{slug}")
    suspend fun getProduct(@Path("slug") slug: String): CatalogProductsSlugGet200Response

    /** 6-digit pincode; 200 = serviceable-or-not (check `data.serviceable`). */
    @GET("catalog/serviceable")
    suspend fun checkPincode(@Query("pincode") pincode: String): CatalogServiceableGet200Response

    // ---- Stories (P2 net-new: journal) -----------------------------------

    /**
     * Paginated published-stories list (newest first), ETag-conditional like
     * [getCatalog]. Raw [Response] so [com.mishran.app.data.repository.StoryRepository]
     * can read the `ETag` header and replay it as `If-None-Match` for 304s.
     * `pillar` filter is exposed for a future pillar-tab UI; the app passes none.
     */
    @GET("stories")
    suspend fun getStories(
        @Header("If-None-Match") etag: String? = null,
        @Query("pillar") pillar: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): Response<StoriesGet200Response>

    /** Bare story object in `{ "data": … }` — adds the flattened `body` field. */
    @GET("stories/{slug}")
    suspend fun getStory(@Path("slug") slug: String): StoriesSlugGet200Response

    // ---- Reviews (B11) ---------------------------------------------------

    /**
     * Moderation-approved reviews for ONE product, newest first, public.
     * `averageRating`/`total` cover ALL approved reviews (not just the page),
     * so the PDP summary stays honest while only the first page is listed.
     * Returns the app-local [ReviewsResponse] — see its kdoc for why the
     * generated ReviewsGet200Response is unusable here.
     */
    @GET("reviews")
    suspend fun getReviews(
        @Query("productId") productId: String,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 5,
    ): ReviewsResponse

    // ---- Verticals (P2 net-new: snacks / QSR / merch) --------------------

    /**
     * The three non-mithai catalog verticals. Same paginated + ETag contract
     * as [getCatalog]; the app keeps them network-only (browse-y surfaces —
     * see VerticalRepository), so the ETag param exists for symmetry and a
     * later offline pass can adopt it without an interface change.
     */
    @GET("catalog/snacks")
    suspend fun getSnacks(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): Response<CatalogSnacksGet200Response>

    @GET("catalog/snacks/{slug}")
    suspend fun getSnack(@Path("slug") slug: String): CatalogSnacksSlugGet200Response

    @GET("catalog/qsr")
    suspend fun getQsrItems(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): Response<CatalogQsrGet200Response>

    @GET("catalog/qsr/{slug}")
    suspend fun getQsrItem(@Path("slug") slug: String): CatalogQsrSlugGet200Response

    @GET("catalog/merch")
    suspend fun getMerch(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): Response<CatalogMerchGet200Response>

    @GET("catalog/merch/{slug}")
    suspend fun getMerchItem(@Path("slug") slug: String): CatalogMerchSlugGet200Response

    // ---- Leads (P2 net-new: enquiry form) --------------------------------

    /**
     * PUBLIC wedding/corporate lead intake — the web's corporate-enquiry
     * counterpart. This route lives OUTSIDE the /api/mobile/v1 prefix (it is
     * the repo-root app/api/leads/route.ts), so the path is root-relative
     * ("/api/leads") and Retrofit resolves it against the base URL's origin —
     * BuildConfig.API_BASE_URL ("…/api/mobile/v1/") collapses to "…/api/leads".
     * The response is BARE JSON `{ leadId, message }`, not the usual
     * `{ "data": … }` envelope, hence the app-local [LeadCreatedResponse]
     * below (the endpoint is deliberately absent from openapi.yaml).
     */
    @POST("/api/leads")
    suspend fun submitLead(
        @Body body: LeadSubmissionRequest,
        @Header("X-Client-Source") clientSource: String = "mobile-android",
    ): LeadCreatedResponse

    // ---- Brand (P1 parity: support surfaces) -----------------------------

    /**
     * Public brand support contact — WhatsApp number (display form) + digits
     * (wa.me deep links). Tiny, cacheable, no auth; BrandRepository caches it
     * in DataStore so the app asks at most once per install.
     */
    @GET("brand")
    suspend fun getBrand(): BrandGet200Response

    // ---- Home hero (P3 parity: admin-curated carousel) -------------------

    /**
     * Admin-curated home hero slides (the web's `home-hero` global). Public,
     * tiny, ETag'd — the app keeps it network-only (browse-y surface, same
     * call as the verticals in [VerticalRepository]); an empty or failed
     * fetch simply leaves Home on its local static hero.
     */
    @GET("hero")
    suspend fun getHero(): HeroGet200Response

    // ---- Cart + payments (Task 10.x) ------------------------------------

    /**
     * PUBLIC read-only pricing preview (B9) — the exact /cart/validate math
     * (server-side line re-pricing, tier fee, free-delivery threshold waiver)
     * with nothing persisted and NO sign-in required, so guest carts can show
     * a delivery fee + threshold progress before checkout. A null `pincodeTier`
     * in the response means "no/userviceable pincode" — the client then keeps
     * its no-pincode copy.
     */
    @POST("cart/estimate")
    suspend fun estimateCart(@Body body: CartEstimateRequest): CartEstimatePost200Response

    @POST("cart/validate")
    suspend fun validateCart(@Body body: CartValidateRequest): CartValidatePost200Response

    @POST("payments/razorpay/create-order")
    suspend fun createOrder(
        @Body body: RazorpayCreateOrderRequest,
        @Header("X-Client-Source") clientSource: String = "mobile-android",
        @Header("Idempotency-Key") idempotencyKey: String? = null,
    ): PaymentsRazorpayCreateOrderPost200Response

    @POST("payments/razorpay/verify")
    suspend fun verifyPayment(
        @Body body: RazorpayVerifyRequest,
        @Header("Idempotency-Key") idempotencyKey: String? = null,
    ): PaymentsRazorpayVerifyPost200Response

    // ---- Orders (Task 11.x) ---------------------------------------------

    @GET("orders")
    suspend fun listOrders(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 20,
    ): OrdersGet200Response

    @GET("orders/{id}")
    suspend fun getOrder(@Path("id") id: String): OrdersIdGet200Response

    // ---- Addresses ------------------------------------------------------

    @GET("addresses")
    suspend fun listAddresses(): AddressesGet200Response

    @POST("addresses")
    suspend fun createAddress(@Body body: AddressInput): AddressesPost201Response

    @PATCH("addresses/{id}")
    suspend fun updateAddress(
        @Path("id") id: String,
        @Body body: AddressInput,
    ): AddressesPost201Response

    /**
     * Owner-scoped delete; 200 body is `{ "data": { "ok": true } }`.
     * Return type is the app-local [DeleteResponse] — the generated contract
     * models only named schemas, and the delete envelope is anonymous inline.
     */
    @DELETE("addresses/{id}")
    suspend fun deleteAddress(@Path("id") id: String): DeleteResponse

    // ---- Push device registration --------------------------------------

    /** Idempotent upsert of the FCM push token for this device. */
    @POST("notifications/register-device")
    suspend fun registerDevice(
        @Body body: NotificationsRegisterDevicePostRequest,
    ): NotificationsRegisterDevicePost200Response
}

/**
 * `{ "data": { "ok": boolean } }` — the success envelope of the owner-scoped
 * DELETE /addresses/{id} (mirrors logout's `{ "data": { "ok" } }` shape).
 * App-local because the OpenAPI generator only emits models for named
 * schemas and this response is an anonymous inline object; the reflective
 * Moshi setup decodes it without adapters.
 */
data class DeleteResponse(
    val data: Data? = null,
) {
    data class Data(val ok: Boolean? = null)
}

/**
 * GET /reviews 200 (B11): `{ "data": { items, averageRating, total, page,
 * pageSize } }`. App-local for the same reason as [DeleteResponse]'s inner
 * object, plus one harder constraint: the generated ReviewsGet200Response
 * types `averageRating` as java.math.BigDecimal, which the reflective Moshi
 * setup cannot decode at all ("Platform class … requires explicit
 * JsonAdapter") — the call would throw on every 200. `averageRating` is a
 * display-only one-decimal number, so Double loses nothing.
 */
data class ReviewsResponse(
    val data: Page? = null,
) {
    /** One page of approved reviews + aggregates over ALL approved reviews. */
    data class Page(
        val items: List<Item> = emptyList(),
        /** Mean rating across all approved reviews; null when there are none. */
        val averageRating: Double? = null,
        val total: Int = 0,
        val page: Int = 1,
        val pageSize: Int = 5,
    )

    /** A moderation-approved review as the public sees it. */
    data class Item(
        val id: String = "",
        /** 1–5. */
        val rating: Int = 0,
        /** Null renders the localized "Anonymous" label. */
        val authorDisplayName: String? = null,
        /** Server-stamped: the author had a delivered order with the product. */
        val verifiedPurchase: Boolean = false,
        /** ISO string — the client parses and formats it. */
        val createdAt: String? = null,
        val body: String? = null,
    )
}

/**
 * Request body for the public POST /api/leads intake (see [MishranApi.submitLead]).
 * Hand-written against the server's `LeadRequestBody` (lib/leads-api.ts) rather
 * than generated: the endpoint is intentionally not part of openapi.yaml, and
 * the server nests the person fields under `contact` while tucking everything
 * the form collects beyond identity into a free-form `payload` object.
 *
 * The server enforces type + contact.name + contact.email; everything else is
 * optional and forwarded as typed contact columns or arbitrary payload keys.
 * `payload` values are [Any] (not String) because the web lead shapes send
 * count-like extras as JSON numbers (guests, quantity) and dates as ISO
 * strings — Moshi's reflective adapter serializes Int/String values as-is.
 * `source` marks the submitting surface; the gift builder sends
 * "android-app" (mirroring the web gift-builder draft).
 */
data class LeadSubmissionRequest(
    /** "wedding" | "corporate" | "gift-builder-draft". */
    val type: String,
    val contact: Contact,
    /** Form extras (event date/city/guests, box options, message, …). */
    val payload: Map<String, Any> = emptyMap(),
    /** Submitting surface, when the shape carries one ("android-app"). */
    val source: String? = null,
) {
    data class Contact(
        val name: String,
        val email: String,
        val phone: String? = null,
        val company: String? = null,
        /** Corporate GSTIN, uppercase alnum-15; server column key is GSTIN. */
        val GSTIN: String? = null,
    )
}

/**
 * Bare 201 response of POST /api/leads: `{ "leadId": …, "message": … }`. No
 * `{ "data" }` envelope — mirrors [DeleteResponse] in being app-local because
 * the route predates the mobile contract.
 */
data class LeadCreatedResponse(
    val leadId: String? = null,
    val message: String? = null,
)
