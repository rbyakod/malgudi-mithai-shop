// apps/android/app/src/main/java/com/mishran/app/push/PushEventBus.kt — Task 11.3.
//
// Process-wide bus for pushes that arrive while the app is foregrounded:
// the FCM service publishes, the app root collects and shows an in-app
// snackbar (the system notification is suppressed-noise in that moment but
// still posted for history; the bus covers the "app is open" gap).
package com.mishran.app.push

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushEventBus @Inject constructor() {

    private val _events = MutableSharedFlow<OrderPushEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<OrderPushEvent> = _events.asSharedFlow()

    fun publish(event: OrderPushEvent) {
        _events.tryEmit(event)
    }
}

/** Hilt bridge for the Compose app root (outside any Hilt-scoped host). */
@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface PushEventBusEntryPoint {
    fun pushEventBus(): PushEventBus
}
