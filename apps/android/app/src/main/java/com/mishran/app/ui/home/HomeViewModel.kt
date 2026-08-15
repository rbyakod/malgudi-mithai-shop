// apps/android/app/src/main/java/com/mishran/app/ui/home/HomeViewModel.kt
//
// Home-tab state off the offline-first catalog (cache emission renders
// instantly; the network refresh may swap in newer rows). Reuses
// [GetCatalogUseCase] — no dedicated home endpoint exists in the mobile v1
// contract. The screen derives its hero image, best-seller rail, and
// family counts from the one list.
package com.mishran.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Product
import com.mishran.app.domain.usecase.GetCatalogUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class HomeViewModel @Inject constructor(
    getCatalog: GetCatalogUseCase,
) : ViewModel() {

    /** Whole cached catalog — the screen slices rail + counts from it. */
    val products: StateFlow<List<Product>> = getCatalog()
        .catch { emit(emptyList()) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            emptyList(),
        )

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
