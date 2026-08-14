// apps/android/app/src/main/java/com/mishran/app/data/sync/PushRegistrationScheduler.kt — Task 11.3.
//
// Idempotent scheduling of the one-shot push-token upload. Called from
// FCM's onNewToken and after a successful login (the route is
// customer-scoped, so registering before login would 401). KEEP + unique
// name collapses a token rotation that lands mid-login into one upload.
package com.mishran.app.data.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object PushRegistrationScheduler {

    private const val UNIQUE_WORK_NAME = "push-registration"

    fun enqueue(context: Context) {
        val request = OneTimeWorkRequestBuilder<PushRegistrationWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }
}
