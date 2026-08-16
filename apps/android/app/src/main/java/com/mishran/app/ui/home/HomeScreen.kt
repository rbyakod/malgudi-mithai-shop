// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeScreen.kt — P1 parity / P2 net-new / parity batch.
//
// The Home tab, structured like the web storefront home but app-paced:
// a photo hero (web hero's counterpart), a best-sellers rail, a
// shop-by-family section that deep-links into the filtered catalog
// (the app's stand-in for the web's occasion sections), and — since P2 —
// a shop-by-vertical portals row (deep-links into the catalog's tabbed
// surfaces) plus the "From the journal" rail over the three newest stories.
// Replaces the Phase 7 placeholder.
//
// P3 parity (admin hero): when the curated `home-hero` global resolves, the
// static photo hero is replaced by a swipeable autoplay carousel whose
// slides deep-link into product/vertical detail; anything else (unset,
// offline, single slide) keeps the original hero untouched below.
//
// Parity batch: a slim announcement strip pinned above the hero carrying the
// live brand tagline (localized fallback when the brand-settings global omits
// it), a "Why Mishran" pillars strip whose four cards deep-link into the
// journal with the pillar preselected, and live brand copy in the static
// fallback hero (brandName/tagline when /brand carries them, app defaults
// otherwise).
package com.mishran.app.ui.home

import android.content.Context
import android.provider.Settings
import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.mishran.api.models.HeroSlide
import com.mishran.api.models.Product
import com.mishran.api.models.Story
import com.mishran.app.R
import com.mishran.app.data.repository.HeroCarousel
import com.mishran.app.ui.catalog.components.ProductCard
import kotlinx.coroutines.delay

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

/**
 * "Why Mishran" pillar cards (parity batch): (labelRes, pillar wire value).
 * Each deep-links into the journal with the pillar preselected — the labels
 * are the marketing names, the values are Story.Pillar wire names, so the
 * "Milk Purity" card lands on the farm-stories filter, not a literal "milk".
 */
private val WHY_MISHRAN_PILLARS = listOf(
    R.string.home_pillars_milk to "farm",
    R.string.home_pillars_karigar to "karigar",
    R.string.home_pillars_karigari to "karigari",
    R.string.home_pillars_modern to "journal",
)

@Composable
fun HomeScreen(
    onProductClick: (slug: String) -> Unit,
    onBrowseCatalog: () -> Unit,
    onFamilyClick: (familyValue: String) -> Unit,
    onVerticalClick: (verticalValue: String) -> Unit,
    onHeroSlideClick: (verticalValue: String, slug: String) -> Unit,
    onStoryClick: (slug: String) -> Unit,
    onJournal: () -> Unit,
    onPillarClick: (pillarValue: String) -> Unit,
    onOrders: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val products by viewModel.products.collectAsStateWithLifecycle()
    // Real best sellers since P1 parity: the featured rows (fallback: first
    // eight of the catalog) — see HomeViewModel.
    val bestSellers by viewModel.bestSellers.collectAsStateWithLifecycle()
    // P2 net-new: three newest journal stories; empty until the journal syncs.
    val journal by viewModel.journal.collectAsStateWithLifecycle()
    // P3 parity: the admin-curated carousel; null until resolved and on any
    // failure — the static hero below keeps rendering in the meantime.
    val hero by viewModel.hero.collectAsStateWithLifecycle()
    // Parity batch: live brand copy for the announcement strip + masthead;
    // null while neither cache nor network has a record — the localized
    // fallbacks render in that case.
    val brand by viewModel.brand.collectAsStateWithLifecycle()
    val heroCarousel = hero?.takeIf { it.slides.isNotEmpty() }
    val heroImage = bestSellers.firstOrNull()?.images?.firstOrNull()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        // Announcement strip (parity batch) — the live brand tagline when the
        // brand-settings global carries one, the localized fallback otherwise.
        // Slim on purpose: one line, never a section.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = brand?.tagline ?: stringResource(R.string.home_announcement),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }

        // Hero — the curated carousel when the global has slides (P3),
        // else the photo, scrim, wordmark + tagline + CTA hero unchanged.
        if (heroCarousel != null) {
            HeroCarousel(
                carousel = heroCarousel,
                onSlideClick = onHeroSlideClick,
            )
        } else {
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
                    // Live brand copy (parity batch): the masthead swaps in
                    // the brand-settings name/tagline when present, the app
                    // defaults otherwise.
                    Text(
                        text = brand?.brandName ?: stringResource(R.string.app_name),
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Light,
                        color = Color.White,
                    )
                    Text(
                        text = brand?.tagline ?: stringResource(R.string.home_hero_tagline),
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

        // Why Mishran (parity batch) — four brand pillars; each card opens the
        // journal with that pillar's stories preselected.
        SectionHeader(stringResource(R.string.home_pillars_title))
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
        ) {
            items(WHY_MISHRAN_PILLARS.size) { index ->
                val (labelRes, pillarValue) = WHY_MISHRAN_PILLARS[index]
                val label = stringResource(labelRes)
                PillarCard(
                    label = label,
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
                    onClick = { onPillarClick(pillarValue) },
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
 * The admin-curated hero: a swipeable pager with a dot strip and gentle
 * autoplay. Autoplay is skipped for a single slide and under reduced motion
 * (animator duration scale 0 — the accepted heuristic); because the timer
 * effect is keyed on the current page, every settle — auto-advance OR a
 * manual swipe — restarts the interval. Tapping a slide is the CTA
 * (product detail for mithai, vertical detail otherwise — the nav graph
 * owns the routing via [onSlideClick]).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HeroCarousel(
    carousel: HeroCarousel,
    onSlideClick: (verticalValue: String, slug: String) -> Unit,
) {
    val slides = carousel.slides
    val pagerState = rememberPagerState(pageCount = { slides.size })
    // Group label for the pager; the strip below announces the position.
    val carouselLabel = stringResource(R.string.home_hero_carousel)
    val pageLabel = stringResource(R.string.home_hero_page, pagerState.currentPage + 1, slides.size)
    val autoplay = slides.size > 1 && !animationsDisabled(LocalContext.current)

    if (autoplay) {
        LaunchedEffect(pagerState.currentPage, carousel.autoplayMs) {
            delay(carousel.autoplayMs.toLong())
            pagerState.animateScrollToPage((pagerState.currentPage + 1) % slides.size)
        }
    }

    Column(modifier = Modifier.semantics { contentDescription = carouselLabel }) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp),
        ) { page ->
            HeroSlideCard(
                slide = slides[page],
                pageLabel = stringResource(R.string.home_hero_page, page + 1, slides.size),
                onSlideClick = onSlideClick,
            )
        }
        if (slides.size > 1) {
            // Same dot strip idiom as ProductDetailScreen's gallery: the
            // strip announces the page position, the dots themselves carry
            // no semantics; inactive dots stay onSurfaceVariant for
            // contrast (Task 12.4).
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .semantics { contentDescription = pageLabel },
                horizontalArrangement = Arrangement.Center,
            ) {
                repeat(slides.size) { index ->
                    val active = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .width(if (active) 16.dp else 6.dp)
                            .height(6.dp)
                            .clip(CircleShape)
                            .background(
                                if (active) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                    )
                }
            }
        }
    }
}

/** One carousel page: full-bleed photo, scrim, name + optional price, CTA tap. */
@Composable
private fun HeroSlideCard(
    slide: HeroSlide,
    pageLabel: String,
    onSlideClick: (verticalValue: String, slug: String) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable { onSlideClick(slide.vertical.value, slide.slug) }
            // Per-page state: TalkBack reads "Slide 2 of 5" as the page's
            // state alongside the image's alt text.
            .semantics { stateDescription = pageLabel },
    ) {
        AsyncImage(
            model = slide.imageURL,
            contentDescription = slide.imageAlt,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
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
                text = slide.name,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                maxLines = 2,
            )
            slide.priceLabel?.let { price ->
                Text(
                    text = price,
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White.copy(alpha = 0.85f),
                )
            }
        }
    }
}

/**
 * Reduced-motion heuristic (accepted for this surface): the global animator
 * duration scale is 0 when the user has disabled animations — the carousel
 * then sits still and only responds to swipes.
 */
private fun animationsDisabled(context: Context): Boolean =
    Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE,
        1f,
    ) == 0f

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

/**
 * One "Why Mishran" pillar card — styled after [JournalRailCard] but without
 * imagery: the label's initial sits where the story photo would (the rail
 * card's own no-image fallback idiom), themed container/on-container pairs
 * keep contrast guaranteed, and the tap opens the filtered journal.
 */
@Composable
private fun PillarCard(
    label: String,
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
                text = label.take(1),
                style = MaterialTheme.typography.headlineMedium,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
            )
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
