// apps/android/app/src/main/java/com/mishran/app/ui/catalog/components/VerticalCards.kt — P2 net-new (verticals).
//
// Grid cells for the three non-mithai catalog tabs — one card per vertical,
// each following ProductCard's shape (image, name, one-line discriminator) so
// the catalog grid reads uniformly across tabs:
//   - SnackCard: MSRP · weight (retail display — no app price).
//   - QsrCard: veg/non-veg dot + category (walk-in menu — no price at all).
//   - MerchCard: type · availability (enquiry-led).
// Purely presentational; the discriminators are joined with blanks dropped so
// half-empty rows never render stray separators.
//
// TODO(i18n): the veg/spice labels and retailer heading hardcode English from
// packages/i18n-strings/en.json (vertical.qsr.veg "Vegetarian", vertical.qsr.
// spice "Spice") — swap for R.string references in the i18n sweep.
package com.mishran.app.ui.catalog.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.mishran.api.models.Merch
import com.mishran.api.models.QsrItem
import com.mishran.api.models.Snack

@Composable
fun SnackCard(
    snack: Snack,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    VerticalCard(
        image = snack.images?.firstOrNull(),
        fallbackInitial = snack.name,
        name = snack.name,
        onClick = onClick,
        modifier = modifier,
    ) {
        Text(
            text = listOfNotNull(snack.msrp, snack.weight)
                .filter { it.isNotBlank() }
                .joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun QsrCard(
    item: QsrItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    VerticalCard(
        image = item.image,
        fallbackInitial = item.name,
        name = item.name,
        onClick = onClick,
        modifier = modifier,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Veg marker: the FSSAI square's dot form — green when veg, the
            // non-veg red otherwise, absent when the menu item says neither.
            item.veg?.let { veg -> VegDot(veg = veg) }
            item.category?.let { category ->
                Text(
                    text = category,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
fun MerchCard(
    merch: Merch,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    VerticalCard(
        image = merch.images?.firstOrNull(),
        fallbackInitial = merch.name,
        name = merch.name,
        onClick = onClick,
        modifier = modifier,
    ) {
        Text(
            text = listOfNotNull(merch.type, merch.availability)
                .filter { it.isNotBlank() }
                .joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Shared card skeleton (ProductCard's shape without its commerce bits):
 * 1:1 image or initial placeholder, then the discriminator slot.
 */
@Composable
private fun VerticalCard(
    image: String?,
    fallbackInitial: String,
    name: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    discriminator: @Composable () -> Unit,
) {
    Card(modifier = modifier.clickable(onClick = onClick)) {
        Column {
            Box(
                modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                contentAlignment = Alignment.Center,
            ) {
                if (image == null) {
                    Text(
                        text = fallbackInitial.take(1),
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                } else {
                    AsyncImage(
                        model = image,
                        contentDescription = name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                    )
                }
            }
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                discriminator()
            }
        }
    }
}

/** Small FSSAI-style dot; the 1dp outline guarantees contrast on any surface. */
@Composable
internal fun VegDot(veg: Boolean, modifier: Modifier = Modifier) {
    Surface(
        color = if (veg) VEG_GREEN else NON_VEG_RED,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shape = CircleShape,
        modifier = modifier.size(10.dp),
    ) {}
}

/** FSSAI palette markers — fixed brand-independent colors, not theme roles. */
internal val VEG_GREEN = Color(0xFF2E7D32)
internal val NON_VEG_RED = Color(0xFFB3261E)
