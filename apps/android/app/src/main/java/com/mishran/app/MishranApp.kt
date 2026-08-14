// apps/android/app/src/main/java/com/mishran/app/MishranApp.kt — Task 7.1 / 9.2.
//
// The @HiltAndroidApp Application triggers Hilt's code generation + creates the
// singleton component that every @AndroidEntryPoint + @HiltViewModel resolves
// against. Since Task 9.2 it is also WorkManager's Configuration.Provider: the
// manifest removes the library's default initializer, and the injected
// HiltWorkerFactory is what lets @HiltWorker classes (catalog refresh, later
// the FCM token upload) receive their dependencies. The 6h catalog refresh is
// (re-)asserted on every launch; KEEP makes it a no-op once enqueued.
package com.mishran.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.mishran.app.work.CatalogWorkScheduler
import com.mishran.app.work.OrderWorkScheduler
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class MishranApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var catalogWorkScheduler: CatalogWorkScheduler
    @Inject lateinit var orderWorkScheduler: OrderWorkScheduler

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        catalogWorkScheduler.schedulePeriodicRefresh()
        orderWorkScheduler.schedulePeriodicRefresh()
    }
}
