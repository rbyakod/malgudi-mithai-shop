# OrderItemsInner

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**productId** | **String** |  | 
**slug** | **String** |  | 
**name** | **String** |  | 
**quantity** | **Int** |  | 
**packLabel** | **String** | Pack-size label the line was priced against (cart ids of the form &#x60;${productId}:${packLabel}&#x60;). Copied through from the cart snapshot so one-tap reorder re-adds the exact pack. Null/absent on base-pack lines and legacy orders.  | [optional] 
**unit** | **String** |  | 
**priceInPaise** | **Int** |  | 
**image** | **String** |  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


