// apps/android/app/src/main/java/com/mishran/app/ui/auth/PhoneEntryScreen.kt — Task 8.1.
//
// Phone-entry screen: E.164 number → Send code. A success result hands the
// server requestId to [onOtpSent] (the NavGraph routes to the OTP screen). The
// layout is a single focused column — this is the front door, so it carries
// the brand wordmark and nothing that competes for attention.
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.mishran.app.R
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mishran.app.ui.common.UiState

@Composable
fun PhoneEntryScreen(
    viewModel: PhoneEntryViewModel = hiltViewModel(),
    onOtpSent: (requestId: String) -> Unit,
) {
    val phone by viewModel.phone.collectAsStateWithLifecycle()
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // Fire navigation exactly once per success, then return to Idle so a
    // configuration change (or back-and-forth) doesn't replay the navigation.
    LaunchedEffect(state) {
        val success = state as? UiState.Success
        if (success != null) {
            onOtpSent(success.data.requestId)
            viewModel.consumeState()
        }
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
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.auth_phone_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
        OutlinedTextField(
            value = phone,
            onValueChange = { viewModel.phone.value = it },
            // TODO(i18n): missing key auth.phone_field
            label = { Text("Phone number") },
            placeholder = { Text(stringResource(R.string.auth_phone_placeholder)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
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
            onClick = { viewModel.sendOtp() },
            enabled = state !is UiState.Loading && viewModel.isValidPhone(),
        ) {
            if (state is UiState.Loading) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.height(20.dp),
                )
            } else {
                Text(stringResource(R.string.auth_phone_cta))
            }
        }
    }
}
