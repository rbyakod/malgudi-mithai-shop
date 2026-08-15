// apps/android/app/src/main/java/com/mishran/app/ui/addresses/AddressesScreen.kt
//
// Account → Delivery addresses: saved-address list with set-default and a
// confirm-then-delete action, plus an add-address form dialog
// (line1/line2/city/state/pincode/tag/default). Checkout's AddressPicker
// reads the same server-side list. Replaces the Phase 7 placeholder on
// Routes.ADDRESSES.
package com.mishran.app.ui.addresses

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.mishran.api.models.Address
import com.mishran.api.models.AddressInput

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddressesScreen(
    onBack: () -> Unit,
    viewModel: AddressesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showForm by remember { mutableStateOf(false) }
    // Address awaiting the delete confirmation dialog's Delete tap.
    var addressPendingDelete by remember { mutableStateOf<Address?>(null) }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.account_addresses)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.loading -> Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.addresses.size, key = { state.addresses[it].id ?: it }) { index ->
                    AddressRow(
                        address = state.addresses[index],
                        onSetDefault = { viewModel.setDefault(state.addresses[index]) },
                        onDelete = { addressPendingDelete = state.addresses[index] },
                    )
                }
                if (state.addresses.isEmpty()) {
                    item {
                        Text(
                            text = stringResource(R.string.account_addresses_empty),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                item {
                    Button(onClick = { showForm = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(stringResource(R.string.checkout_address_add_new))
                    }
                }
            }
        }
    }

    if (showForm) {
        AddAddressDialog(
            onDismiss = { showForm = false },
            onSave = { input ->
                viewModel.addAddress(input)
                showForm = false
            },
        )
    }

    // Delete is destructive and server-side — confirm before calling the VM.
    addressPendingDelete?.let { address ->
        AlertDialog(
            onDismissRequest = { addressPendingDelete = null },
            title = { Text(stringResource(R.string.account_address_delete_title)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteAddress(address)
                        addressPendingDelete = null
                    },
                ) { Text(stringResource(R.string.common_delete)) }
            },
            dismissButton = {
                TextButton(onClick = { addressPendingDelete = null }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }
}

@Composable
private fun AddressRow(
    address: Address,
    onSetDefault: () -> Unit,
    onDelete: () -> Unit,
) {
    val isDefault = address.isDefault == true
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = isDefault, onClick = onSetDefault)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    address.tag?.let {
                        Text(
                            text = it.value.replaceFirstChar { c -> c.uppercase() },
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    if (isDefault) {
                        Text(
                            text = stringResource(R.string.account_address_default),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Text(
                    text = listOfNotNull(
                        address.line1,
                        address.line2,
                        listOfNotNull(address.city, address.state).joinToString(", ")
                            .ifEmpty { null },
                        address.pincode,
                    ).joinToString("\n"),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Outlined.Delete, contentDescription = "Delete address")
            }
        }
    }
}

@Composable
private fun AddAddressDialog(
    onDismiss: () -> Unit,
    onSave: (AddressInput) -> Unit,
) {
    var line1 by remember { mutableStateOf("") }
    var line2 by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var stateName by remember { mutableStateOf("") }
    var pincode by remember { mutableStateOf("") }
    var tag by remember { mutableStateOf(AddressInput.Tag.home) }
    var isDefault by remember { mutableStateOf(false) }

    val pincodeValid = pincode.length == 6 && pincode.all { it.isDigit() }
    val formValid = line1.isNotBlank() && city.isNotBlank() &&
        stateName.isNotBlank() && pincodeValid

    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(stringResource(R.string.account_address_new), style = MaterialTheme.typography.titleLarge)

                OutlinedTextField(
                    value = line1,
                    onValueChange = { line1 = it },
                    label = { Text(stringResource(R.string.checkout_address_line1)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = line2,
                    onValueChange = { line2 = it },
                    label = { Text(stringResource(R.string.checkout_address_line2)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = city,
                    onValueChange = { city = it },
                    label = { Text(stringResource(R.string.checkout_address_city)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = stateName,
                    onValueChange = { stateName = it },
                    label = { Text(stringResource(R.string.checkout_address_state)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = pincode,
                    onValueChange = { if (it.length <= 6 && it.all { c -> c.isDigit() }) pincode = it },
                    label = { Text(stringResource(R.string.checkout_address_pincode)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = pincode.isNotEmpty() && !pincodeValid,
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AddressInput.Tag.entries.forEach { option ->
                        FilterChip(
                            selected = tag == option,
                            onClick = { tag = option },
                            label = {
                                Text(option.name.replaceFirstChar { c -> c.uppercase() })
                            },
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isDefault, onCheckedChange = { isDefault = it })
                    Text(stringResource(R.string.account_address_set_default), style = MaterialTheme.typography.bodyMedium)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            onSave(
                                AddressInput(
                                    line1 = line1.trim(),
                                    line2 = line2.trim().ifEmpty { null },
                                    city = city.trim(),
                                    state = stateName.trim(),
                                    pincode = pincode,
                                    tag = tag,
                                    isDefault = isDefault,
                                ),
                            )
                        },
                        enabled = formValid,
                    ) {
                        Text(stringResource(R.string.common_save))
                    }
                }
            }
        }
    }
}
