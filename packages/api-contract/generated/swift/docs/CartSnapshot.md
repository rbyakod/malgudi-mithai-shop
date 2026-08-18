# CartSnapshot

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**snapshotId** | **UUID** |  | 
**customerId** | **String** |  | 
**items** | [CartSnapshotItem] |  | 
**totals** | [**OrderTotals**](OrderTotals.md) |  | 
**pincodeTier** | **String** | Service tier of the resolved pincode (e.g. shelf, fresh). | 
**couponCode** | **String** | The coupon code whose discount is folded into totals, when a valid one was supplied to /cart/validate. Null when none.  | [optional] 
**freeDeliveryThresholdInPaise** | **Int** | The pincode tier&#39;s free-delivery threshold in paise (0 disables the waiver; null when the tier is unknown). Clients use this to render threshold progress — never a baked-in constant.  | [optional] 
**expiresAt** | **Date** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


