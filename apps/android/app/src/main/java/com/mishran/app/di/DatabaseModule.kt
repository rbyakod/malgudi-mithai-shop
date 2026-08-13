// apps/android/app/src/main/java/com/mishran/app/di/DatabaseModule.kt — Task 7.3 / 9.1.
//
// Hilt providers for local persistence: the typed Preferences DataStore (auth
// tokens, ETag, locale) + the Room database (offline catalog cache). The
// DataStore is created once per process via the top-level `preferencesDataStore`
// delegate so every injection site shares one file + one in-memory cache. Room
// is a single @Singleton database exposing one DAO per table; cart + orders
// DAOs are appended here (and the version bumped) in later phases.
package com.mishran.app.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.room.Room
import com.mishran.app.data.local.MishranDatabase
import com.mishran.app.data.local.dao.CartDao
import com.mishran.app.data.local.dao.ProductDao
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

    @Provides
    @Singleton
    fun provideMishranDatabase(
        @ApplicationContext context: Context,
    ): MishranDatabase =
        Room.databaseBuilder(context, MishranDatabase::class.java, "mishran.db")
            // v1 catalog-only schema; fallback destructive migration is fine
            // while the schema is still churning pre-launch.
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideProductDao(database: MishranDatabase): ProductDao = database.productDao()

    @Provides
    fun provideCartDao(database: MishranDatabase): CartDao = database.cartDao()
}

