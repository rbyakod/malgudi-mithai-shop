// apps/android/app/src/main/java/com/mishran/app/ui/catalog/CatalogScreen.kt — Task 9.3 / P1 parity / P2 net-new (verticals) / parity batch.
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
// Parity batch: the cart toolbar icon carries a live count badge (Σ quantity,
// hidden at 0), the search row gains the sort menu (Featured / A–Z / Z–A,
// persisted), and Mithai cards expose the quick-add button whose write lands
// as a brief "Added" snackbar.
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
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mishran.api.models.Product
import com.mishran.app.R
import com.mishran.app.ui.catalog.components.FAMILY_LABEL_RES
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
    val sortOrder by viewModel.sortOrder.collectAsState()
    val cartCount by viewModel.cartCount.collectAsState()
    var showFilterSheet by remember { mutableStateOf(false) }

    // Quick-add confirmation: one "Added" snackbar per write, at the bottom of
    // the browse surface (short-lived by design — the badge count updates too).
    val snackbarHostState = remember { SnackbarHostState() }
    val quickAddedLabel = stringResource(R.string.catalog_quick_added)
    LaunchedEffect(viewModel) {
        viewModel.quickAdded.collect { snackbarHostState.showSnackbar(quickAddedLabel) }
    }

    // Pull-to-refresh over the whole scrollable surface; on the Mithai tab the
    // ViewModel's isRefreshing bridges gesture → refresh() → Fresh emission,
    // on the vertical tabs the reload shows as the grid's inline loading.
    val isMithai = vertical == CatalogVertical.MITHAI
    PullToRefreshBox(
        isRefreshing = if (isMithai) isRefreshing else false,
        onRefresh = if (isMithai) viewModel::refresh else viewModel::retryVertical,
        modifier = Modifier.fillMaxSize(),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
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
                                    CatalogVertical.MITHAI -> stringResource(R.string.vertical_mithai)
                                    CatalogVertical.SNACKS -> stringResource(R.string.vertical_snacks)
                                    CatalogVertical.QSR -> stringResource(R.string.vertical_qsr)
                                    CatalogVertical.MERCH -> stringResource(R.string.vertical_merch)
                                },
                                maxLines = 1,
                            )
                        },
                    )
                }
            }
            // Live cart count badge (Σ quantity over the Room lines); hidden at
            // 0 so an empty cart reads exactly like the pre-badge icon. The
            // description carries the count for TalkBack.
            BadgedBox(
                badge = {
                    if (cartCount > 0) {
                        Badge { Text(cartCount.toString()) }
                    }
                },
            ) {
                IconButton(onClick = onCartClick) {
                    Icon(
                        Icons.Filled.ShoppingCart,
                        contentDescription = if (cartCount > 0) {
                            stringResource(R.string.cart_badge_count, cartCount.toString())
                        } else {
                            stringResource(R.string.nav_cart)
                        },
                    )
                }
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
                    placeholder = { Text(stringResource(R.string.catalog_search_placeholder)) },
                    singleLine = true,
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChange("") }) {
                                Icon(Icons.Filled.Close, contentDescription = "Clear search")
                            }
                        }
                    },
                )
                SortMenu(
                    selected = sortOrder,
                    onSelect = viewModel::onSortChange,
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
                    label = { Text(stringResource(R.string.catalog_filter_title)) },
                    leadingIcon = {
                        Icon(Icons.Filled.FilterList, contentDescription = null)
                    },
                )
                val family = filters.family
                if (family != null) {
                    FilterChip(
                        selected = true,
                        onClick = { viewModel.onFiltersChange(filters.copy(family = null)) },
                        label = {
                            Text(
                                stringResource(
                                    FAMILY_LABEL_RES[family] ?: R.string.catalog_family_all,
                                ),
                            )
                        },
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
                                    stringResource(R.string.catalog_empty)
                                } else {
                                    stringResource(R.string.catalog_empty_sync)
                                },
                                style = MaterialTheme.typography.bodyLarge,
                                textAlign = TextAlign.Center,
                            )
                        }
                    } else {
                        ProductGrid(
                            products = products,
                            onProductClick = onProductClick,
                            onQuickAdd = viewModel::quickAdd,
                        )
                    }
                }
            }

            // ---- Snacks / QSR / Merch: network-only grids -------------------
            is VerticalListing.Snacks -> VerticalGridSection(
                loading = state.loading,
                error = state.error,
                isEmpty = state.items.isEmpty(),
                emptyMessage = stringResource(R.string.catalog_empty_snacks),
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
                emptyMessage = stringResource(R.string.catalog_empty_qsr),
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
                emptyMessage = stringResource(R.string.catalog_empty_merch),
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
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
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

/**
 * Sort trigger + dropdown. An icon button (label = the generic Sort copy, so
 * TalkBack reads "Sort, Featured" via the menu that follows) anchored to the
 * search field's end; the three fixed orders match the web catalog's options
 * and persist through the ViewModel.
 */
@Composable
private fun SortMenu(
    selected: CatalogSortOrder,
    onSelect: (CatalogSortOrder) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    IconButton(onClick = { expanded = true }) {
        Icon(
            Icons.AutoMirrored.Filled.Sort,
            contentDescription = stringResource(R.string.catalog_sort_label),
        )
    }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        CatalogSortOrder.entries.forEach { order ->
            DropdownMenuItem(
                text = {
                    Text(
                        text = when (order) {
                            CatalogSortOrder.FEATURED -> stringResource(R.string.catalog_sort_featured)
                            CatalogSortOrder.NAME_ASC -> stringResource(R.string.catalog_sort_name_asc)
                            CatalogSortOrder.NAME_DESC -> stringResource(R.string.catalog_sort_name_desc)
                        },
                    )
                },
                leadingIcon = if (order == selected) {
                    { Icon(Icons.Filled.Check, contentDescription = null) }
                } else {
                    null
                },
                onClick = {
                    onSelect(order)
                    expanded = false
                },
            )
        }
    }
}

@Composable
private fun ProductGrid(
    products: List<Product>,
    onProductClick: (Product) -> Unit,
    onQuickAdd: (Product) -> Unit,
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
                onQuickAdd = { onQuickAdd(product) },
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
            Button(onClick = onRetry) { Text(stringResource(R.string.common_try_again)) }
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
