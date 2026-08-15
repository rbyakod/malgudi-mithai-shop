// apps/android/app/src/main/java/com/mishran/app/util/RazorpayLauncher.kt — Task 10.3.
//
// Thin seam over the Razorpay Checkout SDK. The interface keeps ViewModels
// and the use case free of SDK types (and unit-testable); the real adapter
// opens the sheet and routes the Activity's PaymentResultWithDataListener
// callbacks back to the caller. MainActivity forwards results into the
// singleton — Razorpay only supports the listener-on-activity delivery model.
package com.mishran.app.util

import android.app.Activity
import com.razorpay.Checkout
import com.mishran.app.domain.usecase.PaymentRequest
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/** What the Razorpay sheet reported. */
sealed interface RazorpayOutcome {
    data class Success(
        val razorpayPaymentId: String,
        val signature: String,
    ) : RazorpayOutcome

    data class Failed(val code: Int, val description: String?) : RazorpayOutcome

    /** User closed the sheet — no money moved, nothing to verify. */
    data object Dismissed : RazorpayOutcome
}

/** Options the sheet needs; mirrors the fields of [PaymentRequest]. */
data class RazorpayLaunchOptions(
    val keyId: String,
    val razorpayOrderId: String,
    val amountInPaise: Int,
    val customerName: String? = null,
    val customerContact: String? = null,
)

/** Opens the Razorpay sheet. Implemented by [RazorpaySdkLauncher]. */
fun interface RazorpayLauncher {
    fun launch(activity: Activity, options: RazorpayLaunchOptions, onResult: (RazorpayOutcome) -> Unit)
}

/**
 * Real adapter over `com.razorpay.Checkout`. The pending callback lives in a
 * process-global holder so any instance works: the screen may construct one
 * for launching while MainActivity forwards results into the Hilt singleton —
 * both sides share [Pending].
 */
@Singleton
class RazorpaySdkLauncher @Inject constructor() : RazorpayLauncher {

    override fun launch(
        activity: Activity,
        options: RazorpayLaunchOptions,
        onResult: (RazorpayOutcome) -> Unit,
    ) {
        Pending.callback = onResult
        val checkout = Checkout()
        checkout.setKeyID(options.keyId)
        val payload = JSONObject().apply {
            put("name", "Mishran")
            put("order_id", options.razorpayOrderId)
            put("amount", options.amountInPaise)
            put("currency", "INR")
            options.customerName?.let { put("prefill", JSONObject().put("name", it)) }
            put("theme", JSONObject().put("color", "#9b4d2a")) // kakvi brown
        }
        checkout.open(activity, payload)
    }

    /** Called by MainActivity's with-data listener — routes to the caller. */
    fun onPaymentResultSuccess(razorpayPaymentId: String) {
        val signature = PaymentResultSignatureHolder.pop()
        dispatch(RazorpayOutcome.Success(razorpayPaymentId, signature))
    }

    /** Called by MainActivity's with-data listener on error/cancel. */
    fun onPaymentResultError(code: Int, response: String?) {
        // Code 0 = user dismissed the sheet.
        val outcome = if (code == DISMISSED_CODE) RazorpayOutcome.Dismissed
        else RazorpayOutcome.Failed(code, response)
        dispatch(outcome)
    }

    private fun dispatch(outcome: RazorpayOutcome) {
        Pending.callback?.invoke(outcome)
        Pending.callback = null
    }

    private companion object {
        const val DISMISSED_CODE = 0
    }
}

/**
 * One pending callback — only one sheet can be open at a time. Internal (not
 * file-private) so the JVM tests can seed it and assert what dispatch
 * delivers; production only writes it from [RazorpaySdkLauncher.launch].
 */
internal object Pending {
    @Volatile
    var callback: ((RazorpayOutcome) -> Unit)? = null
}

/**
 * Razorpay's plain success callback carries only the payment id; the HMAC
 * signature the server verifies against arrives solely in the with-data
 * variant, on the [com.razorpay.PaymentData] handed to
 * [com.razorpay.PaymentResultWithDataListener.onPaymentSuccess]. MainActivity
 * parks it here before forwarding, and [RazorpaySdkLauncher] pops it while
 * building the Success outcome.
 */
object PaymentResultSignatureHolder {
    @Volatile
    private var signature: String? = null

    fun park(value: String?) {
        signature = value
    }

    fun pop(): String = signature.orEmpty().also { signature = null }
}
