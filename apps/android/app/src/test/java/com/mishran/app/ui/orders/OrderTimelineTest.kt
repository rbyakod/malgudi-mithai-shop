// apps/android/app/src/test/java/com/mishran/app/ui/orders/OrderTimelineTest.kt — Task 11.1.
//
// JVM tests for the pure rendering helpers: stage indexing, labels, tones,
// date formatting, item summary, slot line, and side-state copy.
// NOTE: source-complete (no SDK).
package com.mishran.app.ui.orders

import com.mishran.api.models.Order
import com.mishran.api.models.OrderItemsInner
import com.mishran.api.models.OrderSlot
import com.mishran.api.models.OrderTotals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrderTimelineTest {

    private fun order(
        status: Order.Status,
        items: List<OrderItemsInner> = emptyList(),
        slot: OrderSlot? = null,
    ) = Order(
        id = "o1",
        customerId = "c1",
        items = items,
        totals = OrderTotals(0, 0, 0, 0, 0),
        status = status,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T10:05:00Z",
        slot = slot,
    )

    private fun item(name: String) = OrderItemsInner(
        productId = "p",
        slug = "slug",
        name = name,
        quantity = 1,
        unit = "500g",
        priceInPaise = 100,
    )

    @Test
    fun `timeline stages run confirmed through delivered in order`() {
        assertEquals(
            listOf(
                Order.Status.confirmed,
                Order.Status.packed,
                Order.Status.dispatched,
                Order.Status.out_for_delivery,
                Order.Status.delivered,
            ),
            TIMELINE_STAGES,
        )
    }

    @Test
    fun `stage index resolves for happy-path statuses and null otherwise`() {
        assertEquals(0, stageIndexFor(Order.Status.confirmed))
        assertEquals(4, stageIndexFor(Order.Status.delivered))
        assertNull(stageIndexFor(Order.Status.pending_payment))
        assertNull(stageIndexFor(Order.Status.created))
        assertNull(stageIndexFor(Order.Status.cancelled))
        assertNull(stageIndexFor(Order.Status.payment_failed))
    }

    @Test
    fun `status tones split positive negative and progress`() {
        assertEquals(StatusTone.POSITIVE, statusTone(Order.Status.delivered))
        assertEquals(StatusTone.NEGATIVE, statusTone(Order.Status.cancelled))
        assertEquals(StatusTone.NEGATIVE, statusTone(Order.Status.payment_failed))
        assertEquals(StatusTone.PROGRESS, statusTone(Order.Status.confirmed))
        assertEquals(StatusTone.PROGRESS, statusTone(Order.Status.out_for_delivery))
    }

    @Test
    fun `every status has a label`() {
        Order.Status.values().forEach { status ->
            assertTrue(statusLabel(status).isNotBlank())
        }
    }

    @Test
    fun `formatOrderDate renders a friendly local date or falls back raw`() {
        val formatted = formatOrderDate("2026-08-13T10:00:00Z")
        assertTrue(Regex("^\\d{1,2} Aug, \\d{1,2}:\\d{2} (AM|PM)$").matches(formatted))
        assertEquals("not-a-date", formatOrderDate("not-a-date"))
    }

    @Test
    fun `item summary names the first item and counts the overflow`() {
        assertEquals("No items", itemSummary(order(Order.Status.confirmed)))
        assertEquals("Kaju Katli", itemSummary(order(Order.Status.confirmed, listOf(item("Kaju Katli")))))
        assertEquals(
            "Kaju Katli +2 more",
            itemSummary(order(Order.Status.confirmed, listOf(item("Kaju Katli"), item("Ladoo"), item("Barfi")))),
        )
    }

    @Test
    fun `slot line joins date and window, empty when absent`() {
        assertEquals(
            "2026-08-14, 10:00-14:00",
            slotLine(order(Order.Status.confirmed, slot = OrderSlot("2026-08-14", "10:00-14:00"))),
        )
        assertEquals("", slotLine(order(Order.Status.confirmed)))
    }

    @Test
    fun `side states carry reassurance copy`() {
        Order.Status.values().forEach { status ->
            assertNotNull(supportLine(status))
            assertTrue(supportLine(status).isNotBlank())
        }
        assertTrue(supportLine(Order.Status.payment_failed).contains("refunded"))
    }
}
