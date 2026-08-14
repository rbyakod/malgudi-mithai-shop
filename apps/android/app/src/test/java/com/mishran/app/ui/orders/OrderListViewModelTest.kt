// apps/android/app/src/test/java/com/mishran/app/ui/orders/OrderListViewModelTest.kt — Task 11.1.
//
// JVM tests for the orders tab state: cached rows surface + mark loaded,
// refresh toggles the spinner flag, failure sets the stale-list notice, and
// a second refresh while one is in flight is ignored. NOTE: source-complete.
package com.mishran.app.ui.orders

import com.mishran.api.models.Order
import com.mishran.api.models.OrderTotals
import com.mishran.app.data.repository.OrderRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
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

class OrderListViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: OrderRepository
    private val cachedOrders = MutableStateFlow<List<Order>>(emptyList())

    private fun order(id: String) = Order(
        id = id,
        customerId = "c1",
        items = emptyList(),
        totals = OrderTotals(0, 0, 0, 0, 0),
        status = Order.Status.confirmed,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T10:05:00Z",
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        coEvery { repository.observeOrders() } returns cachedOrders
        coEvery { repository.refreshOrders() } returns true
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `cached orders surface and mark the state loaded`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository)
        advanceUntilIdle()

        cachedOrders.value = listOf(order("o1"), order("o2"))
        advanceUntilIdle()

        assertTrue(vm.state.value.loaded)
        assertEquals(listOf("o1", "o2"), vm.state.value.orders.map { it.id })
        assertFalse(vm.state.value.refreshFailed)
    }

    @Test
    fun `successful refresh clears the failure flag and the spinner`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository)
        advanceUntilIdle()

        assertFalse(vm.refreshing.value)
        assertFalse(vm.state.value.refreshFailed)
    }

    @Test
    fun `failed refresh keeps the stale list and flags it`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository)
        advanceUntilIdle()
        cachedOrders.value = listOf(order("stale"))
        advanceUntilIdle()
        coEvery { repository.refreshOrders() } returns false

        vm.refresh()
        advanceUntilIdle()

        assertTrue(vm.state.value.refreshFailed)
        assertEquals(listOf("stale"), vm.state.value.orders.map { it.id })
    }

    @Test
    fun `a second refresh while one is in flight is ignored`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository)
        advanceUntilIdle()

        // Both calls land before the launched coroutine runs. One of the two
        // is dropped; the init-time refresh already ran, so exactly 2 total.
        vm.refresh()
        vm.refresh()
        advanceUntilIdle()

        coVerify(exactly = 2) { repository.refreshOrders() }
    }

    @Test
    fun `empty cache yields loaded-but-empty state`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository)
        advanceUntilIdle()

        assertTrue(vm.state.value.loaded)
        assertTrue(vm.state.value.orders.isEmpty())
    }
}
