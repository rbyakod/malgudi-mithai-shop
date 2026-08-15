// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeViewModel.kt
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
package com.mishran.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.domain.usecase.GetCatalogUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class HomeViewModel @Inject constructor(
    getCatalog: GetCatalogUseCase,
    catalogRepository: CatalogRepository,
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

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L

        /** Rail length when nothing is featured — matches the pre-parity rail. */
        const val FALLBACK_COUNT = 8
    }
}
