# CartSnapshotItem

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**productId** | **String** |  | 
**slug** | **String** |  | 
**name** | **String** |  | 
**quantity** | **Int** |  | 
**freshnessStatus** | **String** |  | 
**packLabel** | **String** | Pack-size label the line was priced against (present when the request&#39;s CartItem carried one); null for base-price lines.  | [optional] 
**unit** | **String** | Pack identity of the priced line, e.g. \&quot;500g\&quot; / \&quot;1 kg\&quot; / \&quot;250 g\&quot;.  | [optional] 
**priceInPaise** | **Int** | Server-resolved line price in paise (per unit, not x quantity). | [optional] 
**image** | **String** | First product image URL (absolute), when one exists. | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


