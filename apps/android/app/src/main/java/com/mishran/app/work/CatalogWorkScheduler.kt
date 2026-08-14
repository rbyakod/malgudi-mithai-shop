// apps/android/app/src/main/java/com/mishran/app/work/CatalogWorkScheduler.kt — Task 9.2.
//
// Idempotent scheduling of the 6h catalog refresh. `existing KEEP` means the
// first app launch after install enqueues it and every later launch is a no-op,
// so the cadence never resets as the user opens/closes the app. 6h matches the
// repository's STALE_WINDOW_MS so a live device never serves rows past their
// freshness cutoff for long.
package com.mishran.app.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CatalogWorkScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    fun schedulePeriodicRefresh() {
        val request = PeriodicWorkRequestBuilder<CatalogRefreshWorker>(REFRESH_INTERVAL_HOURS, TimeUnit.HOURS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    private companion object {
        const val UNIQUE_WORK_NAME = "catalog-refresh"
        const val REFRESH_INTERVAL_HOURS = 6L
    }
}
