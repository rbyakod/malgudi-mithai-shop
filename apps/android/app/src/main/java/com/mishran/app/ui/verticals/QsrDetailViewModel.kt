// apps/android/app/src/main/java/com/mishran/app/ui/verticals/QsrDetailViewModel.kt — P2 net-new (verticals).
//
// Detail-screen state for a QSR counter-menu item — same one-shot fetch +
// retry shape as SnackDetailViewModel over the walk-in vertical.
package com.mishran.app.ui.verticals

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.QsrItem
import com.mishran.app.data.repository.VerticalRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class QsrDetailViewModel @Inject constructor(
    private val repository: VerticalRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Injected from the route — see Routes.QSR_ITEM ("qsr/{slug}"). */
    val slug: String = checkNotNull(savedStateHandle["slug"])

    private val _state = MutableStateFlow<UiState<QsrItem>>(UiState.Loading)
    val state: StateFlow<UiState<QsrItem>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repository.getQsrItem(slug).fold(
                onSuccess = { UiState.Success(it) },
                onFailure = { UiState.Error("This item could not be loaded.") },
            )
        }
    }
}
