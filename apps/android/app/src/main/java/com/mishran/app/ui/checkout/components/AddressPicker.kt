// apps/android/app/src/main/java/com/mishran/app/ui/checkout/components/AddressPicker.kt — Task 10.2.
//
// Address selection + the live serviceability readout. Selecting an address
// triggers the pincode check; the tier chip (Fresh / Shelf) and SLA line tell
// the user what delivery model applies before they commit.
package com.mishran.app.ui.checkout.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.mishran.api.models.Address
import com.mishran.app.R
import com.mishran.app.ui.checkout.ServiceabilityState
import com.mishran.app.ui.checkout.formatAddressLine

@Composable
fun AddressPicker(
    addresses: List<Address>,
    selected: Address?,
    serviceability: ServiceabilityState,
    onSelect: (Address) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.checkout_address_title),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )

        addresses.forEach { address ->
            val isSelected = address.id == selected?.id
            Surface(
                selected = isSelected,
                shape = MaterialTheme.shapes.medium,
                tonalElevation = if (isSelected) 2.dp else 0.dp,
                onClick = { onSelect(address) },
                modifier = Modifier
                    .fillMaxWidth()
                    // Single a11y node for the whole row: TalkBack announces
                    // "address, selected, radio button, double-tap to switch"
                    // instead of an unlabeled RadioButton nested inside a
                    // second clickable (Task 12.4).
                    .semantics(mergeDescendants = true) {
                        role = Role.RadioButton
                        // Qualify: the bare name would resolve to the
                        // `selected: Address?` parameter above.
                        this.selected = isSelected
                    },
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Display-only: the row above is the one tap target.
                    RadioButton(selected = isSelected, onClick = null)
                    Column {
                        address.tag?.let { tag ->
                            Text(
                                text = tag.value.replaceFirstChar { it.uppercase() },
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            text = formatAddressLine(address),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        ServiceabilityReadout(serviceability)
    }
}

@Composable
private fun ServiceabilityReadout(serviceability: ServiceabilityState) {
    when (serviceability) {
        ServiceabilityState.Unknown -> Unit
        ServiceabilityState.Checking -> Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp))
            Text(stringResource(R.string.checkout_cta_checking), style = MaterialTheme.typography.bodySmall)
        }
        is ServiceabilityState.Serviceable -> Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FilterChip(
                selected = true,
                onClick = {},
                label = {
                    Text(
                        // TODO(i18n): missing keys checkout.tier_fresh / checkout.tier_shelf
                        when (serviceability.tier) {
                            "fresh" -> "Fresh — same-day network"
                            else -> "Shelf — shipped"
                        },
                    )
                },
            )
            serviceability.slaDays?.let { days ->
                Text(
                    // TODO(i18n): missing key checkout.arrives_days (with %1$d)
                    text = if (days <= 1) "Arrives in ~1 day" else "Arrives in ~$days days",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        is ServiceabilityState.NotServiceable -> Text(
            text = when (serviceability.reason) {
                // TODO(i18n): missing keys checkout.error_invalid_pincode /
                // checkout.error_serviceability_check / checkout.error_not_serviceable
                "invalid_pincode" -> "That pincode looks invalid."
                null -> "Couldn't check this pincode — check your connection and retry."
                else -> "We don't deliver to this pincode yet."
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
        )
    }
}
