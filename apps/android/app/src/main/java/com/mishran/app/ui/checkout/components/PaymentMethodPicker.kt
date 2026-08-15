// apps/android/app/src/main/java/com/mishran/app/ui/checkout/components/PaymentMethodPicker.kt — Task 10.2.
//
// Payment channel selection. This only records the user's preference — the
// Razorpay sheet (Task 10.3) owns the actual collection, and its config hints
// at the chosen method without hard-locking it.
package com.mishran.app.ui.checkout.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.mishran.app.R
import com.mishran.app.ui.checkout.PaymentMethod

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PaymentMethodPicker(
    selected: PaymentMethod,
    onSelect: (PaymentMethod) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.checkout_payment_title),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PaymentMethod.entries.forEach { method ->
                FilterChip(
                    selected = method == selected,
                    onClick = { onSelect(method) },
                    label = { Text(stringResource(method.labelRes)) },
                )
            }
        }
    }
}
