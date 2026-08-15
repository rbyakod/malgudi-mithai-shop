// apps/android/app/src/main/java/com/mishran/app/ui/verticals/SnackDetailViewModel.kt — P2 net-new (verticals).
//
// Detail-screen state for a retail snack — one-shot fetch by slug over the
// shared UiState lifecycle, with retry. The list payload already carries
// everything, but the screen fetches its own copy so a deep link / stale list
// row can never render a half-populated page (same rationale as the product
// detail screen's network fallback).
package com.mishran.app.ui.verticals

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.Snack
import com.mishran.app.data.repository.VerticalRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SnackDetailViewModel @Inject constructor(
    private val repository: VerticalRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Injected from the route — see Routes.SNACK ("snack/{slug}"). */
    val slug: String = checkNotNull(savedStateHandle["slug"])

    private val _state = MutableStateFlow<UiState<Snack>>(UiState.Loading)
    val state: StateFlow<UiState<Snack>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repository.getSnack(slug).fold(
                onSuccess = { UiState.Success(it) },
                onFailure = { UiState.Error("This snack could not be loaded.") },
            )
        }
    }
}
