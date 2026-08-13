// apps/android/app/src/main/java/com/mishran/app/ui/orders/OrderDetailViewModel.kt — Task 11.1.
//
// Order detail state: one-shot lookup (Room cache → network fallback) keyed
// by the route's id argument — the same screen serves the Orders tab, the
// post-checkout Track-order CTA, and the mishran://order/{id} push deep link.
package com.mishran.app.ui.orders

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Order
import com.mishran.app.data.repository.OrderRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class OrderDetailViewModel @Inject constructor(
    private val repository: OrderRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val orderId: String = checkNotNull(savedStateHandle["id"])

    private val _state = MutableStateFlow<UiState<Order>>(UiState.Loading)
    val state: StateFlow<UiState<Order>> = _state.asStateFlow()

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
}
