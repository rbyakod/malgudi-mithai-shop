# CartValidateRequest

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [CartItem] |  | 
**pincode** | **String** |  | 
**slot** | [**CartValidateRequestSlot**](CartValidateRequestSlot.md) |  | [optional] 
**couponCode** | **String** | Optional coupon code to resolve and fold into totals. An invalid code fails the request with INVALID_COUPON (a customer mid- checkout wants the error, not a silent full-price snapshot).  | [optional] 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


