// apps/android/app/src/main/java/com/mishran/app/ui/checkout/CheckoutViewModel.kt — Task 10.2.
//
// Checkout state: saved addresses + serviceability of the selected pincode
// (tier drives the slot picker), delivery slot, payment method, and the
// applied coupon (B8: apply/remove re-validate the cart so totals — and the
// discount row — are always server-priced; the code rides along on every
// later validate until removed or rejected). Slots exist
// only for the fresh tier (Delhi NCR same-day network); shelf-tier metros
// ship on the standard SLA so the picker stays hidden. Pure helpers
// (buildSlotOptions, formatAddressLine, pincode validation) are extracted for
// JVM tests. Placing the order is Task 10.3's PlaceOrderUseCase.
package com.mishran.app.ui.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Address
import com.mishran.api.models.CartValidateRequestSlot
import com.mishran.api.models.ServiceableResponse
import com.mishran.app.R
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.domain.usecase.CreateOrderResult
import com.mishran.app.domain.usecase.PaymentRequest
import com.mishran.app.domain.usecase.ValidateCouponResult
import com.mishran.app.domain.usecase.PlaceOrderResult
import com.mishran.app.domain.usecase.PlaceOrderUseCase
import com.mishran.app.util.RazorpayOutcome
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Pincode serviceability of the currently selected address. */
sealed interface ServiceabilityState {
    data object Unknown : ServiceabilityState
    data object Checking : ServiceabilityState
    data class Serviceable(
        val tier: String,
        val city: String?,
        val slaDays: Int?,
    ) : ServiceabilityState

    data class NotServiceable(val reason: String?) : ServiceabilityState
}

/** Payment channel selection — Razorpay renders the actual sheet. */
/** Label resource per method — resolved with stringResource() at the use site. */
enum class PaymentMethod(@androidx.annotation.StringRes val labelRes: Int) {
    UPI(R.string.checkout_payment_upi),
    CARD(R.string.checkout_payment_card),
    NETBANKING(R.string.checkout_payment_netbanking),
    WALLET(R.string.checkout_payment_wallet),
}

data class CheckoutUiState(
    val addresses: List<Address> = emptyList(),
    val selectedAddress: Address? = null,
    val serviceability: ServiceabilityState = ServiceabilityState.Unknown,
    /** Slot options — populated only for the fresh tier. */
    val slotOptions: List<SlotOption> = emptyList(),
    val selectedSlot: SlotOption? = null,
    val paymentMethod: PaymentMethod = PaymentMethod.UPI,
    /** Coupon being typed — uppercased and capped at [CheckoutViewModel.COUPON_MAX_LENGTH]. */
    val couponInput: String = "",
    /** The code the server accepted on the last validate; null when none is applied. */
    val appliedCoupon: String? = null,
    /** True after an INVALID_COUPON response — drives the inline field error. */
    val couponInvalid: Boolean = false,
    /** Server detail for the rejection (e.g. "Coupon EXPIRED5 has expired"), when sent. */
    val couponErrorDetail: String? = null,
    /** Discount folded into the last server-priced totals — drives the −₹ row. */
    val discountInPaise: Int = 0,
    /** A coupon validate is in flight (apply or remove). */
    val validatingCoupon: Boolean = false,
) {
    val isFreshTier: Boolean
        get() = (serviceability as? ServiceabilityState.Serviceable)?.tier == CheckoutViewModel.TIER_FRESH

    /** Address chosen, serviceable, and (fresh tier) a slot picked. */
    val canPlaceOrder: Boolean
        get() = selectedAddress != null &&
            serviceability is ServiceabilityState.Serviceable &&
            (!isFreshTier || selectedSlot != null)
}

data class SlotOption(val date: String, val window: String, val label: String)

/** One-shot checkout events the screen turns into navigation + toasts. */
sealed interface CheckoutEvent {
    /** Open the Razorpay sheet for this request. */
    data class OpenPayment(val request: PaymentRequest) : CheckoutEvent

    /**
     * Order verified + placed. The ETA extras ride along (Task 10.4): the
     * picked slot's label on the fresh tier, or the serviceability SLA in
     * days for shelf-tier orders where no slot exists. The confirmation
     * screen prefers the slot label and falls back to the SLA.
     */
    data class OrderPlaced(
        val orderId: String,
        val slotLabel: String? = null,
        val shelfSlaDays: Int? = null,
    ) : CheckoutEvent

    data class CartChanged(val message: String?) : CheckoutEvent

    /** The coupon code was accepted — toast it (the chip is the durable signal). */
    data class CouponApplied(val code: String) : CheckoutEvent

    data class PaymentFailed(val message: String?) : CheckoutEvent

    data class Failed(val message: String?) : CheckoutEvent
}

@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val addressRepository: AddressRepository,
    private val cartRepository: CartRepository,
    private val placeOrder: PlaceOrderUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(CheckoutUiState())
    val state: StateFlow<CheckoutUiState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<CheckoutEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<CheckoutEvent> = _events

    /** The in-flight payment — kept so the Razorpay outcome finds its context. */
    private var pendingRequest: PaymentRequest? = null

    val placingOrder = MutableStateFlow(false)

    init {
        refreshAddresses()
    }

    fun refreshAddresses() {
        viewModelScope.launch {
            val addresses = addressRepository.listAddresses()
            _state.update { state ->
                // Keep the selection if it still exists; else take the default/first.
                val stillThere = state.selectedAddress
                    ?.let { selected -> addresses.firstOrNull { it.id == selected.id } }
                state.copy(
                    addresses = addresses,
                    // Prefer the flagged default; else the first listed.
                    selectedAddress = stillThere
                        ?: addresses.firstOrNull { it.isDefault == true }
                        ?: addresses.firstOrNull(),
                )
            }
            _state.value.selectedAddress?.let { checkServiceability(it) }
        }
    }

    fun selectAddress(address: Address) {
        _state.update {
            it.copy(
                selectedAddress = address,
                serviceability = ServiceabilityState.Checking,
                // Slot options are tier-dependent; reset until the check lands.
                slotOptions = emptyList(),
                selectedSlot = null,
            )
        }
        checkServiceability(address)
    }

    fun selectSlot(option: SlotOption) {
        _state.update { it.copy(selectedSlot = option) }
    }

    fun selectPaymentMethod(method: PaymentMethod) {
        _state.update { it.copy(paymentMethod = method) }
    }

    /** Edit the coupon field — uppercased as typed, capped at 40 characters. */
    fun updateCouponInput(raw: String) {
        _state.update {
            it.copy(
                couponInput = raw.take(COUPON_MAX_LENGTH).uppercase(),
                couponInvalid = false,
                couponErrorDetail = null,
            )
        }
    }

    /** Validate WITH the typed code — totals come back server-priced. */
    fun applyCoupon() {
        val current = _state.value
        val code = current.couponInput.trim()
        if (code.isEmpty() || current.validatingCoupon) return
        validateCouponWith(code)
    }

    /** Drop the applied code and re-validate WITHOUT it so totals lose the discount. */
    fun removeCoupon() {
        val current = _state.value
        if (current.appliedCoupon == null || current.validatingCoupon) return
        // The chip disappears immediately; validate is stateless server-side,
        // so the code outlives nothing even if the refresh call below fails.
        _state.update {
            it.copy(
                appliedCoupon = null,
                couponInput = "",
                couponInvalid = false,
                couponErrorDetail = null,
                discountInPaise = 0,
            )
        }
        validateCouponWith(null)
    }

    /**
     * The coupon field's validate leg. The code rides on every validate —
     * apply, remove, and later placeOrder() — until removed or rejected, so
     * totals always reflect what the customer will actually pay.
     */
    private fun validateCouponWith(code: String?) {
        val address = _state.value.selectedAddress ?: return
        _state.update { it.copy(validatingCoupon = true) }
        viewModelScope.launch {
            val items = cartRepository.observeItems().first()
            val slot = _state.value.selectedSlot?.let {
                CartValidateRequestSlot(date = it.date, window = it.window)
            }
            when (
                val result = placeOrder.validateCoupon(
                    items = items,
                    pincode = address.pincode.orEmpty(),
                    slot = slot,
                    couponCode = code,
                )
            ) {
                is ValidateCouponResult.Validated -> {
                    val applied = result.snapshot.couponCode
                    _state.update {
                        it.copy(
                            appliedCoupon = applied,
                            couponInput = applied.orEmpty(),
                            couponInvalid = false,
                            couponErrorDetail = null,
                            discountInPaise = result.snapshot.totals.discountInPaise,
                        )
                    }
                    applied?.let { accepted -> _events.emit(CheckoutEvent.CouponApplied(accepted)) }
                }
                is ValidateCouponResult.InvalidCoupon -> _state.update {
                    // Keep the last good totals, clear the applied code, and
                    // leave the CTA alone — an unusable code never blocks checkout.
                    it.copy(
                        appliedCoupon = null,
                        couponInvalid = true,
                        couponErrorDetail = result.message,
                    )
                }
                is ValidateCouponResult.Failure ->
                    _events.tryEmit(CheckoutEvent.Failed(result.message))
            }
            _state.update { it.copy(validatingCoupon = false) }
        }
    }

    /** Validate the cart + mint the order; the sheet opens on [CheckoutEvent.OpenPayment]. */
    fun placeOrder() {
        val current = _state.value
        val address = current.selectedAddress ?: return
        val addressId = address.id ?: return
        if (!current.canPlaceOrder) return
        if (placingOrder.value) return // one transaction at a time

        placingOrder.value = true
        viewModelScope.launch {
            val items = cartRepository.observeItems().first()
            val slot = current.selectedSlot?.let {
                CartValidateRequestSlot(date = it.date, window = it.window)
            }
            when (val result = placeOrder.createPaymentRequest(
                items = items,
                pincode = address.pincode.orEmpty(),
                deliveryAddressId = addressId,
                slot = slot,
                couponCode = current.appliedCoupon,
            )) {
                is CreateOrderResult.NeedsPayment -> {
                    pendingRequest = result.request
                    _events.emit(CheckoutEvent.OpenPayment(result.request))
                }
                is CreateOrderResult.CartChanged ->
                    _events.emit(CheckoutEvent.CartChanged(result.message))
                is CreateOrderResult.CouponRejected -> {
                    // The applied code died between apply and pay — drop it
                    // (and its discount row) and let the customer retry.
                    _state.update {
                        it.copy(
                            appliedCoupon = null,
                            couponInvalid = true,
                            couponErrorDetail = result.message,
                            discountInPaise = 0,
                        )
                    }
                    _events.emit(CheckoutEvent.Failed(result.message))
                }
                is CreateOrderResult.Failure ->
                    _events.emit(CheckoutEvent.Failed(result.message))
            }
            placingOrder.value = false
        }
    }

    /** Razorpay outcome landed — verify the signature (or surface the failure). */
    fun onRazorpayOutcome(outcome: RazorpayOutcome) {
        val request = pendingRequest ?: return
        when (outcome) {
            is RazorpayOutcome.Success -> viewModelScope.launch {
                val result = placeOrder.verifyPayment(
                    request = request,
                    razorpayPaymentId = outcome.razorpayPaymentId,
                    signature = outcome.signature,
                )
                when (result) {
                    is PlaceOrderResult.Success -> {
                        pendingRequest = null
                        cartRepository.clear()
                        // Snapshot the ETA inputs at place time — fresh tier
                        // carries the picked slot, shelf only the SLA days.
                        val current = _state.value
                        _events.emit(
                            CheckoutEvent.OrderPlaced(
                                orderId = result.orderId,
                                slotLabel = current.selectedSlot?.label,
                                shelfSlaDays = (current.serviceability
                                    as? ServiceabilityState.Serviceable)?.slaDays,
                            ),
                        )
                    }
                    is PlaceOrderResult.PaymentFailed ->
                        _events.emit(CheckoutEvent.PaymentFailed(result.message))
                    is PlaceOrderResult.Failure ->
                        _events.emit(CheckoutEvent.Failed(result.message))
                }
            }
            is RazorpayOutcome.Failed ->
                _events.tryEmit(
                    CheckoutEvent.PaymentFailed(
                        outcome.description ?: "Payment failed. If money was deducted it will be refunded within 5-7 days.",
                    ),
                )
            RazorpayOutcome.Dismissed -> Unit // user backed out; nothing moved
        }
    }

    private fun checkServiceability(address: Address) {
        val pincode = address.pincode
        if (pincode == null || !isValidPincode(pincode)) {
            _state.update {
                it.copy(serviceability = ServiceabilityState.NotServiceable("invalid_pincode"))
            }
            return
        }
        viewModelScope.launch {
            val response: ServiceableResponse? = addressRepository.checkServiceability(pincode)
            _state.update { state ->
                // Guard against a stale response racing a newer selection.
                if (state.selectedAddress?.id != address.id) return@update state
                val serviceability = when {
                    response == null -> ServiceabilityState.NotServiceable(null)
                    response.serviceable -> ServiceabilityState.Serviceable(
                        tier = response.tier.orEmpty(),
                        city = response.city,
                        slaDays = response.slaDays,
                    )
                    else -> ServiceabilityState.NotServiceable(response.reason)
                }
                val tier = (serviceability as? ServiceabilityState.Serviceable)?.tier
                state.copy(
                    serviceability = serviceability,
                    slotOptions = if (tier == TIER_FRESH) {
                        buildSlotOptions(LocalDate.now())
                    } else {
                        emptyList()
                    },
                    selectedSlot = null,
                )
            }
        }
    }

    companion object {
        const val TIER_FRESH = "fresh"
        const val TIER_SHELF = "shelf"
        const val WINDOW_MORNING = "10:00-14:00"
        const val WINDOW_EVENING = "16:00-20:00"

        /** Coupon-code length cap (server contract trims at 40). */
        const val COUPON_MAX_LENGTH = 40
    }
}

/** Indian pincodes: exactly 6 digits, first non-zero. */
internal fun isValidPincode(pincode: String): Boolean =
    Regex("[1-9]\\d{5}").matches(pincode)

/**
 * Fresh-tier delivery slots: today + tomorrow, morning + evening windows.
 * Takes `today` as a parameter so tests pin the clock.
 */
internal fun buildSlotOptions(today: LocalDate): List<SlotOption> {
    val dayLabel = DateTimeFormatter.ofPattern("d MMM")
    return listOf(0L, 1L).flatMap { offset ->
        val date = today.plusDays(offset)
        val day = if (offset == 0L) "Today" else "Tomorrow"
        listOf(
            SlotOption(
                date = date.toString(),
                window = CheckoutViewModel.WINDOW_MORNING,
                label = "$day ${date.format(dayLabel)}, ${CheckoutViewModel.WINDOW_MORNING}",
            ),
            SlotOption(
                date = date.toString(),
                window = CheckoutViewModel.WINDOW_EVENING,
                label = "$day ${date.format(dayLabel)}, ${CheckoutViewModel.WINDOW_EVENING}",
            ),
        )
    }
}

/** One-line rendering of an address for picker rows. */
internal fun formatAddressLine(address: Address): String {
    val parts = listOfNotNull(
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.pincode,
    )
    return parts.joinToString(", ")
}
