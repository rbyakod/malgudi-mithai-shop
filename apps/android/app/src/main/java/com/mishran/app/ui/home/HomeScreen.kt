// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeScreen.kt
//
// The Home tab, structured like the web storefront home but app-paced:
// a photo hero (web hero's counterpart), a best-sellers rail, and a
// shop-by-family section that deep-links into the filtered catalog
// (the app's stand-in for the web's occasion sections). Replaces the
// Phase 7 placeholder.
package com.mishran.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.mishran.api.models.Product
import com.mishran.app.ui.catalog.components.ProductCard

private val FAMILY_LABELS = linkedMapOf(
    Product.Family.classic to "Classic",
    Product.Family.original to "House originals",
    Product.Family.sugarMinusFree to "Sugar-free",
    Product.Family.regional to "Regional",
    Product.Family.seasonal to "Seasonal",
)

@Composable
fun HomeScreen(
    onProductClick: (slug: String) -> Unit,
    onBrowseCatalog: () -> Unit,
    onFamilyClick: (familyValue: String) -> Unit,
    onOrders: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val products by viewModel.products.collectAsStateWithLifecycle()
    // Real best sellers since P1 parity: the featured rows (fallback: first
    // eight of the catalog) — see HomeViewModel.
    val bestSellers by viewModel.bestSellers.collectAsStateWithLifecycle()
    val heroImage = bestSellers.firstOrNull()?.images?.firstOrNull()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        // Hero — photo, scrim, wordmark + tagline + CTA (web home's counterpart).
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp),
        ) {
            if (heroImage != null) {
                AsyncImage(
                    model = heroImage,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Black.copy(alpha = 0.25f),
                            1f to Color.Black.copy(alpha = 0.7f),
                        ),
                    ),
            )
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(20.dp),
            ) {
                Text(
                    text = "Mishran",
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Light,
                    color = Color.White,
                )
                Text(
                    text = "Fresh mithai, made every day.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White.copy(alpha = 0.85f),
                )
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = onBrowseCatalog,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = MaterialTheme.colorScheme.primary,
                    ),
                ) {
                    Text("Browse sweets")
                }
            }
        }

        // Best sellers — the rail the web home calls its best-sellers grid.
        SectionHeader("Best sellers")
        when {
            products.isEmpty() -> Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }
            else -> LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
            ) {
                items(bestSellers.size, key = { bestSellers[it].id }) { index ->
                    val product = bestSellers[index]
                    ProductCard(
                        product = product,
                        onClick = { onProductClick(product.slug) },
                        modifier = Modifier.width(180.dp),
                    )
                }
            }
        }

        // Shop by family — deep-links into the filtered catalog.
        SectionHeader("Shop by family")
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
        ) {
            items(FAMILY_LABELS.size) { index ->
                val (family, label) = FAMILY_LABELS.entries.toList()[index]
                val count = products.count { it.family == family }
                SuggestionChip(
                    onClick = { onFamilyClick(family.value) },
                    label = {
                        Text(
                            text = if (count > 0) "$label · $count" else label,
                            style = MaterialTheme.typography.labelLarge,
                        )
                    },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                    shape = RoundedCornerShape(50),
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            OutlinedButton(onClick = onOrders) { Text("Your orders") }
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(start = 20.dp, top = 24.dp, bottom = 12.dp),
    )
}
