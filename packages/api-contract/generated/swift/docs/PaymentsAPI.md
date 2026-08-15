# PaymentsAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**paymentsRazorpayCreateOrderPost**](PaymentsAPI.md#paymentsrazorpaycreateorderpost) | **POST** /payments/razorpay/create-order | 
[**paymentsRazorpayVerifyPost**](PaymentsAPI.md#paymentsrazorpayverifypost) | **POST** /payments/razorpay/verify | 


# **paymentsRazorpayCreateOrderPost**
```swift
    open class func paymentsRazorpayCreateOrderPost(razorpayCreateOrderRequest: RazorpayCreateOrderRequest, idempotencyKey: String? = nil, xClientSource: XClientSource_paymentsRazorpayCreateOrderPost? = nil, completion: @escaping (_ data: PaymentsRazorpayCreateOrderPost200Response?, _ error: Error?) -> Void)
```



Create an internal order + a Razorpay order from a persisted cart snapshot. Idempotent: a replay with the same Idempotency-Key and body returns the cached response without re-running side effects. The X-Client-Source header selects the order `source` field (mobile-android | mobile-ios | web); defaults to mobile-android. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let razorpayCreateOrderRequest = RazorpayCreateOrderRequest(snapshotId: "snapshotId_example", deliveryAddressId: "deliveryAddressId_example") // RazorpayCreateOrderRequest | 
let idempotencyKey = "idempotencyKey_example" // String | Optional. When set, the response is cached for 24h. (optional)
let xClientSource = "xClientSource_example" // String |  (optional) (default to .mobileAndroid)

PaymentsAPI.paymentsRazorpayCreateOrderPost(razorpayCreateOrderRequest: razorpayCreateOrderRequest, idempotencyKey: idempotencyKey, xClientSource: xClientSource) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **razorpayCreateOrderRequest** | [**RazorpayCreateOrderRequest**](RazorpayCreateOrderRequest.md) |  | 
 **idempotencyKey** | **String** | Optional. When set, the response is cached for 24h. | [optional] 
 **xClientSource** | **String** |  | [optional] [default to .mobileAndroid]

### Return type

[**PaymentsRazorpayCreateOrderPost200Response**](PaymentsRazorpayCreateOrderPost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **paymentsRazorpayVerifyPost**
```swift
    open class func paymentsRazorpayVerifyPost(razorpayVerifyRequest: RazorpayVerifyRequest, idempotencyKey: String? = nil, completion: @escaping (_ data: PaymentsRazorpayVerifyPost200Response?, _ error: Error?) -> Void)
```



Verify the Razorpay checkout signature, capture the payment, and transition the order from pending_payment to confirmed. Safe to retry: signature is always re-verified, and an already-captured payment row short-circuits the transition path. Idempotent at the HTTP layer when an Idempotency-Key is supplied. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let razorpayVerifyRequest = RazorpayVerifyRequest(orderId: "orderId_example", razorpayPaymentId: "razorpayPaymentId_example", signature: "signature_example") // RazorpayVerifyRequest | 
let idempotencyKey = "idempotencyKey_example" // String |  (optional)

PaymentsAPI.paymentsRazorpayVerifyPost(razorpayVerifyRequest: razorpayVerifyRequest, idempotencyKey: idempotencyKey) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **razorpayVerifyRequest** | [**RazorpayVerifyRequest**](RazorpayVerifyRequest.md) |  | 
 **idempotencyKey** | **String** |  | [optional] 

### Return type

[**PaymentsRazorpayVerifyPost200Response**](PaymentsRazorpayVerifyPost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

