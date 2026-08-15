// apps/android/app/src/main/java/com/mishran/app/data/repository/SettingsRepository.kt — Task 13.1.
//
// Tiny typed-preferences wrapper for one-off UI flags that outlive the
// composition but belong to no domain (unlike AuthRepository's session keys).
// Same DataStore injection pattern as the sibling repositories — the flag
// here gates the POST_NOTIFICATIONS runtime request so the app never
// re-prompts a user who already answered (denied included).
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.app.data.local.DataStoreKeys
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

@Singleton
class SettingsRepository @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {

    /** True once the notification permission has been asked (denied counts). */
    suspend fun isNotificationPermissionAsked(): Boolean =
        dataStore.data.first()[DataStoreKeys.NOTIFICATION_PERMISSION_ASKED] == true

    /**
     * Persist the asked flag. Callers write it BEFORE launching the system
     * dialog so a process death mid-prompt can never trigger a second ask.
     */
    suspend fun markNotificationPermissionAsked() {
        dataStore.edit { it[DataStoreKeys.NOTIFICATION_PERMISSION_ASKED] = true }
    }
}

/** Hilt bridge for the Compose app root (outside any Hilt-scoped host). */
@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface SettingsRepositoryEntryPoint {
    fun settingsRepository(): SettingsRepository
}
