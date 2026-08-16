// apps/android/app/src/main/java/com/mishran/app/ui/stories/StoriesViewModel.kt — P2 net-new (stories) / parity batch.
//
// Journal-list state over the offline-first story cache — the same shape as
// CatalogViewModel: a refresh trigger re-collects the repository's two-emit
// flow (emission #0 = Room cache → Cached, later ones = post-refresh → Fresh),
// pull-to-refresh bumps the trigger with force = true, and failures degrade to
// an empty Fresh list (the repository already swallowed the network error; an
// empty cache simply means "nothing cached yet").
//
// Parity batch: the pillar filter. A single-select "pillar" state (null = All)
// seeded from the optional ?pillar= route arg (Home's "Why Mishran" cards
// deep-link straight into a preselected pillar) narrows the list by exact
// pillar match; the chip row's options derive from the pillars actually
// present in the cached stories.
package com.mishran.app.ui.stories

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Story
import com.mishran.app.data.repository.StoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.stateIn

/** Journal contents by provenance — mirrors CatalogUiState's contract. */
sealed interface StoriesUiState {
    val stories: List<Story>

    data object Loading : StoriesUiState {
        override val stories: List<Story> get() = emptyList()
    }

    /** Served from Room before/without a network round-trip. */
    data class Cached(override val stories: List<Story>) : StoriesUiState

    /** Re-emitted after a successful (or swallowed-failure) refresh. */
    data class Fresh(override val stories: List<Story>) : StoriesUiState
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class StoriesViewModel @Inject constructor(
    private val repository: StoryRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Bumped by refresh(); the first pass is a normal (ETag-conditional) load. */
    private val refreshTrigger = MutableStateFlow(0)

    /** True from refresh() until that pass's post-refresh emission lands. */
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    /**
     * Selected pillar, null = All. Seeded from the optional ?pillar= arg
     * (Home's pillar cards); unknown values fall back to All so a stale
     * deep link still opens the unfiltered journal.
     */
    private val pillar = MutableStateFlow(
        savedStateHandle.get<String>("pillar")?.takeIf { it in KNOWN_PILLARS },
    )
    val selectedPillar: StateFlow<String?> = pillar.asStateFlow()

    fun onPillarChange(value: String?) {
        pillar.value = value?.takeIf { it in KNOWN_PILLARS }
    }

    val uiState: StateFlow<StoriesUiState> = refreshTrigger
        .flatMapLatest { pass ->
            var index = 0
            repository.getStories(force = pass > 0)
                .map { stories ->
                    val state = if (index == 0) StoriesUiState.Cached(stories)
                    else StoriesUiState.Fresh(stories)
                    if (index >= 1) _isRefreshing.value = false
                    index++
                    state
                }
                .catch { emit(StoriesUiState.Fresh(emptyList())) }
                // Belt-and-braces: the flag also clears when the pass
                // completes, so a single-emission source can't pin it.
                .onCompletion { _isRefreshing.value = false }
        }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            StoriesUiState.Loading,
        )

    /** Pillars present in the current list, in first-seen order — the chips. */
    val availablePillars: StateFlow<List<String>> = uiState
        .map { state -> state.stories.flatMapTo(LinkedHashSet()) { listOf(it.pillar.value) }.toList() }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            emptyList(),
        )

    /** The list after the pillar filter — what the screen renders. */
    val visibleStories: StateFlow<List<Story>> = combine(uiState, pillar) { state, selected ->
        filterStoriesByPillar(state.stories, selected)
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
        emptyList(),
    )

    /** Pull-to-refresh: restarts the flow with `force = true`. */
    fun refresh() {
        _isRefreshing.value = true
        refreshTrigger.value += 1
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L

        /** The contract's pillar values — the deep-link arg's whitelist. */
        val KNOWN_PILLARS = setOf(
            "farm", "milk", "karigar", "karigari",
            "packaging", "festival", "regional", "recipe", "journal",
        )
    }
}

/** Exact pillar match; null keeps everything. Extracted for unit tests. */
internal fun filterStoriesByPillar(stories: List<Story>, pillar: String?): List<Story> =
    if (pillar == null) stories else stories.filter { it.pillar.value == pillar }

/**
 * ISO-8601 instant → "13 Aug 2026"; raw string if unparseable. Rendered in
 * UTC deliberately (unlike formatOrderDate's device zone): a story's publish
 * date is editorial metadata, and pinning UTC keeps the label identical across
 * devices — and unit-testable regardless of the host machine's zone.
 */
internal fun formatStoryDate(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return try {
        java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy")
            .withZone(java.time.ZoneOffset.UTC)
            .format(java.time.Instant.parse(iso))
    } catch (e: java.time.format.DateTimeParseException) {
        iso
    }
}
