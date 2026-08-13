// apps/android/app/src/main/java/com/mishran/app/ui/checkout/CheckoutScreen.kt — Task 10.2.
//
// Checkout composition: address picker (with serviceability readout), slot
// picker (fresh tier only), payment method picker, and the place-order CTA.
// The CTA is disabled until an address is serviceable and — on the fresh
// tier — a slot is picked. Placing the order (validate → create → Razorpay)
// is Task 10.3; the callback below is where it plugs in.
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.app.ui.checkout.components.AddressPicker
import com.mishran.app.ui.checkout.components.PaymentMethodPicker
import com.mishran.app.ui.checkout.components.SlotPicker

@Composable
fun CheckoutScreen(
    onPlaceOrder: () -> Unit,
    viewModel: CheckoutViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
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
            onSelect = viewModel::selectAddress,
        )

        SlotPicker(
            options = state.slotOptions,
            selected = state.selectedSlot,
            onSelect = viewModel::selectSlot,
        )

        PaymentMethodPicker(
            selected = state.paymentMethod,
            onSelect = viewModel::selectPaymentMethod,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Button(
            onClick = onPlaceOrder,
            enabled = state.canPlaceOrder,
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
