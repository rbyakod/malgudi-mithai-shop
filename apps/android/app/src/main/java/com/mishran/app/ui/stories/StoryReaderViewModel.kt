// apps/android/app/src/main/java/com/mishran/app/ui/stories/StoryReaderViewModel.kt — P2 net-new (stories).
//
// Reader-screen state: one-shot lookup over the shared UiState lifecycle —
// network-first for the flattened body (the only body source), Room's cached
// body column as the offline fallback, null when both miss. retry() re-runs
// the same load so a transient failure never strands the screen.
package com.mishran.app.ui.stories

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.api.models.StoryDetail
import com.mishran.app.data.repository.StoryRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StoryReaderViewModel @Inject constructor(
    private val repository: StoryRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Injected from the route — see Routes.STORY ("story/{slug}"). */
    val slug: String = checkNotNull(savedStateHandle["slug"])

    private val _state = MutableStateFlow<UiState<StoryDetail>>(UiState.Loading)
    val state: StateFlow<UiState<StoryDetail>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            val story = repository.getStory(slug)
            _state.value =
                if (story == null) UiState.Error("This story could not be loaded.")
                else UiState.Success(story)
        }
    }
}
