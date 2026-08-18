# CartEstimate

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**itemsTotalInPaise** | **Int** |  | 
**deliveryFeeInPaise** | **Int** |  | 
**discountInPaise** | **Int** |  | 
**totalInPaise** | **Int** |  | 
**pincodeTier** | **String** | Service tier of the resolved pincode; null when no/unserviceable pincode was sent. | 
**freeDeliveryThresholdInPaise** | **Int** | Tier&#39;s free-delivery threshold in paise; null when the tier is unknown. | 
**freeDeliveryEligible** | **Bool** | True when the tier is known and the subtotal met the threshold (fee already zeroed). | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


