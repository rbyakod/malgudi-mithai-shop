
# Review

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **id** | **kotlin.String** |  |  |
| **productId** | **kotlin.String** |  |  |
| **rating** | **kotlin.Int** |  |  |
| **verifiedPurchase** | **kotlin.Boolean** | Server-stamped true when the customer has a delivered order containing the product. |  |
| **status** | [**inline**](#Status) |  |  |
| **created** | **kotlin.Boolean** | True when a new review row was created; false when an existing (customer, product) review was updated. |  |
| **body** | **kotlin.String** |  |  [optional] |
| **authorName** | **kotlin.String** |  |  [optional] |
| **orderId** | **kotlin.String** | Linked delivered order when verifiedPurchase is true. |  [optional] |


<a id="Status"></a>
## Enum: status
| Name | Value |
| ---- | ----- |
| status | pending, approved, rejected |



