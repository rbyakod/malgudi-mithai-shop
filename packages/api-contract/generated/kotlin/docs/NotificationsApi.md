# NotificationsApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**notificationsRegisterDevicePost**](NotificationsApi.md#notificationsRegisterDevicePost) | **POST** /notifications/register-device | Register / refresh a push token (idempotent upsert) |


<a id="notificationsRegisterDevicePost"></a>
# **notificationsRegisterDevicePost**
> NotificationsRegisterDevicePost200Response notificationsRegisterDevicePost(notificationsRegisterDevicePostRequest)

Register / refresh a push token (idempotent upsert)

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = NotificationsApi()
val notificationsRegisterDevicePostRequest : NotificationsRegisterDevicePostRequest =  // NotificationsRegisterDevicePostRequest | 
try {
    val result : NotificationsRegisterDevicePost200Response = apiInstance.notificationsRegisterDevicePost(notificationsRegisterDevicePostRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling NotificationsApi#notificationsRegisterDevicePost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling NotificationsApi#notificationsRegisterDevicePost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **notificationsRegisterDevicePostRequest** | [**NotificationsRegisterDevicePostRequest**](NotificationsRegisterDevicePostRequest.md)|  | |

### Return type

[**NotificationsRegisterDevicePost200Response**](NotificationsRegisterDevicePost200Response.md)

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

