// apps/android/app/src/test/java/com/mishran/app/ui/orderconfirmed/OrderConfirmedTest.kt — Task 10.4.
//
// JVM tests for the confirmation screen's pure helpers: the order-reference
// label and the delivery-ETA line. NOTE: source-complete (no SDK).
package com.mishran.app.ui.orderconfirmed

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OrderConfirmedTest {

    @Test
    fun `order reference prefixes a hash`() {
        assertEquals("#ord_123456", orderReferenceLabel("ord_123456"))
    }

    @Test
    fun `long ids are tail-ellipsized keeping the distinctive end`() {
        val label = orderReferenceLabel("00000000-0000-0000-0000-000000ab12cd")
        assertEquals("#00000000…ab12cd", label)
    }

    @Test
    fun `blank ids fall back to a plain reference`() {
        assertEquals("#—", orderReferenceLabel("   "))
    }

    @Test
    fun `eta line renders a picked slot and is null without one`() {
        assertEquals(
            "Arriving Thu 14 Aug, 10:00–14:00",
            etaLine("Thu 14 Aug, 10:00–14:00"),
        )
        assertNull(etaLine(null))
    }

    @Test
    fun `fallback eta reflects the shelf SLA`() {
        assertEquals("Arriving in 3–4 days", shelfEtaLine(3))
        assertEquals("Arriving in 1–2 days", shelfEtaLine(1))
    }
}
