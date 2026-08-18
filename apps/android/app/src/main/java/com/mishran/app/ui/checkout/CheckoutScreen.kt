// apps/android/app/src/main/java/com/mishran/app/ui/checkout/CheckoutScreen.kt — Tasks 10.2/10.3.
//
// Checkout composition: address picker (with serviceability readout), slot
// picker (fresh tier only), payment method picker, coupon entry (apply/
// remove re-validate so totals stay server-priced), and the place-order CTA.
// The CTA is disabled until an address is serviceable and — on the fresh
// tier — a slot is picked. Placing the order runs validate → create-order →
// Razorpay sheet (via the [RazorpayLauncher] seam) → verify; one-shot events
// drive navigation ([CheckoutEvent.OrderPlaced]) and snackbars.
package com.mishran.app.ui.checkout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.api.models.Address
import com.mishran.app.R
import com.mishran.app.ui.checkout.components.AddressPicker
import com.mishran.app.ui.checkout.components.PaymentMethodPicker
import com.mishran.app.ui.checkout.components.SlotPicker
import com.mishran.app.ui.cart.formatPaise
import com.mishran.app.util.RazorpayLaunchOptions
import com.mishran.app.util.RazorpayLauncher
import com.mishran.app.util.RazorpaySdkLauncher

@Composable
fun CheckoutScreen(
    /**
     * Order placed + verified. Carries the ETA extras (Task 10.4) so the
     * NavGraph can hand them to the confirmation screen: the picked slot's
     * label (fresh tier) or the SLA in days (shelf tier, no slot).
     */
    onOrderPlaced: (orderId: String, slotLabel: String?, shelfSlaDays: Int?) -> Unit,
    viewModel: CheckoutViewModel = hiltViewModel(),
    razorpayLauncher: RazorpayLauncher = RazorpaySdkLauncher(),
) {
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    // Snackbar fallbacks resolved up front — the events collector below runs
    // in a coroutine, where stringResource() is not callable.
    val cartChangedMessage = stringResource(R.string.checkout_error_cart_changed)
    val paymentFailedMessage = stringResource(R.string.checkout_error_payment_failed)
    val paymentSheetMessage = stringResource(R.string.checkout_error_payment_sheet)
    val genericMessage = stringResource(R.string.checkout_error_generic)

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
                        snackbarHostState.showSnackbar(paymentSheetMessage)
                    }
                }
                is CheckoutEvent.OrderPlaced -> onOrderPlaced(
                    event.orderId,
                    event.slotLabel,
                    event.shelfSlaDays,
                )
                is CheckoutEvent.CartChanged -> snackbarHostState.showSnackbar(
                    event.message ?: cartChangedMessage,
                )
                is CheckoutEvent.CouponApplied -> snackbarHostState.showSnackbar(
                    // Parameterized resource — context.getString works in the
                    // coroutine where stringResource() does not.
                    context.getString(R.string.checkout_coupon_applied, event.code),
                )
                is CheckoutEvent.PaymentFailed -> snackbarHostState.showSnackbar(
                    event.message ?: paymentFailedMessage,
                )
                is CheckoutEvent.Failed -> snackbarHostState.showSnackbar(
                    event.message ?: genericMessage,
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
            onCouponInputChange = viewModel::updateCouponInput,
            onApplyCoupon = viewModel::applyCoupon,
            onRemoveCoupon = viewModel::removeCoupon,
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
    onCouponInputChange: (String) -> Unit,
    onApplyCoupon: () -> Unit,
    onRemoveCoupon: () -> Unit,
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
        Text(
            stringResource(R.string.checkout_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() },
        )

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

        CouponSection(
            input = state.couponInput,
            appliedCoupon = state.appliedCoupon,
            invalid = state.couponInvalid,
            errorDetail = state.couponErrorDetail,
            discountInPaise = state.discountInPaise,
            busy = state.validatingCoupon,
            onInputChange = onCouponInputChange,
            onApply = onApplyCoupon,
            onRemove = onRemoveCoupon,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Button(
            onClick = onPlaceOrder,
            enabled = state.canPlaceOrder && !placingOrder,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(
                text = when {
                    state.selectedAddress == null -> stringResource(R.string.checkout_cta_select_address)
                    state.serviceability is ServiceabilityState.Checking -> stringResource(R.string.checkout_cta_checking)
                    state.isFreshTier && state.selectedSlot == null -> stringResource(R.string.checkout_cta_pick_slot)
                    else -> stringResource(R.string.checkout_cta_place_order)
                },
            )
        }

        if (state.serviceability is ServiceabilityState.NotServiceable) {
            Text(
                text = stringResource(R.string.checkout_payment_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * Coupon entry + summary, just above the CTA. Empty state: a compact code
 * field with an Apply button; applied: the server-normalized code in a chip
 * with a Remove button. A rejected code shows the inline error (plus the
 * server's detail when sent) but never blocks the CTA, and a server-priced
 * discount renders as a −₹ row in the order-detail totals-row style.
 */
@Composable
private fun CouponSection(
    input: String,
    appliedCoupon: String?,
    invalid: Boolean,
    errorDetail: String?,
    discountInPaise: Int,
    busy: Boolean,
    onInputChange: (String) -> Unit,
    onApply: () -> Unit,
    onRemove: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.checkout_coupon_label),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        if (appliedCoupon == null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = onInputChange,
                    placeholder = { Text(stringResource(R.string.checkout_coupon_placeholder)) },
                    singleLine = true,
                    isError = invalid,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                )
                Button(onClick = onApply, enabled = input.isNotBlank() && !busy) {
                    Text(stringResource(R.string.checkout_coupon_apply))
                }
            }
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = MaterialTheme.colorScheme.secondaryContainer,
                ) {
                    Text(
                        text = appliedCoupon,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
                TextButton(onClick = onRemove, enabled = !busy) {
                    Text(stringResource(R.string.checkout_coupon_remove))
                }
            }
        }
        if (invalid) {
            Text(
                text = stringResource(R.string.checkout_coupon_invalid) +
                    errorDetail?.let { " $it" }.orEmpty(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        }
        if (discountInPaise > 0) {
            // Same shape as the order-detail totals rows: muted label, muted amount.
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.checkout_coupon_discount),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "−" + formatPaise(discountInPaise.toLong()),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
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
