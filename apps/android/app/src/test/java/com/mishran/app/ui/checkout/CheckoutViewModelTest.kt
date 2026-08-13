// apps/android/app/src/test/java/com/mishran/app/ui/checkout/CheckoutViewModelTest.kt — Task 10.2.
//
// JVM unit tests for the checkout state machine + pure helpers (pincode
// validation, slot option building, address formatting). The repository is
// mocked; serviceability responses pin the tier to exercise both delivery
// models. NOTE: source-complete (no SDK).
package com.mishran.app.ui.checkout

import com.mishran.api.models.Address
import com.mishran.api.models.ServiceableResponse
import com.mishran.app.data.repository.AddressRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
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

class CheckoutViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: AddressRepository

    private val freshAddress = address(id = "a1", pincode = "110001")
    private val shelfAddress = address(id = "a2", pincode = "560001")

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `init loads addresses and checks the default selection`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(shelfAddress, freshAddress.copy(isDefault = true))
        coEvery { repository.checkServiceability("110001") } returns serviceable("fresh")

        val vm = CheckoutViewModel(repository)
        advanceUntilIdle()

        assertEquals(freshAddress.id, vm.state.value.selectedAddress?.id)
        assertTrue(vm.state.value.serviceability is ServiceabilityState.Serviceable)
    }

    @Test
    fun `fresh tier gets slot options, shelf tier gets none`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(freshAddress, shelfAddress)
        coEvery { repository.checkServiceability("110001") } returns serviceable("fresh")
        coEvery { repository.checkServiceability("560001") } returns serviceable("shelf")

        val vm = CheckoutViewModel(repository)
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

        val vm = CheckoutViewModel(repository)
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

        val vm = CheckoutViewModel(repository)
        advanceUntilIdle()

        assertTrue(vm.state.value.canPlaceOrder)
    }

    @Test
    fun `not serviceable blocks ordering`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(shelfAddress)
        coEvery { repository.checkServiceability("560001") } returns
            ServiceableResponse(serviceable = false, reason = "out_of_zone")

        val vm = CheckoutViewModel(repository)
        advanceUntilIdle()

        assertTrue(vm.state.value.serviceability is ServiceabilityState.NotServiceable)
        assertFalse(vm.state.value.canPlaceOrder)
    }

    @Test
    fun `invalid pincode short-circuits without a network call`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(address(id = "a3", pincode = "12"))

        val vm = CheckoutViewModel(repository)
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
        coEvery { repository.checkServiceability("110001") } returns slowFresh
        coEvery { repository.checkServiceability("560001") } returns serviceable("shelf")

        val vm = CheckoutViewModel(repository)
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

        val vm = CheckoutViewModel(repository)
        advanceUntilIdle()

        vm.selectPaymentMethod(PaymentMethod.CARD)
        assertEquals(PaymentMethod.CARD, vm.state.value.paymentMethod)
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
