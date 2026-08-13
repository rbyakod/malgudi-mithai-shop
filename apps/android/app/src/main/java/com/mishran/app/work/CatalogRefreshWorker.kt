// apps/android/app/src/main/java/com/mishran/app/work/CatalogRefreshWorker.kt — Task 9.2.
//
// WorkManager janitor: every 6h it revalidates the catalog cache (If-None-Match
// → 200 upsert / 304 extend freshness). A network failure retries with
// WorkManager's own backoff rather than surfacing anywhere — the cache keeps
// serving whatever it holds. Periodic work never retries past its schedule, so
// Result.retry() simply defers to the next backoff slot within that window.
package com.mishran.app.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mishran.app.data.repository.CatalogRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class CatalogRefreshWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val catalogRepository: CatalogRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = try {
        catalogRepository.refreshNow()
        Result.success()
    } catch (e: Exception) {
        if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
    }

    private companion object {
        // One retry inside the 6h window is plenty for a janitor refresh.
        const val MAX_ATTEMPTS = 1
    }
}
