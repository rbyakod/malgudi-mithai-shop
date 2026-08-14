// apps/android/app/src/test/java/com/mishran/app/widget/WidgetOrderStateTest.kt — Task 11.2.
//
// JVM tests for the widget's pure state mapping: which order gets tracked
// (newest in-flight), and the stage/ETA lines rendered per status. Glance
// composition itself is device-gated (layoutlib) — these cover the logic.
// NOTE: source-complete (no SDK).
package com.mishran.app.widget

import com.mishran.api.models.Order
import com.mishran.api.models.OrderSlot
import com.mishran.api.models.OrderTotals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetOrderStateTest {

    private fun order(
        id: String = "o1",
        status: Order.Status,
        slot: OrderSlot? = null,
    ) = Order(
        id = id,
        customerId = "c1",
        items = emptyList(),
        totals = OrderTotals(0, 0, 0, 0, 0),
        status = status,
        paymentStatus = Order.PaymentStatus.paid,
        deliveryAddressId = "addr-1",
        source = Order.Source.mobileMinusAndroid,
        createdAt = "2026-08-13T10:00:00Z",
        updatedAt = "2026-08-13T10:05:00Z",
        slot = slot,
    )

    @Test
    fun `every trackable stage renders a stage line with progress`() {
        // created/pending_payment render without progress; the five happy-path
        // stages carry the "n/5" counter.
        val expected = mapOf(
            Order.Status.created to "Just placed",
            Order.Status.pending_payment to "Payment pending",
            Order.Status.confirmed to "Confirmed · 1/5",
            Order.Status.packed to "Packed · 2/5",
            Order.Status.dispatched to "Dispatched · 3/5",
            Order.Status.out_for_delivery to "Out for delivery · 4/5",
        )
        expected.forEach { (status, stageLine) ->
            assertEquals(stageLine, widgetLines(order(status = status)).stage)
        }
    }

    @Test
    fun `slot renders an ETA line, slotless happy-path teases timing`() {
        assertEquals(
            "Arriving 2026-08-14 10:00-14:00",
            widgetLines(
                order(
                    status = Order.Status.confirmed,
                    slot = OrderSlot(date = "2026-08-14", window = "10:00-14:00"),
                ),
            ).eta,
        )
        assertEquals(
            "We'll share timing as it moves",
            widgetLines(order(status = Order.Status.packed)).eta,
        )
    }

    @Test
    fun `pending payment nudges the user to pay`() {
        assertEquals(
            "Complete the payment to confirm",
            widgetLines(order(status = Order.Status.pending_payment)).eta,
        )
    }

    @Test
    fun `title is constant across stages`() {
        TRACKABLE_STATUSES.forEach { status ->
            assertEquals("Mishran order", widgetLines(order(status = status)).title)
        }
    }

    @Test
    fun `latest trackable order wins and skips terminal ones`() {
        val orders = listOf(
            order(id = "newest-delivered", status = Order.Status.delivered),
            order(id = "tracked", status = Order.Status.packed),
            order(id = "older-cancelled", status = Order.Status.cancelled),
        )
        assertEquals("tracked", latestTrackableOrder(orders)?.id)
    }

    @Test
    fun `nothing trackable yields null for the empty state`() {
        assertNull(
            latestTrackableOrder(
                listOf(
                    order(status = Order.Status.delivered),
                    order(status = Order.Status.cancelled),
                    order(status = Order.Status.returned),
                ),
            ),
        )
        assertNull(latestTrackableOrder(emptyList()))
    }
}
