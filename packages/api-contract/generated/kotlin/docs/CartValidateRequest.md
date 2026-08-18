
# CartValidateRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **items** | [**kotlin.collections.List&lt;CartItem&gt;**](CartItem.md) |  |  |
| **pincode** | **kotlin.String** |  |  |
| **slot** | [**CartValidateRequestSlot**](CartValidateRequestSlot.md) |  |  [optional] |
| **couponCode** | **kotlin.String** | Optional coupon code to resolve and fold into totals. An invalid code fails the request with INVALID_COUPON (a customer mid- checkout wants the error, not a silent full-price snapshot).  |  [optional] |



