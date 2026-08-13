// apps/android/app/src/main/java/com/mishran/app/work/OrderWorkScheduler.kt — Task 11.1.
//
// Idempotent scheduling of the hourly order refresh. `existing KEEP` means
// the first launch after install enqueues it and later launches no-op, so
// the cadence never resets. UNMETERED (Wi-Fi) per the plan — order status
// JSON is small but the refresh is a catch-up mechanism, not user-facing,
// so it waits for a generous network. The 401-refresh authenticator keeps
// the call authenticated even when the access token aged out in between.
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
class OrderWorkScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    fun schedulePeriodicRefresh() {
        val request = PeriodicWorkRequestBuilder<OrderRefreshWorker>(REFRESH_INTERVAL_HOURS, TimeUnit.HOURS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.UNMETERED)
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
        const val UNIQUE_WORK_NAME = "order-refresh"
        const val REFRESH_INTERVAL_HOURS = 1L
    }
}
