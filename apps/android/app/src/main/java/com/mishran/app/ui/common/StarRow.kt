// apps/android/app/src/main/java/com/mishran/app/ui/common/StarRow.kt — B11.
//
// Five-star aggregate rating row (PDP reviews summary). Fill precision is
// arbitrary: each star clips a filled star to its exact fraction over an
// outline base, so 4.3 reads as four stars plus a third of the fifth. The
// row itself carries the accessibility label (the individual stars are
// decorative); the caller passes the pre-formatted rating string.
package com.mishran.app.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Per-star fill fraction for [rating]: star i is full once rating ≥ i, empty
 * past the rating, and carries the exact remainder otherwise. Ratings outside
 * 0..5 clamp. Pure so the geometry is unit-testable.
 */
internal fun starFillFractions(rating: Double): List<Float> =
    (1..5).map { index -> (rating - (index - 1)).coerceIn(0.0, 1.0).toFloat() }

/**
 * Five-star row for a 0..5 [rating]. [contentDescription] lands on the whole
 * row as one accessibility node ("4.5 out of 5 stars"); individual stars are
 * decorative. [starSize] defaults to the 20dp icon rhythm.
 */
@Composable
fun StarRow(
    rating: Double,
    contentDescription: String,
    modifier: Modifier = Modifier,
    starSize: Dp = 20.dp,
) {
    Row(
        modifier = modifier.semantics { this.contentDescription = contentDescription },
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        starFillFractions(rating).forEach { fraction ->
            Star(fraction = fraction, starSize = starSize)
        }
    }
}

/** One star: outline base with a filled star clipped to [fraction] on top. */
@Composable
private fun Star(fraction: Float, starSize: Dp) {
    Box(modifier = Modifier.size(starSize)) {
        if (fraction < 1f) {
            Icon(
                imageVector = Icons.Outlined.StarOutline,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.outlineVariant,
                modifier = Modifier.requiredSize(starSize),
            )
        }
        // Partial star: a width-fraction clip box crops a FULL-size filled
        // star — requiredSize ignores the box's shrunken width constraint so
        // the star crops instead of squishing.
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction)
                .clipToBounds(),
        ) {
            Icon(
                imageVector = Icons.Filled.Star,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.requiredSize(starSize),
            )
        }
    }
}
