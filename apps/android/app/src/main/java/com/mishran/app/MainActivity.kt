// apps/android/app/src/main/java/com/mishran/app/MainActivity.kt — Task 7.1 / 7.4 / 10.3.
//
// Single-activity host. @AndroidEntryPoint enables Hilt field injection; the
// Compose NavGraph (Task 7.4) lives in MishranAppRoot, wrapped in the brand
// MishranTheme (Task 7.2). Deep links (mishran://order/{id}) are declared in
// the AndroidManifest intent-filter and resolved inside the NavHost.
//
// Task 10.3: the activity is also Razorpay's PaymentResultWithDataListener —
// the SDK only delivers results to the launching activity, so it forwards them
// into the injected RazorpaySdkLauncher singleton (which routes to the caller
// that opened the sheet). The with-data variant (not the plain
// PaymentResultListener) because only PaymentData carries the HMAC signature
// the server needs to verify the payment; the SDK checks for the plain
// listener FIRST, so implementing both would mean the with-data callbacks
// never fire.
package com.mishran.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import com.mishran.app.navigation.MishranAppRoot
import com.mishran.app.ui.theme.MishranTheme
import com.mishran.app.util.PaymentResultSignatureHolder
import com.mishran.app.util.RazorpaySdkLauncher
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

// FragmentActivity (not plain ComponentActivity) because androidx.biometric's
// BiometricPrompt mounts an internal fragment and requires a FragmentActivity
// host. FragmentActivity still extends ComponentActivity, so enableEdgeToEdge()
// + setContent() compose-hosting both keep working.
@AndroidEntryPoint
class MainActivity : FragmentActivity(), PaymentResultWithDataListener {

    @Inject lateinit var razorpayLauncher: RazorpaySdkLauncher

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MishranTheme {
                MishranAppRoot()
            }
        }
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?, paymentData: PaymentData) {
        // Park the signature BEFORE handing off: the launcher pops it while
        // building the Success outcome, so it must already be in the holder.
        PaymentResultSignatureHolder.park(paymentData.signature)
        if (razorpayPaymentId != null) razorpayLauncher.onPaymentResultSuccess(razorpayPaymentId)
    }

    override fun onPaymentError(code: Int, response: String?, paymentData: PaymentData?) {
        razorpayLauncher.onPaymentResultError(code, response)
    }
}
