// apps/android/app/src/main/java/com/mishran/app/ui/catalog/CatalogScreen.kt — Task 9.3.
//
// The catalog browse surface: search bar, active-filter chip row, and a
// 2-column LazyVerticalGrid of product cards. Renders the Room cache the
// instant it lands (Cached) and swaps in the refreshed rows (Fresh) without
// losing scroll or filter state — the ViewModel owns both, the screen just
// renders. Empty state distinguishes "no products match" (filtered) from
// "catalog is empty" (unfiltered offline first run before sync).
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
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import com.mishran.app.ui.catalog.components.ProductCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CatalogScreen(
    onProductClick: (Product) -> Unit,
    onCartClick: () -> Unit,
    viewModel: CatalogViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val products by viewModel.visibleProducts.collectAsState()
    val query by viewModel.searchQuery.collectAsState()
    val filters by viewModel.activeFilters.collectAsState()
    val availableTags by viewModel.availableDietaryTags.collectAsState()
    var showFilterSheet by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
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
            IconButton(onClick = onCartClick) {
                Icon(Icons.Filled.ShoppingCart, contentDescription = "Cart")
            }
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
                leadingIcon = { Icon(Icons.Filled.FilterList, contentDescription = null) },
            )
            if (filters.family != null) {
                FilterChip(
                    selected = true,
                    onClick = { viewModel.onFiltersChange(filters.copy(family = null)) },
                    label = { Text(filters.family.value) },
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

        when (val state = uiState) {
            CatalogUiState.Loading -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) { CircularProgressIndicator() }
            is CatalogUiState.Error -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = state.message,
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
