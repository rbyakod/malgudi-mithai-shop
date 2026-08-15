
# Product

## Properties
| Name | Type | Description | Notes |
| ------------ | ------------- | ------------- | ------------- |
| **id** | **kotlin.String** |  |  |
| **slug** | **kotlin.String** |  |  |
| **name** | **kotlin.String** |  |  |
| **family** | [**inline**](#Family) |  |  |
| **displayPrice** | **kotlin.String** | Display-only. Commerce deferred to Phase 8. |  [optional] |
| **weight** | **kotlin.String** | Net pack weight as display text, e.g. \&quot;250 g\&quot;, \&quot;1 kg\&quot;. Drives the pack-size chip. |  [optional] |
| **featured** | **kotlin.Boolean** | Flags the product for the apps&#39; Best sellers rail. |  [optional] |
| **freshnessStatus** | [**inline**](#FreshnessStatus) |  |  [optional] |
| **dietaryTags** | **kotlin.collections.List&lt;kotlin.String&gt;** |  |  [optional] |
| **allergens** | **kotlin.collections.List&lt;kotlin.String&gt;** |  |  [optional] |
| **ingredients** | **kotlin.String** |  |  [optional] |
| **shelfLife** | **kotlin.String** |  |  [optional] |
| **storage** | **kotlin.String** |  |  [optional] |
| **images** | **kotlin.collections.List&lt;kotlin.String&gt;** |  |  [optional] |
| **story** | **kotlin.String** |  |  [optional] |
| **karigar** | **kotlin.String** | Karigar (artisan) relationship id, if any. |  [optional] |
| **updatedAt** | **kotlin.String** |  |  [optional] |


<a id="Family"></a>
## Enum: family
| Name | Value |
| ---- | ----- |
| family | classic, original, sugar-free, regional, seasonal |


<a id="FreshnessStatus"></a>
## Enum: freshnessStatus
| Name | Value |
| ---- | ----- |
| freshnessStatus | made-daily, made-to-order, batch-frozen,  |



