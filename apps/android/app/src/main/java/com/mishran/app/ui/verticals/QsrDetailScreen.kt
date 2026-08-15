// apps/android/app/src/main/java/com/mishran/app/ui/verticals/QsrDetailScreen.kt — P2 net-new (verticals).
//
// QSR counter-menu detail: image, name, veg/spice badges, description, and
// the "Available at" store chips (walk-in info, not a stock promise). NO cart
// CTA by contract — QSR items carry no price and no ordering path.
//
// TODO(i18n): "Vegetarian"/"Spice"/"Available at" hardcode the English copy
// from packages/i18n-strings/en.json (vertical.qsr.veg/spice/available_at) —
// swap for R.string references in the i18n sweep.
package com.mishran.app.ui.verticals

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import com.mishran.api.models.QsrItem
import com.mishran.app.ui.catalog.components.VegDot
import com.mishran.app.ui.common.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QsrDetailScreen(
    onBack: () -> Unit,
    viewModel: QsrDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.vertical_qsr_menu)) },
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
            is UiState.Success -> QsrDetailContent(
                item = s.data,
                modifier = Modifier.fillMaxSize().padding(padding),
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QsrDetailContent(item: QsrItem, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item.image?.let { image ->
            AsyncImage(
                model = image,
                contentDescription = item.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(280.dp),
            )
        }
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = item.name,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            // Veg marker + spice level, the two facts a counter customer scans
            // first. spiceLevel is 0–3 on the wire; rendered as "Spice · n".
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                item.veg?.let { veg ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        VegDot(veg = veg)
                        Text(
                            text = if (veg) {
                                stringResource(R.string.vertical_qsr_veg)
                            } else {
                                stringResource(R.string.vertical_qsr_nonveg)
                            },
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                item.spiceLevel?.let { level ->
                    // TODO(i18n): missing key vertical.qsr_spice_level (with %%1$d)
                        InfoChip(text = "Spice · $level")
                }
            }
            // TODO(i18n): missing key vertical.description
            DetailSection(label = "Description", body = item.description)

            if (!item.availableAtStores.isNullOrEmpty()) {
                Text(
                    text = stringResource(R.string.vertical_qsr_available_at),
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(top = 8.dp).semantics { heading() },
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item.availableAtStores.forEach { store -> InfoChip(text = store) }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
