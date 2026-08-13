// apps/android/app/src/test/java/com/mishran/app/data/repository/OrderRepositoryTest.kt — Task 11.1.
//
// JVM tests for the order cache repository: refresh replaces the cache (and
// swallows failures), getOrder serves Room first + caches the network
// fallback, observeOrders maps rows back to contract models. The DAO is
// mocked with an in-memory MutableStateFlow table so the mapping + fallback
// logic runs for real. NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.Order
import com.mishran.api.models.OrderItemsInner
import com.mishran.api.models.OrderTotals
import com.mishran.api.models.OrdersGet200Response
import com.mishran.api.models.OrdersGet200ResponseData
import com.mishran.api.models.OrdersIdGet200Response
import com.mishran.app.data.local.dao.OrderDao
import com.mishran.app.data.local.entity.OrderEntity
import com.mishran.app.data.remote.api.MishranApi
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class OrderRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var orderDao: OrderDao
    private lateinit var repository: OrderRepository

    /** In-memory stand-in for the orders table, driven by the mocked DAO. */
    private val table = MutableStateFlow<List<OrderEntity>>(emptyList())

    private fun order(id: String) = Order(
        id = id,
        customerId = "c1",
        items = listOf(
            OrderItemsInner(
                productId = "p1",
                slug = "kaju-katli",
                name = "Kaju Katli",
                quantity = 1,
                unit = "500g",
                priceInPaise = 72000,
            ),
        ),
        totals = OrderTotals(72000, 0, 0, 0, 72000),
        status = Order.Status.confirmed,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T10:05:00Z",
    )

    @Before
    fun setUp() {
        api = mockk()
        orderDao = mockk()
        every { orderDao.observeAll() } returns table
        coEvery { orderDao.getById(any()) } answers {
            table.value.firstOrNull { it.id == firstArg<String>() }
        }
        coEvery { orderDao.replaceAll(any()) } answers {
            table.value = firstArg<List<OrderEntity>>()
        }
        coEvery { orderDao.insertAll(any()) } answers {
            table.value = table.value + firstArg<List<OrderEntity>>()
        }
        repository = OrderRepository(
            api = api,
            orderDao = orderDao,
            moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build(),
        )
    }

    @Test
    fun `refresh replaces the cache and reports success`() = runTest {
        coEvery { api.listOrders(any(), any()) } returns OrdersGet200Response(
            data = OrdersGet200ResponseData(
                items = listOf(order("o1"), order("o2")),
                total = 2,
                page = 1,
                pageSize = 20,
            ),
        )

        assertTrue(repository.refreshOrders())
        assertEquals(listOf("o1", "o2"), table.value.map { it.id })
    }

    @Test
    fun `refresh failure returns false and leaves the cache untouched`() = runTest {
        table.value = listOf(order("cached").toEntity("[]"))
        coEvery { api.listOrders(any(), any()) } throws java.io.IOException("offline")

        assertFalse(repository.refreshOrders())
        assertEquals(listOf("cached"), table.value.map { it.id })
    }

    @Test
    fun `observeOrders maps cached rows back to contract orders with items`() = runTest {
        coEvery { api.listOrders(any(), any()) } returns OrdersGet200Response(
            data = OrdersGet200ResponseData(
                items = listOf(order("o1")),
                total = 1,
                page = 1,
                pageSize = 20,
            ),
        )
        repository.refreshOrders()

        val orders = repository.observeOrders().first()

        assertEquals(1, orders.size)
        assertEquals("o1", orders[0].id)
        assertEquals("Kaju Katli", orders[0].items[0].name)
        assertEquals(Order.Status.confirmed, orders[0].status)
    }

    @Test
    fun `getOrder serves a cached row without touching the network`() = runTest {
        table.value = listOf(order("o1").toEntity("[]"))

        val result = repository.getOrder("o1")

        assertEquals("o1", result?.id)
        coVerify(exactly = 0) { api.getOrder(any()) }
    }

    @Test
    fun `getOrder falls back to the network and caches the result`() = runTest {
        coEvery { api.getOrder("o1") } returns OrdersIdGet200Response(data = order("o1"))

        val result = repository.getOrder("o1")

        assertEquals("o1", result?.id)
        coVerify(exactly = 1) { orderDao.insertAll(any()) }
        assertEquals(listOf("o1"), table.value.map { it.id })
    }

    @Test
    fun `getOrder returns null when cache and network both miss`() = runTest {
        coEvery { api.getOrder("missing") } throws java.io.IOException("offline")

        assertNull(repository.getOrder("missing"))
    }
}
