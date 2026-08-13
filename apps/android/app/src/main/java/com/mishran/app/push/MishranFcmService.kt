// apps/android/app/src/main/java/com/mishran/app/push/MishranFcmService.kt — Task 11.3.
//
// FCM entry point. Order-update pushes carry orderId/stage/event_id in the
// data payload; the service dedups against the notifications_seen ledger
// (FCM is at-least-once), refreshes the order cache for that order, repaints
// the home-screen widget, publishes to the foreground bus, and posts a
// NotificationCompat whose content intent deep-links to the order detail
// screen. onNewToken (and login) enqueue PushRegistrationWorker, which
// upserts the token against POST /notifications/register-device.
package com.mishran.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.glance.appwidget.updateAll
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.mishran.app.R
import com.mishran.app.data.local.dao.NotificationSeenDao
import com.mishran.app.data.local.entity.NotificationSeenEntity
import com.mishran.app.data.repository.OrderRepository
import com.mishran.app.data.sync.PushRegistrationScheduler
import com.mishran.app.widget.OrderStatusWidget
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.runBlocking
import javax.inject.Inject

@AndroidEntryPoint
class MishranFcmService : FirebaseMessagingService() {

    @Inject lateinit var notificationSeenDao: NotificationSeenDao
    @Inject lateinit var orderRepository: OrderRepository
    @Inject lateinit var pushEventBus: PushEventBus

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ORDER_UPDATES,
            "Order updates",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply { description = "Status changes for your Mishran orders" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val event = parsePushData(message.data)
        if (!event.isRenderable) return

        // Dedup: FCM redelivers; the ledger keeps one row per event_id.
        if (notificationSeenDao.exists(event.eventId!!)) return
        notificationSeenDao.insert(
            NotificationSeenEntity(eventId = event.eventId, seenAt = System.currentTimeMillis()),
        )
        notificationSeenDao.purgeOlderThan(System.currentTimeMillis() - SEEN_TTL_MS)

        // Fresh cache for this order, then repaint the widget from it.
        runBlocking {
            orderRepository.getOrder(event.orderId!!)
            runCatching { OrderStatusWidget().updateAll(applicationContext) }
        }

        pushEventBus.publish(event)
        notifyOrderUpdate(event)
    }

    override fun onNewToken(token: String) {
        PushRegistrationScheduler.enqueue(applicationContext)
    }

    private fun notifyOrderUpdate(event: OrderPushEvent) {
        val tapIntent = Intent(Intent.ACTION_VIEW, Uri.parse("mishran://order/${event.orderId}")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val contentIntent = PendingIntent.getActivity(
            this,
            event.orderId.hashCode(),
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ORDER_UPDATES)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(notificationTitle())
            .setContentText(notificationBody(event.stage))
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(notificationBody(event.stage)),
            )
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(this).notify(event.orderId.hashCode(), notification)
    }

    companion object {
        const val CHANNEL_ORDER_UPDATES = "order_updates"

        /** 30-day dedup window — matches the ledger purge cadence. */
        const val SEEN_TTL_MS = 30L * 24 * 60 * 60 * 1000
    }
}
