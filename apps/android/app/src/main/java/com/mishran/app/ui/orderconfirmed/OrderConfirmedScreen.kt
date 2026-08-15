// apps/android/app/src/main/java/com/mishran/app/ui/orderconfirmed/OrderConfirmedScreen.kt — Task 10.4.
//
// Post-payment confirmation: success mark, order reference, delivery ETA,
// and the two exits — Track order (order detail; also reachable via the
// mishran://order/{id} deep link from a push) and Continue shopping.
// Pure helpers (orderReferenceLabel, etaLine, shelfEtaLine) are extracted
// for JVM tests.
package com.mishran.app.ui.orderconfirmed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.mishran.app.R

@Composable
fun OrderConfirmedScreen(
    orderId: String,
    onTrackOrder: (String) -> Unit,
    onContinueShopping: () -> Unit,
    /** Picked fresh-tier slot label ("Thu 14 Aug, 10:00–14:00"); null = shelf tier. */
    slotLabel: String? = null,
    /** Shelf-tier SLA in days; ignored when [slotLabel] is present. */
    shelfSlaDays: Int? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(72.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.order_confirmed),
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = orderReferenceLabel(orderId),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(24.dp))
        val eta = etaLine(slotLabel, stringResource(R.string.order_arriving_slot))
            ?: shelfEtaLine(shelfSlaDays, stringResource(R.string.order_arriving_days))
        if (eta != null) {
            Text(
                text = eta,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(8.dp))
        }
        Text(
            text = stringResource(R.string.order_receipt_note),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = { onTrackOrder(orderId) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(stringResource(R.string.orders_track))
        }
        TextButton(onClick = onContinueShopping, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.order_continue_shopping))
        }
    }
}

/**
 * Human-friendly order reference: "#" + the id, tail-ellipsized when long
 * (UUIDs keep their distinctive end). Blank ids degrade to a dash.
 */
internal fun orderReferenceLabel(orderId: String): String {
    val trimmed = orderId.trim()
    if (trimmed.isEmpty()) return "#—"
    return if (trimmed.length <= MAX_REFERENCE_CHARS) "#$trimmed"
    else "#" + trimmed.take(HEAD_CHARS) + "…" + trimmed.takeLast(TAIL_CHARS)
}

/**
 * Fresh-tier ETA from the picked slot; null when no slot was chosen.
 * [arrivingSlotPattern] is the localized "Arriving %1$s" (order.arriving_slot)
 * resolved by the caller via stringResource — the helper stays pure for JVM tests.
 */
internal fun etaLine(slotLabel: String?, arrivingSlotPattern: String): String? =
    slotLabel?.let { arrivingSlotPattern.format(it) }

/**
 * Shelf-tier ETA from the SLA days; null when unknown. [arrivingDaysPattern]
 * is the localized "Arriving in %1$s–%2$s days" (order.arriving_days); the
 * second arg is always slaDays + 1, matching the en copy's 1–2 day floor.
 */
internal fun shelfEtaLine(slaDays: Int?, arrivingDaysPattern: String): String? = when {
    slaDays == null -> null
    else -> arrivingDaysPattern.format(slaDays, slaDays + 1)
}

private const val MAX_REFERENCE_CHARS = 16
private const val HEAD_CHARS = 8
private const val TAIL_CHARS = 6
