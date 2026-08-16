# Review

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**productId** | **String** |  | 
**rating** | **Int** |  | 
**body** | **String** |  | [optional] 
**authorName** | **String** |  | [optional] 
**verifiedPurchase** | **Bool** | Server-stamped true when the customer has a delivered order containing the product. | 
**orderId** | **String** | Linked delivered order when verifiedPurchase is true. | [optional] 
**status** | **String** |  | 
**created** | **Bool** | True when a new review row was created; false when an existing (customer, product) review was updated. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


