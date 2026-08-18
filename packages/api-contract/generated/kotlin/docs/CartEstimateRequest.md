
# CartEstimateRequest

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **items** | [**kotlin.collections.List&lt;CartItem&gt;**](CartItem.md) |  |  |
| **pincode** | **kotlin.String** | Optional. With a SERVICEABLE pincode the estimate resolves the tier, delivery fee, and free-delivery threshold. Absent or unserviceable → null tier, zero fee, null threshold (the client shows its no-pincode copy).  |  [optional] |



