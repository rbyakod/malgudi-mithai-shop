// apps/android/app/src/main/java/com/mishran/app/ui/account/AccountViewModel.kt
//
// Account-tab state: the signed-in phone off DataStore, and a sign-out that
// revokes the refresh token server-side then clears the local session.
package com.mishran.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.app.data.repository.AuthRepository
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
) : ViewModel() {

    /** E.164 phone of the signed-in customer; null for pre-phone-key sessions. */
    val phone: StateFlow<String?> = authRepository.sessionPhone()
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            null,
        )

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
