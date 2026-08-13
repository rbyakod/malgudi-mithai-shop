// apps/android/app/src/main/java/com/mishran/app/ui/cart/CartViewModel.kt — Task 10.1.
//
// Cart state: live Room lines + locally computed totals, surfaced as one
// immutable CartUiState. Totals are estimates from displayPrice labels —
// checkout re-validates server-side and the snapshot wins. A one-shot
// `lineAdded` event gives the detail screen's CTA a confirmation signal.
package com.mishran.app.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.estimateTotalPaise
import com.mishran.app.data.repository.parsePaise
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
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
) : ViewModel() {

    val state: StateFlow<CartUiState> = repository.observeItems()
        .map(::toUiState)
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            CartUiState(),
        )

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
