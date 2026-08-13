// apps/android/app/src/main/java/com/mishran/app/ui/auth/OtpScreen.kt — Task 8.1.
//
// OTP-verify screen: 6-digit code → Verify. On success the session is already
// persisted by [OtpViewModel]/[AuthRepository]; this screen hands control to
// [onVerified] (the NavGraph routes to Home and pops the auth stack).
// SMS-retriever autofill (Task 8.3) will populate [code] from an inbound SMS;
// the field stays hand-editable regardless.
package com.mishran.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mishran.app.ui.common.UiState

@Composable
fun OtpScreen(
    viewModel: OtpViewModel = hiltViewModel(),
    enrollmentViewModel: BiometricEnrollmentViewModel = hiltViewModel(),
    onVerified: () -> Unit,
    onResend: () -> Unit,
) {
    val code by viewModel.code.collectAsStateWithLifecycle()
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // On a fresh verify success, offer biometric enrollment (if a STRONG sensor
    // is available and not already enabled) before handing off to the NavGraph.
    // While the dialog is up we hold navigation; either button releases it.
    var showEnrollment by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(state) {
        if (state is UiState.Success && !showEnrollment) {
            if (enrollmentViewModel.shouldOffer()) {
                showEnrollment = true
            } else {
                onVerified()
                viewModel.consumeState()
            }
        }
    }

    if (showEnrollment) {
        EnableBiometricDialog(
            // Persist the token, THEN navigate — enable() invokes onVerified()
            // inside its coroutine after the write lands, so popping this entry
            // cannot cancel a half-written token.
            onEnable = {
                showEnrollment = false
                enrollmentViewModel.enable {
                    onVerified()
                    viewModel.consumeState()
                }
            },
            onSkip = {
                showEnrollment = false
                onVerified()
                viewModel.consumeState()
            },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Enter the code",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "We texted a 6-digit code to your phone.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = code,
            onValueChange = { entered -> viewModel.code.value = entered.filter { it.isDigit() }.take(6) },
            label = { Text("6-digit code") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Spacer(Modifier.height(16.dp))
        when (val current = state) {
            is UiState.Error -> Text(
                text = current.message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp),
            )
            else -> {}
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { viewModel.verify() },
            enabled = state !is UiState.Loading && code.length == 6,
        ) {
            if (state is UiState.Loading) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.height(20.dp),
                )
            } else {
                Text("Verify")
            }
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onResend) {
            Text("Resend code")
        }
    }
}
