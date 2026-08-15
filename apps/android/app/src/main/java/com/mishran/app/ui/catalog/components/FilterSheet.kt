// apps/android/app/src/main/java/com/mishran/app/ui/catalog/components/FilterSheet.kt — Task 9.3.
//
// Bottom sheet for catalog filtering: a family dropdown (single-select, with
// an "All families" reset) and dietary-tag multi-select chips. Fully
// controlled — the caller owns the CatalogFilters; every interaction calls
// back with the next immutable value, so the sheet itself is stateless apart
// from the dropdown's open flag.
package com.mishran.app.ui.catalog.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.mishran.app.R
import com.mishran.api.models.Product
import com.mishran.app.ui.catalog.CatalogFilters

/**
 * Human labels for the family enum — value-strings ("sugar-free") are not UI
 * copy. Resolved with stringResource() at the use sites (this file + the
 * CatalogScreen filter chip). Falls back to "All families" on a miss.
 */
internal val FAMILY_LABEL_RES: Map<Product.Family, Int> = mapOf(
    Product.Family.classic to R.string.catalog_family_classic,
    Product.Family.original to R.string.catalog_family_originals,
    Product.Family.sugarMinusFree to R.string.catalog_family_sugar_free,
    Product.Family.regional to R.string.catalog_family_regional,
    Product.Family.seasonal to R.string.catalog_family_seasonal,
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FilterSheet(
    filters: CatalogFilters,
    availableDietaryTags: Set<String>,
    onChange: (CatalogFilters) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.catalog_filter_title),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.semantics { heading() },
                )
                if (filters.isActive) {
                    TextButton(onClick = { onChange(CatalogFilters()) }) {
                        Text(stringResource(R.string.common_clear_all))
                    }
                }
            }

            FamilyDropdown(
                selected = filters.family,
                onSelect = { family -> onChange(filters.copy(family = family)) },
            )

            if (availableDietaryTags.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(R.string.catalog_filter_dietary),
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.semantics { heading() },
                    )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        availableDietaryTags.sorted().forEach { tag ->
                            FilterChip(
                                selected = tag in filters.dietaryTags,
                                onClick = {
                                    val next = if (tag in filters.dietaryTags) {
                                        filters.dietaryTags - tag
                                    } else {
                                        filters.dietaryTags + tag
                                    }
                                    onChange(filters.copy(dietaryTags = next))
                                },
                                label = { Text(tag) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FamilyDropdown(
    selected: Product.Family?,
    onSelect: (Product.Family?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabelRes = selected?.let { FAMILY_LABEL_RES[it] } ?: R.string.catalog_family_all
    val selectedLabel = stringResource(selectedLabelRes)

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.catalog_filter_category)) },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.catalog_family_all)) },
                onClick = {
                    onSelect(null)
                    expanded = false
                },
            )
            FAMILY_LABEL_RES.forEach { (family, labelRes) ->
                DropdownMenuItem(
                    text = { Text(stringResource(labelRes)) },
                    onClick = {
                        onSelect(family)
                        expanded = false
                    },
                )
            }
        }
    }
}
