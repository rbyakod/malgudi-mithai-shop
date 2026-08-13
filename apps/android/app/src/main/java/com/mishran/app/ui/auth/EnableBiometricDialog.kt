// apps/android/app/src/main/java/com/mishran/app/ui/auth/EnableBiometricDialog.kt — Task 8.2.
//
// Post-sign-in enrollment offer. The moment a fresh sign-in completes we hold a
// valid refresh token; if a STRONG biometric sensor is available and the user
// hasn't already opted in, we offer to copy that token into the Keystore-encrypted
// store so the next cold start can unlock with biometrics instead of an OTP.
//
// [BiometricEnrollmentViewModel] holds the (Context-free, testable) decision +
// action; the dialog is pure presentation. Reused later by the Account screen's
// biometric toggle without modification. shouldOffer() is suspend because it
// reads SecureTokenStore — callers (a LaunchedEffect coroutine) await it.
package com.mishran.app.ui.auth

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.util.BiometricStatus
import com.mishran.app.util.BiometricStatusProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BiometricEnrollmentViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val biometricStatusProvider: BiometricStatusProvider,
) : ViewModel() {

    /** Offer enrollment only when a STRONG sensor is present and not already enabled. */
    suspend fun shouldOffer(): Boolean =
        biometricStatusProvider.status() == BiometricStatus.Available &&
            !authRepository.isBiometricLoginEnabled()

    /**
     * Copy the current refresh token into the biometric-gated store. [onComplete]
     * runs inside the same coroutine *after* the write lands, so callers that
     * navigate away on completion (e.g. the OTP handoff) do so only once the
     * token is persisted — popping the nav entry cannot cancel a half-written
     * token. Default no-op suits the Account-screen toggle (no navigation).
     */
    fun enable(onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            authRepository.enableBiometricLogin()
            onComplete()
        }
    }
}

@Composable
fun EnableBiometricDialog(
    onEnable: () -> Unit,
    onSkip: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onSkip,
        title = { Text("Enable biometric login?") },
        text = {
            Text("Next time, open Mishran with your fingerprint or face instead of a code.")
        },
        confirmButton = {
            TextButton(onClick = onEnable) { Text("Enable") }
        },
        dismissButton = {
            TextButton(onClick = onSkip) { Text("Skip") }
        },
    )
}
