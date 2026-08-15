// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailScreen.kt — Task 9.4 / P1 parity.
//
// Product detail: swipeable image gallery (Coil), name/price/freshness badge,
// pack-size chip row, ingredients / shelf life / storage / story sections,
// quantity stepper, and a bottom Add-to-cart + Buy-now bar. The add callbacks
// are owned by the caller — Task 10.1 wires the cart write; P1 parity adds
// Buy now (same write, straight to checkout) and the pack chips (the
// selected chip swaps the price line and scopes the cart line).
package com.mishran.app.ui.product

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.mishran.api.models.Product
import com.mishran.app.R
import com.mishran.app.ui.common.UiState

@Composable
fun ProductDetailScreen(
    onAddedToCart: () -> Unit,
    onBuyNow: () -> Unit = {},
    viewModel: ProductDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val quantity by viewModel.quantity.collectAsState()

    // Pop back once the cart write lands (not before — a cancelled coroutine
    // must never eat an Add-to-cart tap).
    LaunchedEffect(viewModel) {
        viewModel.added.collect { onAddedToCart() }
    }
    // Buy now: same write, then straight to checkout — no cart stop.
    LaunchedEffect(viewModel) {
        viewModel.bought.collect { onBuyNow() }
    }

    when (val s = state) {
        is UiState.Idle -> Box(modifier = Modifier.fillMaxSize())
        is UiState.Loading -> Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) { CircularProgressIndicator() }
        is UiState.Error -> Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = s.message,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
        }
        is UiState.Success -> ProductDetailContent(
            product = s.data,
            quantity = quantity,
            onIncrement = viewModel::incrementQuantity,
            onDecrement = viewModel::decrementQuantity,
            onAddToCart = viewModel::addToCart,
            onBuyNow = viewModel::buyNow,
        )
    }
}

@Composable
private fun ProductDetailContent(
    product: Product,
    quantity: Int,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onAddToCart: (PackSize?) -> Unit,
    onBuyNow: (PackSize?) -> Unit,
) {
    // Pack chips derive purely from the product (verbatim port of the web's
    // lib/mithai/packSizes.ts). Products whose price/weight don't parse get
    // none and render exactly the pre-pack UI.
    val packSizes = remember(product) {
        derivePackSizes(product.displayPrice.orEmpty(), product.weight)
    }
    // Default to the chip carrying the product's real (verbatim) price; the
    // selected chip rewrites the price line + the cart line.
    var selectedPack by remember(product) {
        mutableStateOf(packSizes.basePackFor(product.displayPrice))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        Gallery(product)
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.semantics { heading() },
                    )
                    (selectedPack?.priceLabel ?: product.displayPrice)?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                product.freshnessStatus?.let { freshness ->
                    SuggestionChip(
                        onClick = {},
                        enabled = false,
                        label = { Text(freshness.value) },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                        border = null,
                    )
                }
            }

            if (packSizes.isNotEmpty()) {
                PackSizeRow(
                    packs = packSizes,
                    selected = selectedPack,
                    onSelect = { selectedPack = it },
                )
            }

            Section(stringResource(R.string.product_ingredients), product.ingredients)
            // TODO(i18n): missing key product.shelf_life
            Section("Shelf life", product.shelfLife)
            // TODO(i18n): missing key product.storage
            Section("Storage", product.storage)
            // TODO(i18n): missing key product.story
            Section("Story", product.story)
            product.allergens.orEmpty().takeIf { it.isNotEmpty() }?.let { allergens ->
                // TODO(i18n): missing key product.allergens
                Section(label = "Allergens", body = allergens.joinToString(", "))
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(stringResource(R.string.product_quantity), style = MaterialTheme.typography.titleSmall)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedIconButton(onClick = onDecrement, enabled = quantity > 1) {
                        Icon(Icons.Filled.Remove, contentDescription = "One less")
                    }
                    Text(
                        text = quantity.toString(),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                    OutlinedIconButton(onClick = onIncrement) {
                        Icon(Icons.Filled.Add, contentDescription = "One more")
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = { onAddToCart(selectedPack) },
                    modifier = Modifier.weight(1f).height(52.dp),
                ) {
                    Text(stringResource(R.string.product_add_to_cart))
                }
                OutlinedButton(
                    onClick = { onBuyNow(selectedPack) },
                    modifier = Modifier.weight(1f).height(52.dp),
                ) {
                    Text(stringResource(R.string.product_buy_now))
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

/**
 * Pack-size selector between the price line and the detail sections. The
 * chips are display-only estimates off the single real catalog price (the
 * base chip carries it verbatim) — spelled out under the row so nobody reads
 * a derived number as a quote; checkout re-validates server-side.
 */
@Composable
private fun PackSizeRow(
    packs: List<PackSize>,
    selected: PackSize?,
    onSelect: (PackSize) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.product_pack_size),
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.semantics { heading() },
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.semantics { contentDescription = "Choose a pack size" },
        ) {
            packs.forEach { pack ->
                FilterChip(
                    selected = selected?.label == pack.label,
                    onClick = { onSelect(pack) },
                    label = { Text(pack.label) },
                )
            }
        }
        if (packs.size > 1) {
            Text(
                text = stringResource(R.string.product_pack_estimate),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Pager over the image list; a placeholder tile when the product has none. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Gallery(product: Product) {
    val images = product.images.orEmpty()
    if (images.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxWidth().height(320.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = product.name.take(1),
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        return
    }
    val pagerState = rememberPagerState(pageCount = { images.size })
    Column {
        HorizontalPager(state = pagerState) { page ->
            AsyncImage(
                model = images[page],
                contentDescription = "${product.name} — image ${page + 1}",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(320.dp),
            )
        }
        if (images.size > 1) {
            // Thin dot strip instead of a full tab row. The strip itself
            // announces the page position (the dots carry no semantics);
            // inactive dots use onSurfaceVariant because outline lands at
            // 2.49:1 on the light canvas — under the 3:1 non-text minimum
            // (Task 12.4).
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .semantics {
                        contentDescription =
                            "Image ${pagerState.currentPage + 1} of ${images.size}"
                    },
                horizontalArrangement = Arrangement.Center,
            ) {
                repeat(images.size) { index ->
                    val active = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .width(if (active) 16.dp else 6.dp)
                            .height(6.dp)
                            .clip(CircleShape)
                            .background(
                                if (active) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun Section(label: String, body: String?) {
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
