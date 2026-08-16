
# OrderItemsInner

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **productId** | **kotlin.String** |  |  |
| **slug** | **kotlin.String** |  |  |
| **name** | **kotlin.String** |  |  |
| **quantity** | **kotlin.Int** |  |  |
| **unit** | **kotlin.String** |  |  |
| **priceInPaise** | **kotlin.Int** |  |  |
| **packLabel** | **kotlin.String** | Pack-size label the line was priced against (cart ids of the form &#x60;${productId}:${packLabel}&#x60;). Copied through from the cart snapshot so one-tap reorder re-adds the exact pack. Null/absent on base-pack lines and legacy orders.  |  [optional] |
| **image** | **kotlin.String** |  |  [optional] |



