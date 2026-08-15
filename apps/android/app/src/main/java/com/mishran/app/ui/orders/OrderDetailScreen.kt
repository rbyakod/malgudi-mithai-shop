// apps/android/app/src/main/java/com/mishran/app/ui/orders/OrderDetailScreen.kt — Task 11.1.
//
// Order detail: status header + delivery timeline (canonical happy-path
// stages with the live one highlighted; side states render a banner), line
// items, totals breakdown, slot line, and a support CTA. The same screen
// serves the Orders tab, the post-checkout Track-order CTA, and the
// mishran://order/{id} push deep link.
package com.mishran.app.ui.orders

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.api.models.Order
import com.mishran.app.R
import com.mishran.app.ui.cart.formatPaise
import com.mishran.app.ui.common.UiState
import com.mishran.app.ui.orderconfirmed.orderReferenceLabel

@Composable
fun OrderDetailScreen(
    onCallSupport: () -> Unit = {},
    viewModel: OrderDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    when (val current = state) {
        is UiState.Loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        is UiState.Error -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(current.message, style = MaterialTheme.typography.bodyLarge)
                Button(onClick = viewModel::load, modifier = Modifier.padding(top = 16.dp)) {
                    Text(stringResource(R.string.common_try_again))
                }
            }
        }
        is UiState.Success -> OrderDetailContent(
            order = current.data,
            onCallSupport = onCallSupport,
            modifier = Modifier.fillMaxSize(),
        )
        UiState.Idle -> Unit
    }
}

@Composable
private fun OrderDetailContent(
    order: Order,
    onCallSupport: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Column {
            Text(
                text = orderReferenceLabel(order.id),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = stringResource(R.string.order_placed_at, formatOrderDate(order.createdAt)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier.padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StatusChip(order.status)
                if (order.slot != null) {
                    Text(
                        text = slotLine(order),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        val stageIndex = stageIndexFor(order.status)
        if (stageIndex != null) {
            Timeline(stageIndex = stageIndex)
        } else {
            SideStateBanner(order)
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.order_items_title), style = MaterialTheme.typography.titleMedium)
            order.items.forEach { item ->
                Row(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.name, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            text = "${item.quantity} × ${item.unit}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        text = formatPaise(item.priceInPaise.toLong() * item.quantity),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(stringResource(R.string.order_totals_title), style = MaterialTheme.typography.titleMedium)
            TotalRow(stringResource(R.string.cart_subtotal), order.totals.itemsTotalInPaise)
            TotalRow(stringResource(R.string.cart_delivery_fee), order.totals.deliveryFeeInPaise)
            if (order.totals.taxesInPaise > 0) {
                TotalRow(stringResource(R.string.order_taxes), order.totals.taxesInPaise)
            }
            if (order.totals.discountInPaise > 0) {
                TotalRow(stringResource(R.string.order_discount), -order.totals.discountInPaise)
            }
            HorizontalDivider()
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.cart_total),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPaise(order.totals.totalInPaise.toLong()),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        TextButton(onClick = onCallSupport) {
            Text(stringResource(R.string.order_help_call))
        }
    }
}

@Composable
private fun Timeline(stageIndex: Int) {
    Column {
        TIMELINE_STAGES.forEachIndexed { index, stage ->
            val done = index < stageIndex
            val current = index == stageIndex
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp)
                    // Progress is otherwise conveyed only through dot/text
                    // color (Task 12.4).
                    .semantics {
                        stateDescription = when {
                            current -> "Current stage"
                            done -> "Completed"
                            else -> "Upcoming"
                        }
                    },
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    done || current -> MaterialTheme.colorScheme.primary
                                    else -> MaterialTheme.colorScheme.outlineVariant
                                },
                            ),
                    )
                }
                Text(
                    text = (statusLabelRes(stage)?.let { stringResource(it) } ?: statusLabel(stage)) +
                        if (current) " • now" else "",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (current) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (done || current) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 12.dp),
                )
            }
        }
    }
}

@Composable
private fun SideStateBanner(order: Order) {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
        shape = MaterialTheme.shapes.medium,
    ) {
        Text(
            text = "${statusLabelRes(order.status)?.let { stringResource(it) } ?: statusLabel(order.status)} — ${supportLine(order.status)}",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        )
    }
}

@Composable
private fun TotalRow(label: String, paise: Int) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = formatPaise(paise.toLong()),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** "Thu 14 Aug, 10:00–14:00" — slot lines store the raw date + window. */
internal fun slotLine(order: Order): String {
    val date = order.slot?.date ?: ""
    val window = order.slot?.window ?: ""
    return listOf(date, window).filter { it.isNotEmpty() }.joinToString(", ")
}

/** Placeholder support line — swap for the real number before launch. */
const val SUPPORT_PHONE = "+918000000000"

/** Reassurance copy for side states; pure for JVM tests. */
internal fun supportLine(status: Order.Status): String = when (status) {    Order.Status.pending_payment -> "complete the payment to confirm this order."
    Order.Status.payment_failed -> "any deducted amount is refunded within 5-7 days."
    Order.Status.cancelled -> "reach out to support if this looks wrong."
    Order.Status.returned -> "the return is being processed."
    Order.Status.failed_delivery -> "our team will contact you to re-attempt."
    Order.Status.abandoned -> "this order was never completed."
    else -> "reach out to support."
}
