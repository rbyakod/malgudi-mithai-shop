// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailViewModel.kt — Task 9.4 / 10.1 / P1 parity.
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
package com.mishran.app.ui.product

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val repository: CatalogRepository,
    private val cartRepository: CartRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Injected from the route — see Routes.PRODUCT ("product/{slug}"). */
    val slug: String = checkNotNull(savedStateHandle["slug"])

    private val _state = MutableStateFlow<UiState<Product>>(UiState.Loading)
    val state: StateFlow<UiState<Product>> = _state.asStateFlow()

    private val _quantity = MutableStateFlow(MIN_QUANTITY)
    val quantity: StateFlow<Int> = _quantity.asStateFlow()

    init {
        load()
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
    }
}
