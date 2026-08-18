# OrdersApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**ordersCodPost**](OrdersApi.md#ordersCodPost) | **POST** /orders/cod |  |
| [**ordersGet**](OrdersApi.md#ordersGet) | **GET** /orders |  |
| [**ordersIdGet**](OrdersApi.md#ordersIdGet) | **GET** /orders/{id} |  |


<a id="ordersCodPost"></a>
# **ordersCodPost**
> OrdersIdGet200Response ordersCodPost(codCreateOrderRequest)



Create a cash-on-delivery order from a validated cart snapshot: requireCustomer, snapshot ownership + 10-minute expiry checks identical to Razorpay create-order, then the order is born status&#x3D;confirmed / paymentStatus&#x3D;pending / paymentMethod&#x3D;cod with razorpayOrderId null (payment-side jobs skip it). Cash is marked collected by staff (orders console). Route lands with the COD batch (B12); declared here so client codegen sees the shape once. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = OrdersApi()
val codCreateOrderRequest : CodCreateOrderRequest =  // CodCreateOrderRequest | 
try {
    val result : OrdersIdGet200Response = apiInstance.ordersCodPost(codCreateOrderRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling OrdersApi#ordersCodPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling OrdersApi#ordersCodPost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **codCreateOrderRequest** | [**CodCreateOrderRequest**](CodCreateOrderRequest.md)|  | |

### Return type

[**OrdersIdGet200Response**](OrdersIdGet200Response.md)

### Authorization


Configure bearerAuth statically:
```kotlin
ApiClient.accessToken = ""
```
Configure bearerAuth dynamically:
```kotlin
apiInstance.accessTokenProvider = { "" }
```

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="ordersGet"></a>
# **ordersGet**
> OrdersGet200Response ordersGet(page, pageSize)



List the authenticated customer&#39;s own orders, newest first. Pagination via &#x60;page&#x60; and &#x60;pageSize&#x60; query params; pageSize is capped at 50. Non-integer or NaN values fall back to the defaults (page&#x3D;1, pageSize&#x3D;20). The customer id is taken from the verified access token; a forged &#x60;customerId&#x60; in a query string is never honored. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = OrdersApi()
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : OrdersGet200Response = apiInstance.ordersGet(page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling OrdersApi#ordersGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling OrdersApi#ordersGet")
    e.printStackTrace()
}
```

### Parameters
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 20] |

### Return type

[**OrdersGet200Response**](OrdersGet200Response.md)

### Authorization


Configure bearerAuth statically:
```kotlin
ApiClient.accessToken = ""
```
Configure bearerAuth dynamically:
```kotlin
apiInstance.accessTokenProvider = { "" }
```

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="ordersIdGet"></a>
# **ordersIdGet**
> OrdersIdGet200Response ordersIdGet(id)



Fetch a single order by id. Returns 404 ORDER_NOT_FOUND both when the id does not exist and when the order belongs to a different customer (no existence leak). 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = OrdersApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : OrdersIdGet200Response = apiInstance.ordersIdGet(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling OrdersApi#ordersIdGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling OrdersApi#ordersIdGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**OrdersIdGet200Response**](OrdersIdGet200Response.md)

### Authorization


Configure bearerAuth statically:
```kotlin
ApiClient.accessToken = ""
```
Configure bearerAuth dynamically:
```kotlin
apiInstance.accessTokenProvider = { "" }
```

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

