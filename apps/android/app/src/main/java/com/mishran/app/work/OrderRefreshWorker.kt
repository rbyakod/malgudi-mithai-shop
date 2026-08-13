// apps/android/app/src/main/java/com/mishran/app/work/OrderRefreshWorker.kt — Task 11.1.
//
// WorkManager janitor: every hour it refreshes the order cache so status
// changes missed by push (FCM delivery is best-effort) still show up when
// the user opens the Orders tab. The repository swallows network failures
// (returns false), so retry is driven by the boolean, not exceptions.
package com.mishran.app.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mishran.app.data.repository.OrderRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class OrderRefreshWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val orderRepository: OrderRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = if (orderRepository.refreshOrders()) {
        Result.success()
    } else {
        if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
    }

    private companion object {
        // One retry inside the hourly window is plenty for a janitor refresh.
        const val MAX_ATTEMPTS = 1
    }
}
