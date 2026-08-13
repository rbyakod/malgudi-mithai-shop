// apps/android/app/src/main/java/com/mishran/app/widget/WidgetOrderState.kt — Task 11.2.
//
// Pure state mapping for the order-status widget: which order to track (the
// newest one still moving — delivered/cancelled/etc. drop off the widget)
// and the three text lines rendered per stage. Extracted from the Glance
// composition so every stage's render is JVM-testable without layoutlib.
package com.mishran.app.widget

import com.mishran.api.models.Order
import com.mishran.app.ui.orders.stageIndexFor
import com.mishran.app.ui.orders.statusLabel

/** Statuses the widget tracks — anything still worth glancing at. */
val TRACKABLE_STATUSES: Set<Order.Status> = setOf(
    Order.Status.created,
    Order.Status.pending_payment,
    Order.Status.confirmed,
    Order.Status.packed,
    Order.Status.dispatched,
    Order.Status.out_for_delivery,
)

/**
 * The newest order still in flight, or null when nothing is trackable (the
 * widget then renders its empty state). Input is newest-first, matching the
 * DAO's ordering.
 */
fun latestTrackableOrder(orders: List<Order>): Order? =
    orders.firstOrNull { it.status in TRACKABLE_STATUSES }

/** The widget's three lines for a tracked order. */
data class WidgetLines(
    val title: String,
    val stage: String,
    val eta: String,
)

/** Title / stage / ETA copy for a tracked order; pure for JVM tests. */
fun widgetLines(order: Order): WidgetLines {
    val eta = when {
        order.slot?.date != null && order.slot?.window != null ->
            "Arriving ${order.slot!!.date} ${order.slot!!.window}"
        stageIndexFor(order.status) != null -> "We'll share timing as it moves"
        else -> "Complete the payment to confirm"
    }
    val stage = when (val index = stageIndexFor(order.status)) {
        null -> statusLabel(order.status)
        else -> "${statusLabel(order.status)} · ${index + 1}/${TIMELINE_STAGE_COUNT}"
    }
    return WidgetLines(
        title = "Mishran order",
        stage = stage,
        eta = eta,
    )
}

private const val TIMELINE_STAGE_COUNT = 5
