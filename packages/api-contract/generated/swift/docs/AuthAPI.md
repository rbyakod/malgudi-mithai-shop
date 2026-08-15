# AuthAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**authApplePost**](AuthAPI.md#authapplepost) | **POST** /auth/apple | 
[**authLogoutPost**](AuthAPI.md#authlogoutpost) | **POST** /auth/logout | 
[**authOtpSendPost**](AuthAPI.md#authotpsendpost) | **POST** /auth/otp/send | 
[**authOtpVerifyPost**](AuthAPI.md#authotpverifypost) | **POST** /auth/otp/verify | 
[**authRefreshPost**](AuthAPI.md#authrefreshpost) | **POST** /auth/refresh | 


# **authApplePost**
```swift
    open class func authApplePost(authApplePostRequest: AuthApplePostRequest, completion: @escaping (_ data: AuthApplePost200Response?, _ error: Error?) -> Void)
```



Sign in with Apple. The iOS client obtains an identityToken (RS256 JWT) from ASAuthorizationAppleIDCredential and POSTs it here. Server verifies the token against Apple JWks, rejects replay (same identityToken twice → 409), upserts a customer keyed by the Apple `sub`, and returns the same JWT pair + customer shape as /auth/otp/verify so the client's post-login flow is identical. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let authApplePostRequest = _auth_apple_post_request(identityToken: "identityToken_example", name: "name_example") // AuthApplePostRequest | 

AuthAPI.authApplePost(authApplePostRequest: authApplePostRequest) { (response, error) in
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
 **authApplePostRequest** | [**AuthApplePostRequest**](AuthApplePostRequest.md) |  | 

### Return type

[**AuthApplePost200Response**](AuthApplePost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLogoutPost**
```swift
    open class func authLogoutPost(completion: @escaping (_ data: AuthLogoutPost200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


AuthAPI.authLogoutPost() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

[**AuthLogoutPost200Response**](AuthLogoutPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authOtpSendPost**
```swift
    open class func authOtpSendPost(otpSendRequest: OtpSendRequest, completion: @escaping (_ data: AuthOtpSendPost200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let otpSendRequest = OtpSendRequest(phone: "phone_example") // OtpSendRequest | 

AuthAPI.authOtpSendPost(otpSendRequest: otpSendRequest) { (response, error) in
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
 **otpSendRequest** | [**OtpSendRequest**](OtpSendRequest.md) |  | 

### Return type

[**AuthOtpSendPost200Response**](AuthOtpSendPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authOtpVerifyPost**
```swift
    open class func authOtpVerifyPost(otpVerifyRequest: OtpVerifyRequest, completion: @escaping (_ data: AuthOtpVerifyPost200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let otpVerifyRequest = OtpVerifyRequest(requestId: "requestId_example", code: "code_example") // OtpVerifyRequest | 

AuthAPI.authOtpVerifyPost(otpVerifyRequest: otpVerifyRequest) { (response, error) in
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
 **otpVerifyRequest** | [**OtpVerifyRequest**](OtpVerifyRequest.md) |  | 

### Return type

[**AuthOtpVerifyPost200Response**](AuthOtpVerifyPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authRefreshPost**
```swift
    open class func authRefreshPost(completion: @escaping (_ data: AuthRefreshPost200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


AuthAPI.authRefreshPost() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

[**AuthRefreshPost200Response**](AuthRefreshPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

