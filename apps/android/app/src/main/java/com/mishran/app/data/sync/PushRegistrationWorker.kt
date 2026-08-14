// apps/android/app/src/main/java/com/mishran/app/data/sync/PushRegistrationWorker.kt — Task 11.3.
//
// One-shot upload of this device's FCM token to
// POST /notifications/register-device (idempotent server-side upsert).
// Skips silently when nobody is logged in — the post-login hook re-enqueues
// it with a session in place; registering anonymously would only 401.
package com.mishran.app.data.sync

import android.content.Context
import android.os.Build
import com.google.firebase.messaging.FirebaseMessaging
import com.mishran.api.models.NotificationsRegisterDevicePostRequest
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.repository.AuthRepository
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.Locale

@HiltWorker
class PushRegistrationWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val api: MishranApi,
    private val authRepository: AuthRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        if (!authRepository.isLoggedIn()) {
            // Login re-enqueues; nothing to upload anonymously.
            return Result.success()
        }
        return try {
            val token = FirebaseMessaging.getInstance().token.await()
            api.registerDevice(
                NotificationsRegisterDevicePostRequest(
                    platform = NotificationsRegisterDevicePostRequest.Platform.android,
                    pushToken = token,
                    deviceModel = Build.MODEL,
                    osVersion = Build.VERSION.RELEASE,
                    locale = Locale.getDefault().toLanguageTag(),
                ),
            )
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
        }
    }

    private companion object {
        // Token upload is not urgent — two backoff retries then give up;
        // the next token rotation or login re-enqueues.
        const val MAX_ATTEMPTS = 2
    }
}

/** Minimal await for Firebase's Task API without pulling kotlinx-coroutines-play. */
private suspend fun <T> com.google.android.gms.tasks.Task<T>.await(): T =
    kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
        addOnSuccessListener { result -> continuation.resumeWith(Result.success(result)) }
        addOnFailureListener { e -> continuation.resumeWith(Result.failure(e)) }
        addOnCanceledListener { continuation.cancel() }
    }
