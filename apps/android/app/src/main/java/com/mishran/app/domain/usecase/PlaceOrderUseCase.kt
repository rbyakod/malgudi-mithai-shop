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
package com.mishran.app.domain.usecase

import com.mishran.api.models.CartItem
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

    data class Failure(val message: String?) : CreateOrderResult
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
     */
    suspend fun createPaymentRequest(
        items: List<CartItemEntity>,
        pincode: String,
        deliveryAddressId: String,
        slot: CartValidateRequestSlot?,
    ): CreateOrderResult {
        val snapshot = try {
            api.validateCart(
                CartValidateRequest(
                    items = items.map { CartItem(productId = it.productId, quantity = it.quantity) },
                    pincode = pincode,
                    slot = slot,
                ),
            ).data
        } catch (e: HttpException) {
            return when (parseErrorCode(e)) {
                ERROR_CART_CHANGED -> CreateOrderResult.CartChanged(parseErrorMessage(e))
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
    }
}

/** Extract `error.code` from a backend error body; null when unparseable. */
internal fun parseErrorCode(e: HttpException): String? {
    val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull() ?: return null
    val parsed = runCatching { ERROR_JSON_ADAPTER.fromJson(body) }.getOrNull() ?: return null
    @Suppress("UNCHECKED_CAST")
    val error = parsed["error"] as? Map<String, Any?> ?: return null
    return error["code"] as? String
}

/** Extract `error.message` for friendlier failure copy. */
internal fun parseErrorMessage(e: HttpException): String? {
    val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull() ?: return null
    val parsed = runCatching { ERROR_JSON_ADAPTER.fromJson(body) }.getOrNull() ?: return null
    @Suppress("UNCHECKED_CAST")
    val error = parsed["error"] as? Map<String, Any?> ?: return null
    return error["message"] as? String
}

private val ERROR_JSON_ADAPTER: com.squareup.moshi.JsonAdapter<Map<String, Any?>> =
    Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()
        .adapter(
            com.squareup.moshi.Types.newParameterizedType(
                Map::class.java,
                String::class.java,
                Any::class.java,
            ),
        )
        .lenient()
