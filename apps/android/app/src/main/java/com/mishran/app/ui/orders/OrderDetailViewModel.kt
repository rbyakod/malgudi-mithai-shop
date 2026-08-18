// apps/android/app/src/main/java/com/mishran/app/ui/orders/OrderDetailViewModel.kt — Task 11.1.
//
// Order detail state: one-shot lookup (Room cache → network fallback) keyed
// by the route's id argument — the same screen serves the Orders tab, the
// post-checkout Track-order CTA, and the mishran://order/{id} push deep link.
//
// Parity batch (reorder): reorder() walks the order's line items back into
// the local cart via CartRepository.addPackLine (pack-size aware, no Product
// resolution — the order item carries everything). Each line is its own
// write, so one failing line (Room hiccup, disk full) never aborts the rest;
// the one-shot `reordered` event carries the added/total counts and the
// screen composes the all-or-partial snackbar from them.
package com.mishran.app.ui.orders

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Order
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.OrderRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** One-shot reorder outcome: [added] of [total] lines landed in the cart. */
data class Reordered(val added: Int, val total: Int)

@HiltViewModel
class OrderDetailViewModel @Inject constructor(
    private val repository: OrderRepository,
    private val cartRepository: CartRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val orderId: String = checkNotNull(savedStateHandle["id"])

    private val _state = MutableStateFlow<UiState<Order>>(UiState.Loading)
    val state: StateFlow<UiState<Order>> = _state.asStateFlow()

    private val _reordered = MutableSharedFlow<Reordered>(extraBufferCapacity = 1)

    /** Fired once the reorder walk finishes — the screen snackbar-confirms. */
    val reordered: SharedFlow<Reordered> = _reordered

    init {
        load()
    }

    /** (Re-)fetch; also the retry hook from the error state. */
    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repository.getOrder(orderId)
                ?.let { UiState.Success(it) }
                ?: UiState.Error("We couldn't find that order.")
        }
    }

    /**
     * Put every line item back into the cart. A no-op outside Success (no
     * order to walk); failures are counted per line, not thrown, so the
     * event's counts drive the all-added vs partial message.
     */
    fun reorder() {
        val current = _state.value as? UiState.Success<Order> ?: return
        viewModelScope.launch {
            var added = 0
            current.data.items.forEach { item ->
                val landed = runCatching {
                    cartRepository.addPackLine(
                        productId = item.productId,
                        slug = item.slug,
                        name = item.name,
                        imageUrl = item.image,
                        packLabel = item.packLabel,
                        unitPricePaise = item.priceInPaise.toLong(),
                        unit = item.unit,
                        quantity = item.quantity,
                    )
                }.isSuccess
                if (landed) added++
            }
            _reordered.emit(Reordered(added = added, total = current.data.items.size))
        }
    }
}
