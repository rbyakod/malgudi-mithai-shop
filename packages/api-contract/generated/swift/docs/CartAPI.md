# CartAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**cartEstimatePost**](CartAPI.md#cartestimatepost) | **POST** /cart/estimate | 
[**cartValidatePost**](CartAPI.md#cartvalidatepost) | **POST** /cart/validate | 


# **cartEstimatePost**
```swift
    open class func cartEstimatePost(cartEstimateRequest: CartEstimateRequest, completion: @escaping (_ data: CartEstimatePost200Response?, _ error: Error?) -> Void)
```



Read-only pricing preview of a cart — the exact /cart/validate math (server-side line re-pricing, pincode tier lookup, tier delivery fee, free-delivery threshold waiver) with nothing persisted and NO sign-in required. Guest carts call this to show delivery fees and threshold progress before checkout. Unpriceable or vanished lines error exactly like validate so callers can distinguish \"here's your estimate\" from \"your cart is stale\"; pincode serviceability is informational here — a known tier prices its real fee/threshold, while an absent or unserviceable pincode yields a null tier, no fee, and no threshold (nothing to estimate against; the client shows its no-pincode copy). Validate enforces serviceability for real. Rate-limited per client IP. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let cartEstimateRequest = CartEstimateRequest(items: [CartItem(productId: "productId_example", quantity: 123, packLabel: "packLabel_example")], pincode: "pincode_example") // CartEstimateRequest | 

CartAPI.cartEstimatePost(cartEstimateRequest: cartEstimateRequest) { (response, error) in
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
 **cartEstimateRequest** | [**CartEstimateRequest**](CartEstimateRequest.md) |  | 

### Return type

[**CartEstimatePost200Response**](CartEstimatePost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cartValidatePost**
```swift
    open class func cartValidatePost(cartValidateRequest: CartValidateRequest, completion: @escaping (_ data: CartValidatePost200Response?, _ error: Error?) -> Void)
```



Validate the customer's cart: authenticate, re-check pincode serviceability, re-fetch each product to confirm it still exists, price every line server-side (optional per-item packLabel prices the matching derived pack size; unpriceable lines like \"on request\" are rejected 422), enforce the fresh-tier rule (made-daily items only ship to fresh-tier pincodes), normalize iOS relative slot tokens, persist a tamper-evident cart snapshot with real totals (subtotal + flat delivery fee by tier; taxes 0, MRP inclusive of GST), and return the snapshot id + shape valid for 10 minutes. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let cartValidateRequest = CartValidateRequest(items: [CartItem(productId: "productId_example", quantity: 123, packLabel: "packLabel_example")], pincode: "pincode_example", slot: CartValidateRequest_slot(date: "date_example", window: "window_example"), couponCode: "couponCode_example") // CartValidateRequest | 

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

