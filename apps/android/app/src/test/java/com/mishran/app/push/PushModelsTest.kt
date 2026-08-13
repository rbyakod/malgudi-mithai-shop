// apps/android/app/src/test/java/com/mishran/app/push/PushModelsTest.kt — Task 11.3.
//
// JVM tests for push parsing + copy: data-payload field mapping,
// renderability gating (dedup + deep link both need their keys), and the
// per-stage notification body. NOTE: source-complete (no SDK).
package com.mishran.app.push

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PushModelsTest {

    @Test
    fun `push data parses orderId stage and event_id keys`() {
        val event = parsePushData(
            mapOf(
                "orderId" to "order-1",
                "stage" to "packed",
                "event_id" to "evt-42",
            ),
        )
        assertEquals(OrderPushEvent("order-1", "packed", "evt-42"), event)
    }

    @Test
    fun `missing keys parse to nulls`() {
        val event = parsePushData(emptyMap())
        assertEquals(OrderPushEvent(null, null, null), event)
    }

    @Test
    fun `renderable requires both orderId and event_id`() {
        assertTrue(parsePushData(mapOf("orderId" to "o", "event_id" to "e")).isRenderable)
        assertFalse(parsePushData(mapOf("orderId" to "o")).isRenderable)
        assertFalse(parsePushData(mapOf("event_id" to "e")).isRenderable)
        assertFalse(parsePushData(mapOf("stage" to "packed")).isRenderable)
    }

    @Test
    fun `happy-path stages render a friendly body`() {
        assertEquals(
            "Your order is confirmed",
            notificationBody("confirmed"),
        )
        assertEquals(
            "Your order is out for delivery",
            notificationBody("out_for_delivery"),
        )
    }

    @Test
    fun `sensitive stages carry their reassurance copy`() {
        assertEquals(
            "Payment pending — complete it to confirm your order",
            notificationBody("pending_payment"),
        )
        assertEquals(
            "Payment failed — any deducted amount is refunded in 5-7 days",
            notificationBody("payment_failed"),
        )
        assertEquals(
            "Delivered — we hope you enjoy your sweets",
            notificationBody("delivered"),
        )
    }

    @Test
    fun `unknown or missing stages fall back to a generic body`() {
        assertEquals("Your order has an update", notificationBody("teleported"))
        assertEquals("Your order has an update", notificationBody(null))
    }

    @Test
    fun `title is the brand`() {
        assertEquals("Mishran", notificationTitle())
    }
}
