// apps/android/app/src/main/java/com/mishran/app/ui/gift/GiftScreen.kt — parity batch (gift builder).
//
// The gift-builder lead form (Account → "Build a gift"): contact fields,
// three dropdowns (occasion, box size, budget — the web builder's verbatim
// option lists), a needed-by date, dietary notes, and a message card. Submit
// posts the web gift-builder draft shape to POST /api/leads; the success
// state replaces the form with the confirmation copy + the server's leadId —
// the same screen contract as EnquiryScreen, dropdowns styled after
// FilterSheet's FamilyDropdown.
package com.mishran.app.ui.gift

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mishran.app.R
import com.mishran.app.ui.common.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GiftScreen(
    onBack: () -> Unit,
    viewModel: GiftViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val errors by viewModel.errors.collectAsStateWithLifecycle()
    val submitState by viewModel.submitState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.gift_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when (val s = submitState) {
                is UiState.Success -> GiftSuccess(
                    leadId = s.data.leadId.orEmpty(),
                    onAnother = viewModel::reset,
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                )
                else -> GiftFormContent(
                    form = form,
                    errors = errors,
                    submitting = s is UiState.Loading,
                    onFieldChange = viewModel::onFieldChange,
                    onSubmit = viewModel::submit,
                )
            }
        }
    }
}

@Composable
private fun GiftFormContent(
    form: GiftForm,
    errors: Map<GiftField, String>,
    submitting: Boolean,
    onFieldChange: (GiftForm.() -> GiftForm) -> Unit,
    onSubmit: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(R.string.gift_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        FormField(
            label = stringResource(R.string.enquiry_field_name),
            value = form.name,
            error = errors[GiftField.NAME],
            onValueChange = { onFieldChange { copy(name = it) } },
        )
        FormField(
            label = stringResource(R.string.enquiry_field_email),
            value = form.email,
            error = errors[GiftField.EMAIL],
            onValueChange = { onFieldChange { copy(email = it) } },
        )
        FormField(
            label = stringResource(R.string.enquiry_field_phone),
            value = form.phone,
            onValueChange = { onFieldChange { copy(phone = it) } },
        )
        FormField(
            label = stringResource(R.string.enquiry_field_city),
            value = form.city,
            onValueChange = { onFieldChange { copy(city = it) } },
        )

        DropdownField(
            label = stringResource(R.string.gift_field_occasion),
            options = GIFT_OCCASIONS,
            selected = form.occasion,
            onSelect = { onFieldChange { copy(occasion = it) } },
        )
        DropdownField(
            label = stringResource(R.string.gift_field_box_size),
            options = GIFT_BOX_SIZES,
            selected = form.boxSize,
            onSelect = { onFieldChange { copy(boxSize = it) } },
        )
        DropdownField(
            label = stringResource(R.string.gift_field_budget),
            options = GIFT_BUDGETS,
            selected = form.budget,
            onSelect = { onFieldChange { copy(budget = it) } },
        )

        FormField(
            label = stringResource(R.string.enquiry_field_deadline),
            value = form.date,
            placeholder = "e.g. 20 Oct 2026",
            onValueChange = { onFieldChange { copy(date = it) } },
        )
        FormField(
            label = stringResource(R.string.gift_field_dietary),
            value = form.dietary,
            placeholder = "e.g. no nuts, Jain options",
            onValueChange = { onFieldChange { copy(dietary = it) } },
        )
        FormField(
            label = stringResource(R.string.gift_field_message),
            value = form.message,
            minLines = 3,
            onValueChange = { onFieldChange { copy(message = it) } },
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(onClick = onSubmit, enabled = !submitting) {
                Text(stringResource(R.string.gift_submit))
            }
            if (submitting) {
                Spacer(Modifier.width(12.dp))
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp).width(20.dp),
                    strokeWidth = 2.dp,
                )
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

/** Success dead-end: confirmation copy + the leadId ops references. */
@Composable
private fun GiftSuccess(
    leadId: String,
    onAnother: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = stringResource(R.string.gift_success),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        if (leadId.isNotBlank()) {
            Text(
                text = stringResource(R.string.enquiry_reference, leadId),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        TextButton(onClick = onAnother) { Text(stringResource(R.string.enquiry_send_another)) }
    }
}

/** One labeled input; the error (when set) drives isError + supporting text. */
@Composable
private fun FormField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    error: String? = null,
    placeholder: String? = null,
    minLines: Int = 1,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        isError = error != null,
        supportingText = error?.let { message -> { Text(message) } },
        minLines = minLines,
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Read-only labeled dropdown — FilterSheet's FamilyDropdown idiom. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    // Placeholder text until a choice exists, so the field never looks blank.
    val display = selected.ifBlank { label }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
    ) {
        OutlinedTextField(
            value = display,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onSelect(option)
                        expanded = false
                    },
                )
            }
        }
    }
}
