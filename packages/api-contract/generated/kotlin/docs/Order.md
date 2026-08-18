
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
| **paymentMethod** | [**inline**](#PaymentMethod) | How the order collects its money. razorpay: prepaid through the Razorpay sheet (razorpayOrderId set; webhook/verify settle it). cod: cash at the door — born status&#x3D;confirmed with paymentStatus&#x3D;pending until staff mark cash collected; razorpayOrderId stays null so payment-side jobs skip it. Legacy orders read as razorpay.  |  [optional] |
| **couponCode** | **kotlin.String** | Coupon whose discount is reflected in totals.discountInPaise, when one was applied. |  [optional] |
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


<a id="PaymentMethod"></a>
## Enum: paymentMethod
| Name | Value |
| ---- | ----- |
| paymentMethod | razorpay, cod |



