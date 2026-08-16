// apps/android/app/src/main/java/com/mishran/app/ui/catalog/CatalogViewModel.kt — Task 9.3 / P2 net-new (verticals) / parity batch.
//
// Streams the offline-first catalog into UI state. The repo flow emits twice
// (cache → network-refreshed); the first emission renders as Cached (usable
// instantly, possibly stale) and any later one as Fresh. Search + filters are
// modeled URL-query-style — a plain `CatalogFilters` object whose fields map
// 1:1 to the contract's query params (family, dietaryTags, q) — so the state
// is shareable/bookmarkable later without reshaping. Filtering runs client-side
// against the full cached list (the whole catalog is on disk; there is nothing
// to gain from server-side filtering in v1), then the chosen sort order is
// applied over the filtered slice (also client-side — the web sorts its
// cached list the same way).
//
// P2 net-new: the segmented vertical tabs (Mithai · Snacks · QSR · Merch).
// The Mithai tab is exactly the pre-existing products flow; the other three
// load their lists network-only through VerticalRepository with a plain
// Loading / Content / Error lifecycle (retry = restart the flow). Search and
// filters are Mithai-scoped — the vertical tabs carry no query params yet —
// so the screen hides that row off the Mithai tab. Switching tabs restarts
// the active vertical's flow (browse-y pages, no cache worth invalidating).
//
// Parity batch: the sort choice persists in DataStore (survives restarts,
// seeded once at construction like the family/vertical deep-link args), the
// cart badge counts the Room lines reactively, and quickAdd writes the BASE
// pack straight from a grid card (bare productId so it merges with a PDP
// base-pack add; the repository owns that rule).
package com.mishran.app.ui.catalog

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Merch
import com.mishran.api.models.Product
import com.mishran.api.models.QsrItem
import com.mishran.api.models.Snack
import com.mishran.app.domain.usecase.GetCatalogUseCase
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.SettingsRepository
import com.mishran.app.data.repository.VerticalRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
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

/**
 * Sort orders the catalog offers. `wireValue` is the DataStore string (and a
 * future URL arg), matching the web's option ids.
 */
enum class CatalogSortOrder(val wireValue: String) {
    FEATURED("featured"),
    NAME_ASC("name_asc"),
    NAME_DESC("name_desc");

    companion object {
        /** Resolve a persisted/deep-linked value; unknown falls back to Featured. */
        fun fromWireValue(value: String?): CatalogSortOrder =
            entries.firstOrNull { it.wireValue == value } ?: FEATURED
    }
}

/**
 * One catalog vertical tab. `wireValue` is the URL arg (Routes.catalog) so
 * Home's portals deep-link straight to a tab; "Mithai" is the products flow.
 */
enum class CatalogVertical(val wireValue: String) {
    MITHAI("mithai"),
    SNACKS("snacks"),
    QSR("qsr"),
    MERCH("merch");

    companion object {
        /** Resolve the deep-link arg; null/unknown falls back to Mithai. */
        fun fromWireValue(value: String?): CatalogVertical =
            entries.firstOrNull { it.wireValue == value } ?: MITHAI
    }
}

/**
 * Contents of whichever vertical tab is active. Mithai is a marker — the
 * screen renders the existing products flow (uiState/visibleProducts) — while
 * the other three carry their typed list plus a Loading/Error lifecycle
 * (`loading = true` with empty items = first load; `error != null` = retry
 * state; a successful reload clears both).
 */
sealed interface VerticalListing {
    data object Mithai : VerticalListing
    data class Snacks(
        val items: List<Snack> = emptyList(),
        val loading: Boolean = false,
        val error: String? = null,
    ) : VerticalListing

    data class Qsr(
        val items: List<QsrItem> = emptyList(),
        val loading: Boolean = false,
        val error: String? = null,
    ) : VerticalListing

    data class Merch(
        // Qualified: a bare `Merch` here would resolve to THIS class
        // (innermost scope beats the api.models import) and recurse.
        val items: List<com.mishran.api.models.Merch> = emptyList(),
        val loading: Boolean = false,
        val error: String? = null,
    ) : VerticalListing
}

/** Generic loading/content/error page the vertical loaders emit before typing. */
private data class VerticalPage<T>(
    val items: List<T> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val getCatalog: GetCatalogUseCase,
    private val verticalRepository: VerticalRepository,
    private val cartRepository: CartRepository,
    private val settingsRepository: SettingsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val query = MutableStateFlow("")

    // Optional ?family= deep-link arg (Home's family cards) seeds the filter.
    private val initialFamily = savedStateHandle.get<String>("family")
        ?.let { name -> Product.Family.entries.firstOrNull { it.value == name } }
    private val filters = MutableStateFlow(CatalogFilters(family = initialFamily))

    /**
     * Active sort order. Defaults to Featured, then adopts whatever the user
     * persisted last (one DataStore read — the same seed pattern as the
     * family/vertical route args above).
     */
    private val sort = MutableStateFlow(CatalogSortOrder.FEATURED)
    val sortOrder: StateFlow<CatalogSortOrder> = sort.asStateFlow()

    init {
        viewModelScope.launch {
            val persisted = settingsRepository.catalogSortFlow().first() ?: return@launch
            sort.value = CatalogSortOrder.fromWireValue(persisted)
        }
    }

    /** Bumped by refresh(); the first pass is a normal (ETag-conditional) load. */
    private val refreshTrigger = MutableStateFlow(0)

    /** True from refresh() until that pass's post-refresh emission lands. */
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    val uiState: StateFlow<CatalogUiState> = refreshTrigger
        .flatMapLatest { pass ->
            // Flow has no mapIndexed; count emissions inline instead (the
            // counter restarts with each pass because the flow is cold).
            var index = 0
            getCatalog(force = pass > 0)
                .map { products ->
                    // Emit #0 is the Room cache; anything after is post-refresh.
                    val state = if (index == 0) CatalogUiState.Cached(products)
                    else CatalogUiState.Fresh(products)
                    if (index >= 1) _isRefreshing.value = false
                    index++
                    state
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

    /** The catalog after search + filters + sort — what the grid renders. */
    val visibleProducts: StateFlow<List<Product>> = combine(
        uiState,
        query,
        filters,
        sort,
    ) { state, q, f, s -> sortProducts(filterProducts(state.products, q, f), s) }
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

    /** Swap the sort order and persist the choice for the next session. */
    fun onSortChange(value: CatalogSortOrder) {
        sort.value = value
        viewModelScope.launch { settingsRepository.setCatalogSort(value.wireValue) }
    }

    // ---- Cart parity: badge + quick add -----------------------------------

    /** Σ quantity over the Room lines; the toolbar badge renders it (0 hides). */
    val cartCount: StateFlow<Int> = cartRepository.observeItems()
        .map(::cartBadgeCount)
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            0,
        )

    /** Fired once a quick-add write lands — the screen confirms with a snackbar. */
    private val _quickAdded = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val quickAdded: SharedFlow<Unit> = _quickAdded

    /**
     * Add the BASE pack of a grid card straight to the cart: verbatim
     * displayPrice, bare productId line id (pack = null — the repository's
     * no-pack path), quantity 1 stacked on any existing line. Mithai-grid
     * only; the screen never offers it on the vertical tabs or Home rail.
     */
    fun quickAdd(product: Product) {
        viewModelScope.launch {
            cartRepository.add(product, quantity = 1, pack = null)
            _quickAdded.emit(Unit)
        }
    }

    /** Pull-to-refresh / retry: restarts the flow with `force = true`. */
    fun refresh() {
        _isRefreshing.value = true
        refreshTrigger.value += 1
    }

    // ---- Vertical tabs (P2 net-new) --------------------------------------

    /** Active tab; seeded from the optional ?vertical= deep-link arg. */
    private val vertical = MutableStateFlow(
        CatalogVertical.fromWireValue(savedStateHandle.get<String>("vertical")),
    )
    val activeVertical: StateFlow<CatalogVertical> = vertical.asStateFlow()

    /** Bumped by retryVertical() — restarts the active vertical's loader. */
    private val verticalRetry = MutableStateFlow(0)

    /**
     * The active tab's contents. combine (not flatMapLatest over vertical
     * alone) so a retry can restart the loader without changing tabs; the
     * Mithai tab short-circuits to its marker and never touches the network
     * path (its data already streams through uiState above).
     */
    val verticalState: StateFlow<VerticalListing> = combine(vertical, verticalRetry) { v, _ -> v }
        .flatMapLatest { current ->
            when (current) {
                CatalogVertical.MITHAI -> flowOf(VerticalListing.Mithai)
                CatalogVertical.SNACKS -> pageFlow { verticalRepository.getSnacks() }
                    .map { VerticalListing.Snacks(it.items, it.loading, it.error) }
                CatalogVertical.QSR -> pageFlow { verticalRepository.getQsrItems() }
                    .map { VerticalListing.Qsr(it.items, it.loading, it.error) }
                CatalogVertical.MERCH -> pageFlow { verticalRepository.getMerch() }
                    .map { VerticalListing.Merch(it.items, it.loading, it.error) }
            }
        }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            VerticalListing.Mithai,
        )

    fun onVerticalChange(value: CatalogVertical) {
        vertical.value = value
    }

    /** Error-state CTA: re-run the loader for whichever tab is showing. */
    fun retryVertical() {
        verticalRetry.value += 1
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}

/**
 * One Loading → Content/Error pass over a network-only vertical list. The
 * failure message is generic on purpose — the screens offer a retry, not a
 * diagnosis.
 */
private fun <T> pageFlow(loader: suspend () -> Result<List<T>>) = flow {
    emit(VerticalPage<T>(loading = true))
    loader().fold(
        onSuccess = { items -> emit(VerticalPage(items = items)) },
        onFailure = { emit(VerticalPage(error = VERTICAL_ERROR_MESSAGE)) },
    )
}

private const val VERTICAL_ERROR_MESSAGE =
    "Could not load this section. Check your connection and try again."

/**
 * Pure client-side filter: family must match when set, every selected dietary
 * tag must be present, and a non-blank query case-insensitively matches any of
 * the product's text fields — name, slug, the long description (the contract's
 * `story` field; Product carries no separate description), the family value,
 * or any dietary tag. The widened matcher is what the web catalog searches
 * over. Extracted from the ViewModel so it is directly unit-testable.
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
        val queryOk = q.isEmpty() || product.matchesSearchQuery(q)
        familyOk && tagsOk && queryOk
    }
}

/** The widened per-product matcher: any of the text fields containing `q`. */
private fun Product.matchesSearchQuery(q: String): Boolean =
    name.lowercase().contains(q) ||
        slug.lowercase().contains(q) ||
        story.orEmpty().lowercase().contains(q) ||
        family.value.lowercase().contains(q) ||
        dietaryTags.orEmpty().any { it.lowercase().contains(q) }

/**
 * Pure client-side sort over the filtered slice. Featured puts flagged rows
 * first (stable within each group, ties broken by name — matching the web's
 * featured-then-name rule); the name orders compare locale-free lowercase so
 * the result is deterministic in JVM tests and on device alike.
 */
internal fun sortProducts(products: List<Product>, order: CatalogSortOrder): List<Product> =
    when (order) {
        CatalogSortOrder.FEATURED ->
            products.sortedWith(
                compareByDescending<Product> { it.featured == true }
                    .thenBy { it.name.lowercase() },
            )
        CatalogSortOrder.NAME_ASC -> products.sortedBy { it.name.lowercase() }
        CatalogSortOrder.NAME_DESC -> products.sortedByDescending { it.name.lowercase() }
    }

/**
 * Badge count = Σ quantity over the lines (not the line count — three of one
 * sweet read as 3, not 1). Extracted so the derivation is unit-testable.
 */
internal fun cartBadgeCount(items: List<CartItemEntity>): Int = items.sumOf { it.quantity }
