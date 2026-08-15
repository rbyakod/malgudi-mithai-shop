// apps/android/app/src/test/java/com/mishran/app/util/RazorpayLauncherTest.kt — Task 10.3.
//
// JVM tests for the signature plumbing: MainActivity parks the HMAC from the
// PaymentResultWithDataListener's PaymentData, and onPaymentResultSuccess
// must pop exactly that value into the Success outcome — the server's verify
// rejects an empty signature. Also covers the holder's park/pop semantics
// and the error-code collapse (0 = Dismissed). NOTE: source-complete (no
// SDK) — onPaymentResultSuccess/onPaymentResultError never touch Checkout,
// so they run on a plain JVM.
package com.mishran.app.util

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RazorpayLauncherTest {

    private val launcher = RazorpaySdkLauncher()

    @After
    fun tearDown() {
        // Never let one test's parked signature / callback leak into the next.
        PaymentResultSignatureHolder.park(null)
        Pending.callback = null
    }

    @Test
    fun `pop returns the parked signature once and drains the holder`() {
        PaymentResultSignatureHolder.park("sig_1")
        assertEquals("sig_1", PaymentResultSignatureHolder.pop())
        assertEquals("", PaymentResultSignatureHolder.pop())
    }

    @Test
    fun `pop with nothing parked yields an empty signature`() {
        assertEquals("", PaymentResultSignatureHolder.pop())
    }

    @Test
    fun `onPaymentResultSuccess delivers the parked signature end to end`() {
        val outcomes = mutableListOf<RazorpayOutcome>()
        Pending.callback = { outcomes.add(it) }
        PaymentResultSignatureHolder.park("sig_1")

        launcher.onPaymentResultSuccess("pay_1")

        assertEquals(listOf(RazorpayOutcome.Success("pay_1", "sig_1")), outcomes)
        // The dispatch is single-shot: callback cleared, signature consumed.
        assertNull(Pending.callback)
        assertEquals("", PaymentResultSignatureHolder.pop())
    }

    @Test
    fun `success without a parked signature degrades to empty, not null`() {
        val outcomes = mutableListOf<RazorpayOutcome>()
        Pending.callback = { outcomes.add(it) }

        launcher.onPaymentResultSuccess("pay_2")

        assertEquals(listOf(RazorpayOutcome.Success("pay_2", "")), outcomes)
    }

    @Test
    fun `error code zero collapses to Dismissed`() {
        val outcomes = mutableListOf<RazorpayOutcome>()
        Pending.callback = { outcomes.add(it) }

        launcher.onPaymentResultError(0, null)

        assertEquals(listOf(RazorpayOutcome.Dismissed), outcomes)
    }

    @Test
    fun `non-zero error codes surface as Failed with the description`() {
        val outcomes = mutableListOf<RazorpayOutcome>()
        Pending.callback = { outcomes.add(it) }

        launcher.onPaymentResultError(2, "bank declined")

        assertEquals(listOf(RazorpayOutcome.Failed(2, "bank declined")), outcomes)
        assertNull(Pending.callback)
    }
}
