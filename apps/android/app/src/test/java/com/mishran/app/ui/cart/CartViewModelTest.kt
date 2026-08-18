// apps/android/app/src/test/java/com/mishran/app/ui/cart/CartViewModelTest.kt — Task 10.1 / B9.
//
// JVM unit tests for the cart ViewModel state mapping + mutation dispatch.
// The repository is mocked with a MutableStateFlow-backed observeItems so
// mutations visibly update the state under test. B9 adds the delivery-line
// suite: the estimate flow (persisted pincode in, debounced refetch, silent
// failure fallback) and the pure progress math. NOTE: source-complete (no SDK).
package com.mishran.app.ui.cart

import com.mishran.api.models.CartEstimate
import com.mishran.api.models.Product
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.SettingsRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CartViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: CartRepository
    private lateinit var brandRepository: BrandRepository
    private lateinit var settingsRepository: SettingsRepository
    private lateinit var addressRepository: AddressRepository

    /** The live cart the mocked observeItems reads from. */
    private val table = MutableStateFlow<List<CartItemEntity>>(emptyList())

    private val product = Product(
        id = "p1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        family = Product.Family.classic,
        displayPrice = "₹720 / 500g",
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        brandRepository = mockk()
        settingsRepository = mockk()
        addressRepository = mockk()
        every { repository.observeItems() } returns table
        // Parity batch: the WhatsApp button's digits seam — null keeps the
        // placeholder, and no test here needs a real brand record.
        coEvery { brandRepository.getSupportContact() } returns null
        // B9 defaults: no persisted check, estimate quietly unavailable —
        // per-test stubs recorded later take precedence in mockk.
        coEvery { settingsRepository.deliveryCheck() } returns null
        coEvery { settingsRepository.setDeliveryCheck(any()) } returns Unit
        coEvery { repository.estimate(any(), any()) } returns null
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel() = CartViewModel(
        repository,
        brandRepository,
        settingsRepository,
        addressRepository,
    )

    @Test
    fun `state maps lines to count, estimate, and unpriced flag`() = runTest(dispatcher) {
        table.value = listOf(
            line("p1", "₹720 / 500g", quantity = 2),
            line("p2", null, quantity = 1),
        )

        val vm = viewModel()
        vm.state.backgroundCollect(this)
        advanceUntilIdle()

        assertEquals(3, vm.state.value.itemCount)
        assertEquals(144000L, vm.state.value.estimatedTotalPaise)
        assertTrue(vm.state.value.hasUnpricedLines)
        assertFalse(vm.state.value.isEmpty)
    }

    @Test
    fun `empty table yields the empty state`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.state.backgroundCollect(this)

        assertTrue(vm.state.value.isEmpty)
        assertEquals(0L, vm.state.value.estimatedTotalPaise)
        assertFalse(vm.state.value.hasUnpricedLines)
    }

    @Test
    fun `add dispatches product and quantity to the repository`() = runTest(dispatcher) {
        coEvery { repository.add(any(), any()) } returns Unit

        val vm = viewModel()
        vm.add(product, 3)
        advanceUntilIdle()

        coVerify(exactly = 1) { repository.add(product, 3) }
    }

    @Test
    fun `add emits the lineAdded event after the write`() = runTest(dispatcher) {
        coEvery { repository.add(any(), any()) } returns Unit

        val vm = viewModel()
        var fired = 0
        val collector = launch { vm.lineAdded.collect { fired++ } }

        vm.add(product, 1)
        advanceUntilIdle()

        assertEquals(1, fired)
        collector.cancel()
    }

    @Test
    fun `increment and decrement delegate with the adjusted quantity`() = runTest(dispatcher) {
        coEvery { repository.setQuantity(any(), any()) } returns Unit

        val vm = viewModel()
        vm.increment("p1", current = 2)
        vm.decrement("p1", current = 2)
        advanceUntilIdle()

        coVerify { repository.setQuantity("p1", 3) }
        coVerify { repository.setQuantity("p1", 1) }
    }

    @Test
    fun `remove and clear delegate`() = runTest(dispatcher) {
        coEvery { repository.remove(any()) } returns Unit
        coEvery { repository.clear() } returns Unit

        val vm = viewModel()
        vm.remove("p1")
        vm.clear()
        advanceUntilIdle()

        coVerify(exactly = 1) { repository.remove("p1") }
        coVerify(exactly = 1) { repository.clear() }
    }

    // ---- formatPaise (pure) ----------------------------------------------

    @Test
    fun `formatPaise renders whole rupees without decimals`() {
        assertEquals("₹720", formatPaise(72000))
        assertEquals("₹1,200", formatPaise(120000))
        assertEquals("₹0", formatPaise(0))
    }

    @Test
    fun `formatPaise renders sub-rupee amounts with two decimals`() {
        assertEquals("₹12.50", formatPaise(1250))
    }

    // ---- "Send order on WhatsApp" message builder (parity batch) ----------

    @Test
    fun `buildCartWhatsAppMessage enumerates every line and the total`() {
        val message = buildCartWhatsAppMessage(
            items = listOf(
                line("p1", "₹720 / 500g", quantity = 2),
                line("p2", "₹960 / 1 kg", quantity = 1),
            ),
            totalLabel = "₹2,400",
        )
        assertTrue(message.startsWith("Hi Mishran! I'd like to order:"))
        assertTrue(message.contains("1. Sweet p1 × 2 — ₹720 / 500g"))
        assertTrue(message.contains("2. Sweet p2 × 1 — ₹960 / 1 kg"))
        assertTrue(message.endsWith("Total: ₹2,400"))
    }

    @Test
    fun `buildCartWhatsAppMessage folds the pack label into the line name`() {
        val packed = CartItemEntity(
            productId = "p1",
            slug = "kaju-katli",
            name = "Kaju Katli",
            packLabel = "500g",
            imageUrl = null,
            displayPrice = "₹720 / 500g",
            quantity = 1,
            addedAt = 0L,
        )
        val message = buildCartWhatsAppMessage(listOf(packed), totalLabel = "₹720")
        assertTrue(message.contains("1. Kaju Katli (500g) × 1 — ₹720 / 500g"))
    }

    // ---- B9: delivery estimate flow ---------------------------------------

    @Test
    fun `a persisted pincode rides along on the debounced estimate fetch`() =
        runTest(dispatcher) {
            coEvery { settingsRepository.deliveryCheck() } returns "110001|shelf|New Delhi|3"
            coEvery { repository.estimate(any(), any()) } returns estimate(
                freeDeliveryEligible = false,
                thresholdInPaise = 200000,
            )
            table.value = listOf(line("p1", "₹720 / 500g", quantity = 2))

            val vm = viewModel()
            vm.delivery.backgroundCollect(this)
            advanceUntilIdle()

            coVerify(exactly = 1) { repository.estimate(any(), "110001") }
            assertEquals(
                CartDeliveryUi.Priced(
                    feeInPaise = 4900,
                    freeDeliveryEligible = false,
                    progress = CartProgress.Remaining(56000),
                ),
                vm.delivery.value,
            )
        }

    @Test
    fun `an estimate failure keeps the no-pincode copy`() = runTest(dispatcher) {
        coEvery { settingsRepository.deliveryCheck() } returns "110001|shelf|New Delhi|3"
        coEvery { repository.estimate(any(), any()) } returns null
        table.value = listOf(line("p1", "₹720 / 500g", quantity = 2))

        val vm = viewModel()
        vm.delivery.backgroundCollect(this)
        advanceUntilIdle()

        assertEquals(CartDeliveryUi.AtCheckout, vm.delivery.value)
    }

    @Test
    fun `an empty cart clears the estimate without calling the endpoint`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.delivery.backgroundCollect(this)
        advanceUntilIdle()

        coVerify(exactly = 0) { repository.estimate(any(), any()) }
        assertEquals(CartDeliveryUi.AtCheckout, vm.delivery.value)
    }

    // ---- B9: progress math (pure) ------------------------------------------

    @Test
    fun `progressState unlocks once the subtotal meets the threshold`() {
        assertEquals(CartProgress.Unlocked, progressState(200000, 200000))
        assertEquals(CartProgress.Unlocked, progressState(250000, 200000))
    }

    @Test
    fun `progressState reports the positive shortfall below the threshold`() {
        assertEquals(CartProgress.Remaining(56000), progressState(144000, 200000))
        assertEquals(CartProgress.Remaining(100), progressState(199900, 200000))
    }

    @Test
    fun `toDeliveryUi keeps the no-pincode copy for null estimates and unknown tiers`() {
        assertEquals(CartDeliveryUi.AtCheckout, toDeliveryUi(null))
        assertEquals(
            CartDeliveryUi.AtCheckout,
            toDeliveryUi(estimate(pincodeTier = null, thresholdInPaise = null)),
        )
    }

    @Test
    fun `toDeliveryUi follows the server's eligible stamp for the unlocked line`() {
        assertEquals(
            CartDeliveryUi.Priced(
                feeInPaise = 0,
                freeDeliveryEligible = true,
                progress = CartProgress.Unlocked,
            ),
            toDeliveryUi(
                estimate(
                    feeInPaise = 0,
                    freeDeliveryEligible = true,
                    thresholdInPaise = 200000,
                ),
            ),
        )
    }

    @Test
    fun `toDeliveryUi omits progress when the tier carries no threshold`() {
        assertEquals(
            CartDeliveryUi.Priced(
                feeInPaise = 4900,
                freeDeliveryEligible = false,
                progress = null,
            ),
            toDeliveryUi(estimate(thresholdInPaise = null)),
        )
    }

    private fun estimate(
        itemsTotalInPaise: Int = 144000,
        feeInPaise: Int = 4900,
        pincodeTier: String? = "shelf",
        thresholdInPaise: Int? = 200000,
        freeDeliveryEligible: Boolean = false,
    ) = CartEstimate(
        itemsTotalInPaise = itemsTotalInPaise,
        deliveryFeeInPaise = feeInPaise,
        discountInPaise = 0,
        totalInPaise = itemsTotalInPaise + feeInPaise,
        pincodeTier = pincodeTier,
        freeDeliveryThresholdInPaise = thresholdInPaise,
        freeDeliveryEligible = freeDeliveryEligible,
    )

    private fun line(productId: String, displayPrice: String?, quantity: Int) = CartItemEntity(
        productId = productId,
        slug = "slug-$productId",
        name = "Sweet $productId",
        imageUrl = null,
        displayPrice = displayPrice,
        quantity = quantity,
        addedAt = 0L,
    )

    /** Keep a live collector so stateIn(WhileSubscribed) actually runs. */
    private fun <T> kotlinx.coroutines.flow.StateFlow<T>.backgroundCollect(
        scope: kotlinx.coroutines.test.TestScope,
    ) {
        scope.backgroundScope.launch { this@backgroundCollect.collect { } }
    }
}
