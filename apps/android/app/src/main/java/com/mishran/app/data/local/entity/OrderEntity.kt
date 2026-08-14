// apps/android/app/src/main/java/com/mishran/app/data/local/entity/OrderEntity.kt — Task 11.1.
//
// Room cache of the customer's last 20 orders (offline-first orders tab).
// Enums are stored as JSON value-strings (stable across codegen renames);
// line items are stored as a JSON blob — the list screen only reads
// id/status/total/date and the detail screen renders items read-only, so
// they are never queried by column. createdAtEpoch carries the sort key
// (the raw ISO string round-trips for display equality).
package com.mishran.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "orders")
data class OrderEntity(
    @PrimaryKey val id: String,
    val customerId: String,
    val status: String,
    val paymentStatus: String,
    val source: String,
    val deliveryAddressId: String,
    val createdAt: String,
    val createdAtEpoch: Long,
    val updatedAt: String,
    val slotDate: String?,
    val slotWindow: String?,
    val razorpayOrderId: String?,
    val itemsTotalInPaise: Int,
    val deliveryFeeInPaise: Int,
    val taxesInPaise: Int,
    val discountInPaise: Int,
    val totalInPaise: Int,
    val itemsJson: String,
)
