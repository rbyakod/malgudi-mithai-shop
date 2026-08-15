// apps/android/app/src/main/java/com/mishran/app/ui/auth/BiometricGate.kt — Task 8.2.
//
// Cold-start auth gate mounted at the SPLASH route. It decides where the app
// opens:
//
//   - A biometric-gated session is the priority. If the user opted into
//     biometric login (SecureTokenStore holds a refresh token) AND a STRONG
//     biometric sensor is available, we challenge them; on success the session
//     is restored (token copied back to the DataStore + silent-refresh) and we
//     drop onto Home. On cancel / lockout / failure we fall back to OTP sign-in.
//   - If biometric login isn't enabled but a plain session still exists, we go
//     straight Home (the first protected call 401s → TokenRefreshAuthenticator).
//   - Otherwise → phone-entry sign-in.
//
// The decision + result handling live in [BiometricGateViewModel] (no Context,
// unit-testable). Only the untestable BiometricPrompt mount stays in the
// composable, which routes the prompt's coroutine result back to the ViewModel.
package com.mishran.app.ui.auth

import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.mishran.app.R
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.util.BiometricPromptController
import com.mishran.app.util.BiometricResult
import com.mishran.app.util.BiometricStatus
import com.mishran.app.util.BiometricStatusProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Cold-start decision tree rendered by [BiometricGate]. */
sealed interface GateState {
    data object Checking : GateState
    data object NeedLogin : GateState
    data object Prompt : GateState
    data object Unlocking : GateState
    data object Unlocked : GateState
}

@HiltViewModel
class BiometricGateViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val biometricStatusProvider: BiometricStatusProvider,
) : ViewModel() {

    private val _state = MutableStateFlow<GateState>(GateState.Checking)
    val state: StateFlow<GateState> = _state.asStateFlow()

    init {
        evaluate()
    }

    /**
     * Decide the entry point. A biometric-gated session wins; a plain stored
     * session is honored by skipping straight to Unlocked; otherwise sign-in.
     */
    fun evaluate() {
        viewModelScope.launch {
            _state.value = when {
                authRepository.isBiometricLoginEnabled() -> when (biometricStatusProvider.status()) {
                    // Enrolled but the sensor vanished or no prints/face remain:
                    // we cannot challenge, so fall back to OTP.
                    BiometricStatus.Available -> GateState.Prompt
                    else -> GateState.NeedLogin
                }
                authRepository.isLoggedIn() -> GateState.Unlocked
                else -> GateState.NeedLogin
            }
        }
    }

    /** Fed by the composable once the BiometricPrompt coroutine resolves. */
    fun onPromptResult(result: BiometricResult) {
        when (result) {
            BiometricResult.Success -> unlock()
            is BiometricResult.Error -> _state.value = GateState.NeedLogin
        }
    }

    private fun unlock() {
        viewModelScope.launch {
            _state.value = GateState.Unlocking
            _state.value =
                if (authRepository.restoreSessionFromBiometric()) GateState.Unlocked
                else GateState.NeedLogin
        }
    }
}

@Composable
fun BiometricGate(
    onUnlocked: () -> Unit,
    onNeedLogin: () -> Unit,
    viewModel: BiometricGateViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(state) {
        when (state) {
            GateState.NeedLogin -> onNeedLogin()
            GateState.Unlocked -> onUnlocked()
            GateState.Prompt -> {
                // BiometricPrompt needs a FragmentActivity host (MainActivity).
                val activity = context.findFragmentActivity()
                if (activity == null) {
                    viewModel.onPromptResult(BiometricResult.Error(-1, "No fragment host"))
                } else {
                    val result = BiometricPromptController(activity).authenticate(
                        title = "Unlock Mishran",
                        subtitle = "Use your fingerprint or face to sign in",
                    )
                    viewModel.onPromptResult(result)
                }
            }
            GateState.Checking, GateState.Unlocking -> Unit
        }
    }

    GateSplash(state)
}

@Composable
private fun GateSplash(state: GateState) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.height(20.dp))
            when (state) {
                GateState.Checking, GateState.Unlocking -> CircularProgressIndicator()
                GateState.Prompt -> Text(
                    // TODO(i18n): missing key auth.biometric_waiting
                    text = "Waiting for biometric…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> Unit
            }
        }
    }
}

/** Walk ContextWrapper chains to find the hosting FragmentActivity. */
private tailrec fun Context.findFragmentActivity(): FragmentActivity? = when (this) {
    is FragmentActivity -> this
    is ContextWrapper -> baseContext.findFragmentActivity()
    else -> null
}
