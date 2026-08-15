// apps/android/app/src/main/java/com/mishran/app/ui/account/AccountViewModel.kt — P1 parity.
//
// Account-tab state: the signed-in phone off DataStore, a sign-out that
// revokes the refresh token server-side then clears the local session, and
// (P1 parity) the brand WhatsApp contact off GET /brand — placeholder digits
// until the fetch succeeds, so the support row is always actionable.
package com.mishran.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.PLACEHOLDER_WHATSAPP_DIGITS
import com.mishran.app.data.repository.PLACEHOLDER_WHATSAPP_NUMBER
import com.mishran.app.data.repository.SupportContact
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    brandRepository: BrandRepository,
) : ViewModel() {

    /** E.164 phone of the signed-in customer; null for pre-phone-key sessions. */
    val phone: StateFlow<String?> = authRepository.sessionPhone()
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            null,
        )

    /**
     * WhatsApp contact for the support row: the brand number once /brand (or
     * its DataStore cache) answers, the placeholder until then — a failed
     * fetch never blanks the row.
     */
    private val _support = MutableStateFlow(
        SupportContact(
            whatsappNumber = PLACEHOLDER_WHATSAPP_NUMBER,
            whatsappDigits = PLACEHOLDER_WHATSAPP_DIGITS,
        ),
    )
    val support: StateFlow<SupportContact> = _support.asStateFlow()

    init {
        viewModelScope.launch {
            brandRepository.getSupportContact()?.let { _support.value = it }
        }
    }

    /** True while signOut() is in flight — disables the button. */
    private val _signingOut = MutableStateFlow(false)
    val signingOut: StateFlow<Boolean> = _signingOut.asStateFlow()

    /** Revoke + clear, then invoke [onSignedOut] on the main thread. */
    fun signOut(onSignedOut: () -> Unit) {
        if (_signingOut.value) return
        _signingOut.value = true
        viewModelScope.launch {
            try {
                authRepository.signOut()
            } finally {
                _signingOut.value = false
                onSignedOut()
            }
        }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
