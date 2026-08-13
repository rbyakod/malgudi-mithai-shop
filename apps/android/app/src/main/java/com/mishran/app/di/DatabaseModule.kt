// apps/android/app/src/main/java/com/mishran/app/di/DatabaseModule.kt — Task 7.3.
//
// Hilt providers for local persistence. Today only the typed Preferences
// DataStore (auth tokens, ETag, locale) is needed; Room DAOs land in Phase 9
// (orders cache + cart) and will be added here. The DataStore is created once
// per process via the top-level `preferencesDataStore` delegate so every
// injection site shares one file + one in-memory cache.
package com.mishran.app.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun providePreferencesDataStore(
        @ApplicationContext context: Context,
    ): DataStore<Preferences> {
        // SupervisorJob so a failed write on one key does not cancel the store's
        // scope for the lifetime of the process; IO dispatcher for disk access.
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        return PreferenceDataStoreFactory.create(
            scope = scope,
            produceFile = { java.io.File(context.filesDir, "datastore/mishran.preferences_pb") },
        )
    }
}
