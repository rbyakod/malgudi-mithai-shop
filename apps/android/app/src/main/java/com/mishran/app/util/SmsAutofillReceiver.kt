// apps/android/app/src/main/java/com/mishran/app/util/SmsAutofillReceiver.kt — Task 8.3.
//
// BroadcastReceiver for the SMS Retriever API. When the system matches the app
// signature hash in an inbound SMS, it broadcasts SMS_RETRIEVED_ACTION carrying
// the full message; we extract the 6-digit OTP and hand it to [onCode]. The
// receiver is registered/unregistered by [SmsAutofillController] for the OTP
// screen's lifetime only (no manifest entry, no SMS permission).
package com.mishran.app.util

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.phone.SmsRetriever

class SmsAutofillReceiver(
    private val onCode: (String) -> Unit,
) : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val message = intent.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE) ?: return
        extractOtpCode(message)?.let(onCode)
    }

    /** Pure extractor (unit-testable) — first isolated 6-digit run in [message]. */
    companion object {
        // Exactly six digits, not bordered by another digit, so a phone number
        // like 18001234567 won't yield a false OTP.
        private val OTP_REGEX = Regex("(?<!\\d)\\d{6}(?!\\d)")

        fun extractOtpCode(message: String): String? = OTP_REGEX.find(message)?.value
    }
}
