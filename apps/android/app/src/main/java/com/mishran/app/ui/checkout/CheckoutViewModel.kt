// apps/android/app/src/main/java/com/mishran/app/ui/checkout/CheckoutViewModel.kt — Task 10.2.
//
// Checkout state: saved addresses + serviceability of the selected pincode
// (tier drives the slot picker), delivery slot, payment method. Slots exist
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
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.domain.usecase.CreateOrderResult
import com.mishran.app.domain.usecase.PaymentRequest
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
enum class PaymentMethod(val label: String) {
    UPI("UPI"),
    CARD("Card"),
    NETBANKING("Netbanking"),
    WALLET("Wallet"),
}

data class CheckoutUiState(
    val addresses: List<Address> = emptyList(),
    val selectedAddress: Address? = null,
    val serviceability: ServiceabilityState = ServiceabilityState.Unknown,
    /** Slot options — populated only for the fresh tier. */
    val slotOptions: List<SlotOption> = emptyList(),
    val selectedSlot: SlotOption? = null,
    val paymentMethod: PaymentMethod = PaymentMethod.UPI,
) {
    val isFreshTier: Boolean
        get() = (serviceability as? ServiceabilityState.Serviceable)?.tier == TIER_FRESH

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

    data class OrderPlaced(val orderId: String) : CheckoutEvent

    data class CartChanged(val message: String?) : CheckoutEvent

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
                    selectedAddress = stillThere ?: addresses.firstOrNull(),
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
            )) {
                is CreateOrderResult.NeedsPayment -> {
                    pendingRequest = result.request
                    _events.emit(CheckoutEvent.OpenPayment(result.request))
                }
                is CreateOrderResult.CartChanged ->
                    _events.emit(CheckoutEvent.CartChanged(result.message))
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
                        _events.emit(CheckoutEvent.OrderPlaced(result.orderId))
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
