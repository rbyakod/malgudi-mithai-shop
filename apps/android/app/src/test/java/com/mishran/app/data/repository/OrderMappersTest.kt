// apps/android/app/src/test/java/com/mishran/app/data/repository/OrderMappersTest.kt — Task 11.1.
//
// JVM round-trip tests for the order cache mappers: contract model → Room
// row → contract model, including enum value-strings, slot round-trip, and
// unknown-enum fallbacks. NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.Order
import com.mishran.api.models.OrderItemsInner
import com.mishran.api.models.OrderSlot
import com.mishran.api.models.OrderTotals
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrderMappersTest {

    private val itemsAdapter = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()
        .adapter<List<OrderItemsInner>>(
            Types.newParameterizedType(List::class.java, OrderItemsInner::class.java),
        )

    private fun order(
        status: Order.Status = Order.Status.out_for_delivery,
        slot: OrderSlot? = OrderSlot(date = "2026-08-14", window = "10:00-14:00"),
    ) = Order(
        id = "order-1",
        customerId = "c1",
        items = listOf(
            OrderItemsInner(
                productId = "p1",
                slug = "kaju-katli",
                name = "Kaju Katli",
                quantity = 2,
                unit = "500g",
                priceInPaise = 72000,
                image = null,
            ),
        ),
        totals = OrderTotals(144000, 4900, 0, 0, 148900),
        status = status,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T12:00:00Z",
        slot = slot,
        razorpayOrderId = "rzp_order_1",
    )

    /** Through the entity AND the real Moshi items blob, both directions. */
    private fun roundTrip(source: Order): Order {
        val entity = source.toEntity(itemsAdapter.toJson(source.items))
        return entity.toDomain(itemsAdapter.fromJson(entity.itemsJson) ?: emptyList())
    }

    @Test
    fun `order round-trips through the entity with items and slot`() {
        assertEquals(order(), roundTrip(order()))
    }

    @Test
    fun `slotless order round-trips with a null slot`() {
        assertNull(roundTrip(order(slot = null)).slot)
    }

    @Test
    fun `entity stores enums as value strings and parses the sort epoch`() {
        val entity = order().toEntity("[]")
        assertEquals("out_for_delivery", entity.status)
        assertEquals("paid", entity.paymentStatus)
        assertEquals("mobile-android", entity.source)
        assertEquals(Instant.parse("2026-08-13T10:00:00Z").toEpochMilli(), entity.createdAtEpoch)
    }

    @Test
    fun `unknown enum value strings fall back to the least-wrong state`() {
        val entity = order().toEntity("[]").copy(
            status = "in_a_kitchen_somewhere",
            paymentStatus = "maybe",
            source = "carrier-pigeon",
        )
        val restored = entity.toDomain(emptyList())
        assertEquals(Order.Status.created, restored.status)
        assertEquals(Order.PaymentStatus.pending, restored.paymentStatus)
        assertEquals(Order.Source.mobileMinusAndroid, restored.source)
    }

    @Test
    fun `epochOrZero parses instants and zero-pads garbage`() {
        assertEquals(
            Instant.parse("2026-08-13T10:00:00Z").toEpochMilli(),
            epochOrZero("2026-08-13T10:00:00Z"),
        )
        assertEquals(0L, epochOrZero("yesterday-ish"))
    }

    @Test
    fun `undecodable itemsJson renders as an empty list`() {
        val restored = order().toEntity("not json at all").toDomain(emptyList())
        assertTrue(restored.items.isEmpty())
    }
}
