// apps/android/app/src/main/java/com/mishran/app/util/SmsAutofillController.kt — Task 8.3.
//
// Lifecycle-aware facade over the SMS Retriever API. start() opens a ~5-minute
// listen window via SmsRetriever.getClient and registers the broadcast receiver;
// stop() unregisters it. Encapsulates the API-33+ RECEIVER_NOT_EXPORTED flag so
// the OTP screen only deals with start/stop. Idempotent: stop without start, or
// double-stop, is safe (the receiver reference is cleared).
package com.mishran.app.util

import android.content.Context
import android.content.IntentFilter
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.phone.SmsRetriever

class SmsAutofillController {

    private var receiver: SmsAutofillReceiver? = null

    /** Begin listening; [onCode] fires with the captured 6-digit OTP, if any. */
    fun start(context: Context, onCode: (String) -> Unit) {
        // Guard against a double-start leaking a prior receiver.
        stop(context)
        receiver = SmsAutofillReceiver(onCode).also { receiver ->
            val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
            // API 33+ requires an explicit exported flag for non-system broadcasts.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.registerReceiver(
                    context,
                    receiver,
                    filter,
                    ContextCompat.RECEIVER_NOT_EXPORTED,
                )
            } else {
                context.registerReceiver(receiver, filter)
            }
        }
        SmsRetriever.getClient(context).startSmsRetriever()
    }

    fun stop(context: Context) {
        receiver?.let { runCatching { context.unregisterReceiver(it) } }
        receiver = null
    }
}
