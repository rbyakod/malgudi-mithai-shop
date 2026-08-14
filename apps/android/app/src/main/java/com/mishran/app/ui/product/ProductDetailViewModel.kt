// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailViewModel.kt — Task 9.4 / 10.1.
//
// Detail-screen state: one-shot lookup (Room → network fallback → null) over
// the shared UiState lifecycle, plus the quantity stepper (floored at 1 —
// removing items is the cart's job, not the product page's). Since Task 10.1
// the Add-to-cart CTA writes the line into the Room cart and emits `added`
// once it lands — the screen turns that into navigation (pop back).
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

    /** Write the current (product, quantity) into the cart; emits [added] on landing. */
    fun addToCart() {
        val current = _state.value as? UiState.Success<Product> ?: return
        viewModelScope.launch {
            cartRepository.add(current.data, _quantity.value)
            _added.emit(Unit)
        }
    }

    private val _added = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Fired once the cart write lands — the screen pops back on this. */
    val added: SharedFlow<Unit> = _added

    private companion object {
        const val MIN_QUANTITY = 1
        // Backstop, not a product rule — the server re-validates at checkout.
        const val MAX_QUANTITY = 20
    }
}
