// apps/android/app/src/main/java/com/mishran/app/ui/common/UiState.kt — Task 8.1.
//
// Generic one-shot UI state for screens driven by a single action (send OTP,
// verify payment, …). Distinct from streaming/Flow states (catalog) which use
// their own sealed types. Kept intentionally small: four states cover the
// loading lifecycle without modeling partial/transient combos the UI doesn't
// render yet.
package com.mishran.app.ui.common

sealed interface UiState<out T> {
    data object Idle : UiState<Nothing>
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}
