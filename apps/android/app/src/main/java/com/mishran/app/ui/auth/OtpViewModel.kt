// apps/android/app/src/main/java/com/mishran/app/ui/auth/OtpViewModel.kt — Task 8.1.
//
// Drives the OTP-verify screen. The requestId produced by the phone step
// travels through the NavGraph arg (auth/otp/{requestId}); Hilt injects it via
// [SavedStateHandle]. On success the verified customer + tokens are persisted by
// [AuthRepository], and the screen reacts to [uiState] (navigate to Home).
package com.mishran.app.ui.auth

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.OtpVerifyResponse
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
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

    /** The OTP requestId injected from the nav route. */
    val requestId: String = savedStateHandle["requestId"] ?: ""

    /** Two-way bound 6-digit code input. */
    val code = MutableStateFlow("")

    private val _uiState = MutableStateFlow<UiState<OtpVerifyResponse>>(UiState.Idle)
    val uiState: StateFlow<UiState<OtpVerifyResponse>> = _uiState.asStateFlow()

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

    fun consumeState() {
        _uiState.value = UiState.Idle
    }

    private fun messageFor(e: HttpException): String = when (e.code()) {
        400 -> "That code isn't right. Please try again."
        410 -> "This code has expired. Request a new one."
        else -> "Something went wrong (${e.code()}). Please try again."
    }

    private companion object {
        // Mirrors the OtpVerifyRequest pattern in packages/api-contract/openapi.yaml.
        val CODE_REGEX = Regex("^[0-9]{6}$")
    }
}
