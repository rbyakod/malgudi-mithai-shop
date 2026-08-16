// apps/android/app/src/main/java/com/mishran/app/ui/cart/CartViewModel.kt — Task 10.1 / parity batch.
//
// Cart state: live Room lines + locally computed totals, surfaced as one
// immutable CartUiState. Totals are estimates from displayPrice labels —
// checkout re-validates server-side and the snapshot wins. A one-shot
// `lineAdded` event gives the detail screen's CTA a confirmation signal.
//
// Parity batch: the WhatsApp order button's digits — the brand number from
// GET /brand (placeholder fallback), same pattern as the PDP's Ask row.
package com.mishran.app.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.PLACEHOLDER_WHATSAPP_DIGITS
import com.mishran.app.data.repository.estimateTotalPaise
import com.mishran.app.data.repository.parsePaise
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

@HiltViewModel
class CartViewModel @Inject constructor(
    private val repository: CartRepository,
    brandRepository: BrandRepository,
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

    init {
        viewModelScope.launch {
            brandRepository.getSupportContact()?.let { _whatsappDigits.value = it.whatsappDigits }
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
