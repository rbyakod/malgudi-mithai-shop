// apps/android/app/src/test/java/com/mishran/app/ui/checkout/CheckoutViewModelTest.kt — Tasks 10.2/10.3.
//
// JVM unit tests for the checkout state machine + pure helpers (pincode
// validation, slot option building, address formatting) and the payment
// transaction (place-order event dispatch, Razorpay outcome handling).
// Repositories + use case are mocked; serviceability responses pin the tier
// to exercise both delivery models. NOTE: source-complete (no SDK).
package com.mishran.app.ui.checkout

import com.mishran.api.models.Address
import com.mishran.api.models.ServiceableResponse
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.domain.usecase.CreateOrderResult
import com.mishran.app.domain.usecase.PaymentRequest
import com.mishran.app.domain.usecase.PlaceOrderResult
import com.mishran.app.domain.usecase.PlaceOrderUseCase
import com.mishran.app.util.RazorpayOutcome
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.util.UUID

class CheckoutViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: AddressRepository
    private lateinit var cartRepository: CartRepository
    private lateinit var placeOrder: PlaceOrderUseCase

    private val freshAddress = address(id = "a1", pincode = "110001")
    private val shelfAddress = address(id = "a2", pincode = "560001")

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        cartRepository = mockk()
        placeOrder = mockk()
        coEvery { cartRepository.observeItems() } returns MutableStateFlow(emptyList())
        coEvery { cartRepository.clear() } returns Unit
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `init loads addresses and checks the default selection`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(shelfAddress, freshAddress.copy(isDefault = true))
        coEvery { repository.checkServiceability("110001") } returns serviceable("fresh")

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()

        assertEquals(freshAddress.id, vm.state.value.selectedAddress?.id)
        assertTrue(vm.state.value.serviceability is ServiceabilityState.Serviceable)
    }

    @Test
    fun `fresh tier gets slot options, shelf tier gets none`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(freshAddress, shelfAddress)
        coEvery { repository.checkServiceability("110001") } returns serviceable("fresh")
        coEvery { repository.checkServiceability("560001") } returns serviceable("shelf")

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()
        assertEquals(4, vm.state.value.slotOptions.size)

        vm.selectAddress(shelfAddress)
        advanceUntilIdle()

        assertTrue(vm.state.value.slotOptions.isEmpty())
        assertNull(vm.state.value.selectedSlot)
        assertFalse(vm.state.value.isFreshTier)
    }

    @Test
    fun `canPlaceOrder requires address serviceability and slot on fresh tier`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(freshAddress)
        coEvery { repository.checkServiceability("110001") } returns serviceable("fresh")

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()
        assertFalse(vm.state.value.canPlaceOrder) // no slot yet

        vm.selectSlot(vm.state.value.slotOptions.first())
        assertTrue(vm.state.value.canPlaceOrder)
    }

    @Test
    fun `shelf tier can place an order without a slot`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(shelfAddress)
        coEvery { repository.checkServiceability("560001") } returns
            serviceable("shelf", slaDays = 3)

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()

        assertTrue(vm.state.value.canPlaceOrder)
    }

    @Test
    fun `not serviceable blocks ordering`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(shelfAddress)
        coEvery { repository.checkServiceability("560001") } returns
            ServiceableResponse(serviceable = false, reason = "out_of_zone")

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()

        assertTrue(vm.state.value.serviceability is ServiceabilityState.NotServiceable)
        assertFalse(vm.state.value.canPlaceOrder)
    }

    @Test
    fun `invalid pincode short-circuits without a network call`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(address(id = "a3", pincode = "12"))

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()

        val serviceability = vm.state.value.serviceability
        assertTrue(
            serviceability is ServiceabilityState.NotServiceable &&
                serviceability.reason == "invalid_pincode",
        )
        io.mockk.coVerify(exactly = 0) { repository.checkServiceability(any()) }
    }

    @Test
    fun `stale serviceability response does not clobber a newer selection`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(freshAddress, shelfAddress)
        val slowFresh = kotlinx.coroutines.CompletableDeferred<ServiceableResponse?>()
        coEvery { repository.checkServiceability("110001") } coAnswers { slowFresh.await() }
        coEvery { repository.checkServiceability("560001") } returns serviceable("shelf")

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()
        // Re-select before the first check resolves.
        vm.selectAddress(shelfAddress)
        advanceUntilIdle()
        assertEquals("shelf", (vm.state.value.serviceability as ServiceabilityState.Serviceable).tier)

        // Now the stale fresh response lands — it must be ignored.
        slowFresh.complete(serviceable("fresh"))
        advanceUntilIdle()
        assertEquals("shelf", (vm.state.value.serviceability as ServiceabilityState.Serviceable).tier)
    }

    @Test
    fun `payment method selection is stored`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns emptyList()

        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()

        vm.selectPaymentMethod(PaymentMethod.CARD)
        assertEquals(PaymentMethod.CARD, vm.state.value.paymentMethod)
    }

    // ---- payment transaction (Task 10.3) -----------------------------------

    private fun paymentRequest() = PaymentRequest(
        orderId = "order-1",
        razorpayOrderId = "rzp_order_1",
        amountInPaise = 144000,
        keyId = "rzp_test_key",
        idempotencyKey = UUID.randomUUID().toString(),
    )

    private fun readyViewModel(): CheckoutViewModel {
        coEvery { repository.listAddresses() } returns listOf(shelfAddress)
        coEvery { repository.checkServiceability("560001") } returns serviceable("shelf")
        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        return vm
    }

    /** Collect one-shot events into a list for the duration of a test body. */
    private fun kotlinx.coroutines.test.TestScope.recordEvents(
        vm: CheckoutViewModel,
    ): MutableList<CheckoutEvent> {
        val events = mutableListOf<CheckoutEvent>()
        // Unconfined on the shared scheduler: subscribe + deliver synchronously
        // so emissions land in `events` before the assertions read it.
        backgroundScope.launch(
            kotlinx.coroutines.test.UnconfinedTestDispatcher(testScheduler),
            start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED,
        ) {
            vm.events.collect { events.add(it) }
        }
        return events
    }

    @Test
    fun `placeOrder dispatches OpenPayment with the minted request`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        val request = paymentRequest()
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(request)

        vm.placeOrder()
        advanceUntilIdle()

        assertEquals(listOf(CheckoutEvent.OpenPayment(request)), events.toList())
        assertFalse(vm.placingOrder.value)
    }

    @Test
    fun `cart-changed surfaces as an event and never opens the sheet`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.CartChanged("2 items changed price")

        vm.placeOrder()
        advanceUntilIdle()

        assertEquals(listOf(CheckoutEvent.CartChanged("2 items changed price")), events.toList())
    }

    @Test
    fun `create failure surfaces as Failed`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.Failure("offline")

        vm.placeOrder()
        advanceUntilIdle()

        assertEquals(listOf(CheckoutEvent.Failed("offline")), events.toList())
    }

    @Test
    fun `a second placeOrder while one is in flight is ignored`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(paymentRequest())

        // Both calls land before the launched coroutine runs.
        vm.placeOrder()
        vm.placeOrder()
        advanceUntilIdle()

        coVerify(exactly = 1) { placeOrder.createPaymentRequest(any(), any(), any(), any()) }
    }

    @Test
    fun `razorpay success verifies, clears the cart, and emits OrderPlaced`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        val request = paymentRequest()
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(request)
        coEvery {
            placeOrder.verifyPayment(request, "pay_1", "sig_1")
        } returns PlaceOrderResult.Success("order-1")

        vm.placeOrder()
        advanceUntilIdle()
        vm.onRazorpayOutcome(RazorpayOutcome.Success("pay_1", "sig_1"))
        advanceUntilIdle()

        // Shelf tier (readyViewModel): no slot, so the ETA falls back to the
        // serviceability SLA days.
        assertEquals(
            listOf(
                CheckoutEvent.OpenPayment(request),
                CheckoutEvent.OrderPlaced("order-1", slotLabel = null, shelfSlaDays = 1),
            ),
            events.toList(),
        )
        coVerify(exactly = 1) { cartRepository.clear() }
    }

    @Test
    fun `fresh tier order carries the picked slot label for the ETA`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(freshAddress)
        coEvery { repository.checkServiceability("110001") } returns serviceable("fresh")
        val vm = CheckoutViewModel(repository, cartRepository, placeOrder)
        advanceUntilIdle()
        vm.selectSlot(vm.state.value.slotOptions.first())
        val events = recordEvents(vm)
        val request = paymentRequest()
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(request)
        coEvery {
            placeOrder.verifyPayment(request, "pay_1", "sig_1")
        } returns PlaceOrderResult.Success("order-1")

        vm.placeOrder()
        advanceUntilIdle()
        vm.onRazorpayOutcome(RazorpayOutcome.Success("pay_1", "sig_1"))
        advanceUntilIdle()

        assertEquals(
            CheckoutEvent.OrderPlaced(
                "order-1",
                slotLabel = vm.state.value.selectedSlot?.label,
                shelfSlaDays = 1,
            ),
            events.last(),
        )
    }

    @Test
    fun `razorpay sheet failure emits PaymentFailed without verifying`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(paymentRequest())

        vm.placeOrder()
        advanceUntilIdle()
        vm.onRazorpayOutcome(RazorpayOutcome.Failed(2, "bank declined"))
        advanceUntilIdle()

        val last = events.last()
        assertTrue(last is CheckoutEvent.PaymentFailed && last.message == "bank declined")
        coVerify(exactly = 0) { placeOrder.verifyPayment(any(), any(), any()) }
        coVerify(exactly = 0) { cartRepository.clear() }
    }

    @Test
    fun `verify rejection keeps the cart and emits PaymentFailed`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        val request = paymentRequest()
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(request)
        coEvery {
            placeOrder.verifyPayment(request, "pay_1", "sig_1")
        } returns PlaceOrderResult.PaymentFailed("signature mismatch")

        vm.placeOrder()
        advanceUntilIdle()
        vm.onRazorpayOutcome(RazorpayOutcome.Success("pay_1", "sig_1"))
        advanceUntilIdle()

        assertEquals(CheckoutEvent.PaymentFailed("signature mismatch"), events.last())
        coVerify(exactly = 0) { cartRepository.clear() }
    }

    @Test
    fun `dismissing the sheet emits nothing`() = runTest(dispatcher) {
        val vm = readyViewModel()
        advanceUntilIdle()
        val events = recordEvents(vm)
        coEvery {
            placeOrder.createPaymentRequest(any(), any(), any(), any())
        } returns CreateOrderResult.NeedsPayment(paymentRequest())

        vm.placeOrder()
        advanceUntilIdle()
        vm.onRazorpayOutcome(RazorpayOutcome.Dismissed)
        advanceUntilIdle()

        assertEquals(1, events.size) // just OpenPayment
        coVerify(exactly = 0) { placeOrder.verifyPayment(any(), any(), any()) }
        coVerify(exactly = 0) { cartRepository.clear() }
    }

    // ---- pure helpers ------------------------------------------------------

    @Test
    fun `pincode validation accepts 6 digits starting non-zero only`() {
        assertTrue(isValidPincode("110001"))
        assertTrue(isValidPincode("560001"))
        assertFalse(isValidPincode("060001"))
        assertFalse(isValidPincode("11001"))
        assertFalse(isValidPincode("1100011"))
        assertFalse(isValidPincode("11000a"))
    }

    @Test
    fun `slot options cover today and tomorrow with two windows each`() {
        val today = LocalDate.of(2026, 8, 13)
        val options = buildSlotOptions(today)

        assertEquals(4, options.size)
        assertEquals(today.toString(), options[0].date)
        assertEquals(today.plusDays(1).toString(), options[2].date)
        assertEquals(CheckoutViewModel.WINDOW_MORNING, options[0].window)
        assertEquals(CheckoutViewModel.WINDOW_EVENING, options[1].window)
        assertTrue(options[0].label.startsWith("Today"))
        assertTrue(options[2].label.startsWith("Tomorrow"))
    }

    @Test
    fun `address line joins present parts`() {
        val line = formatAddressLine(
            address(id = "a", pincode = "110001").copy(
                line1 = "12 Hauz Khas Village",
                city = "New Delhi",
                state = "Delhi",
            ),
        )
        assertEquals("12 Hauz Khas Village, New Delhi, Delhi, 110001", line)
    }

    private fun address(id: String, pincode: String?) = Address(
        id = id,
        line1 = null,
        city = null,
        state = null,
        pincode = pincode,
    )

    private fun serviceable(tier: String, slaDays: Int? = 1) = ServiceableResponse(
        serviceable = true,
        tier = tier,
        city = "Test City",
        slaDays = slaDays,
    )
}
