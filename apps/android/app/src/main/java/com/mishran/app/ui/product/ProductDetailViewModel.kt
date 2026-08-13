// apps/android/app/src/main/java/com/mishran/app/ui/product/ProductDetailViewModel.kt — Task 9.4.
//
// Detail-screen state: one-shot lookup (Room → network fallback → null) over
// the shared UiState lifecycle, plus the quantity stepper (floored at 1 —
// removing items is the cart's job, not the product page's). The Add-to-cart
// CTA is a UI event carrying (product, quantity); the cart repository lands in
// Task 10.1 and will subscribe to it.
package com.mishran.app.ui.product

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val repository: CatalogRepository,
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

    private companion object {
        const val MIN_QUANTITY = 1
        // Backstop, not a product rule — the server re-validates at checkout.
        const val MAX_QUANTITY = 20
    }
}
