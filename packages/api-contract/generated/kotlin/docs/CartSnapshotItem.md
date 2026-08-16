
# CartSnapshotItem

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **productId** | **kotlin.String** |  |  |
| **slug** | **kotlin.String** |  |  |
| **name** | **kotlin.String** |  |  |
| **quantity** | **kotlin.Int** |  |  |
| **freshnessStatus** | [**inline**](#FreshnessStatus) |  |  |
| **packLabel** | **kotlin.String** | Pack-size label the line was priced against (present when the request&#39;s CartItem carried one); null for base-price lines.  |  [optional] |
| **unit** | **kotlin.String** | Pack identity of the priced line, e.g. \&quot;500g\&quot; / \&quot;1 kg\&quot; / \&quot;250 g\&quot;.  |  [optional] |
| **priceInPaise** | **kotlin.Int** | Server-resolved line price in paise (per unit, not x quantity). |  [optional] |
| **image** | **kotlin.String** | First product image URL (absolute), when one exists. |  [optional] |


<a id="FreshnessStatus"></a>
## Enum: freshnessStatus
| Name | Value |
| ---- | ----- |
| freshnessStatus | made-daily, made-to-order, batch-frozen,  |



