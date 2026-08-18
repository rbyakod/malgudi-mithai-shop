// apps/android/app/src/main/java/com/mishran/app/ui/auth/PhoneEntryScreen.kt — Task 8.1.
//
// Phone-entry screen: country dial-code chip + national number → Send OTP.
// A success result hands the server requestId + the composed phone to
// [onOtpSent] (the NavGraph routes to the OTP screen, which resends in
// place). The layout is a single focused column — this is
// the front door, so it carries the brand wordmark and nothing that competes
// for attention.
package com.mishran.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
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
    onOtpSent: (requestId: String, phone: String) -> Unit,
) {
    val selectedCountry by viewModel.selectedCountry.collectAsStateWithLifecycle()
    val nationalNumber by viewModel.nationalNumber.collectAsStateWithLifecycle()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showCountryPicker by rememberSaveable { mutableStateOf(false) }
    // Hoisted: the semantics lambda below is not a composable scope.
    val countryLabel = stringResource(R.string.auth_phone_country_label)

    // Fire navigation exactly once per success, then return to Idle so a
    // configuration change (or back-and-forth) doesn't replay the navigation.
    // The composed phone rides along so the OTP screen can resend in place.
    LaunchedEffect(state) {
        val success = state as? UiState.Success
        if (success != null) {
            onOtpSent(success.data.requestId, viewModel.e164)
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
        Row(
            verticalAlignment = Alignment.Bottom,
            modifier = Modifier.padding(horizontal = 8.dp),
        ) {
            OutlinedButton(
                onClick = { showCountryPicker = true },
                modifier = Modifier
                    .height(56.dp)
                    .semantics { contentDescription = countryLabel },
            ) {
                Text(text = "${selectedCountry.flagEmoji} ${selectedCountry.dialPrefixed}")
                Icon(Icons.Default.ArrowDropDown, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(
                value = nationalNumber,
                onValueChange = viewModel::onNationalNumberChange,
                label = { Text(stringResource(R.string.auth_phone_label)) },
                placeholder = { Text(stringResource(R.string.auth_phone_national_placeholder)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = nationalNumber.isNotEmpty() && !viewModel.isValidPhone(),
                supportingText = if (nationalNumber.isNotEmpty() && !viewModel.isValidPhone()) {
                    { Text(stringResource(R.string.auth_phone_error_invalid)) }
                } else {
                    null
                },
                modifier = Modifier.weight(1f),
            )
        }
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

    if (showCountryPicker) {
        CountryPickerDialog(
            selected = selectedCountry,
            onSelect = { viewModel.onSelectCountry(it) },
            onDismiss = { showCountryPicker = false },
        )
    }
}
