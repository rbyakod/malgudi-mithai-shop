// apps/android/app/src/main/java/com/mishran/app/domain/usecase/PlaceOrderUseCase.kt — Task 10.3.
//
// The checkout transaction, minus the SDK: (1) POST /cart/validate turns the
// local cart into a server snapshot (authoritative totals), (2) POST
// /payments/razorpay/create-order mints the payable order. The Razorpay sheet
// launch happens in the UI layer (it needs an Activity); once the outcome
// lands, verifyPayment() posts the signature to /payments/razorpay/verify.
//
// Idempotency: create-order and verify share one UUID v4 per snapshot, kept
// in memory for the process lifetime — a retry after a network blip replays
// the same key and the backend dedupes instead of double-charging.
//
// P1 parity (pack sizes): local cart lines may be pack-scoped ("p1:500g").
// The server contract has no variant field, so createPaymentRequest first
// collapses the lines by BASE productId (suffix stripped, quantities summed)
// before POST /cart/validate — see [collapsePackLines].
package com.mishran.app.domain.usecase

import com.mishran.api.models.CartItem
import com.mishran.api.models.CartSnapshot
import com.mishran.api.models.CartValidatePost200Response
import com.mishran.api.models.CartValidateRequest
import com.mishran.api.models.CartValidateRequestSlot
import com.mishran.api.models.PaymentsRazorpayCreateOrderPost200Response
import com.mishran.api.models.PaymentsRazorpayVerifyPost200Response
import com.mishran.api.models.RazorpayCreateOrderRequest
import com.mishran.api.models.RazorpayVerifyRequest
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.remote.api.MishranApi
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import retrofit2.HttpException
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/** Everything the Razorpay sheet needs, plus our own order ids for verify. */
data class PaymentRequest(
    val orderId: String,
    val razorpayOrderId: String,
    val amountInPaise: Int,
    val keyId: String,
    /** The idempotency key to replay on verify. */
    val idempotencyKey: String,
)

/** Outcome of the pre-payment legs (validate + create-order). */
sealed interface CreateOrderResult {
    /** Ready to open the Razorpay sheet with [request]. */
    data class NeedsPayment(val request: PaymentRequest) : CreateOrderResult

    /** 409 CART_CHANGED — the user must review the diff and re-confirm. */
    data class CartChanged(val message: String?) : CreateOrderResult

    /**
     * 422 INVALID_COUPON — a code that rode along on the validate is no
     * longer usable (expired etc.). Not terminal: the caller drops the code
     * and the customer can retry at full price or with another code.
     */
    data class CouponRejected(val message: String?) : CreateOrderResult

    data class Failure(val message: String?) : CreateOrderResult
}

/** Outcome of the coupon field's validate-only refresh (apply/remove). */
sealed interface ValidateCouponResult {
    /**
     * Server-priced snapshot — its totals already fold the coupon's discount
     * and `couponCode` carries the normalized (uppercase) applied code.
     */
    data class Validated(val snapshot: CartSnapshot) : ValidateCouponResult

    /** 422 INVALID_COUPON — the code is unknown, expired, or under its minimum. */
    data class InvalidCoupon(val message: String?) : ValidateCouponResult

    data class Failure(val message: String?) : ValidateCouponResult
}

/** Final outcome of the whole place-order transaction. */
sealed interface PlaceOrderResult {
    data class Success(val orderId: String) : PlaceOrderResult

    /** Razorpay reported failure or the server rejected the signature. */
    data class PaymentFailed(val message: String?) : PlaceOrderResult

    data class Failure(val message: String?) : PlaceOrderResult
}

@Singleton
class PlaceOrderUseCase @Inject constructor(
    private val api: MishranApi,
) {

    /** snapshotId → the idempotency key minted when its order was created. */
    private val idempotencyKeys = mutableMapOf<String, UUID>()

    /**
     * Validate the local cart against the server and mint a payable order.
     * @param slot date+window when the fresh tier is selected, else null.
     * @param couponCode the applied coupon, when one survives — rides along
     *   on validate so the minted order totals fold its discount.
     */
    suspend fun createPaymentRequest(
        items: List<CartItemEntity>,
        pincode: String,
        deliveryAddressId: String,
        slot: CartValidateRequestSlot?,
        couponCode: String? = null,
    ): CreateOrderResult {
        val snapshot = try {
            api.validateCart(
                CartValidateRequest(
                    items = collapsePackLines(items),
                    pincode = pincode,
                    slot = slot,
                    couponCode = couponCode,
                ),
            ).data
        } catch (e: HttpException) {
            return when (parseErrorCode(e)) {
                ERROR_CART_CHANGED -> CreateOrderResult.CartChanged(parseErrorMessage(e))
                ERROR_INVALID_COUPON -> CreateOrderResult.CouponRejected(parseErrorMessage(e))
                else -> CreateOrderResult.Failure(e.message())
            }
        } catch (e: Exception) {
            return CreateOrderResult.Failure(e.message)
        }

        val key = idempotencyKeys.getOrPut(snapshot.snapshotId.toString()) { UUID.randomUUID() }
        val order = try {
            api.createOrder(
                body = RazorpayCreateOrderRequest(
                    snapshotId = snapshot.snapshotId.toString(),
                    deliveryAddressId = deliveryAddressId,
                ),
                idempotencyKey = key.toString(),
            ).data
        } catch (e: HttpException) {
            // The snapshot may have expired server-side — treat as retryable failure.
            return CreateOrderResult.Failure(e.message())
        } catch (e: Exception) {
            return CreateOrderResult.Failure(e.message)
        }

        return CreateOrderResult.NeedsPayment(
            PaymentRequest(
                orderId = order.orderId,
                razorpayOrderId = order.razorpayOrderId,
                amountInPaise = order.amountInPaise,
                keyId = order.keyId,
                idempotencyKey = key.toString(),
            ),
        )
    }

    /**
     * Validate-only leg for the coupon field: POST /cart/validate with (or
     * without — removal) a code and hand back the server-priced snapshot. No
     * order is minted; apply/remove just refresh totals, and the code that
     * survives re-validates rides along when [createPaymentRequest] runs.
     */
    suspend fun validateCoupon(
        items: List<CartItemEntity>,
        pincode: String,
        slot: CartValidateRequestSlot?,
        couponCode: String?,
    ): ValidateCouponResult = try {
        ValidateCouponResult.Validated(
            api.validateCart(
                CartValidateRequest(
                    items = collapsePackLines(items),
                    pincode = pincode,
                    slot = slot,
                    couponCode = couponCode,
                ),
            ).data,
        )
    } catch (e: HttpException) {
        if (parseErrorCode(e) == ERROR_INVALID_COUPON) {
            ValidateCouponResult.InvalidCoupon(parseErrorMessage(e))
        } else {
            ValidateCouponResult.Failure(e.message())
        }
    } catch (e: Exception) {
        ValidateCouponResult.Failure(e.message)
    }

    /** Post the Razorpay outcome's signature; map the server's verdict. */
    suspend fun verifyPayment(
        request: PaymentRequest,
        razorpayPaymentId: String,
        signature: String,
    ): PlaceOrderResult {
        val verified: PaymentsRazorpayVerifyPost200Response = try {
            api.verifyPayment(
                body = RazorpayVerifyRequest(
                    orderId = request.orderId,
                    razorpayPaymentId = razorpayPaymentId,
                    signature = signature,
                ),
                idempotencyKey = request.idempotencyKey,
            )
        } catch (e: HttpException) {
            return PlaceOrderResult.PaymentFailed(parseErrorMessage(e))
        } catch (e: Exception) {
            // The payment succeeded; a network failure to verify is NOT terminal
            // — the server reconciles via webhook. Surface as PaymentFailed so
            // the UI shows the refund message, but the order may still confirm.
            return PlaceOrderResult.PaymentFailed(e.message)
        }
        return PlaceOrderResult.Success(verified.data.order.id)
    }

    private companion object {
        const val ERROR_CART_CHANGED = "CART_CHANGED"
        const val ERROR_INVALID_COUPON = "INVALID_COUPON"
    }
}

/**
 * Strip the pack suffix off a cart line id ("p1:500g" → "p1"; bare ids pass
 * through). The server's CartItem carries no variant field, so validate and
 * create-order only ever see BASE product ids.
 */
internal fun baseProductId(lineId: String): String = lineId.substringBefore(CART_ID_SEPARATOR)

/** Separator between a product id and its pack label in a cart line id. */
private const val CART_ID_SEPARATOR = ':'

/**
 * Collapse cart lines by BASE productId, summing quantities per product and
 * preserving first-appearance order. Required because pack-size lines are
 * local-only ("p1" + "p1:1 kg" both map to product p1): sent as-is, the
 * server would reject the suffixed ids as unknown products and validate
 * would fail.
 */
internal fun collapsePackLines(items: List<CartItemEntity>): List<CartItem> =
    items
        .groupBy(keySelector = { baseProductId(it.productId) }, valueTransform = { it.quantity })
        .map { (productId, quantities) -> CartItem(productId = productId, quantity = quantities.sum()) }

/**
 * Parsed error envelopes, cached per exception: an OkHttp response body is
 * single-shot, and a single failure path reads both the code and the message
 * off the same response.
 */
private val errorEnvelopes = java.util.Collections.synchronizedMap(
    java.util.WeakHashMap<HttpException, Map<String, Any?>>(),
)

private fun errorEnvelope(e: HttpException): Map<String, Any?> =
    errorEnvelopes.getOrPut(e) {
        val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
        runCatching { ERROR_JSON_ADAPTER.fromJson(body ?: "") }.getOrNull() ?: emptyMap()
    }

/** Extract `error.code` from a backend error body; null when unparseable. */
internal fun parseErrorCode(e: HttpException): String? {
    @Suppress("UNCHECKED_CAST")
    val error = errorEnvelope(e)["error"] as? Map<String, Any?> ?: return null
    return error["code"] as? String
}

/** Extract `error.message` for friendlier failure copy. */
internal fun parseErrorMessage(e: HttpException): String? {
    @Suppress("UNCHECKED_CAST")
    val error = errorEnvelope(e)["error"] as? Map<String, Any?> ?: return null
    return error["message"] as? String
}

private val ERROR_JSON_ADAPTER: com.squareup.moshi.JsonAdapter<Map<String, Any?>> =
    Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()
        .adapter<Map<String, Any?>>(
            com.squareup.moshi.Types.newParameterizedType(
                Map::class.java,
                String::class.java,
                Any::class.java,
            ),
        )
        .lenient()
