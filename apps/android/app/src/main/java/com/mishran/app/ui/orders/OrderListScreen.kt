// apps/android/app/src/main/java/com/mishran/app/ui/orders/OrderListScreen.kt — Task 11.1 / P1 parity.
//
// Orders tab: card list (reference, status chip, total, date) over the Room
// cache, refreshed on entry + hourly by the WorkManager janitor. Offline the
// stale list keeps serving with an inline notice; empty state offers the
// catalog. P1 parity wraps the list in material3's PullToRefreshBox — the
// gesture the original header comment deferred to the 1.3 upgrade — which
// also replaces the old 24dp header spinner (the box owns the indicator).
package com.mishran.app.ui.orders

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.api.models.Order
import com.mishran.app.R
import com.mishran.app.ui.cart.formatPaise
import com.mishran.app.ui.orderconfirmed.orderReferenceLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderListScreen(
    onOrderClick: (orderId: String) -> Unit,
    onBrowse: () -> Unit,
    onOpenCart: () -> Unit = {},
    // B5: the guest session's sign-in CTA — wired to AUTH_PHONE with a
    // redirect back here, so the verified session lands on the order list.
    onSignIn: () -> Unit = {},
    viewModel: OrderListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val refreshing by viewModel.refreshing.collectAsState()

    // Pull-to-refresh over the whole tab (header + list); the box's built-in
    // indicator is the only refresh affordance — the old inline 24dp header
    // spinner was dropped as redundant.
    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = viewModel::refresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.orders_title),
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
            }

            when {
                // Guest (B5): no session means no history to show — the sign-in
                // CTA instead of a false "No orders yet." empty state.
                state.needAuth -> NeedAuthOrders(onSignIn)
                !state.loaded -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.orders.isEmpty() -> EmptyOrders(onBrowse, onOpenCart)
                else -> LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    if (state.refreshFailed) {
                        item {
                            Text(
                                text = stringResource(R.string.orders_refresh_failed),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    items(state.orders, key = { it.id }) { order ->
                        OrderCard(order = order, onClick = { onOrderClick(order.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderCard(order: Order, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = orderReferenceLabel(order.id),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = formatOrderDate(order.createdAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = itemSummary(order),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                StatusChip(order.status)
                Text(
                    text = formatPaise(order.totals.totalInPaise.toLong()),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
internal fun StatusChip(status: Order.Status) {
    val (container, content) = when (statusTone(status)) {
        StatusTone.POSITIVE ->
            MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
        StatusTone.NEGATIVE ->
            MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        StatusTone.PROGRESS ->
            MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
    }
    Surface(color = container, contentColor = content, shape = MaterialTheme.shapes.small) {
        Text(
            text = statusLabelRes(status)?.let { stringResource(it) } ?: statusLabel(status),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun EmptyOrders(onBrowse: () -> Unit, onOpenCart: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.ReceiptLong,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(64.dp),
        )
        Text(
            text = stringResource(R.string.orders_empty),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
        )
        Text(
            text = stringResource(R.string.orders_empty_hint),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(onClick = onBrowse, modifier = Modifier.padding(top = 24.dp)) {
            Text(stringResource(R.string.cart_empty_cta))
        }
        OutlinedButton(onClick = onOpenCart, modifier = Modifier.padding(top = 8.dp)) {
            Text(stringResource(R.string.orders_go_to_cart))
        }
    }
}

/** Guest session (B5): sign-in CTA — same shape as the empty state. */
@Composable
private fun NeedAuthOrders(onSignIn: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.ReceiptLong,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(64.dp),
        )
        Text(
            text = stringResource(R.string.auth_sign_in_to_continue),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
        )
        Text(
            text = stringResource(R.string.orders_empty_hint),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(onClick = onSignIn, modifier = Modifier.padding(top = 24.dp)) {
            Text(stringResource(R.string.auth_sign_in_to_continue))
        }
    }
}

/** "Kaju Katli +2 more" — pure; first item name + overflow count. */
internal fun itemSummary(order: Order): String {
    val first = order.items.firstOrNull()?.name ?: return "No items"
    val extra = order.items.size - 1
    return if (extra > 0) "$first +$extra more" else first
}
