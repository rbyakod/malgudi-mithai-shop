// apps/android/app/src/main/java/com/mishran/app/ui/catalog/CatalogScreen.kt — Task 9.3 / P1 parity / P2 net-new (verticals).
//
// The catalog browse surface: a segmented vertical-tab header
// (Mithai · Snacks · QSR · Merch), search bar, active-filter chip row, and a
// 2-column LazyVerticalGrid. The Mithai tab is the original products flow —
// it renders the Room cache the instant it lands (Cached) and swaps in the
// refreshed rows (Fresh) without losing scroll or filter state — while the
// other three tabs swap the grid's content source to their network-only list
// (loading / error-retry / content). Search + filters are Mithai-scoped, so
// that row hides off the Mithai tab. Pull-to-refresh wraps everything:
// products refresh (ETag-bypassing) on Mithai, a plain reload on the others.
// P1 parity wrapped the scrollable content in material3's PullToRefreshBox.
//
// TODO(i18n): tab labels + empty/error lines hardcode the English copy from
// packages/i18n-strings/en.json (vertical.mithai/snacks/qsr/merch, …) — swap
// for R.string references in the sweep that wires generated resources.
package com.mishran.app.ui.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.api.models.Product
import com.mishran.app.ui.catalog.components.FilterSheet
import com.mishran.app.ui.catalog.components.MerchCard
import com.mishran.app.ui.catalog.components.ProductCard
import com.mishran.app.ui.catalog.components.QsrCard
import com.mishran.app.ui.catalog.components.SnackCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CatalogScreen(
    onProductClick: (Product) -> Unit,
    onCartClick: () -> Unit,
    onSnackClick: (slug: String) -> Unit = {},
    onQsrClick: (slug: String) -> Unit = {},
    onMerchClick: (slug: String) -> Unit = {},
    viewModel: CatalogViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val products by viewModel.visibleProducts.collectAsState()
    val query by viewModel.searchQuery.collectAsState()
    val filters by viewModel.activeFilters.collectAsState()
    val availableTags by viewModel.availableDietaryTags.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val vertical by viewModel.activeVertical.collectAsState()
    val listing by viewModel.verticalState.collectAsState()
    var showFilterSheet by remember { mutableStateOf(false) }

    // Pull-to-refresh over the whole scrollable surface; on the Mithai tab the
    // ViewModel's isRefreshing bridges gesture → refresh() → Fresh emission,
    // on the vertical tabs the reload shows as the grid's inline loading.
    val isMithai = vertical == CatalogVertical.MITHAI
    PullToRefreshBox(
        isRefreshing = if (isMithai) isRefreshing else false,
        onRefresh = if (isMithai) viewModel::refresh else viewModel::retryVertical,
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
        // Vertical tabs — the catalog's header row (cart button rides along).
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 8.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.weight(1f)) {
                CatalogVertical.entries.forEachIndexed { index, tab ->
                    SegmentedButton(
                        selected = vertical == tab,
                        onClick = { viewModel.onVerticalChange(tab) },
                        shape = SegmentedButtonDefaults.itemShape(
                            index = index,
                            count = CatalogVertical.entries.size,
                        ),
                        label = {
                            Text(
                                text = when (tab) {
                                    CatalogVertical.MITHAI -> "Mithai"
                                    CatalogVertical.SNACKS -> "Snacks"
                                    CatalogVertical.QSR -> "QSR"
                                    CatalogVertical.MERCH -> "Merch"
                                },
                                maxLines = 1,
                            )
                        },
                    )
                }
            }
            IconButton(onClick = onCartClick) {
                Icon(Icons.Filled.ShoppingCart, contentDescription = "Cart")
            }
        }

        // Search + filters are Mithai-scoped (no vertical query params yet).
        if (isMithai) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = viewModel::onSearchQueryChange,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Search sweets") },
                    singleLine = true,
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChange("") }) {
                                Icon(Icons.Filled.Close, contentDescription = "Clear search")
                            }
                        }
                    },
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = filters.isActive,
                    onClick = { showFilterSheet = true },
                    label = { Text("Filters") },
                    leadingIcon = {
                        Icon(Icons.Filled.FilterList, contentDescription = null)
                    },
                )
                val family = filters.family
                if (family != null) {
                    FilterChip(
                        selected = true,
                        onClick = { viewModel.onFiltersChange(filters.copy(family = null)) },
                        label = { Text(family.value) },
                    )
                }
                filters.dietaryTags.forEach { tag ->
                    FilterChip(
                        selected = true,
                        onClick = {
                            viewModel.onFiltersChange(
                                filters.copy(dietaryTags = filters.dietaryTags - tag),
                            )
                        },
                        label = { Text(tag) },
                    )
                }
            }
        }

        when (val state = listing) {
            // ---- Mithai: the original products flow, unchanged --------------
            VerticalListing.Mithai -> when (val productState = uiState) {
                CatalogUiState.Loading -> Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator() }
                is CatalogUiState.Error -> Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = productState.message,
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                    )
                }
                else -> {
                    if (products.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize().padding(16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = if (query.isNotBlank() || filters.isActive) {
                                    "No sweets match your search or filters."
                                } else {
                                    "The catalog will appear here once it syncs."
                                },
                                style = MaterialTheme.typography.bodyLarge,
                                textAlign = TextAlign.Center,
                            )
                        }
                    } else {
                        ProductGrid(
                            products = products,
                            onProductClick = onProductClick,
                        )
                    }
                }
            }

            // ---- Snacks / QSR / Merch: network-only grids -------------------
            is VerticalListing.Snacks -> VerticalGridSection(
                loading = state.loading,
                error = state.error,
                isEmpty = state.items.isEmpty(),
                emptyMessage = "No snacks yet.",
                onRetry = viewModel::retryVertical,
            ) {
                items(state.items, key = { it.id }) { snack ->
                    SnackCard(
                        snack = snack,
                        onClick = { onSnackClick(snack.slug) },
                    )
                }
            }

            is VerticalListing.Qsr -> VerticalGridSection(
                loading = state.loading,
                error = state.error,
                isEmpty = state.items.isEmpty(),
                emptyMessage = "The counter menu is coming soon.",
                onRetry = viewModel::retryVertical,
            ) {
                items(state.items, key = { it.id }) { item ->
                    QsrCard(
                        item = item,
                        onClick = { onQsrClick(item.slug) },
                    )
                }
            }

            is VerticalListing.Merch -> VerticalGridSection(
                loading = state.loading,
                error = state.error,
                isEmpty = state.items.isEmpty(),
                emptyMessage = "No merch yet.",
                onRetry = viewModel::retryVertical,
            ) {
                items(state.items, key = { it.id }) { merch ->
                    MerchCard(
                        merch = merch,
                        onClick = { onMerchClick(merch.slug) },
                    )
                }
            }
        }
        }
    }

    if (showFilterSheet) {
        FilterSheet(
            filters = filters,
            availableDietaryTags = availableTags,
            onChange = viewModel::onFiltersChange,
            onDismiss = { showFilterSheet = false },
        )
    }
}

@Composable
private fun ProductGrid(
    products: List<Product>,
    onProductClick: (Product) -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(products, key = { it.id }) { product ->
            ProductCard(
                product = product,
                onClick = { onProductClick(product) },
            )
        }
    }
}

/**
 * Shared loading / error-retry / empty / content scaffold for the three
 * network-only verticals. [content] is the LazyVerticalGrid content slot.
 */
@Composable
private fun VerticalGridSection(
    loading: Boolean,
    error: String?,
    isEmpty: Boolean,
    emptyMessage: String,
    onRetry: () -> Unit,
    content: androidx.compose.foundation.lazy.grid.LazyGridScope.() -> Unit,
) {
    when {
        loading && isEmpty -> Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) { CircularProgressIndicator() }
        error != null && isEmpty -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        ) {
            Text(
                text = error,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
            Button(onClick = onRetry) { Text("Try again") }
        }
        isEmpty -> Box(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = emptyMessage,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
        }
        else -> LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}
