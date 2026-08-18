# Order

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**customerId** | **String** |  | 
**items** | [OrderItemsInner] |  | 
**totals** | [**OrderTotals**](OrderTotals.md) |  | 
**status** | **String** |  | 
**paymentStatus** | **String** |  | 
**paymentMethod** | **String** | How the order collects its money. razorpay: prepaid through the Razorpay sheet (razorpayOrderId set; webhook/verify settle it). cod: cash at the door — born status&#x3D;confirmed with paymentStatus&#x3D;pending until staff mark cash collected; razorpayOrderId stays null so payment-side jobs skip it. Legacy orders read as razorpay.  | [optional] [default to .razorpay]
**couponCode** | **String** | Coupon whose discount is reflected in totals.discountInPaise, when one was applied. | [optional] 
**deliveryAddressId** | **String** |  | 
**slot** | [**OrderSlot**](OrderSlot.md) |  | [optional] 
**source** | **String** |  | 
**razorpayOrderId** | **String** |  | [optional] 
**createdAt** | **Date** |  | 
**updatedAt** | **Date** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


