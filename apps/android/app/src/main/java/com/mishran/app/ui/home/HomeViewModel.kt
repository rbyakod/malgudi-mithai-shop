// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeViewModel.kt — P1 parity / P2 net-new.
//
// Home-tab state off the offline-first catalog (cache emission renders
// instantly; the network refresh may swap in newer rows). Reuses
// [GetCatalogUseCase] — no dedicated home endpoint exists in the mobile v1
// contract. The screen derives its hero image, best-seller rail, and
// family counts from the one list.
//
// P1 parity (real best sellers): `bestSellers` prefers the featured rows
// (Product.featured → ProductDao.observeFeatured, re-emitting on every
// catalog upsert) and falls back to the first eight of the catalog until
// anything is flagged — so Home never renders an empty rail on a fresh
// cache whose rows predate the featured column.
//
// P2 net-new: `journal` exposes the three newest stories for the
// "From the journal" rail (reactive off the stories Room cache, so it fills
// in whenever the journal syncs — Home does not fetch it itself).
//
// P3 parity (admin hero): `hero` exposes the curated carousel (network-only
// fetch in its own flow, so it loads in parallel with the catalog and never
// blocks the screen). Null — not yet loaded, unset, or failed — keeps the
// existing static hero rendering; the screen swaps the carousel in only
// when slides exist.
package com.mishran.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.api.models.Story
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.data.repository.HeroCarousel
import com.mishran.app.data.repository.HeroRepository
import com.mishran.app.data.repository.StoryRepository
import com.mishran.app.domain.usecase.GetCatalogUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class HomeViewModel @Inject constructor(
    getCatalog: GetCatalogUseCase,
    catalogRepository: CatalogRepository,
    storyRepository: StoryRepository,
    heroRepository: HeroRepository,
) : ViewModel() {

    /** Whole cached catalog — the screen slices hero + family counts from it. */
    val products: StateFlow<List<Product>> = getCatalog()
        .catch { emit(emptyList()) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            emptyList(),
        )

    /**
     * The Best sellers rail: featured rows when any are flagged, else the
     * first [FALLBACK_COUNT] catalog entries (name-sorted, so the fallback is
     * stable across refreshes).
     */
    val bestSellers: StateFlow<List<Product>> = combine(
        products,
        catalogRepository.observeFeatured().catch { emit(emptyList()) },
    ) { all, featured ->
        featured.ifEmpty { all.take(FALLBACK_COUNT) }
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
        emptyList(),
    )

    /**
     * The "From the journal" rail: the three newest stories, reactive off the
     * Room cache (newest-first ordering lives in the DAO query). Empty until
     * the journal syncs — the rail hides rather than placeholders.
     */
    val journal: StateFlow<List<Story>> = storyRepository.observeLatest(JOURNAL_RAIL_COUNT)
        .catch { emit(emptyList()) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            emptyList(),
        )

    /**
     * The admin-curated hero carousel, or null while unknown — the screen
     * renders its static hero until (and unless) slides arrive. One fetch
     * per subscription; the repository collapses every failure to null and
     * the catch keeps the boundary airtight, so this flow never errors and
     * the catalog flows above are unaffected.
     */
    val hero: StateFlow<HeroCarousel?> = flow {
        emit(heroRepository.getHero())
    }.catch { emit(null) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            null,
        )

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L

        /** Rail length when nothing is featured — matches the pre-parity rail. */
        const val FALLBACK_COUNT = 8

        /** Story cards on the journal rail (spec: three latest). */
        const val JOURNAL_RAIL_COUNT = 3
    }
}
