// apps/android/app/src/main/java/com/mishran/app/ui/auth/CountryPickerDialog.kt
//
// Searchable single-choice country picker for the sign-in dial-code chip.
// ~240 rows, so the list MUST be a LazyColumn (a scrollable Column would
// eagerly compose every row and jank). Search matches country name, ISO code,
// or dial code digits.
package com.mishran.app.ui.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.mishran.app.R

@Composable
fun CountryPickerDialog(
    selected: CountryCode,
    onSelect: (CountryCode) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }

    // Cheap filter, recomputed per keystroke over the in-memory table.
    val filtered = remember(query) {
        val q = query.trim()
        if (q.isEmpty()) {
            Countries.all
        } else {
            val dialQuery = q.removePrefix("+")
            Countries.all.filter { c ->
                c.name.contains(q, ignoreCase = true) ||
                    c.iso2.equals(q, ignoreCase = true) ||
                    (dialQuery.isNotEmpty() && dialQuery.all { it.isDigit() } &&
                        (c.dialCode == dialQuery || c.dialCode.startsWith(dialQuery)))
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.auth_phone_country_label)) },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    placeholder = { Text(stringResource(R.string.auth_phone_country_search)) },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                LazyColumn(
                    // Cap the dialog height — the list scrolls inside.
                    modifier = Modifier.heightIn(max = 420.dp),
                ) {
                    items(filtered, key = { it.iso2 }) { country ->
                        val isSelected = country.iso2 == selected.iso2
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 44.dp)
                                .clickable {
                                    onSelect(country)
                                    onDismiss()
                                }
                                .semantics { this.selected = isSelected }
                                .padding(vertical = 10.dp, horizontal = 4.dp),
                        ) {
                            Text(text = country.flagEmoji, style = MaterialTheme.typography.bodyLarge)
                            Spacer(Modifier.width(12.dp))
                            Text(
                                text = country.name,
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = country.dialPrefixed,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (isSelected) {
                                Spacer(Modifier.width(8.dp))
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
    )
}
