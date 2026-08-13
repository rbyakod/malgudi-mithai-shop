// apps/android/app/src/main/java/com/mishran/app/data/repository/OrderRepository.kt — Task 11.1.
//
// Single source of truth for the customer's orders. observeOrders() streams
// the Room cache (last 20, newest first); refreshOrders() pulls page 1 and
// transactionally replaces the cache — failures are swallowed (returns false)
// so the tab keeps serving whatever is on disk. getOrder() serves the detail
// screen + deep links: Room first, single network fetch on a cold cache,
// cached back so a later offline visit still renders. Line items ride along
// as a JSON blob (Moshi adapter shared with the network graph).
package com.mishran.app.data.repository

import com.mishran.api.models.Order
import com.mishran.api.models.OrderItemsInner
import com.mishran.api.models.OrderSlot
import com.mishran.api.models.OrderTotals
import com.mishran.app.data.local.dao.OrderDao
import com.mishran.app.data.local.entity.OrderEntity
import com.mishran.app.data.remote.api.MishranApi
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Instant
import java.time.format.DateTimeParseException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepository @Inject constructor(
    private val api: MishranApi,
    private val orderDao: OrderDao,
    moshi: Moshi,
) {

    private val itemsAdapter: com.squareup.moshi.JsonAdapter<List<OrderItemsInner>> =
        orderItemsAdapter(moshi)

    /** Live cached orders, newest first (max 20 rows). */
    fun observeOrders(): Flow<List<Order>> =
        orderDao.observeAll().map { rows -> rows.map { it.toDomain(decodeItems(it.itemsJson)) } }

    /**
     * Fetch page 1 from the server and replace the cache. Returns false on
     * any failure (offline, auth, 5xx) — the cache is left untouched.
     */
    suspend fun refreshOrders(): Boolean = try {
        val orders = api.listOrders(page = 1, pageSize = PAGE_SIZE).data.items
        orderDao.replaceAll(orders.map { it.toEntity(itemsAdapter.toJson(it.items)) })
        true
    } catch (e: Exception) {
        false
    }

    /**
     * One-shot lookup for the detail screen: Room first, then a single
     * network fetch (cached back) when the row is not on disk — e.g. a push
     * deep link into an order the list screen never loaded. Null when both
     * miss (offline first run); the caller renders a not-found state.
     */
    suspend fun getOrder(id: String): Order? {
        orderDao.getById(id)?.let { return it.toDomain(decodeItems(it.itemsJson)) }
        return try {
            api.getOrder(id).data.also { order ->
                orderDao.insertAll(listOf(order.toEntity(itemsAdapter.toJson(order.items))))
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun decodeItems(itemsJson: String): List<OrderItemsInner> =
        runCatching { itemsAdapter.fromJson(itemsJson) }.getOrNull() ?: emptyList()

    companion object {
        /** Matches the DAO's LIMIT — one page is the whole v1 orders tab. */
        const val PAGE_SIZE = 20
    }
}

/**
 * Moshi adapter for the order line-item blob — top-level so the 11.2 widget
 * decodes rows through the same path as the repository.
 */
internal fun orderItemsAdapter(
    moshi: Moshi,
): com.squareup.moshi.JsonAdapter<List<OrderItemsInner>> =
    moshi.adapter(Types.newParameterizedType(List::class.java, OrderItemsInner::class.java))

/** Map a fetched order to its cache row; [itemsJson] carries the line items. */
internal fun Order.toEntity(itemsJson: String): OrderEntity = OrderEntity(
    id = id,
    customerId = customerId,
    status = status.value,
    paymentStatus = paymentStatus.value,
    source = source.value,
    deliveryAddressId = deliveryAddressId,
    createdAt = createdAt,
    createdAtEpoch = epochOrZero(createdAt),
    updatedAt = updatedAt,
    slotDate = slot?.date,
    slotWindow = slot?.window,
    razorpayOrderId = razorpayOrderId,
    itemsTotalInPaise = totals.itemsTotalInPaise,
    deliveryFeeInPaise = totals.deliveryFeeInPaise,
    taxesInPaise = totals.taxesInPaise,
    discountInPaise = totals.discountInPaise,
    totalInPaise = totals.totalInPaise,
    itemsJson = itemsJson,
)

/** Restore a cache row to the contract model; value-strings map back to enums. */
internal fun OrderEntity.toDomain(items: List<OrderItemsInner>): Order {
    val status = Order.Status.values().firstOrNull { it.value == this.status }
        // Unknown status (server ahead of the contract): treat as freshly
        // created — the least-wrong render, same fallback shape as the catalog.
        ?: Order.Status.created
    val paymentStatus = Order.PaymentStatus.values()
        .firstOrNull { it.value == this.paymentStatus } ?: Order.PaymentStatus.pending
    val source = Order.Source.values().firstOrNull { it.value == this.source }
        ?: Order.Source.mobileMinusAndroid
    return Order(
        id = id,
        customerId = customerId,
        items = items,
        totals = OrderTotals(
            itemsTotalInPaise = itemsTotalInPaise,
            deliveryFeeInPaise = deliveryFeeInPaise,
            taxesInPaise = taxesInPaise,
            discountInPaise = discountInPaise,
            totalInPaise = totalInPaise,
        ),
        status = status,
        paymentStatus = paymentStatus,
        deliveryAddressId = deliveryAddressId,
        source = source,
        createdAt = createdAt,
        updatedAt = updatedAt,
        slot = if (slotDate != null || slotWindow != null) {
            OrderSlot(date = slotDate, window = slotWindow)
        } else {
            null
        },
        razorpayOrderId = razorpayOrderId,
    )
}

/** ISO-8601 instant → epoch millis; 0 when unparseable (sorts oldest). */
internal fun epochOrZero(iso: String): Long = try {
    Instant.parse(iso).toEpochMilli()
} catch (e: DateTimeParseException) {
    0L
}
