// apps/android/app/src/main/java/com/mishran/app/ui/auth/PhoneEntryViewModel.kt — Task 8.1.
//
// Drives the phone-entry screen: country picker + national number compose an
// E.164 value, which is validated and sent to [AuthRepository.sendOtp]. The
// result is exposed as [uiState] for the screen to react to (success →
// navigate to OTP, error → show message).
package com.mishran.app.ui.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.OtpSendResponse
import com.mishran.app.R
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

@HiltViewModel
class PhoneEntryViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val authRepository: AuthRepository,
) : ViewModel() {

    /** Selected country for the dial-code chip. India (+91) by default. */
    val selectedCountry = MutableStateFlow(Countries.defaultCountry)

    /** National number — local digits only, no dial code, no formatting. */
    val nationalNumber = MutableStateFlow("")

    /** E.164 value sent to the server (e.g. +919876543210). */
    val e164: String get() = selectedCountry.value.dialPrefixed + nationalNumber.value

    private val _uiState = MutableStateFlow<UiState<OtpSendResponse>>(UiState.Idle)
    val uiState: StateFlow<UiState<OtpSendResponse>> = _uiState.asStateFlow()

    fun isValidPhone(): Boolean = PHONE_REGEX.matches(e164)

    fun onSelectCountry(country: CountryCode) {
        selectedCountry.value = country
    }

    /**
     * National-number input. ASCII digits only, capped at 15 (E.164 total is
     * 15 including the dial code; 15 here just guards absurd paste). A pasted
     * full E.164 number ("+919876543210") decomposes via longest dial-prefix
     * match into a country selection + remainder, so pasting from contacts
     * still lands on the right E.164 instead of double-prefixing.
     */
    fun onNationalNumberChange(raw: String) {
        val trimmed = raw.trim()
        if (trimmed.startsWith("+")) {
            val digits = asciiDigits(trimmed)
            val match = Countries.longestDialPrefix(digits)
            if (match != null) {
                selectedCountry.value = match.first
                nationalNumber.value = match.second.take(MAX_DIGITS)
            } else {
                nationalNumber.value = digits.take(MAX_DIGITS)
            }
            return
        }
        nationalNumber.value = asciiDigits(trimmed).take(MAX_DIGITS)
    }

    fun sendOtp() {
        if (!isValidPhone()) {
            _uiState.value =
                UiState.Error(appContext.getString(R.string.auth_phone_error_invalid))
            return
        }
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            _uiState.value = try {
                UiState.Success(authRepository.sendOtp(e164))
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

    private fun asciiDigits(s: String): String = s.filter { it in '0'..'9' }

    private companion object {
        // Mirrors the OtpSendRequest pattern in packages/api-contract/openapi.yaml.
        val PHONE_REGEX = Regex("^\\+[1-9]\\d{6,14}\$")

        // E.164 caps the FULL number at 15 digits; national part stays under
        // that even for the longest dial codes.
        const val MAX_DIGITS = 15
    }
}
