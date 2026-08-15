// apps/android/app/src/main/java/com/mishran/app/ui/enquiry/EnquiryScreen.kt — P2 net-new (enquiry).
//
// The wedding/corporate enquiry form: a segmented type toggle that swaps the
// extra-field set, required-field validation surfaced per field, and a submit
// whose success state replaces the form with the confirmation copy + the
// server's leadId. Entry points: merch detail's "Enquire" CTA (type preset to
// corporate via ?type=) and the Account "Bulk & events" row.
//
// TODO(i18n): strings below hardcode the English copy already present in
// packages/i18n-strings/en.json (enquiry.title/type.wedding/type.corporate/
// field.*/submit/success/error, merch.enquire) — swap for R.string references
// in the sweep that wires generated resources.
package com.mishran.app.ui.enquiry

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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mishran.app.ui.common.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EnquiryScreen(
    onBack: () -> Unit,
    viewModel: EnquiryViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val errors by viewModel.errors.collectAsStateWithLifecycle()
    val submitState by viewModel.submitState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bulk & events") },
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
                is UiState.Success -> EnquirySuccess(
                    leadId = s.data.leadId.orEmpty(),
                    onAnother = viewModel::reset,
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                )
                else -> EnquiryFormContent(
                    form = form,
                    errors = errors,
                    submitting = s is UiState.Loading,
                    onTypeChange = viewModel::onTypeChange,
                    onFieldChange = viewModel::onFieldChange,
                    onExtraChange = viewModel::onExtraChange,
                    onSubmit = viewModel::submit,
                )
            }
        }
    }
}

@Composable
private fun EnquiryFormContent(
    form: EnquiryForm,
    errors: Map<EnquiryField, String>,
    submitting: Boolean,
    onTypeChange: (EnquiryType) -> Unit,
    onFieldChange: (EnquiryField, String) -> Unit,
    onExtraChange: (EnquiryForm.() -> EnquiryForm) -> Unit,
    onSubmit: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Type toggle — swaps the extra-field set below.
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            EnquiryType.entries.forEachIndexed { index, type ->
                SegmentedButton(
                    selected = form.type == type,
                    onClick = { onTypeChange(type) },
                    shape = SegmentedButtonDefaults.itemShape(index, EnquiryType.entries.size),
                ) {
                    Text(
                        text = if (type == EnquiryType.WEDDING) "Wedding" else "Corporate",
                    )
                }
            }
        }

        FormField(
            label = "Name",
            value = form.name,
            error = errors[EnquiryField.NAME],
            onValueChange = { onFieldChange(EnquiryField.NAME, it) },
        )
        FormField(
            label = "Phone",
            value = form.phone,
            error = errors[EnquiryField.PHONE],
            onValueChange = { onFieldChange(EnquiryField.PHONE, it) },
        )
        FormField(
            label = "Email",
            value = form.email,
            error = errors[EnquiryField.EMAIL],
            onValueChange = { onFieldChange(EnquiryField.EMAIL, it) },
        )

        when (form.type) {
            EnquiryType.WEDDING -> {
                FormField(
                    label = "Event date",
                    value = form.eventDate,
                    placeholder = "e.g. 12 Nov 2026",
                    onValueChange = { onExtraChange { copy(eventDate = it) } },
                )
                FormField(
                    label = "City",
                    value = form.city,
                    onValueChange = { onExtraChange { copy(city = it) } },
                )
                FormField(
                    label = "Guests",
                    value = form.guests,
                    placeholder = "e.g. 400",
                    onValueChange = { onExtraChange { copy(guests = it) } },
                )
            }
            EnquiryType.CORPORATE -> {
                FormField(
                    label = "Company",
                    value = form.company,
                    onValueChange = { onExtraChange { copy(company = it) } },
                )
                FormField(
                    label = "Quantity",
                    value = form.quantity,
                    placeholder = "e.g. 250 boxes",
                    onValueChange = { onExtraChange { copy(quantity = it) } },
                )
                FormField(
                    label = "Needed by",
                    value = form.neededBy,
                    placeholder = "e.g. 20 Oct 2026",
                    onValueChange = { onExtraChange { copy(neededBy = it) } },
                )
            }
        }

        FormField(
            label = "Message",
            value = form.message,
            error = errors[EnquiryField.MESSAGE],
            minLines = 4,
            onValueChange = { onFieldChange(EnquiryField.MESSAGE, it) },
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(onClick = onSubmit, enabled = !submitting) {
                Text("Submit")
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
private fun EnquirySuccess(
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
            text = "Thank you. Our events team will be in touch within one business day.",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        if (leadId.isNotBlank()) {
            Text(
                text = "Reference: $leadId",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        TextButton(onClick = onAnother) { Text("Send another enquiry") }
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
