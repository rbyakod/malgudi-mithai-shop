// apps/android/app/src/test/java/com/mishran/app/util/SmsAutofillReceiverTest.kt — Task 8.3.
//
// JVM unit tests for the OTP extractor (the BroadcastReceiver dispatch is
// Android-only). NOTE: source-complete (no SDK).
package com.mishran.app.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SmsAutofillReceiverTest {

    @Test
    fun `extracts code from a templated MSG91 message`() {
        val msg = "<#> Your Mishran code is 123456. Do not share it.\nQST5Kx9aBcD"
        assertEquals("123456", SmsAutofillReceiver.extractOtpCode(msg))
    }

    @Test
    fun `extracts leading code`() {
        assertEquals("654321", SmsAutofillReceiver.extractOtpCode("654321 is your Mishran code"))
    }

    @Test
    fun `returns null when no six-digit run exists`() {
        assertNull(SmsAutofillReceiver.extractOtpCode("Your order is confirmed. Thanks!"))
    }

    @Test
    fun `does not match a 6-digit slice of a longer number`() {
        // A pure 11-digit run has no isolated 6-digit substring → no false OTP.
        assertNull(SmsAutofillReceiver.extractOtpCode("Track at 18001234567 anytime"))
    }

    @Test
    fun `prefers the isolated code over a longer number`() {
        val msg = "Order 12345678 ready. Code 482910"
        assertEquals("482910", SmsAutofillReceiver.extractOtpCode(msg))
    }
}
