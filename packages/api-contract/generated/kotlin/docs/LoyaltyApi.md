# LoyaltyApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**accountLoyaltyPassGet**](LoyaltyApi.md#accountLoyaltyPassGet) | **GET** /account/loyalty-pass | Generate / refresh the customer&#39;s Apple Wallet loyalty pass (signed URL) |


<a id="accountLoyaltyPassGet"></a>
# **accountLoyaltyPassGet**
> AccountLoyaltyPassGet200Response accountLoyaltyPassGet()

Generate / refresh the customer&#39;s Apple Wallet loyalty pass (signed URL)

Silver tier at &gt;&#x3D;2 delivered orders, Gold at &gt;&#x3D;5. Below the threshold the route 404s. Returns a short-lived signed .pkpass URL the iOS client adds via PKAddPassesViewController. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = LoyaltyApi()
try {
    val result : AccountLoyaltyPassGet200Response = apiInstance.accountLoyaltyPassGet()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling LoyaltyApi#accountLoyaltyPassGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling LoyaltyApi#accountLoyaltyPassGet")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AccountLoyaltyPassGet200Response**](AccountLoyaltyPassGet200Response.md)

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

