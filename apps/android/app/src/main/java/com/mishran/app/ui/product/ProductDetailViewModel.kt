// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailViewModel.kt — Task 9.4 / 10.1 / P1 parity / parity batch.
//
// Detail-screen state: one-shot lookup (Room → network fallback → null) over
// the shared UiState lifecycle, plus the quantity stepper (floored at 1 —
// removing items is the cart's job, not the product page's). Since Task 10.1
// the Add-to-cart CTA writes the line into the Room cart and emits `added`
// once it lands — the screen turns that into navigation (pop back).
//
// P1 parity adds the two pack/buy seams:
//   - addToCart/buyNow take the SELECTED pack chip (null = no chips or base
//     pack) so the cart line keys itself and prices itself off the chip.
//   - buyNow is the one-shot flow: same cart write, then `bought` fires and
//     the screen navigates straight to checkout (no cart stop).
//
// Parity batch adds the two serviceability seams:
//   - "Check delivery": the same GET /catalog/serviceable the checkout uses
//     (via AddressRepository), exposed as a small state machine (Idle /
//     Checking / Result / NotServiceable / Invalid / Error). The last
//     successful check persists in DataStore and RESTORES on later PDP visits
//     without a refetch — the web's last-check memory.
//   - "Ask on WhatsApp": the brand digits from BrandRepository (placeholder
//     fallback handled there) + an English-composed product-facts message
//     built by a pure function so it is unit-testable.
package com.mishran.app.ui.product

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.PLACEHOLDER_WHATSAPP_DIGITS
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.data.repository.SettingsRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Lifecycle of the PDP "Check delivery" box. */
sealed interface DeliveryCheckState {
    /** No check yet (or reset via "Change") — the entry form shows. */
    data object Idle : DeliveryCheckState

    /** A check is in flight. */
    data object Checking : DeliveryCheckState

    /** The pincode is serviceable; tier drives the label + ETA wording. */
    data class Serviceable(
        val pincode: String,
        val tier: String,
        val city: String?,
        val slaDays: Int?,
    ) : DeliveryCheckState

    /** Reachable answer: this pincode is outside the network. */
    data class NotServiceable(val pincode: String) : DeliveryCheckState

    /** Client-side format rejection (not 6 digits) — no request goes out. */
    data object Invalid : DeliveryCheckState

    /** Transport/server failure — retryable via Check again. */
    data object Error : DeliveryCheckState
}

/**
 * What the delivery box remembers across PDP visits. Only SERVICEABLE results
 * persist — restoring "we don't deliver there" or a transient error would
 * present stale news as current, and the web's memory is the positive check.
 */
data class DeliveryCheckSnapshot(
    val pincode: String,
    val tier: String,
    val city: String?,
    val slaDays: Int?,
) {
    /**
     * Pipe-encode for the preferences DataStore: "pincode|tier|city|slaDays".
     * Tier values ("fresh"/"shelf") are fixed enums and cities in the
     * serviceability table carry no pipes, so the format is collision-free.
     */
    fun encode(): String = listOf(pincode, tier, city.orEmpty(), slaDays?.toString().orEmpty())
        .joinToString("|")

    companion object {
        /** Decode [encode]'s output; null when malformed (never crash on prefs). */
        fun decode(raw: String): DeliveryCheckSnapshot? {
            val parts = raw.split("|")
            if (parts.size != 4) return null
            if (parts[0].isEmpty() || parts[1].isEmpty()) return null
            return DeliveryCheckSnapshot(
                pincode = parts[0],
                tier = parts[1],
                city = parts[2].takeIf { it.isNotEmpty() },
                slaDays = parts[3].takeIf { it.isNotEmpty() }?.toIntOrNull(),
            )
        }
    }
}

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val repository: CatalogRepository,
    private val cartRepository: CartRepository,
    private val addressRepository: AddressRepository,
    private val settingsRepository: SettingsRepository,
    brandRepository: BrandRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Injected from the route — see Routes.PRODUCT ("product/{slug}"). */
    val slug: String = checkNotNull(savedStateHandle["slug"])

    private val _state = MutableStateFlow<UiState<Product>>(UiState.Loading)
    val state: StateFlow<UiState<Product>> = _state.asStateFlow()

    private val _quantity = MutableStateFlow(MIN_QUANTITY)
    val quantity: StateFlow<Int> = _quantity.asStateFlow()

    // ---- "Check delivery" (parity batch) ----------------------------------

    /** The pincode field's text; survives state transitions so "Change" keeps it. */
    private val _pincode = MutableStateFlow("")
    val pincode: StateFlow<String> = _pincode.asStateFlow()

    private val _deliveryCheck = MutableStateFlow<DeliveryCheckState>(DeliveryCheckState.Idle)
    val deliveryCheck: StateFlow<DeliveryCheckState> = _deliveryCheck.asStateFlow()

    /**
     * wa.me digits for the Ask row: the brand number when /brand (or its
     * cache) answers, the placeholder otherwise — the row is always tappable.
     */
    private val _whatsappDigits = MutableStateFlow(PLACEHOLDER_WHATSAPP_DIGITS)
    val whatsappDigits: StateFlow<String> = _whatsappDigits.asStateFlow()

    init {
        load()
        // Restore the last persisted check (no refetch — the web behavior):
        // the snapshot populates the field AND the result row together.
        viewModelScope.launch {
            val snapshot = settingsRepository.deliveryCheck()?.let(DeliveryCheckSnapshot::decode)
            if (snapshot != null) {
                _pincode.value = snapshot.pincode
                _deliveryCheck.value = DeliveryCheckState.Serviceable(
                    pincode = snapshot.pincode,
                    tier = snapshot.tier,
                    city = snapshot.city,
                    slaDays = snapshot.slaDays,
                )
            }
        }
        viewModelScope.launch {
            brandRepository.getSupportContact()?.let { _whatsappDigits.value = it.whatsappDigits }
        }
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            val product = repository.getProduct(slug)
            _state.value =
                if (product == null) UiState.Error("That sweet could not be found.")
                else UiState.Success(product)
        }
    }

    fun onPincodeChange(value: String) {
        _pincode.value = value.take(DELIVERY_PINCODE_MAX_DIGITS)
    }

    /**
     * Run the check. A malformed pincode flips to Invalid without a request;
     * a null response means offline or unreachable (Error), a serviceable
     * false means a real not-serviceable answer. Successes persist.
     */
    fun checkDelivery() {
        val candidate = _pincode.value.trim()
        if (!isServiceablePincode(candidate)) {
            _deliveryCheck.value = DeliveryCheckState.Invalid
            return
        }
        if (_deliveryCheck.value is DeliveryCheckState.Checking) return
        _deliveryCheck.value = DeliveryCheckState.Checking
        viewModelScope.launch {
            val response = try {
                addressRepository.checkServiceability(candidate)
            } catch (e: Exception) {
                null
            }
            _deliveryCheck.value = when {
                // The repository already collapses failures to null; the try
                // is belt-and-braces so this state machine never throws.
                response == null -> DeliveryCheckState.Error
                response.serviceable -> DeliveryCheckState.Serviceable(
                    pincode = candidate,
                    tier = response.tier.orEmpty(),
                    city = response.city,
                    slaDays = response.slaDays,
                )
                else -> DeliveryCheckState.NotServiceable(candidate)
            }
            val serviceable = _deliveryCheck.value as? DeliveryCheckState.Serviceable
            if (serviceable != null) {
                settingsRepository.setDeliveryCheck(
                    DeliveryCheckSnapshot(
                        pincode = serviceable.pincode,
                        tier = serviceable.tier,
                        city = serviceable.city,
                        slaDays = serviceable.slaDays,
                    ).encode(),
                )
            }
        }
    }

    /** "Change": back to the entry form, pincode kept for editing. */
    fun resetDeliveryCheck() {
        _deliveryCheck.value = DeliveryCheckState.Idle
    }

    fun incrementQuantity() {
        _quantity.value = (_quantity.value + 1).coerceAtMost(MAX_QUANTITY)
    }

    fun decrementQuantity() {
        _quantity.value = (_quantity.value - 1).coerceAtLeast(MIN_QUANTITY)
    }

    /**
     * Write the current (product, quantity, pack) into the cart; emits [added]
     * on landing. [pack] is the selected PDP chip, null when the product
     * offers none — the repository owns the pack → line-id rule.
     */
    fun addToCart(pack: PackSize? = null) {
        val current = _state.value as? UiState.Success<Product> ?: return
        viewModelScope.launch {
            cartRepository.add(current.data, _quantity.value, pack)
            _added.emit(Unit)
        }
    }

    /**
     * One-shot buy: the same cart write as [addToCart], then [bought] fires so
     * the screen skips the cart and navigates straight to checkout.
     */
    fun buyNow(pack: PackSize? = null) {
        val current = _state.value as? UiState.Success<Product> ?: return
        viewModelScope.launch {
            cartRepository.add(current.data, _quantity.value, pack)
            _bought.emit(Unit)
        }
    }

    private val _added = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Fired once the cart write lands — the screen pops back on this. */
    val added: SharedFlow<Unit> = _added

    private val _bought = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Fired once the buy-now cart write lands — the screen goes to checkout. */
    val bought: SharedFlow<Unit> = _bought

    private companion object {
        const val MIN_QUANTITY = 1
        // Backstop, not a product rule — the server re-validates at checkout.
        const val MAX_QUANTITY = 20

        /** The pincode field accepts exactly this many digits. */
        const val DELIVERY_PINCODE_MAX_DIGITS = 6
    }
}

/**
 * Indian pincodes: exactly 6 digits, first non-zero — the same rule checkout
 * applies (restated locally so the PDP's box does not import checkout's
 * internals for one regex).
 */
internal fun isServiceablePincode(pincode: String): Boolean =
    Regex("[1-9]\\d{5}").matches(pincode)

/**
 * The delivery result line's ETA segment: "same-day" for the fresh tier (the
 * localized label arrives as a parameter — resources are composable-only),
 * "<n> days" from the SLA otherwise, empty when the SLA is unknown.
 */
internal fun deliveryDaysLabel(tier: String, slaDays: Int?, sameDayLabel: String): String = when {
    tier == TIER_FRESH -> sameDayLabel
    slaDays != null -> "$slaDays days"
    else -> ""
}

/** The fresh tier's wire value — mirrors checkout's TIER_FRESH. */
internal const val TIER_FRESH = "fresh"

/**
 * The "Ask on WhatsApp" prefill: plain English product facts (name, selected
 * pack + its price line, quantity) so it reads the same in every locale — the
 * shop replies in whatever language the customer used to open the chat.
 */
internal fun buildProductWhatsAppMessage(
    product: Product,
    pack: PackSize?,
    quantity: Int,
): String = buildString {
    appendLine("Hi Mishran! Quick question about this sweet:")
    appendLine(product.name)
    pack?.let { appendLine("${it.label} · ${it.priceLabel}") }
        ?: product.displayPrice?.let { appendLine(it) }
    append("Quantity: $quantity")
}
