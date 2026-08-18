# OrdersAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ordersCodPost**](OrdersAPI.md#orderscodpost) | **POST** /orders/cod | 
[**ordersGet**](OrdersAPI.md#ordersget) | **GET** /orders | 
[**ordersIdGet**](OrdersAPI.md#ordersidget) | **GET** /orders/{id} | 


# **ordersCodPost**
```swift
    open class func ordersCodPost(codCreateOrderRequest: CodCreateOrderRequest, completion: @escaping (_ data: OrdersIdGet200Response?, _ error: Error?) -> Void)
```



Create a cash-on-delivery order from a validated cart snapshot: requireCustomer, snapshot ownership + 10-minute expiry checks identical to Razorpay create-order, then the order is born status=confirmed / paymentStatus=pending / paymentMethod=cod with razorpayOrderId null (payment-side jobs skip it). Cash is marked collected by staff (orders console). Route lands with the COD batch (B12); declared here so client codegen sees the shape once. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let codCreateOrderRequest = CodCreateOrderRequest(snapshotId: "snapshotId_example", deliveryAddressId: "deliveryAddressId_example") // CodCreateOrderRequest | 

OrdersAPI.ordersCodPost(codCreateOrderRequest: codCreateOrderRequest) { (response, error) in
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
 **codCreateOrderRequest** | [**CodCreateOrderRequest**](CodCreateOrderRequest.md) |  | 

### Return type

[**OrdersIdGet200Response**](OrdersIdGet200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersGet**
```swift
    open class func ordersGet(page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: OrdersGet200Response?, _ error: Error?) -> Void)
```



List the authenticated customer's own orders, newest first. Pagination via `page` and `pageSize` query params; pageSize is capped at 50. Non-integer or NaN values fall back to the defaults (page=1, pageSize=20). The customer id is taken from the verified access token; a forged `customerId` in a query string is never honored. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 20)

OrdersAPI.ordersGet(page: page, pageSize: pageSize) { (response, error) in
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
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 20]

### Return type

[**OrdersGet200Response**](OrdersGet200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersIdGet**
```swift
    open class func ordersIdGet(id: String, completion: @escaping (_ data: OrdersIdGet200Response?, _ error: Error?) -> Void)
```



Fetch a single order by id. Returns 404 ORDER_NOT_FOUND both when the id does not exist and when the order belongs to a different customer (no existence leak). 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let id = "id_example" // String | 

OrdersAPI.ordersIdGet(id: id) { (response, error) in
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
 **id** | **String** |  | 

### Return type

[**OrdersIdGet200Response**](OrdersIdGet200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

