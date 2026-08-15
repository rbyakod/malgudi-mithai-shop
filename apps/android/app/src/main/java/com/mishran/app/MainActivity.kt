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

import android.content.Context
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatDelegate
import androidx.appcompat.app.AppCompatActivity
import androidx.core.os.LocaleListCompat
import com.mishran.app.data.repository.SettingsRepositoryEntryPoint
import com.mishran.app.navigation.MishranAppRoot
import com.mishran.app.ui.theme.MishranTheme
import com.mishran.app.util.PaymentResultSignatureHolder
import com.mishran.app.util.RazorpaySdkLauncher
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import dagger.hilt.android.AndroidEntryPoint
import dagger.hilt.android.EntryPointAccessors
import javax.inject.Inject
import kotlinx.coroutines.runBlocking

// AppCompatActivity (which extends FragmentActivity) for two reasons:
// androidx.biometric's BiometricPrompt mounts an internal fragment and needs a
// FragmentActivity host, and the AppCompat per-app locale backport
// (AppCompatDelegate.setApplicationLocales) only engages under AppCompatActivity
// on API < 33. ComponentActivity's enableEdgeToEdge() + setContent() keep working.
@AndroidEntryPoint
class MainActivity : AppCompatActivity(), PaymentResultWithDataListener {

    @Inject lateinit var razorpayLauncher: RazorpaySdkLauncher

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(newBase)
        // Restore the persisted locale before onCreate so the first frame
        // already renders in the chosen language (no recreate flicker). Hilt
        // field injection hasn't run this early, so the repository comes via
        // the entry point. runBlocking is the accepted trade here: one tiny
        // DataStore read that must complete before any UI inflates.
        val tag = runBlocking {
            EntryPointAccessors.fromApplication<SettingsRepositoryEntryPoint>(applicationContext)
                .settingsRepository()
                .localeTag()
        }
        if (!tag.isNullOrEmpty() &&
            AppCompatDelegate.getApplicationLocales() != LocaleListCompat.forLanguageTags(tag)
        ) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
        }
    }

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
