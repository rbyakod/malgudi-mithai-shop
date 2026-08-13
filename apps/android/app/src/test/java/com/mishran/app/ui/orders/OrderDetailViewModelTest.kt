// apps/android/app/src/test/java/com/mishran/app/ui/orders/OrderDetailViewModelTest.kt — Task 11.1.
//
// JVM tests for the order detail lookup: id comes from SavedStateHandle,
// cache/network hits map to Success, misses to Error, and load() retries.
// NOTE: source-complete (no SDK).
package com.mishran.app.ui.orders

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Order
import com.mishran.api.models.OrderTotals
import com.mishran.app.data.repository.OrderRepository
import com.mishran.app.ui.common.UiState
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class OrderDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: OrderRepository

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

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `found order maps to Success`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns order

        val vm = OrderDetailViewModel(repository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()

        assertEquals(UiState.Success(order), vm.state.value)
    }

    @Test
    fun `missing order maps to Error`() = runTest(dispatcher) {
        coEvery { repository.getOrder("missing") } returns null

        val vm = OrderDetailViewModel(repository, SavedStateHandle(mapOf("id" to "missing")))
        advanceUntilIdle()

        assertTrue(vm.state.value is UiState.Error)
    }

    @Test
    fun `load retries from Error to Success`() = runTest(dispatcher) {
        coEvery { repository.getOrder("o1") } returns null andThen order

        val vm = OrderDetailViewModel(repository, SavedStateHandle(mapOf("id" to "o1")))
        advanceUntilIdle()
        assertTrue(vm.state.value is UiState.Error)

        vm.load()
        advanceUntilIdle()

        assertEquals(UiState.Success(order), vm.state.value)
    }
}
