# PaymentsApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**paymentsRazorpayCreateOrderPost**](PaymentsApi.md#paymentsRazorpayCreateOrderPost) | **POST** /payments/razorpay/create-order |  |
| [**paymentsRazorpayVerifyPost**](PaymentsApi.md#paymentsRazorpayVerifyPost) | **POST** /payments/razorpay/verify |  |


<a id="paymentsRazorpayCreateOrderPost"></a>
# **paymentsRazorpayCreateOrderPost**
> PaymentsRazorpayCreateOrderPost200Response paymentsRazorpayCreateOrderPost(razorpayCreateOrderRequest, idempotencyKey, xClientSource)



Create an internal order + a Razorpay order from a persisted cart snapshot. Idempotent: a replay with the same Idempotency-Key and body returns the cached response without re-running side effects. The X-Client-Source header selects the order &#x60;source&#x60; field (mobile-android | mobile-ios | web); defaults to mobile-android. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = PaymentsApi()
val razorpayCreateOrderRequest : RazorpayCreateOrderRequest =  // RazorpayCreateOrderRequest | 
val idempotencyKey : kotlin.String = idempotencyKey_example // kotlin.String | Optional. When set, the response is cached for 24h.
val xClientSource : kotlin.String = xClientSource_example // kotlin.String | 
try {
    val result : PaymentsRazorpayCreateOrderPost200Response = apiInstance.paymentsRazorpayCreateOrderPost(razorpayCreateOrderRequest, idempotencyKey, xClientSource)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling PaymentsApi#paymentsRazorpayCreateOrderPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling PaymentsApi#paymentsRazorpayCreateOrderPost")
    e.printStackTrace()
}
```

### Parameters
| **razorpayCreateOrderRequest** | [**RazorpayCreateOrderRequest**](RazorpayCreateOrderRequest.md)|  | |
| **idempotencyKey** | **kotlin.String**| Optional. When set, the response is cached for 24h. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **xClientSource** | **kotlin.String**|  | [optional] [default to XClientSource.mobileMinusAndroid] [enum: mobile-android, mobile-ios, web] |

### Return type

[**PaymentsRazorpayCreateOrderPost200Response**](PaymentsRazorpayCreateOrderPost200Response.md)

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

<a id="paymentsRazorpayVerifyPost"></a>
# **paymentsRazorpayVerifyPost**
> PaymentsRazorpayVerifyPost200Response paymentsRazorpayVerifyPost(razorpayVerifyRequest, idempotencyKey)



Verify the Razorpay checkout signature, capture the payment, and transition the order from pending_payment to confirmed. Safe to retry: signature is always re-verified, and an already-captured payment row short-circuits the transition path. Idempotent at the HTTP layer when an Idempotency-Key is supplied. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = PaymentsApi()
val razorpayVerifyRequest : RazorpayVerifyRequest =  // RazorpayVerifyRequest | 
val idempotencyKey : kotlin.String = idempotencyKey_example // kotlin.String | 
try {
    val result : PaymentsRazorpayVerifyPost200Response = apiInstance.paymentsRazorpayVerifyPost(razorpayVerifyRequest, idempotencyKey)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling PaymentsApi#paymentsRazorpayVerifyPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling PaymentsApi#paymentsRazorpayVerifyPost")
    e.printStackTrace()
}
```

### Parameters
| **razorpayVerifyRequest** | [**RazorpayVerifyRequest**](RazorpayVerifyRequest.md)|  | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **idempotencyKey** | **kotlin.String**|  | [optional] |

### Return type

[**PaymentsRazorpayVerifyPost200Response**](PaymentsRazorpayVerifyPost200Response.md)

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

