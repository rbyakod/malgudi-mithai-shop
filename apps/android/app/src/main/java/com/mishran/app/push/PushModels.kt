// apps/android/app/src/main/java/com/mishran/app/push/PushModels.kt — Task 11.3.
//
// Pure parsing + copy for order-update pushes. The backend's FCM data
// payload carries orderId / stage / event_id; parsing is a plain map lookup
// (JVM-testable, no Firebase types). Copy maps server stage strings to the
// same friendly labels the orders screens use.
package com.mishran.app.push

import com.mishran.api.models.Order
import com.mishran.app.ui.orders.statusLabel

/** The fields the app cares about from an order-update push. */
data class OrderPushEvent(
    val orderId: String?,
    val stage: String?,
    val eventId: String?,
) {
    /** Dedup + deep link both need their keys; anything less is dropped. */
    val isRenderable: Boolean
        get() = orderId != null && eventId != null
}

/** Read orderId / stage / event_id out of the FCM data payload. */
fun parsePushData(data: Map<String, String>): OrderPushEvent = OrderPushEvent(
    orderId = data[KEY_ORDER_ID],
    stage = data[KEY_STAGE],
    eventId = data[KEY_EVENT_ID],
)

/** Notification title — always the brand, never the raw stage string. */
fun notificationTitle(): String = "Mishran"

/** Notification body per stage, e.g. "Your order is out for delivery". */
fun notificationBody(stage: String?): String {
    val label = Order.Status.values().firstOrNull { it.value == stage }
        ?.let { statusLabel(it) }
        ?: return "Your order has an update"
    return when (stage) {
        Order.Status.pending_payment.value -> "$label — complete it to confirm your order"
        Order.Status.payment_failed.value -> "$label — any deducted amount is refunded in 5-7 days"
        Order.Status.delivered.value -> "Delivered — we hope you enjoy your sweets"
        else -> "Your order is ${label.replaceFirstChar { it.lowercase() }}"
    }
}

private const val KEY_ORDER_ID = "orderId"
private const val KEY_STAGE = "stage"
private const val KEY_EVENT_ID = "event_id"
