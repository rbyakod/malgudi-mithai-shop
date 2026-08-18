// apps/android/app/src/test/java/com/mishran/app/ui/orders/OrderListViewModelTest.kt — Task 11.1.
//
// JVM tests for the orders tab state: cached rows surface + mark loaded,
// refresh toggles the spinner flag, failure sets the stale-list notice, and
// a second refresh while one is in flight is ignored. B5 guest browsing:
// a null session renders the sign-in (needAuth) state and skips the network.
package com.mishran.app.ui.orders

import com.mishran.api.models.Order
import com.mishran.api.models.OrderTotals
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.data.repository.OrderRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
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
    private lateinit var authRepository: AuthRepository
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
        authRepository = mockk()
        coEvery { repository.observeOrders() } returns cachedOrders
        coEvery { repository.refreshOrders() } returns true
        // Session defaults to signed-in; the guest tests swap the flow.
        every { authRepository.isLoggedInFlow() } returns flowOf(true)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `cached orders surface and mark the state loaded`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository, authRepository)
        advanceUntilIdle()

        cachedOrders.value = listOf(order("o1"), order("o2"))
        advanceUntilIdle()

        assertTrue(vm.state.value.loaded)
        assertEquals(listOf("o1", "o2"), vm.state.value.orders.map { it.id })
        assertFalse(vm.state.value.refreshFailed)
    }

    @Test
    fun `successful refresh clears the failure flag and the spinner`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository, authRepository)
        advanceUntilIdle()

        assertFalse(vm.refreshing.value)
        assertFalse(vm.state.value.refreshFailed)
    }

    @Test
    fun `failed refresh keeps the stale list and flags it`() = runTest(dispatcher) {
        val vm = OrderListViewModel(repository, authRepository)
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
        val vm = OrderListViewModel(repository, authRepository)
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
        val vm = OrderListViewModel(repository, authRepository)
        advanceUntilIdle()

        assertTrue(vm.state.value.loaded)
        assertTrue(vm.state.value.orders.isEmpty())
    }

    // ---- B5 guest browsing -------------------------------------------------

    @Test
    fun `guest session renders the sign-in state and skips the refresh`() = runTest(dispatcher) {
        every { authRepository.isLoggedInFlow() } returns flowOf(false)

        val vm = OrderListViewModel(repository, authRepository)
        advanceUntilIdle()

        // The 401-only refresh never fires; no false "No orders yet." state.
        assertTrue(vm.state.value.needAuth)
        coVerify(exactly = 0) { repository.refreshOrders() }
    }

    @Test
    fun `guest pull-to-refresh is a no-op`() = runTest(dispatcher) {
        every { authRepository.isLoggedInFlow() } returns flowOf(false)

        val vm = OrderListViewModel(repository, authRepository)
        advanceUntilIdle()

        vm.refresh()
        advanceUntilIdle()

        assertFalse(vm.refreshing.value)
        coVerify(exactly = 0) { repository.refreshOrders() }
    }

    @Test
    fun `signing in clears the guest state and pulls the list`() = runTest(dispatcher) {
        // The CTA redirects back here post-verify — the session flips to true
        // while this ViewModel is still alive.
        val session = MutableStateFlow(false)
        every { authRepository.isLoggedInFlow() } returns session

        val vm = OrderListViewModel(repository, authRepository)
        advanceUntilIdle()
        assertTrue(vm.state.value.needAuth)

        session.value = true
        advanceUntilIdle()

        assertFalse(vm.state.value.needAuth)
        coVerify(exactly = 1) { repository.refreshOrders() }
    }
}
