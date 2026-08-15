// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeScreen.kt
//
// The Home tab: brand greeting, primary browse/orders CTAs, and a horizontal
// featured rail off the cached catalog. Replaces the Phase 7 placeholder —
// same route (Routes.HOME), real content.
package com.mishran.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mishran.app.ui.catalog.components.ProductCard

@Composable
fun HomeScreen(
    onProductClick: (slug: String) -> Unit,
    onBrowseCatalog: () -> Unit,
    onOrders: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val featured by viewModel.featured.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        Text(
            text = "Mishran",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Light,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "Fresh mithai, made every day.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = onBrowseCatalog) { Text("Browse sweets") }
            OutlinedButton(onClick = onOrders) { Text("Your orders") }
        }

        Spacer(Modifier.height(28.dp))
        Text(
            text = "From the counter",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(12.dp))
        when {
            featured.isEmpty() -> Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }
            else -> LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                items(featured.size, key = { featured[it].id }) { index ->
                    val product = featured[index]
                    ProductCard(
                        product = product,
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.width(180.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}
