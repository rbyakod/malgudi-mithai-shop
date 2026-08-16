// apps/android/app/src/main/java/com/mishran/app/ui/catalog/components/ProductCard.kt — Task 9.3 / P1 parity / parity batch.
//
// One catalog cell: image, name, display price, freshness badge, and (since
// P1 parity) a "Bestseller" chip pinned over the image when the product is
// featured. Purely presentational — takes a Product and an open callback,
// owns no state, so it renders identically in the grid and in Home's rail.
//
// Parity batch: an optional compact quick-add button pinned to the image's
// bottom-end corner. Null (the default) keeps the card exactly as the Home
// rail and vertical tabs render it; only the Mithai catalog grid passes it.
// The 40dp FilledIconButton still meets the 48dp touch-target floor —
// Material3's minimumInteractiveComponentSize pads the extra hit area.
package com.mishran.app.ui.catalog.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.mishran.api.models.Product
import com.mishran.app.R

@Composable
fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onQuickAdd: (() -> Unit)? = null,
) {
    Card(modifier = modifier.clickable(onClick = onClick)) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f),
                contentAlignment = Alignment.Center,
            ) {
                val image = product.images.orEmpty().firstOrNull()
                if (image == null) {
                    Text(
                        text = product.name.take(1),
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                } else {
                    AsyncImage(
                        model = image,
                        contentDescription = product.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                    )
                }
                if (product.featured == true) {
                    BestsellerBadge(modifier = Modifier.align(Alignment.TopStart))
                }
                if (onQuickAdd != null) {
                    QuickAddButton(
                        onClick = onQuickAdd,
                        modifier = Modifier.align(Alignment.BottomEnd),
                    )
                }
            }
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                product.displayPrice?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                product.freshnessStatus?.let { freshness ->
                    SuggestionChip(
                        onClick = onClick,
                        enabled = false,
                        label = {
                            Text(freshness.value, style = MaterialTheme.typography.labelSmall)
                        },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                        border = null,
                    )
                }
            }
        }
    }
}

/**
 * "Bestseller" flag pinned over a featured card's image. tertiaryContainer/
 * onTertiaryContainer keeps text contrast inside the theme's guaranteed pair
 * (Task 12.4's contrast rule) on any photo beneath it.
 */
@Composable
private fun BestsellerBadge(modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        shape = MaterialTheme.shapes.small,
        modifier = modifier.padding(8.dp),
    ) {
        Text(
            text = stringResource(R.string.product_bestseller),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

/**
 * Compact quick-add pinned to a card image's bottom-end corner — one tap adds
 * the BASE pack (the card's verbatim displayPrice line). primaryContainer
 * sits on any photo with guaranteed contrast for the glyph; the TalkBack
 * label is the catalog.quick_add copy.
 */
@Composable
private fun QuickAddButton(onClick: () -> Unit, modifier: Modifier = Modifier) {
    FilledIconButton(
        onClick = onClick,
        modifier = modifier.padding(8.dp).size(40.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.Add,
            contentDescription = stringResource(R.string.catalog_quick_add),
        )
    }
}
