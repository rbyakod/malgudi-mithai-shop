
# CartSnapshot

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **snapshotId** | [**java.util.UUID**](java.util.UUID.md) |  |  |
| **customerId** | **kotlin.String** |  |  |
| **items** | [**kotlin.collections.List&lt;CartSnapshotItem&gt;**](CartSnapshotItem.md) |  |  |
| **totals** | [**OrderTotals**](OrderTotals.md) |  |  |
| **pincodeTier** | **kotlin.String** | Service tier of the resolved pincode (e.g. shelf, fresh). |  |
| **expiresAt** | **kotlin.String** |  |  |
| **couponCode** | **kotlin.String** | The coupon code whose discount is folded into totals, when a valid one was supplied to /cart/validate. Null when none.  |  [optional] |
| **freeDeliveryThresholdInPaise** | **kotlin.Int** | The pincode tier&#39;s free-delivery threshold in paise (0 disables the waiver; null when the tier is unknown). Clients use this to render threshold progress — never a baked-in constant.  |  [optional] |



