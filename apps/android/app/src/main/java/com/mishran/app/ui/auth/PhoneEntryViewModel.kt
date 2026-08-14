// apps/android/app/src/main/java/com/mishran/app/ui/auth/PhoneEntryViewModel.kt — Task 8.1.
//
// Drives the phone-entry screen: validates an E.164 number, calls
// [AuthRepository.sendOtp], and exposes the one-shot result as [uiState] for
// the screen to react to (success → navigate to OTP, error → show message).
package com.mishran.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.OtpSendResponse
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
class PhoneEntryViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    /** Two-way bound phone input. E.164 expected (e.g. +919876543210). */
    val phone = MutableStateFlow("")

    private val _uiState = MutableStateFlow<UiState<OtpSendResponse>>(UiState.Idle)
    val uiState: StateFlow<UiState<OtpSendResponse>> = _uiState.asStateFlow()

    fun isValidPhone(): Boolean = PHONE_REGEX.matches(phone.value.trim())

    fun sendOtp() {
        if (!isValidPhone()) {
            _uiState.value = UiState.Error("Enter a valid phone number with country code.")
            return
        }
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            _uiState.value = try {
                UiState.Success(authRepository.sendOtp(phone.value.trim()))
            } catch (e: HttpException) {
                UiState.Error(messageFor(e))
            } catch (e: Exception) {
                UiState.Error("Couldn't reach Mishran. Check your connection and try again.")
            }
        }
    }

    /** Reset back to Idle so a configuration change doesn't replay a stale result. */
    fun consumeState() {
        _uiState.value = UiState.Idle
    }

    private fun messageFor(e: HttpException): String = when (e.code()) {
        429 -> "Too many attempts. Please wait a moment and try again."
        503 -> "Our SMS provider is down. Please try again shortly."
        else -> "Something went wrong (${e.code()}). Please try again."
    }

    private companion object {
        // Mirrors the OtpSendRequest pattern in packages/api-contract/openapi.yaml.
        val PHONE_REGEX = Regex("^\\+[1-9]\\d{6,14}\$")
    }
}
