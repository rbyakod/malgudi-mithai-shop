// apps/android/app/src/test/java/com/mishran/app/ui/orders/OrderDetailViewModelTest.kt — Task 11.1 / parity batch (reorder).
//
// JVM tests for the order detail lookup: id comes from SavedStateHandle,
// cache/network hits map to Success, misses to Error, and load() retries.
// The reorder tests walk the mock cart through every order line and assert
// the all-added vs partial event counts. NOTE: source-complete (no SDK).
package com.mishran.app.ui.orders

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Order
import com.mishran.api.models.OrderItemsInner
import com.mishran.api.models.OrderTotals
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.OrderRepository
import com.mishran.app.ui.common.UiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class OrderDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: OrderRepository
    private lateinit var cartRepository: CartRepository

    private val order = Order(
        id = "o1",
        customerId = "c1",
        items = emptyList(),
        totals = OrderTotals(0, 0, 0, 0, 0),
        status = Order.Status.delivered,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T10:05:00Z",
    )

    /** A pack line, a bare (base-pack/legacy) line, and a second product. */
    private val orderWithItems = order.copy(
        items = listOf(
            OrderItemsInner(
                productId = "p1",
                slug = "kaju-katli",
                name = "Kaju Katli",
                quantity = 2,
                unit = "500g",
                priceInPaise = 72000,
                packLabel = "500g",
                image = "https://cdn.mishran.in/kaju-katli.jpg",
            ),
            OrderItemsInner(
                productId = "p2",
                slug = "mysore-pak",
                name = "Mysore Pak",
                quantity = 1,
                unit = "250g",
                priceInPaise = 18000,
            ),
            OrderItemsInner(
                productId = "p1",
                slug = "kaju-katli",
                name = "Kaju Katli",
                quantity = 1,
                unit = "1 kg",
                priceInPaise = 144000,
                packLabel = "1 kg",
            ),
        ),
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        cartRepository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `found order maps to Success`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns order

        val vm = OrderDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()

        assertEquals(UiState.Success(order), vm.state.value)
    }

    @Test
    fun `missing order maps to Error`() = runTest(dispatcher) {
        coEvery { repository.getOrder("missing") } returns null

        val vm = OrderDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("id" to "missing")))
        advanceUntilIdle()

        assertTrue(vm.state.value is UiState.Error)
    }

    @Test
    fun `load retries from Error to Success`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns null andThen order

        val vm = OrderDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()
        assertTrue(vm.state.value is UiState.Error)

        vm.load()
        advanceUntilIdle()

        assertEquals(UiState.Success(order), vm.state.value)
    }

    // ---- Parity batch: reorder --------------------------------------------

    @Test
    fun `reorder walks every order line into the cart and reports all added`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns orderWithItems
        coEvery {
            cartRepository.addPackLine(any(), any(), any(), any(), any(), any(), any(), any())
        } returns Unit

        val vm = OrderDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()

        var event: Reordered? = null
        val collector = launch { vm.reordered.collect { event = it } }

        vm.reorder()
        advanceUntilIdle()

        assertEquals(Reordered(added = 3, total = 3), event)
        coVerify(exactly = 1) {
            cartRepository.addPackLine(
                "p1", "kaju-katli", "Kaju Katli",
                "https://cdn.mishran.in/kaju-katli.jpg", "500g", 72000L, "500g", 2,
            )
        }
        coVerify(exactly = 1) {
            cartRepository.addPackLine("p2", "mysore-pak", "Mysore Pak", null, null, 18000L, "250g", 1)
        }
        collector.cancel()
    }

    @Test
    fun `a failing line counts as not added but never aborts the walk`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns orderWithItems
        coEvery {
            cartRepository.addPackLine(any(), any(), any(), any(), any(), any(), any(), any())
        } returns Unit
        coEvery {
            cartRepository.addPackLine("p2", any(), any(), any(), any(), any(), any(), any())
        } throws RuntimeException("disk full")

        val vm = OrderDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()

        var event: Reordered? = null
        val collector = launch { vm.reordered.collect { event = it } }

        vm.reorder()
        advanceUntilIdle()

        assertEquals(Reordered(added = 2, total = 3), event)
        // The line AFTER the failing one still landed.
        coVerify(exactly = 1) {
            cartRepository.addPackLine("p1", any(), any(), any(), "1 kg", any(), any(), any())
        }
        collector.cancel()
    }

    @Test
    fun `reorder is a no-op outside the Success state`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns null

        val vm = OrderDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()

        var fired = 0
        val collector = launch { vm.reordered.collect { fired++ } }

        vm.reorder()
        advanceUntilIdle()

        assertEquals(0, fired)
        coVerify(exactly = 0) {
            cartRepository.addPackLine(any(), any(), any(), any(), any(), any(), any(), any())
        }
        collector.cancel()
    }
}
