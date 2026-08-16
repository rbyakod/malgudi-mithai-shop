// apps/android/app/src/main/java/com/mishran/app/ui/stories/StoriesScreen.kt — P2 net-new (stories) / parity batch.
//
// The journal list: the newest story rendered as a full-bleed hero card (image
// + title + pillar chip + date), with every older story as a row beneath
// (thumbnail, title, excerpt, pillar chip, date). PullToRefreshBox over the
// LazyColumn drives a forced ETag-bypassing refresh. Entry points: Home's
// "From the journal" rail, the Account "Journal" row, and (parity batch)
// Home's "Why Mishran" cards, which preselect a pillar via ?pillar=.
//
// Parity batch: a horizontal single-select FilterChip row above the list —
// "All" plus one chip per pillar present in the cached stories, labeled via
// the stories.pillar.<value> strings.
package com.mishran.app.ui.stories

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.mishran.app.R
import com.mishran.api.models.Story

/** Label resource per pillar wire value; the fallback renders the raw value. */
internal fun pillarLabelRes(pillar: String): Int? = when (pillar) {
    "farm" -> R.string.stories_pillar_farm
    "milk" -> R.string.stories_pillar_milk
    "karigar" -> R.string.stories_pillar_karigar
    "karigari" -> R.string.stories_pillar_karigari
    "packaging" -> R.string.stories_pillar_packaging
    "festival" -> R.string.stories_pillar_festival
    "regional" -> R.string.stories_pillar_regional
    "recipe" -> R.string.stories_pillar_recipe
    "journal" -> R.string.stories_pillar_journal
    else -> null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StoriesScreen(
    onBack: () -> Unit,
    onStoryClick: (slug: String) -> Unit,
    viewModel: StoriesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val selectedPillar by viewModel.selectedPillar.collectAsStateWithLifecycle()
    val availablePillars by viewModel.availablePillars.collectAsStateWithLifecycle()
    val stories by viewModel.visibleStories.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.stories_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Pillar chips — All + one per pillar present in the list.
                if (state !is StoriesUiState.Loading && availablePillars.isNotEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FilterChip(
                            selected = selectedPillar == null,
                            onClick = { viewModel.onPillarChange(null) },
                            label = { Text(stringResource(R.string.stories_filter_all)) },
                        )
                        availablePillars.forEach { pillar ->
                            val labelRes = pillarLabelRes(pillar)
                            FilterChip(
                                selected = selectedPillar == pillar,
                                onClick = { viewModel.onPillarChange(pillar) },
                                label = {
                                    Text(
                                        text = labelRes?.let { stringResource(it) } ?: pillar,
                                    )
                                },
                            )
                        }
                    }
                }
                when {
                    state is StoriesUiState.Loading -> Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) { CircularProgressIndicator() }
                    stories.isEmpty() -> Box(
                        modifier = Modifier.fillMaxSize().padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = stringResource(R.string.stories_empty),
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = TextAlign.Center,
                        )
                    }
                    else -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        // Newest story: the hero card. The repository emits
                        // newest-first, so index 0 is the hero by construction.
                        item(key = stories[0].id) {
                            StoryHeroCard(
                                story = stories[0],
                                onClick = { onStoryClick(stories[0].slug) },
                            )
                        }
                        items(stories.size - 1, key = { stories[it + 1].id }) { index ->
                            val story = stories[index + 1]
                            StoryRow(
                                story = story,
                                onClick = { onStoryClick(story.slug) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Full-width editorial card for the newest story — image over scrimmed title. */
@Composable
internal fun StoryHeroCard(
    story: Story,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Box {
            story.heroImage?.let { image ->
                AsyncImage(
                    model = image,
                    contentDescription = story.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f),
                )
            }
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PillarChip(pillar = story.pillar.value)
                Text(
                    text = story.title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                formatStoryDate(story.publishedAt)?.let { date ->
                    Text(
                        text = date,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/** Older-story row: square thumbnail on the start, text stack beside it. */
@Composable
internal fun StoryRow(
    story: Story,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            story.heroImage?.let { image ->
                AsyncImage(
                    model = image,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(88.dp),
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = story.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                story.excerpt?.let { excerpt ->
                    Text(
                        text = excerpt,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PillarChip(pillar = story.pillar.value)
                    formatStoryDate(story.publishedAt)?.let { date ->
                        Text(
                            text = date,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

/** Small disabled chip carrying the story's pillar value ("karigar", "farm"). */
@Composable
internal fun PillarChip(pillar: String, modifier: Modifier = Modifier) {
    SuggestionChip(
        onClick = {},
        enabled = false,
        label = { Text(pillar, style = MaterialTheme.typography.labelSmall) },
        colors = SuggestionChipDefaults.suggestionChipColors(
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        border = null,
        shape = RoundedCornerShape(50),
        modifier = modifier,
    )
}
