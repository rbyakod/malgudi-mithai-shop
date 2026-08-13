// apps/android/app/src/main/java/com/mishran/app/ui/catalog/CatalogViewModel.kt — Task 9.3.
//
// Streams the offline-first catalog into UI state. The repo flow emits twice
// (cache → network-refreshed); the first emission renders as Cached (usable
// instantly, possibly stale) and any later one as Fresh. Search + filters are
// modeled URL-query-style — a plain `CatalogFilters` object whose fields map
// 1:1 to the contract's query params (family, dietaryTags, q) — so the state
// is shareable/bookmarkable later without reshaping. Filtering runs client-side
// against the full cached list (the whole catalog is on disk; there is nothing
// to gain from server-side filtering in v1).
package com.mishran.app.ui.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.domain.usecase.GetCatalogUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.mapIndexed
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Catalog contents by provenance. Every state exposes `products` so derived
 * flows (visible items, filter chip options) never need to pattern-match.
 */
sealed interface CatalogUiState {
    val products: List<Product>

    data object Loading : CatalogUiState {
        override val products: List<Product> get() = emptyList()
    }

    /** Served from Room before/without a network round-trip. */
    data class Cached(override val products: List<Product>) : CatalogUiState

    /** Re-emitted after a successful (or swallowed-failure) refresh. */
    data class Fresh(override val products: List<Product>) : CatalogUiState

    /** Reserved: the repository never throws today, but the contract stays. */
    data class Error(val message: String) : CatalogUiState {
        override val products: List<Product> get() = emptyList()
    }
}

/**
 * Active catalog filters, URL-query-style. A null family means "all families"
 * (the param is absent, not empty) — matching how the API treats omitted
 * query params.
 */
data class CatalogFilters(
    val family: Product.Family? = null,
    val dietaryTags: Set<String> = emptySet(),
) {
    val isActive: Boolean get() = family != null || dietaryTags.isNotEmpty()
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val getCatalog: GetCatalogUseCase,
) : ViewModel() {

    private val query = MutableStateFlow("")
    private val filters = MutableStateFlow(CatalogFilters())

    /** Bumped by refresh(); the first pass is a normal (ETag-conditional) load. */
    private val refreshTrigger = MutableStateFlow(0)

    val uiState: StateFlow<CatalogUiState> = refreshTrigger
        .flatMapLatest { pass ->
            getCatalog(force = pass > 0)
                .mapIndexed { index, products ->
                    // Emit #0 is the Room cache; anything after is post-refresh.
                    if (index == 0) CatalogUiState.Cached(products)
                    else CatalogUiState.Fresh(products)
                }
                .catch { e ->
                    emit(CatalogUiState.Error(e.message ?: "Could not load catalog"))
                }
        }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            CatalogUiState.Loading,
        )

    /** The catalog after search + filters — what the grid renders. */
    val visibleProducts: StateFlow<List<Product>> = combine(
        uiState,
        query,
        filters,
        ) { state, q, f -> filterProducts(state.products, q, f) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            emptyList(),
        )

    /** Distinct dietary tags in the current catalog — the FilterSheet's options. */
    val availableDietaryTags: StateFlow<Set<String>> = uiState
        .map { state ->
            state.products.flatMapTo(mutableSetOf()) { it.dietaryTags.orEmpty() }
        }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            emptySet(),
        )

    val searchQuery: StateFlow<String> = query
    val activeFilters: StateFlow<CatalogFilters> = filters

    fun onSearchQueryChange(value: String) {
        query.value = value
    }

    fun onFiltersChange(value: CatalogFilters) {
        filters.value = value
    }

    fun clearFilters() {
        filters.value = CatalogFilters()
    }

    /** Pull-to-refresh / retry: restarts the flow with `force = true`. */
    fun refresh() {
        refreshTrigger.value += 1
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}

/**
 * Pure client-side filter: family must match when set, every selected dietary
 * tag must be present, and a non-blank query matches name (case-insensitive)
 * or slug. Extracted from the ViewModel so it is directly unit-testable.
 */
internal fun filterProducts(
    products: List<Product>,
    query: String,
    filters: CatalogFilters,
): List<Product> {
    val q = query.trim().lowercase()
    return products.filter { product ->
        val familyOk = filters.family == null || product.family == filters.family
        val tagsOk = filters.dietaryTags.all { it in product.dietaryTags.orEmpty() }
        val queryOk = q.isEmpty() ||
            product.name.lowercase().contains(q) ||
            product.slug.contains(q)
        familyOk && tagsOk && queryOk
    }
}
