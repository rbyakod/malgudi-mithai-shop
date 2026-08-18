// apps/android/app/src/main/java/com/mishran/app/ui/cart/CartViewModel.kt — Task 10.1 / parity batch / B9.
//
// Cart state: live Room lines + locally computed totals, surfaced as one
// immutable CartUiState. Totals are estimates from displayPrice labels —
// checkout re-validates server-side and the snapshot wins. A one-shot
// `lineAdded` event gives the detail screen's CTA a confirmation signal.
//
// Parity batch: the WhatsApp order button's digits — the brand number from
// GET /brand (placeholder fallback), same pattern as the PDP's Ask row.
//
// B9 (cart estimates): whenever the cart contents settle, the ViewModel
// refetches the PUBLIC POST /cart/estimate with the persisted PDP
// delivery-check pincode (guests included). Success prices the footer's
// delivery row + free-delivery progress; failure, no pincode, or an
// unserviceable pincode all degrade to the same no-pincode copy — the
// estimate is decoration and never blocks checkout.
package com.mishran.app.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.CartEstimate
import com.mishran.api.models.Product
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.PLACEHOLDER_WHATSAPP_DIGITS
import com.mishran.app.data.repository.SettingsRepository
import com.mishran.app.data.repository.estimateTotalPaise
import com.mishran.app.data.repository.parsePaise
import com.mishran.app.ui.product.DeliveryCheckController
import com.mishran.app.ui.product.DeliveryCheckSnapshot
import com.mishran.app.ui.product.DeliveryCheckState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CartUiState(
    val items: List<CartItemEntity> = emptyList(),
    val itemCount: Int = 0,
    /** Estimated total in paise (0 when nothing is parseable). */
    val estimatedTotalPaise: Long = 0L,
    /** Any line whose price label carries no number — total is then partial. */
    val hasUnpricedLines: Boolean = false,
) {
    val isEmpty: Boolean get() = items.isEmpty()
}

/**
 * The footer's delivery line (B9). [AtCheckout] is the shared degraded shape —
 * no pincode, estimate failure, or an unserviceable pincode (the server then
 * answers a null tier) all render the same copy + check-delivery affordance.
 */
sealed interface CartDeliveryUi {
    data object AtCheckout : CartDeliveryUi

    /** Server-priced fee for the saved pincode, plus threshold progress. */
    data class Priced(
        val feeInPaise: Int,
        val freeDeliveryEligible: Boolean,
        val progress: CartProgress?,
    ) : CartDeliveryUi
}

/** Free-delivery threshold progress; null when the tier carries no threshold. */
sealed interface CartProgress {
    data object Unlocked : CartProgress

    /** Paise left to reach the threshold. */
    data class Remaining(val paise: Int) : CartProgress
}

/**
 * Threshold math in isolation: met-or-exceeded → [CartProgress.Unlocked],
 * otherwise the (positive) shortfall. Pure for direct unit testing.
 */
internal fun progressState(itemsTotalInPaise: Int, thresholdInPaise: Int): CartProgress =
    if (itemsTotalInPaise >= thresholdInPaise) {
        CartProgress.Unlocked
    } else {
        CartProgress.Remaining(thresholdInPaise - itemsTotalInPaise)
    }

/**
 * Server estimate → footer line. A null estimate, or one whose pincodeTier is
 * null (no / unserviceable pincode — the contract's "nothing to estimate
 * against"), keeps the no-pincode copy. The unlocked decision follows the
 * server's freeDeliveryEligible stamp (it also zeroes the fee).
 */
internal fun toDeliveryUi(estimate: CartEstimate?): CartDeliveryUi {
    if (estimate?.pincodeTier == null) return CartDeliveryUi.AtCheckout
    return CartDeliveryUi.Priced(
        feeInPaise = estimate.deliveryFeeInPaise,
        freeDeliveryEligible = estimate.freeDeliveryEligible,
        progress = when {
            estimate.freeDeliveryEligible -> CartProgress.Unlocked
            estimate.freeDeliveryThresholdInPaise != null -> progressState(
                itemsTotalInPaise = estimate.itemsTotalInPaise,
                thresholdInPaise = estimate.freeDeliveryThresholdInPaise,
            )
            else -> null
        },
    )
}

@HiltViewModel
class CartViewModel @Inject constructor(
    private val repository: CartRepository,
    brandRepository: BrandRepository,
    settingsRepository: SettingsRepository,
    addressRepository: AddressRepository,
) : ViewModel() {

    val state: StateFlow<CartUiState> = repository.observeItems()
        .map(::toUiState)
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            CartUiState(),
        )

    /**
     * wa.me digits for the order button: the brand number once /brand (or its
     * cache) answers, the placeholder until then — the button stays tappable.
     */
    private val _whatsappDigits = MutableStateFlow(PLACEHOLDER_WHATSAPP_DIGITS)
    val whatsappDigits: StateFlow<String> = _whatsappDigits.asStateFlow()

    // ---- Delivery estimate (B9) --------------------------------------------

    /** Latest server estimate; null until one lands (footer then degrades). */
    private val _estimate = MutableStateFlow<CartEstimate?>(null)
    val delivery: StateFlow<CartDeliveryUi> =
        _estimate.map(::toDeliveryUi).stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            CartDeliveryUi.AtCheckout,
        )

    /** Pincode the estimates price against — the persisted PDP check, if any. */
    private var estimatePincode: String? = null

    /** Cart snapshot the estimate flow last saw (the sheet refetch reuses it). */
    private var latestItems: List<CartItemEntity> = emptyList()

    /**
     * The cart's delivery sheet (B9) reuses the PDP's exact check-delivery
     * box: same controller, same serviceability call, same persistence — the
     * sheet is the footer affordance's host, not new pincode UI.
     */
    val deliveryCheckController = DeliveryCheckController(
        addressRepository = addressRepository,
        settingsRepository = settingsRepository,
        scope = viewModelScope,
    )

    /** The delivery sheet's pincode field + check state (controller-backed). */
    val pincode: StateFlow<String> = deliveryCheckController.pincode
    val deliveryCheck: StateFlow<DeliveryCheckState> = deliveryCheckController.deliveryCheck

    fun onPincodeChange(value: String) = deliveryCheckController.onPincodeChange(value)

    fun checkDelivery() = deliveryCheckController.checkDelivery()

    fun resetDeliveryCheck() = deliveryCheckController.resetDeliveryCheck()

    init {
        viewModelScope.launch {
            brandRepository.getSupportContact()?.let { _whatsappDigits.value = it.whatsappDigits }
        }
        viewModelScope.launch {
            // Pincode first — the estimate request needs it.
            estimatePincode =
                settingsRepository.deliveryCheck()?.let(DeliveryCheckSnapshot::decode)?.pincode
            repository.observeItems().collectLatest { items ->
                latestItems = items
                if (items.isEmpty()) {
                    _estimate.value = null
                } else {
                    // Debounce without FlowPreview: collectLatest cancels the
                    // in-flight block (and its delay) on the next emission, so
                    // stepper bursts coalesce into one estimate call.
                    delay(ESTIMATE_DEBOUNCE_MS)
                    _estimate.value = repository.estimate(items, estimatePincode)
                }
            }
        }
        viewModelScope.launch {
            // A check that lands in the cart's sheet (serviceable) re-prices
            // the footer immediately with the fresh pincode.
            deliveryCheckController.deliveryCheck.collect { check ->
                if (check is DeliveryCheckState.Serviceable && check.pincode != estimatePincode) {
                    estimatePincode = check.pincode
                    if (latestItems.isNotEmpty()) {
                        _estimate.value = repository.estimate(latestItems, estimatePincode)
                    }
                }
            }
        }
    }

    /** Fired once an add lands — the detail screen uses it to confirm + pop. */
    private val _lineAdded = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val lineAdded: SharedFlow<Unit> = _lineAdded

    fun add(product: Product, quantity: Int) {
        viewModelScope.launch {
            repository.add(product, quantity)
            _lineAdded.emit(Unit)
        }
    }

    fun increment(productId: String, current: Int) {
        viewModelScope.launch { repository.setQuantity(productId, current + 1) }
    }

    fun decrement(productId: String, current: Int) {
        // Floor at 1 — decrementing the last unit is what Remove is for.
        viewModelScope.launch { repository.setQuantity(productId, current - 1) }
    }

    fun setQuantity(productId: String, quantity: Int) {
        viewModelScope.launch { repository.setQuantity(productId, quantity) }
    }

    fun remove(productId: String) {
        viewModelScope.launch { repository.remove(productId) }
    }

    fun clear() {
        viewModelScope.launch { repository.clear() }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L

        /** Cart writes are user-paced; bursts settle within this window. */
        const val ESTIMATE_DEBOUNCE_MS = 400L
    }
}

/** Pure mapping — kept top-level so totals logic is directly unit-testable. */
internal fun toUiState(items: List<CartItemEntity>): CartUiState = CartUiState(
    items = items,
    itemCount = items.sumOf { it.quantity },
    estimatedTotalPaise = estimateTotalPaise(items),
    hasUnpricedLines = items.any { parsePaise(it.displayPrice) == null },
)

/**
 * "Send order on WhatsApp" prefill: one numbered line per cart line
 * ("1. Kaju Katli (500g) × 2 — ₹720 / 500g") plus the estimated total.
 * English-composed on purpose — it is a message to the shop, not UI chrome,
 * so it stays identical across app locales (the web's WhatsApp order composes
 * the same way). [totalLabel] arrives pre-formatted (formatPaise) because the
 * formatter lives with the screen.
 */
internal fun buildCartWhatsAppMessage(items: List<CartItemEntity>, totalLabel: String): String =
    buildString {
        appendLine("Hi Mishran! I'd like to order:")
        items.forEachIndexed { index, line ->
            val name = if (line.packLabel != null) "${line.name} (${line.packLabel})" else line.name
            val price = line.displayPrice.orEmpty()
            appendLine("${index + 1}. $name × ${line.quantity} — $price")
        }
        append("Total: $totalLabel")
    }
