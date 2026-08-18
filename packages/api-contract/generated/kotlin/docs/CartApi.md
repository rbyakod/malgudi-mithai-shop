# CartApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**cartEstimatePost**](CartApi.md#cartEstimatePost) | **POST** /cart/estimate |  |
| [**cartValidatePost**](CartApi.md#cartValidatePost) | **POST** /cart/validate |  |


<a id="cartEstimatePost"></a>
# **cartEstimatePost**
> CartEstimatePost200Response cartEstimatePost(cartEstimateRequest)



Read-only pricing preview of a cart — the exact /cart/validate math (server-side line re-pricing, pincode tier lookup, tier delivery fee, free-delivery threshold waiver) with nothing persisted and NO sign-in required. Guest carts call this to show delivery fees and threshold progress before checkout. Unpriceable or vanished lines error exactly like validate so callers can distinguish \&quot;here&#39;s your estimate\&quot; from \&quot;your cart is stale\&quot;; pincode serviceability is informational here — a known tier prices its real fee/threshold, while an absent or unserviceable pincode yields a null tier, no fee, and no threshold (nothing to estimate against; the client shows its no-pincode copy). Validate enforces serviceability for real. Rate-limited per client IP. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CartApi()
val cartEstimateRequest : CartEstimateRequest =  // CartEstimateRequest | 
try {
    val result : CartEstimatePost200Response = apiInstance.cartEstimatePost(cartEstimateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CartApi#cartEstimatePost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CartApi#cartEstimatePost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **cartEstimateRequest** | [**CartEstimateRequest**](CartEstimateRequest.md)|  | |

### Return type

[**CartEstimatePost200Response**](CartEstimatePost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="cartValidatePost"></a>
# **cartValidatePost**
> CartValidatePost200Response cartValidatePost(cartValidateRequest)



Validate the customer&#39;s cart: authenticate, re-check pincode serviceability, re-fetch each product to confirm it still exists, price every line server-side (optional per-item packLabel prices the matching derived pack size; unpriceable lines like \&quot;on request\&quot; are rejected 422), enforce the fresh-tier rule (made-daily items only ship to fresh-tier pincodes), normalize iOS relative slot tokens, persist a tamper-evident cart snapshot with real totals (subtotal + flat delivery fee by tier; taxes 0, MRP inclusive of GST), and return the snapshot id + shape valid for 10 minutes. 

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

