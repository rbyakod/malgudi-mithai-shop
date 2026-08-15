# AuthApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**authApplePost**](AuthApi.md#authApplePost) | **POST** /auth/apple |  |
| [**authLogoutPost**](AuthApi.md#authLogoutPost) | **POST** /auth/logout |  |
| [**authOtpSendPost**](AuthApi.md#authOtpSendPost) | **POST** /auth/otp/send |  |
| [**authOtpVerifyPost**](AuthApi.md#authOtpVerifyPost) | **POST** /auth/otp/verify |  |
| [**authRefreshPost**](AuthApi.md#authRefreshPost) | **POST** /auth/refresh |  |


<a id="authApplePost"></a>
# **authApplePost**
> AuthApplePost200Response authApplePost(authApplePostRequest)



Sign in with Apple. The iOS client obtains an identityToken (RS256 JWT) from ASAuthorizationAppleIDCredential and POSTs it here. Server verifies the token against Apple JWks, rejects replay (same identityToken twice → 409), upserts a customer keyed by the Apple &#x60;sub&#x60;, and returns the same JWT pair + customer shape as /auth/otp/verify so the client&#39;s post-login flow is identical. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AuthApi()
val authApplePostRequest : AuthApplePostRequest =  // AuthApplePostRequest | 
try {
    val result : AuthApplePost200Response = apiInstance.authApplePost(authApplePostRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#authApplePost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#authApplePost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **authApplePostRequest** | [**AuthApplePostRequest**](AuthApplePostRequest.md)|  | |

### Return type

[**AuthApplePost200Response**](AuthApplePost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="authLogoutPost"></a>
# **authLogoutPost**
> AuthLogoutPost200Response authLogoutPost()



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AuthApi()
try {
    val result : AuthLogoutPost200Response = apiInstance.authLogoutPost()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#authLogoutPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#authLogoutPost")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AuthLogoutPost200Response**](AuthLogoutPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="authOtpSendPost"></a>
# **authOtpSendPost**
> AuthOtpSendPost200Response authOtpSendPost(otpSendRequest)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AuthApi()
val otpSendRequest : OtpSendRequest =  // OtpSendRequest | 
try {
    val result : AuthOtpSendPost200Response = apiInstance.authOtpSendPost(otpSendRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#authOtpSendPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#authOtpSendPost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **otpSendRequest** | [**OtpSendRequest**](OtpSendRequest.md)|  | |

### Return type

[**AuthOtpSendPost200Response**](AuthOtpSendPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="authOtpVerifyPost"></a>
# **authOtpVerifyPost**
> AuthOtpVerifyPost200Response authOtpVerifyPost(otpVerifyRequest)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AuthApi()
val otpVerifyRequest : OtpVerifyRequest =  // OtpVerifyRequest | 
try {
    val result : AuthOtpVerifyPost200Response = apiInstance.authOtpVerifyPost(otpVerifyRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#authOtpVerifyPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#authOtpVerifyPost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **otpVerifyRequest** | [**OtpVerifyRequest**](OtpVerifyRequest.md)|  | |

### Return type

[**AuthOtpVerifyPost200Response**](AuthOtpVerifyPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="authRefreshPost"></a>
# **authRefreshPost**
> AuthRefreshPost200Response authRefreshPost()



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AuthApi()
try {
    val result : AuthRefreshPost200Response = apiInstance.authRefreshPost()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AuthApi#authRefreshPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AuthApi#authRefreshPost")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AuthRefreshPost200Response**](AuthRefreshPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

