// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeScreen.kt — P1 parity / P2 net-new.
//
// The Home tab, structured like the web storefront home but app-paced:
// a photo hero (web hero's counterpart), a best-sellers rail, a
// shop-by-family section that deep-links into the filtered catalog
// (the app's stand-in for the web's occasion sections), and — since P2 —
// a shop-by-vertical portals row (deep-links into the catalog's tabbed
// surfaces) plus the "From the journal" rail over the three newest stories.
// Replaces the Phase 7 placeholder.
//
// TODO(i18n): "From the journal" and the portal labels hardcode the English
// copy from packages/i18n-strings/en.json (home.journal, vertical.mithai/
// snacks/qsr/merch) — swap for R.string references in the i18n sweep.
package com.mishran.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.mishran.api.models.Product
import com.mishran.api.models.Story
import com.mishran.app.R
import com.mishran.app.ui.catalog.components.ProductCard

// Label resources (not Strings) so the top-level map stays composable-agnostic;
// the use site resolves them with stringResource().
private val FAMILY_LABELS = linkedMapOf(
    Product.Family.classic to R.string.catalog_family_classic,
    Product.Family.original to R.string.catalog_family_originals,
    Product.Family.sugarMinusFree to R.string.catalog_family_sugar_free,
    Product.Family.regional to R.string.catalog_family_regional,
    Product.Family.seasonal to R.string.catalog_family_seasonal,
)

/**
 * Portal tiles for "Shop by vertical" — wire names match Routes.catalog args.
 * (labelRes, taglineRes, wireValue).
 */
private val VERTICAL_PORTALS = listOf(
    Triple(R.string.vertical_mithai, R.string.home_portal_mithai, "mithai"),
    Triple(R.string.vertical_snacks, R.string.home_portal_snacks, "snacks"),
    Triple(R.string.vertical_qsr, R.string.vertical_qsr_menu, "qsr"),
    Triple(R.string.vertical_merch, R.string.merch_enquire, "merch"),
)

@Composable
fun HomeScreen(
    onProductClick: (slug: String) -> Unit,
    onBrowseCatalog: () -> Unit,
    onFamilyClick: (familyValue: String) -> Unit,
    onVerticalClick: (verticalValue: String) -> Unit,
    onStoryClick: (slug: String) -> Unit,
    onJournal: () -> Unit,
    onOrders: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val products by viewModel.products.collectAsStateWithLifecycle()
    // Real best sellers since P1 parity: the featured rows (fallback: first
    // eight of the catalog) — see HomeViewModel.
    val bestSellers by viewModel.bestSellers.collectAsStateWithLifecycle()
    // P2 net-new: three newest journal stories; empty until the journal syncs.
    val journal by viewModel.journal.collectAsStateWithLifecycle()
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
                    text = stringResource(R.string.app_name),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Light,
                    color = Color.White,
                )
                Text(
                    text = stringResource(R.string.home_hero_tagline),
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
                    Text(stringResource(R.string.home_browse))
                }
            }
        }

        // Best sellers — the rail the web home calls its best-sellers grid.
        SectionHeader(stringResource(R.string.home_best_sellers))
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
        SectionHeader(stringResource(R.string.home_shop_by_family))
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
        ) {
            items(FAMILY_LABELS.size) { index ->
                val (family, labelRes) = FAMILY_LABELS.entries.toList()[index]
                val label = stringResource(labelRes)
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

        // Shop by vertical (P2) — portals into the catalog's tabbed surfaces.
        SectionHeader(stringResource(R.string.home_shop_by_vertical))
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
        ) {
            items(VERTICAL_PORTALS.size) { index ->
                val (labelRes, taglineRes, wireValue) = VERTICAL_PORTALS[index]
                VerticalPortalCard(
                    label = stringResource(labelRes),
                    tagline = stringResource(taglineRes),
                    containerColor = when (index) {
                        0 -> MaterialTheme.colorScheme.primaryContainer
                        1 -> MaterialTheme.colorScheme.secondaryContainer
                        2 -> MaterialTheme.colorScheme.tertiaryContainer
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    },
                    contentColor = when (index) {
                        0 -> MaterialTheme.colorScheme.onPrimaryContainer
                        1 -> MaterialTheme.colorScheme.onSecondaryContainer
                        2 -> MaterialTheme.colorScheme.onTertiaryContainer
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    onClick = { onVerticalClick(wireValue) },
                )
            }
        }

        // From the journal (P2) — three newest stories; hidden until synced.
        if (journal.isNotEmpty()) {
            SectionHeader(
                title = stringResource(R.string.home_journal),
                actionLabel = stringResource(R.string.common_see_all),
                onAction = onJournal,
            )
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
            ) {
                items(journal.size, key = { journal[it].id }) { index ->
                    JournalRailCard(
                        story = journal[index],
                        onClick = { onStoryClick(journal[index].slug) },
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            OutlinedButton(onClick = onOrders) { Text(stringResource(R.string.home_your_orders)) }
        }
        Spacer(Modifier.height(20.dp))
    }
}

/**
 * One vertical portal tile. A themed container instead of a photo on purpose:
 * Home has no imagery for the non-mithai verticals, and container/on-container
 * pairs keep text contrast guaranteed (Task 12.4's rule) where a photo would
 * need a scrim.
 */
@Composable
private fun VerticalPortalCard(
    label: String,
    tagline: String,
    containerColor: Color,
    contentColor: Color,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.width(150.dp).height(92.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = containerColor,
            contentColor = contentColor,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clickable(onClick = onClick)
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = tagline,
                style = MaterialTheme.typography.labelMedium,
            )
        }
    }
}

/** Journal rail card — photo when the story has one, title + pillar below. */
@Composable
private fun JournalRailCard(story: Story, onClick: () -> Unit) {
    Card(modifier = Modifier.width(200.dp).clickable(onClick = onClick)) {
        Column {
            Box(
                modifier = Modifier.fillMaxWidth().height(110.dp),
                contentAlignment = Alignment.Center,
            ) {
                val image = story.heroImage
                if (image == null) {
                    Text(
                        text = story.title.take(1),
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                } else {
                    AsyncImage(
                        model = image,
                        contentDescription = story.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().height(110.dp),
                    )
                }
            }
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = story.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                )
                Text(
                    text = story.pillar.value,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, end = 8.dp, top = 24.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.weight(1f),
        )
        if (actionLabel != null) {
            TextButton(onClick = onAction) { Text(actionLabel) }
        }
    }
}
