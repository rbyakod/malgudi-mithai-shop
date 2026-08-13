# CartApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**cartValidatePost**](CartApi.md#cartValidatePost) | **POST** /cart/validate |  |


<a id="cartValidatePost"></a>
# **cartValidatePost**
> CartValidatePost200Response cartValidatePost(cartValidateRequest)



Validate the customer&#39;s cart: authenticate, re-check pincode serviceability, re-fetch each product to confirm it still exists, persist a tamper-evident cart snapshot, and return the snapshot id + shape valid for 10 minutes.  NOTE: totals are all zero today — commerce / variant pricing on MithaiProducts is deferred to Phase 8. This endpoint gives mobile clients a stable contract for cart shape + availability now. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CartApi()
val cartValidateRequest : CartValidateRequest =  // CartValidateRequest | 
try {
    val result : CartValidatePost200Response = apiInstance.cartValidatePost(cartValidateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CartApi#cartValidatePost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CartApi#cartValidatePost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cartValidateRequest** | [**CartValidateRequest**](CartValidateRequest.md)|  | |

### Return type

[**CartValidatePost200Response**](CartValidatePost200Response.md)

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

