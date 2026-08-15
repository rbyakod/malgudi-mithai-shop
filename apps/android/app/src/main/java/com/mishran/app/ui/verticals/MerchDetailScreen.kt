// apps/android/app/src/main/java/com/mishran/app/ui/verticals/MerchDetailScreen.kt — P2 net-new (verticals).
//
// Merch detail: image, name, price + availability chips, description, and the
// "Enquire" CTA — merch is enquiry-led (availability says so on the wire), so
// the button routes to the enquiry form with the type preset to corporate.
// No cart CTA by design.
//
// TODO(i18n): "Enquire" hardcodes the English copy from
// packages/i18n-strings/en.json (merch.enquire) — swap for an R.string
// reference in the i18n sweep.
package com.mishran.app.ui.verticals

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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
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
import com.mishran.api.models.Merch
import com.mishran.app.ui.common.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MerchDetailScreen(
    onBack: () -> Unit,
    onEnquire: () -> Unit,
    viewModel: MerchDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.vertical_merch)) },
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
            is UiState.Success -> MerchDetailContent(
                merch = s.data,
                onEnquire = onEnquire,
                modifier = Modifier.fillMaxSize().padding(padding),
            )
        }
    }
}

@Composable
private fun MerchDetailContent(
    merch: Merch,
    onEnquire: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        merch.images?.firstOrNull()?.let { image ->
            AsyncImage(
                model = image,
                contentDescription = merch.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(280.dp),
            )
        }
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = merch.name,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                merch.price?.takeIf { it.isNotBlank() }?.let { price -> InfoChip(text = price) }
                merch.availability?.takeIf { it.isNotBlank() }?.let { availability ->
                    InfoChip(text = availability)
                }
            }
            // TODO(i18n): missing key vertical.description
            DetailSection(label = "Description", body = merch.description)

            Spacer(Modifier.height(8.dp))
            Button(onClick = onEnquire, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Text(stringResource(R.string.merch_enquire))
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** Shared labeled paragraph (the product detail screen's Section(), verbatim). */
@Composable
internal fun DetailSection(label: String, body: String?) {
    if (body.isNullOrBlank()) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
