// apps/android/app/src/test/java/com/mishran/app/domain/usecase/PlaceOrderUseCaseTest.kt — Task 10.3 / P1 parity.
//
// JVM branch tests for the checkout transaction: success, CART_CHANGED (409),
// create-order failure, verify success/failure, and idempotency-key stability
// per snapshot — plus (P1 parity) the pack-line collapse that folds
// "p1:500g"-style cart lines onto base product ids before validate.
// HttpExceptions are built from real retrofit Response.error bodies carrying
// the backend's {error:{code,message}} envelope. NOTE: source-complete (no SDK).
package com.mishran.app.domain.usecase

import com.mishran.api.models.CartItem
import com.mishran.api.models.CartSnapshot
import com.mishran.api.models.CartSnapshotItem
import com.mishran.api.models.CartValidatePost200Response
import com.mishran.api.models.CartValidateRequest
import com.mishran.api.models.Order
import com.mishran.api.models.OrderTotals
import com.mishran.api.models.PaymentsRazorpayCreateOrderPost200Response
import com.mishran.api.models.PaymentsRazorpayVerifyPost200Response
import com.mishran.api.models.RazorpayCreateOrderRequest
import com.mishran.api.models.RazorpayCreateOrderResponse
import com.mishran.api.models.RazorpayVerifyRequest
import com.mishran.api.models.RazorpayVerifyResponse
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.remote.api.MishranApi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.util.UUID

class PlaceOrderUseCaseTest {

    private lateinit var api: MishranApi
    private lateinit var useCase: PlaceOrderUseCase

    private val cartLine = CartItemEntity(
        productId = "p1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        imageUrl = null,
        displayPrice = "₹720 / 500g",
        quantity = 2,
        addedAt = 0L,
    )

    private val snapshot = CartSnapshot(
        snapshotId = java.util.UUID.fromString("00000000-0000-0000-0000-000000000001"),
        customerId = "c1",
        items = listOf(
            CartSnapshotItem(
                productId = "p1",
                slug = "kaju-katli",
                name = "Kaju Katli",
                quantity = 2,
                freshnessStatus = CartSnapshotItem.FreshnessStatus.madeMinusDaily,
            ),
        ),
        totals = OrderTotals(144000, 0, 0, 0, 144000),
        pincodeTier = "fresh",
        expiresAt = "2026-08-13T20:00:00Z",
    )

    private val createOrderResponse = PaymentsRazorpayCreateOrderPost200Response(
        data = RazorpayCreateOrderResponse(
            orderId = "order-1",
            razorpayOrderId = "rzp_order_1",
            amountInPaise = 144000,
            keyId = "rzp_test_key",
        ),
    )

    @Before
    fun setUp() {
        api = mockk()
        useCase = PlaceOrderUseCase(api)
    }

    private fun httpError(code: Int, errorCode: String?, message: String?): HttpException =
        HttpException(
            Response.error<Any>(
                code,
                """
                {"error":{"code":${errorCode?.let { "\"$it\"" }},"message":${message?.let { "\"$it\"" }}}}
                """.trimIndent().toResponseBody("application/json".toMediaType()),
            ),
        )

    @Test
    fun `happy path validates then mints a payment request`() = runTest {
        coEvery { api.validateCart(any()) } returns CartValidatePost200Response(snapshot)
        coEvery { api.createOrder(any(), any(), any()) } returns createOrderResponse

        val result = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        assertTrue(result is CreateOrderResult.NeedsPayment)
        val request = (result as CreateOrderResult.NeedsPayment).request
        assertEquals("order-1", request.orderId)
        assertEquals("rzp_order_1", request.razorpayOrderId)
        assertEquals(144000, request.amountInPaise)
        assertEquals("rzp_test_key", request.keyId)
        // Idempotency key is a valid UUID.
        assertNotNull(UUID.fromString(request.idempotencyKey))
    }

    @Test
    fun `cart items map to contract products with quantities`() = runTest {
        coEvery { api.validateCart(any()) } returns CartValidatePost200Response(snapshot)
        coEvery { api.createOrder(any(), any(), any()) } returns createOrderResponse

        useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        val body = slot<CartValidateRequest>()
        coVerify { api.validateCart(capture(body)) }
        assertEquals(listOf(CartItem(productId = "p1", quantity = 2)), body.captured.items)
        assertEquals("110001", body.captured.pincode)
    }

    // ---- P1 parity: pack-line collapse before validate --------------------

    @Test
    fun `baseProductId strips the pack suffix and passes bare ids through`() {
        assertEquals("p1", baseProductId("p1:500g"))
        assertEquals("p1", baseProductId("p1:1 kg"))
        assertEquals("p1", baseProductId("p1"))
        assertEquals("p-42", baseProductId("p-42"))
    }

    @Test
    fun `collapsePackLines sums pack lines into their base product`() {
        val collapsed = collapsePackLines(
            listOf(
                packLine("p1", label = null, quantity = 2),
                packLine("p1", label = "1 kg", quantity = 1),
                packLine("p2", label = "500g", quantity = 3),
            ),
        )

        // Order preserves first appearance; quantities merge per base id.
        assertEquals(
            listOf(CartItem(productId = "p1", quantity = 3), CartItem(productId = "p2", quantity = 3)),
            collapsed,
        )
    }

    @Test
    fun `createPaymentRequest validates the collapsed cart not the pack lines`() = runTest {
        coEvery { api.validateCart(any()) } returns CartValidatePost200Response(snapshot)
        coEvery { api.createOrder(any(), any(), any()) } returns createOrderResponse

        // Without the collapse the server would see productId "p1:500g" —
        // an unknown product — and reject the validate call.
        useCase.createPaymentRequest(
            listOf(packLine("p1", label = "500g", quantity = 2)),
            "110001",
            "addr-1",
            slot = null,
        )

        val body = slot<CartValidateRequest>()
        coVerify { api.validateCart(capture(body)) }
        assertEquals(listOf(CartItem(productId = "p1", quantity = 2)), body.captured.items)
    }

    /** A cart line keyed like the PDP's pack-sized add does (base or derived). */
    private fun packLine(productId: String, label: String?, quantity: Int): CartItemEntity =
        CartItemEntity(
            productId = if (label == null) productId else "$productId:$label",
            slug = "$productId-slug",
            name = "Sweet $productId",
            imageUrl = null,
            displayPrice = "₹720 / 500g",
            packLabel = label,
            quantity = quantity,
            addedAt = 0L,
        )

    @Test
    fun `409 CART_CHANGED surfaces as CartChanged with the server message`() = runTest {
        coEvery { api.validateCart(any()) } throws
            httpError(409, "CART_CHANGED", "2 items changed price")

        val result = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        assertTrue(result is CreateOrderResult.CartChanged)
        assertEquals("2 items changed price", (result as CreateOrderResult.CartChanged).message)
        coVerify(exactly = 0) { api.createOrder(any(), any(), any()) }
    }

    @Test
    fun `other HTTP failures surface as generic Failure`() = runTest {
        coEvery { api.validateCart(any()) } throws
            httpError(422, "PINCODE_NOT_SERVICEABLE", "out of zone")

        val result = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        assertTrue(result is CreateOrderResult.Failure)
    }

    @Test
    fun `network failure on validate surfaces as Failure`() = runTest {
        coEvery { api.validateCart(any()) } throws java.io.IOException("offline")

        val result = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        assertTrue(result is CreateOrderResult.Failure)
    }

    @Test
    fun `idempotency key is stable per snapshot across retries`() = runTest {
        coEvery { api.validateCart(any()) } returns CartValidatePost200Response(snapshot)
        coEvery { api.createOrder(any(), any(), any()) } throws java.io.IOException("flaky") andThen createOrderResponse

        val first = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)
        val second = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        assertTrue(first is CreateOrderResult.Failure) // network died, no key escape hatch needed
        val request = (second as CreateOrderResult.NeedsPayment).request

        val keys = mutableListOf<String>()
        coVerify(atLeast = 2) { api.createOrder(any(), any(), capture(keys)) }
        assertEquals(keys.toSet().size, 1) // same key both attempts
        assertEquals(request.idempotencyKey, keys.last())
    }

    @Test
    fun `verify success returns the order id`() = runTest {
        coEvery { api.verifyPayment(any(), any()) } returns PaymentsRazorpayVerifyPost200Response(
            data = RazorpayVerifyResponse(order = order()),
        )
        val request = paymentRequest()

        val result = useCase.verifyPayment(request, "pay_1", "sig_1")

        assertEquals(PlaceOrderResult.Success("order-1"), result)
        val body = slot<RazorpayVerifyRequest>()
        coVerify { api.verifyPayment(capture(body), capture(io.mockk.slot<String>())) }
        assertEquals("order-1", body.captured.orderId)
    }

    @Test
    fun `verify rejection surfaces as PaymentFailed`() = runTest {
        coEvery { api.verifyPayment(any(), any()) } throws
            httpError(402, "PAYMENT_FAILED", "signature mismatch")
        val request = paymentRequest()

        val result = useCase.verifyPayment(request, "pay_1", "bad_sig")

        assertTrue(result is PlaceOrderResult.PaymentFailed)
    }

    @Test
    fun `network failure during verify is PaymentFailed not Failure`() = runTest {
        coEvery { api.verifyPayment(any(), any()) } throws java.io.IOException("offline")
        val request = paymentRequest()

        val result = useCase.verifyPayment(request, "pay_1", "sig_1")

        // Money may have moved — the UI must show the refund message; the
        // server's webhook reconciles the order either way.
        assertTrue(result is PlaceOrderResult.PaymentFailed)
    }

    @Test
    fun `error envelope parse helpers read code and message`() {
        val e = httpError(409, "CART_CHANGED", "msg")
        assertEquals("CART_CHANGED", parseErrorCode(e))
        assertEquals("msg", parseErrorMessage(e))
    }

    @Test
    fun `different snapshots mint different idempotency keys`() = runTest {
        coEvery { api.validateCart(any()) } returns CartValidatePost200Response(snapshot)
        coEvery { api.createOrder(any(), any(), any()) } returns createOrderResponse

        useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)
        val otherSnapshot = snapshot.copy(
            snapshotId = java.util.UUID.fromString("00000000-0000-0000-0000-000000000002"),
        )
        coEvery { api.validateCart(any()) } returns CartValidatePost200Response(otherSnapshot)

        val second = useCase.createPaymentRequest(listOf(cartLine), "110001", "addr-1", slot = null)

        val keys = mutableListOf<String>()
        coVerify(atLeast = 2) { api.createOrder(any(), any(), capture(keys)) }
        assertNotEquals(keys[0], keys[1])
        assertTrue((second as CreateOrderResult.NeedsPayment).request.idempotencyKey.isNotEmpty())
    }

    private fun paymentRequest() = PaymentRequest(
        orderId = "order-1",
        razorpayOrderId = "rzp_order_1",
        amountInPaise = 144000,
        keyId = "rzp_test_key",
        idempotencyKey = UUID.randomUUID().toString(),
    )

    private fun order() = Order(
        id = "order-1",
        customerId = "c1",
        items = emptyList(),
        totals = OrderTotals(144000, 0, 0, 0, 144000),
        status = Order.Status.pending_payment,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T10:05:00Z",
    )
}
