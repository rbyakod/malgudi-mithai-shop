# LoyaltyApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**accountLoyaltyGet**](LoyaltyApi.md#accountLoyaltyGet) | **GET** /account/loyalty | Read the customer&#39;s loyalty standing (no wallet-pass side effects) |
| [**accountLoyaltyPassGet**](LoyaltyApi.md#accountLoyaltyPassGet) | **GET** /account/loyalty-pass | Generate / refresh the customer&#39;s Apple Wallet loyalty pass (signed URL) |


<a id="accountLoyaltyGet"></a>
# **accountLoyaltyGet**
> AccountLoyaltyGet200Response accountLoyaltyGet()

Read the customer&#39;s loyalty standing (no wallet-pass side effects)

Plain loyalty-state read for surfaces that show progress rather than mint a pass: deliveredCount plus the resolved tier (null below Silver, \&quot;silver\&quot; at &gt;&#x3D;2 delivered, \&quot;gold\&quot; at &gt;&#x3D;5) and the tier thresholds. Unlike /account/loyalty-pass this never 404s below the threshold and never writes WalletPasses. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = LoyaltyApi()
try {
    val result : AccountLoyaltyGet200Response = apiInstance.accountLoyaltyGet()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling LoyaltyApi#accountLoyaltyGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling LoyaltyApi#accountLoyaltyGet")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AccountLoyaltyGet200Response**](AccountLoyaltyGet200Response.md)

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

