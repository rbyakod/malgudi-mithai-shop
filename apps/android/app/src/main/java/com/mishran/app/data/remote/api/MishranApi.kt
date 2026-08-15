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
import com.mishran.api.models.AuthOtpSendPost200Response
import com.mishran.api.models.AuthOtpVerifyPost200Response
import com.mishran.api.models.AuthRefreshPost200Response
import com.mishran.api.models.CartValidatePost200Response
import com.mishran.api.models.CartValidateRequest
import com.mishran.api.models.CatalogProductsGet200Response
import com.mishran.api.models.CatalogProductsSlugGet200Response
import com.mishran.api.models.CatalogServiceableGet200Response
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

    // ---- Cart + payments (Task 10.x) ------------------------------------

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
