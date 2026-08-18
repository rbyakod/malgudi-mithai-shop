// apps/android/app/src/main/java/com/mishran/app/ui/cart/CartScreen.kt — Task 10.1 / parity batch.
//
// The cart: line items with quantity steppers + remove, an estimated-total
// footer with a checkout CTA, and an empty state that routes to the catalog.
// The total label says "est." because it is derived from display prices —
// the server's cart-validate snapshot is the authoritative number.
//
// Parity batch: a "Send order on WhatsApp" outline button beside checkout —
// it opens wa.me with every line enumerated + the estimated total (the
// message builder is a pure function in CartViewModel). The caller owns the
// ACTION_VIEW intent.
//
// B9: the footer gains a delivery line off the server's cart estimate —
// with a saved pincode it prices the fee + free-delivery progress; without
// one (or when the estimate fails) it shows the no-pincode copy beside a
// "Check" affordance that opens the delivery sheet hosting the PDP's exact
// check-delivery box.
package com.mishran.app.ui.cart

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.mishran.app.R
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.ui.product.DeliveryCheckSection
import com.mishran.app.ui.product.DeliveryCheckState
import com.mishran.app.util.buildWhatsAppUrl
import java.util.Locale

@Composable
fun CartScreen(
    onCheckout: () -> Unit,
    onBrowse: () -> Unit,
    onWhatsApp: (url: String) -> Unit = {},
    viewModel: CartViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val delivery by viewModel.delivery.collectAsState()
    val sheetPincode by viewModel.pincode.collectAsState()
    val sheetCheck by viewModel.deliveryCheck.collectAsState()
    var showDeliverySheet by remember { mutableStateOf(false) }

    if (state.isEmpty) {
        EmptyCart(onBrowse)
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(state.items, key = { it.productId }) { line ->
                CartLine(
                    line = line,
                    onIncrement = { viewModel.increment(line.productId, line.quantity) },
                    onDecrement = { viewModel.decrement(line.productId, line.quantity) },
                    onRemove = { viewModel.remove(line.productId) },
                )
            }
        }

        Surface(tonalElevation = 2.dp) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(stringResource(R.string.cart_estimated_total), style = MaterialTheme.typography.titleSmall)
                    Text(
                        text = formatPaise(state.estimatedTotalPaise) +
                            if (state.hasUnpricedLines) "+" else "",
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
                if (state.hasUnpricedLines) {
                    Text(
                        text = stringResource(R.string.cart_unpriced_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                DeliverySummary(
                    delivery = delivery,
                    onOpenCheck = { showDeliverySheet = true },
                )
                Button(
                    onClick = onCheckout,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) {
                    Text(stringResource(R.string.cart_checkout_items, state.itemCount))
                }
                OutlinedButton(
                    onClick = {
                        onWhatsApp(
                            buildWhatsAppUrl(
                                digits = viewModel.whatsappDigits.value,
                                message = buildCartWhatsAppMessage(
                                    items = state.items,
                                    totalLabel = formatPaise(state.estimatedTotalPaise) +
                                        if (state.hasUnpricedLines) "+" else "",
                                ),
                            ),
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.cart_whatsapp_send))
                }
                OutlinedButton(
                    onClick = viewModel::clear,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.cart_clear))
                }
            }
        }
    }

    if (showDeliverySheet) {
        CartDeliverySheet(
            pincode = sheetPincode,
            check = sheetCheck,
            onPincodeChange = viewModel::onPincodeChange,
            onCheck = viewModel::checkDelivery,
            onReset = viewModel::resetDeliveryCheck,
            onDismiss = { showDeliverySheet = false },
        )
    }
}

/**
 * The footer's delivery line (B9). Degraded (no pincode / estimate failure /
 * unserviceable pincode) → the no-pincode copy plus the "Check" affordance;
 * priced → the fee row (unlocked announced in the value slot) and, while
 * below the threshold, the add-more progress line.
 */
@Composable
private fun DeliverySummary(
    delivery: CartDeliveryUi,
    onOpenCheck: () -> Unit,
) {
    when (delivery) {
        CartDeliveryUi.AtCheckout -> Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.cart_delivery_at_checkout),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onOpenCheck) {
                Text(stringResource(R.string.product_delivery_check))
            }
        }
        is CartDeliveryUi.Priced -> Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(stringResource(R.string.cart_delivery_fee), style = MaterialTheme.typography.titleSmall)
                Text(
                    text = if (delivery.freeDeliveryEligible) {
                        stringResource(R.string.cart_free_delivery_unlocked)
                    } else {
                        formatPaise(delivery.feeInPaise.toLong())
                    },
                    style = MaterialTheme.typography.titleSmall,
                    color = if (delivery.freeDeliveryEligible) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                )
            }
            val progress = delivery.progress
            if (progress is CartProgress.Remaining) {
                Text(
                    text = stringResource(
                        R.string.cart_free_delivery_progress,
                        formatPaise(progress.paise.toLong()),
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

/**
 * The cart's delivery sheet (B9) — the PDP's check-delivery box verbatim, no
 * new pincode UI. Auto-dismisses once a check lands serviceable: the footer
 * behind it re-prices immediately with the fresh pincode.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun CartDeliverySheet(
    pincode: String,
    check: DeliveryCheckState,
    onPincodeChange: (String) -> Unit,
    onCheck: () -> Unit,
    onReset: () -> Unit,
    onDismiss: () -> Unit,
) {
    LaunchedEffect(check) {
        if (check is DeliveryCheckState.Serviceable) onDismiss()
    }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.padding(16.dp)) {
            DeliveryCheckSection(
                pincode = pincode,
                check = check,
                onPincodeChange = onPincodeChange,
                onCheck = onCheck,
                onReset = onReset,
            )
        }
    }
}

@Composable
private fun CartLine(
    line: CartItemEntity,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onRemove: () -> Unit,
) {
    Surface(
        tonalElevation = 1.dp,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (line.imageUrl != null) {
                AsyncImage(
                    model = line.imageUrl,
                    contentDescription = line.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(56.dp).clip(RoundedCornerShape(8.dp)),
                )
            } else {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.size(56.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = line.name.take(1),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = line.name,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                )
                line.displayPrice?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedIconButton(
                        onClick = onDecrement,
                        enabled = line.quantity > 1,
                        // No size override: OutlinedIconButton floors itself at
                        // the 48dp touch-target minimum (Task 12.4).
                    ) {
                        Icon(Icons.Filled.Remove, contentDescription = stringResource(R.string.cart_qty_decrease))
                    }
                    Text(
                        text = line.quantity.toString(),
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                    OutlinedIconButton(
                        onClick = onIncrement,
                    ) {
                        Icon(Icons.Filled.Add, contentDescription = stringResource(R.string.cart_qty_increase))
                    }
                }
            }
            IconButton(onClick = onRemove) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.cart_remove) + " ${line.name}")
            }
        }
    }
}

@Composable
private fun EmptyCart(onBrowse: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(
                imageVector = Icons.Filled.ShoppingBag,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(56.dp),
            )
            Text(
                text = stringResource(R.string.cart_empty),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
            )
            Button(onClick = onBrowse) { Text(stringResource(R.string.cart_empty_cta)) }
        }
    }
}

/** Paise → "₹1,234.50"-style label; whole rupees drop the decimals. */
internal fun formatPaise(paise: Long): String {
    val rupees = paise / 100
    val remainder = (paise % 100).toInt()
    val grouped = String.format(Locale.ENGLISH, "%,d", rupees)
    return if (remainder == 0) "₹$grouped" else "₹$grouped.${remainder.toString().padStart(2, '0')}"
}
