// apps/android/app/src/main/java/com/mishran/app/ui/verticals/SnackDetailScreen.kt — P2 net-new (verticals).
//
// Retail-snack detail: image, name, MSRP + weight chips, description, and the
// "Where to buy" retailer rows — retail is external by design, so each row
// hands its URL to [onOpenRetailer], which the NavGraph turns into an
// ACTION_VIEW intent (the system browser / installed Custom Tabs provider).
// There is deliberately NO cart CTA: snacks are never app-commerce.
//
// TODO(i18n): "Where to buy" hardcodes the English copy from
// packages/i18n-strings/en.json (vertical.snacks.retailers) — swap for an
// R.string reference in the i18n sweep.
package com.mishran.app.ui.verticals

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.mishran.app.R
import com.mishran.api.models.Snack
import com.mishran.app.ui.common.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SnackDetailScreen(
    onBack: () -> Unit,
    onOpenRetailer: (url: String) -> Unit,
    viewModel: SnackDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.vertical_snacks)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        when (val s = state) {
            is UiState.Idle -> Box(modifier = Modifier.fillMaxSize().padding(padding))
            is UiState.Loading -> Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center,
            ) { CircularProgressIndicator() }
            is UiState.Error -> Box(
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = s.message,
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                    )
                    TextButton(onClick = viewModel::load) { Text(stringResource(R.string.common_try_again)) }
                }
            }
            is UiState.Success -> SnackDetailContent(
                snack = s.data,
                onOpenRetailer = onOpenRetailer,
                modifier = Modifier.fillMaxSize().padding(padding),
            )
        }
    }
}

@Composable
private fun SnackDetailContent(
    snack: Snack,
    onOpenRetailer: (url: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        snack.images?.firstOrNull()?.let { image ->
            AsyncImage(
                model = image,
                contentDescription = snack.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(280.dp),
            )
        }
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = snack.name,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                snack.msrp?.takeIf { it.isNotBlank() }?.let { msrp ->
                    InfoChip(text = msrp)
                }
                snack.weight?.takeIf { it.isNotBlank() }?.let { weight ->
                    InfoChip(text = weight)
                }
            }
            // TODO(i18n): missing key vertical.description
            DetailSection(label = "Description", body = snack.description)

            if (!snack.retailers.isNullOrEmpty()) {
                Text(
                    text = stringResource(R.string.vertical_snacks_retailers),
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(top = 8.dp).semantics { heading() },
                )
                snack.retailers.forEach { retailer ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenRetailer(retailer.url) },
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    text = retailer.label,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Text(
                                    // TODO(i18n): missing key vertical.opens_in_browser
                                    text = "Opens in your browser",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** Disabled display chip — the house pattern for read-only metadata. */
@Composable
internal fun InfoChip(text: String) {
    SuggestionChip(
        onClick = {},
        enabled = false,
        label = { Text(text, style = MaterialTheme.typography.labelMedium) },
        colors = SuggestionChipDefaults.suggestionChipColors(
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        border = null,
    )
}
