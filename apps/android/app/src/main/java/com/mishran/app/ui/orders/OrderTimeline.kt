// apps/android/app/src/main/java/com/mishran/app/ui/orders/OrderTimeline.kt — Task 11.1.
//
// Pure rendering helpers for the orders screens. The backend contract carries
// only the order's CURRENT status (no per-order history array in v1), so the
// detail screen renders the canonical happy-path state machine as a timeline
// with the live stage highlighted; side states (cancelled, payment_failed,
// …) render a banner instead. Extracted top-level for JVM tests.
package com.mishran.app.ui.orders

import com.mishran.api.models.Order
import com.mishran.app.R
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/** Canonical happy-path stages, in order. */
val TIMELINE_STAGES: List<Order.Status> = listOf(
    Order.Status.confirmed,
    Order.Status.packed,
    Order.Status.dispatched,
    Order.Status.out_for_delivery,
    Order.Status.delivered,
)

/**
 * Index of the live stage within [TIMELINE_STAGES], or null for pre-confirmation
 * (created/pending_payment) and side states — those render a banner instead.
 */
fun stageIndexFor(status: Order.Status): Int? = TIMELINE_STAGES.indexOf(status).takeIf { it >= 0 }

/** Friendly copy per status. */
fun statusLabel(status: Order.Status): String = when (status) {
    Order.Status.created -> "Just placed"
    Order.Status.pending_payment -> "Payment pending"
    Order.Status.confirmed -> "Confirmed"
    Order.Status.packed -> "Packed"
    Order.Status.dispatched -> "Dispatched"
    Order.Status.out_for_delivery -> "Out for delivery"
    Order.Status.delivered -> "Delivered"
    Order.Status.payment_failed -> "Payment failed"
    Order.Status.cancelled -> "Cancelled"
    Order.Status.returned -> "Returned"
    Order.Status.failed_delivery -> "Delivery failed"
    Order.Status.abandoned -> "Abandoned"
}

/**
 * @StringRes counterpart of [statusLabel] for Compose call sites (resolved
 * with stringResource). Returns null for the side states that have no
 * generated key yet — callers fall back to [statusLabel]'s English.
 * statusLabel itself stays the single source for the widget + push builders,
 * which render outside composition.
 */
fun statusLabelRes(status: Order.Status): Int? = when (status) {
    Order.Status.created -> R.string.orders_status_created
    Order.Status.pending_payment -> R.string.orders_status_pending_payment
    Order.Status.confirmed -> R.string.orders_status_confirmed
    Order.Status.packed -> R.string.orders_status_packed
    Order.Status.dispatched -> R.string.orders_status_dispatched
    Order.Status.out_for_delivery -> R.string.orders_status_out_for_delivery
    Order.Status.delivered -> R.string.orders_status_delivered
    Order.Status.payment_failed -> R.string.orders_status_payment_failed
    Order.Status.cancelled -> R.string.orders_status_cancelled
    // TODO(i18n): missing keys orders.status_returned/_failed_delivery/_abandoned
    else -> null
}

/** Visual tone for status chips/banners. */
enum class StatusTone { PROGRESS, POSITIVE, NEGATIVE }

fun statusTone(status: Order.Status): StatusTone = when (status) {
    Order.Status.delivered -> StatusTone.POSITIVE
    Order.Status.cancelled,
    Order.Status.payment_failed,
    Order.Status.returned,
    Order.Status.failed_delivery,
    Order.Status.abandoned,
    -> StatusTone.NEGATIVE
    else -> StatusTone.PROGRESS
}

/** ISO-8601 instant → "13 Aug, 3:05 PM" (device zone); raw string if unparseable. */
fun formatOrderDate(iso: String): String = try {
    DateTimeFormatter.ofPattern("d MMM, h:mm a")
        .withZone(ZoneId.systemDefault())
        .format(Instant.parse(iso))
} catch (e: DateTimeParseException) {
    iso
}
