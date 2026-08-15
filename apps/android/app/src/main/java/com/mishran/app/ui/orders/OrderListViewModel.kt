// apps/android/app/src/main/java/com/mishran/app/ui/orders/OrderListViewModel.kt — Task 11.1 / P1 parity.
//
// Orders tab state: streams the Room cache (offline-first), kicks a network
// refresh on entry, and exposes a lightweight refresh-failure flag the screen
// renders as an inline notice (the stale list stays visible). `refreshing`
// drives the screen's PullToRefreshBox indicator (P1 parity — the gesture
// this file long pre-announced); refresh() stays the single entry point.
package com.mishran.app.ui.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Order
import com.mishran.app.data.repository.OrderRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OrderListUiState(
    val orders: List<Order> = emptyList(),
    /** First cache emission landed — distinguishes "loading" from "no orders". */
    val loaded: Boolean = false,
    /** Last refresh attempt failed (offline/auth) — stale list keeps serving. */
    val refreshFailed: Boolean = false,
)

@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val repository: OrderRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(OrderListUiState())
    val state: StateFlow<OrderListUiState> = _state.asStateFlow()

    val refreshing = MutableStateFlow(false)

    init {
        repository.observeOrders()
            .onEach { orders -> _state.update { it.copy(orders = orders, loaded = true) } }
            .launchIn(viewModelScope)
        refresh()
    }

    /** Fetch page 1 + replace the cache; one refresh at a time. */
    fun refresh() {
        if (refreshing.value) return
        refreshing.value = true
        viewModelScope.launch {
            val ok = repository.refreshOrders()
            _state.update { it.copy(refreshFailed = !ok) }
            refreshing.value = false
        }
    }
}
