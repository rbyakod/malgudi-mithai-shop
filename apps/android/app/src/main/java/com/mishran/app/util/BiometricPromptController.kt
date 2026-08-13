// apps/android/app/src/main/java/com/mishran/app/util/BiometricPromptController.kt — Task 8.2.
//
// Bridges the callback-based androidx BiometricPrompt to coroutines so a
// Composable can `await` a biometric challenge. The prompt needs a
// FragmentActivity host (see MainActivity) + a main-thread Executor.
//
// Lifecycle nuances handled here:
//   - onAuthenticationFailed (a wrong finger) does NOT resume — the system
//     keeps the prompt open for the user to retry, so we stay suspended.
//   - onAuthenticationError covers Cancel / lockout / no space and resumes with
//     Error; the UI treats any non-Success terminal state as "did not unlock".
package com.mishran.app.util

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

sealed interface BiometricResult {
    data object Success : BiometricResult
    data class Error(val code: Int, val message: String) : BiometricResult
}

class BiometricPromptController(private val activity: FragmentActivity) {

    private val executor = ContextCompat.getMainExecutor(activity)

    /** Show a biometric prompt; suspends until the user succeeds, cancels, or is locked out. */
    suspend fun authenticate(title: String, subtitle: String, description: String? = null): BiometricResult =
        suspendCancellableCoroutine { cont ->
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (cont.isActive) cont.resume(BiometricResult.Success)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (cont.isActive) {
                        cont.resume(BiometricResult.Error(errorCode, errString.toString()))
                    }
                }

                // Per-attempt failure (wrong finger): leave the prompt open so the
                // user can retry. Do NOT resume the coroutine here.
            }

            val prompt = BiometricPrompt(activity, executor, callback)
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .apply {
                    if (description != null) setDescription(description)
                    // No CryptoObject is bound, so we must supply a negative button
                    // (Cancel) rather than setConfirmationRequired(false) + crypto.
                    setNegativeButtonText("Cancel")
                }
                .build()

            prompt.authenticate(info)
            cont.invokeOnCancellation { prompt.cancelAuthentication() }
        }
}
