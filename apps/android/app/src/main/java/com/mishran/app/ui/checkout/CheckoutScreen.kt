// apps/android/app/src/main/java/com/mishran/app/ui/checkout/CheckoutScreen.kt — Tasks 10.2/10.3.
//
// Checkout composition: address picker (with serviceability readout), slot
// picker (fresh tier only), payment method picker, and the place-order CTA.
// The CTA is disabled until an address is serviceable and — on the fresh
// tier — a slot is picked. Placing the order runs validate → create-order →
// Razorpay sheet (via the [RazorpayLauncher] seam) → verify; one-shot events
// drive navigation ([CheckoutEvent.OrderPlaced]) and snackbars.
package com.mishran.app.ui.checkout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.api.models.Address
import com.mishran.app.ui.checkout.components.AddressPicker
import com.mishran.app.ui.checkout.components.PaymentMethodPicker
import com.mishran.app.ui.checkout.components.SlotPicker
import com.mishran.app.util.RazorpayLaunchOptions
import com.mishran.app.util.RazorpayLauncher
import com.mishran.app.util.RazorpaySdkLauncher

@Composable
fun CheckoutScreen(
    onOrderPlaced: (orderId: String) -> Unit,
    viewModel: CheckoutViewModel = hiltViewModel(),
    razorpayLauncher: RazorpayLauncher = RazorpaySdkLauncher(),
) {
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    // One-shot events: open the sheet, navigate, or surface a failure message.
    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is CheckoutEvent.OpenPayment -> {
                    val activity = context.findActivity()
                    if (activity != null) {
                        razorpayLauncher.launch(
                            activity,
                            RazorpayLaunchOptions(
                                keyId = event.request.keyId,
                                razorpayOrderId = event.request.razorpayOrderId,
                                amountInPaise = event.request.amountInPaise,
                            ),
                            viewModel::onRazorpayOutcome,
                        )
                    } else {
                        snackbarHostState.showSnackbar("Couldn't open the payment sheet.")
                    }
                }
                is CheckoutEvent.OrderPlaced -> onOrderPlaced(event.orderId)
                is CheckoutEvent.CartChanged -> snackbarHostState.showSnackbar(
                    event.message ?: "Your cart changed — please review it and try again.",
                )
                is CheckoutEvent.PaymentFailed -> snackbarHostState.showSnackbar(
                    event.message ?: "Payment failed. If money was deducted it will be refunded within 5-7 days.",
                )
                is CheckoutEvent.Failed -> snackbarHostState.showSnackbar(
                    event.message ?: "Something went wrong — please try again.",
                )
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        CheckoutContent(
            state = state,
            placingOrder = viewModel.placingOrder.value,
            onSelectAddress = viewModel::selectAddress,
            onSelectSlot = viewModel::selectSlot,
            onSelectPaymentMethod = viewModel::selectPaymentMethod,
            onPlaceOrder = viewModel::placeOrder,
            modifier = Modifier.padding(padding),
        )
    }
}

@Composable
private fun CheckoutContent(
    state: CheckoutUiState,
    placingOrder: Boolean,
    onSelectAddress: (Address) -> Unit,
    onSelectSlot: (SlotOption) -> Unit,
    onSelectPaymentMethod: (PaymentMethod) -> Unit,
    onPlaceOrder: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Text("Checkout", style = MaterialTheme.typography.headlineSmall)

        AddressPicker(
            addresses = state.addresses,
            selected = state.selectedAddress,
            serviceability = state.serviceability,
            onSelect = onSelectAddress,
        )

        SlotPicker(
            options = state.slotOptions,
            selected = state.selectedSlot,
            onSelect = onSelectSlot,
        )

        PaymentMethodPicker(
            selected = state.paymentMethod,
            onSelect = onSelectPaymentMethod,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Button(
            onClick = onPlaceOrder,
            enabled = state.canPlaceOrder && !placingOrder,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(
                text = when {
                    state.selectedAddress == null -> "Select a delivery address"
                    state.serviceability is ServiceabilityState.Checking -> "Checking delivery…"
                    state.isFreshTier && state.selectedSlot == null -> "Pick a delivery slot"
                    else -> "Place order"
                },
            )
        }

        if (state.serviceability is ServiceabilityState.NotServiceable) {
            Text(
                text = "Payment is collected only after the order is confirmed.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Unwrap the nearest Activity from a Compose context (single-activity app). */
private tailrec fun android.content.Context.findActivity(): android.app.Activity? =
    when (this) {
        is android.app.Activity -> this
        is android.content.ContextWrapper -> baseContext.findActivity()
        else -> null
    }
