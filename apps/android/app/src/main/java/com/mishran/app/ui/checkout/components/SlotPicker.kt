// apps/android/app/src/main/java/com/mishran/app/ui/checkout/components/SlotPicker.kt — Task 10.2.
//
// Delivery slot selection for the fresh (Delhi NCR) tier — today/tomorrow,
// morning/evening windows. The caller renders nothing for the shelf tier, so
// this component assumes it is only composed when slotOptions is non-empty.
package com.mishran.app.ui.checkout.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mishran.app.ui.checkout.SlotOption

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SlotPicker(
    options: List<SlotOption>,
    selected: SlotOption?,
    onSelect: (SlotOption) -> Unit,
) {
    if (options.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Delivery slot", style = MaterialTheme.typography.titleMedium)
        Text(
            text = "You're in our same-day fresh network — pick a slot.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Surface(tonalElevation = 1.dp, shape = MaterialTheme.shapes.medium) {
            FlowRow(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                options.forEach { option ->
                    FilterChip(
                        selected = option == selected,
                        onClick = { onSelect(option) },
                        label = { Text(option.label) },
                    )
                }
            }
        }
    }
}
