
# Order

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **id** | **kotlin.String** |  |  |
| **customerId** | **kotlin.String** |  |  |
| **items** | [**kotlin.collections.List&lt;OrderItemsInner&gt;**](OrderItemsInner.md) |  |  |
| **totals** | [**OrderTotals**](OrderTotals.md) |  |  |
| **status** | [**inline**](#Status) |  |  |
| **paymentStatus** | [**inline**](#PaymentStatus) |  |  |
| **deliveryAddressId** | **kotlin.String** |  |  |
| **source** | [**inline**](#Source) |  |  |
| **createdAt** | **kotlin.String** |  |  |
| **updatedAt** | **kotlin.String** |  |  |
| **slot** | [**OrderSlot**](OrderSlot.md) |  |  [optional] |
| **razorpayOrderId** | **kotlin.String** |  |  [optional] |


<a id="Status"></a>
## Enum: status
| Name | Value |
| ---- | ----- |
| status | created, pending_payment, confirmed, packed, dispatched, out_for_delivery, delivered, payment_failed, cancelled, returned, failed_delivery, abandoned |


<a id="PaymentStatus"></a>
## Enum: paymentStatus
| Name | Value |
| ---- | ----- |
| paymentStatus | pending, paid, failed, refunded, partially_refunded |


<a id="Source"></a>
## Enum: source
| Name | Value |
| ---- | ----- |
| source | mobile-android, mobile-ios, web |



