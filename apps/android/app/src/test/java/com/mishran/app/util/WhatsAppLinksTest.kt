// apps/android/app/src/test/java/com/mishran/app/util/WhatsAppLinksTest.kt — parity batch.
//
// JVM unit tests for the wa.me link builder behind the Account support row,
// the PDP "Ask on WhatsApp" row, and the cart "Send order" button. The
// builder is framework-free by design — these tests pin the URL shape and
// the encoding. NOTE: source-complete (no SDK).
package com.mishran.app.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WhatsAppLinksTest {

    @Test
    fun `a message rides along URL-encoded`() {
        val url = buildWhatsAppUrl("919876543210", "Hi Mishran! I'd like to order: 2 boxes")
        assertEquals("https://wa.me/919876543210?text=Hi+Mishran%21+I%27d+like+to+order%3A+2+boxes", url)
    }

    @Test
    fun `digits are trimmed before the link is built`() {
        assertEquals(
            "https://wa.me/919876543210?text=Hi",
            buildWhatsAppUrl(" 919876543210 ", "Hi"),
        )
    }

    @Test
    fun `blank text drops the query entirely so the chat still opens`() {
        assertEquals("https://wa.me/919876543210", buildWhatsAppUrl("919876543210", "   "))
    }

    @Test
    fun `multi-line messages keep their line breaks through the encoding`() {
        val url = buildWhatsAppUrl("919876543210", "line one\nline two")
        assertTrue(url.contains("%0A"))
        assertFalse(url.contains("\n"))
    }
}
