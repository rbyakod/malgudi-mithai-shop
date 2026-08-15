# CartAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**cartValidatePost**](CartAPI.md#cartvalidatepost) | **POST** /cart/validate | 


# **cartValidatePost**
```swift
    open class func cartValidatePost(cartValidateRequest: CartValidateRequest, completion: @escaping (_ data: CartValidatePost200Response?, _ error: Error?) -> Void)
```



Validate the customer's cart: authenticate, re-check pincode serviceability, re-fetch each product to confirm it still exists, persist a tamper-evident cart snapshot, and return the snapshot id + shape valid for 10 minutes.  NOTE: totals are all zero today — commerce / variant pricing on MithaiProducts is deferred to Phase 8. This endpoint gives mobile clients a stable contract for cart shape + availability now. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let cartValidateRequest = CartValidateRequest(items: [CartItem(productId: "productId_example", quantity: 123)], pincode: "pincode_example", slot: CartValidateRequest_slot(date: "date_example", window: "window_example")) // CartValidateRequest | 

CartAPI.cartValidatePost(cartValidateRequest: cartValidateRequest) { (response, error) in
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
 **cartValidateRequest** | [**CartValidateRequest**](CartValidateRequest.md) |  | 

### Return type

[**CartValidatePost200Response**](CartValidatePost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

