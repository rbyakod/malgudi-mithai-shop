// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailScreen.kt — Task 9.4.
//
// Product detail: swipeable image gallery (Coil), name/price/freshness badge,
// ingredients / shelf life / storage / story sections, quantity stepper, and a
// bottom Add-to-cart bar. The add callback is owned by the caller — Task 10.1
// wires it to the cart repository once that exists.
package com.mishran.app.ui.product

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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.mishran.api.models.Product
import com.mishran.app.ui.common.UiState

@Composable
fun ProductDetailScreen(
    onAddedToCart: () -> Unit,
    viewModel: ProductDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val quantity by viewModel.quantity.collectAsState()

    // Pop back once the cart write lands (not before — a cancelled coroutine
    // must never eat an Add-to-cart tap).
    LaunchedEffect(viewModel) {
        viewModel.added.collect { onAddedToCart() }
    }

    when (val s = state) {
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
        )
    }
}

@Composable
private fun ProductDetailContent(
    product: Product,
    quantity: Int,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onAddToCart: () -> Unit,
) {
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
                    )
                    product.displayPrice?.let {
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

            Section("Ingredients", product.ingredients)
            Section("Shelf life", product.shelfLife)
            Section("Storage", product.storage)
            Section("Story", product.story)
            product.allergens.orEmpty().takeIf { it.isNotEmpty() }?.let { allergens ->
                Section(label = "Allergens", body = allergens.joinToString(", "))
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Quantity", style = MaterialTheme.typography.titleSmall)
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
            Button(onClick = onAddToCart, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Text("Add to cart")
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

/** Pager over the image list; a placeholder tile when the product has none. */
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
            // Thin dot strip instead of a full tab row.
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
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
                                else MaterialTheme.colorScheme.outline,
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
        Text(label, style = MaterialTheme.typography.titleSmall)
        Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
