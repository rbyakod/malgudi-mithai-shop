// apps/android/app/src/main/java/com/mishran/app/ui/auth/OtpViewModel.kt — Task 8.1.
//
// Drives the OTP-verify screen. The requestId produced by the phone step
// travels through the NavGraph arg (auth/otp/{requestId}?phone={phone});
// Hilt injects both via [SavedStateHandle]. Resend re-sends to the same
// phone IN PLACE (no pop to phone entry) and writes the fresh requestId
// back into the handle, so verify() always reads the latest id — including
// after process death. On success the verified customer + tokens are
// persisted by [AuthRepository], and the screen reacts to [uiState]
// (navigate to Home).
package com.mishran.app.ui.auth

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.OtpSendResponse
import com.mishran.api.models.OtpVerifyResponse
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

@HiltViewModel
class OtpViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val authRepository: AuthRepository,
) : ViewModel() {

    /** The OTP requestId injected from the nav route (updated in place on resend). */
    val requestId: String get() = savedStateHandle["requestId"] ?: ""

    /** The E.164 phone injected from the nav route — resend target. */
    val phone: String get() = savedStateHandle["phone"] ?: ""

    /** Two-way bound 6-digit code input. */
    val code = MutableStateFlow("")

    /** Seconds until resend re-enables (0 = can resend now). */
    val resendCountdown = MutableStateFlow(0)

    /** Resend-only failure message (rate limits, network) — separate from the verify uiState. */
    private val _resendError = MutableStateFlow<String?>(null)
    val resendError: StateFlow<String?> = _resendError.asStateFlow()

    private val _uiState = MutableStateFlow<UiState<OtpVerifyResponse>>(UiState.Idle)
    val uiState: StateFlow<UiState<OtpVerifyResponse>> = _uiState.asStateFlow()

    private var countdownJob: Job? = null

    init {
        // The initial send just happened on the phone screen — start the
        // cooldown from arrival (within a second of the actual send).
        startResendCountdown()
    }

    fun verify() {
        val digits = code.value.trim()
        if (!CODE_REGEX.matches(digits)) {
            _uiState.value = UiState.Error("Enter the 6-digit code.")
            return
        }
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            _uiState.value = try {
                UiState.Success(authRepository.verifyOtp(requestId, digits))
            } catch (e: HttpException) {
                UiState.Error(messageFor(e))
            } catch (e: Exception) {
                UiState.Error("Couldn't reach Mishran. Check your connection and try again.")
            }
        }
    }

    /**
     * In-place resend: re-send to the same phone, swap in the fresh
     * requestId, clear stale digits, restart the cooldown. Server rate
     * limits (5/hour, 10/day) surface through [resendError].
     */
    fun resend() {
        if (resendCountdown.value > 0 || phone.isBlank()) return
        viewModelScope.launch {
            try {
                val response: OtpSendResponse = authRepository.sendOtp(phone)
                savedStateHandle["requestId"] = response.requestId
                code.value = ""
                _resendError.value = null
                startResendCountdown()
            } catch (e: HttpException) {
                _resendError.value = resendMessageFor(e)
            } catch (e: Exception) {
                _resendError.value = "Couldn't reach Mishran. Check your connection and try again."
            }
        }
    }

    fun consumeState() {
        _uiState.value = UiState.Idle
    }

    private fun startResendCountdown() {
        countdownJob?.cancel()
        resendCountdown.value = RESEND_COOLDOWN_SECONDS
        countdownJob = viewModelScope.launch {
            while (resendCountdown.value > 0) {
                delay(1_000)
                resendCountdown.value -= 1
            }
        }
    }

    private fun messageFor(e: HttpException): String = when (e.code()) {
        400 -> "That code isn't right. Please try again."
        410 -> "This code has expired. Request a new one."
        else -> "Something went wrong (${e.code()}). Please try again."
    }

    private fun resendMessageFor(e: HttpException): String = when (e.code()) {
        429 -> "Too many attempts. Please wait a moment and try again."
        503 -> "Our SMS provider is down. Please try again shortly."
        else -> "Something went wrong (${e.code()}). Please try again."
    }

    private companion object {
        // Mirrors the OtpVerifyRequest pattern in packages/api-contract/openapi.yaml.
        val CODE_REGEX = Regex("^[0-9]{6}$")

        // Matches the web flow's 30 s resend countdown.
        const val RESEND_COOLDOWN_SECONDS = 30
    }
}
