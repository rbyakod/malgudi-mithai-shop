# WalletApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**walletRegisterPassDevicePost**](WalletApi.md#walletRegisterPassDevicePost) | **POST** /wallet/register-pass-device | Register a device token for Apple Wallet .pass updates (idempotent) |
| [**walletUnregisterPassDeviceDelete**](WalletApi.md#walletUnregisterPassDeviceDelete) | **DELETE** /wallet/unregister-pass-device | Remove a device token from Apple Wallet .pass updates (idempotent) |


<a id="walletRegisterPassDevicePost"></a>
# **walletRegisterPassDevicePost**
> NotificationsRegisterDevicePost200Response walletRegisterPassDevicePost(passDeviceInput)

Register a device token for Apple Wallet .pass updates (idempotent)

Called by the iOS app after the user adds the loyalty pass to Wallet. Stores the pass-update token on the WalletPasses row so the backend can push .pass update pings when the loyalty balance / tier changes. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = WalletApi()
val passDeviceInput : PassDeviceInput =  // PassDeviceInput | 
try {
    val result : NotificationsRegisterDevicePost200Response = apiInstance.walletRegisterPassDevicePost(passDeviceInput)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WalletApi#walletRegisterPassDevicePost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WalletApi#walletRegisterPassDevicePost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **passDeviceInput** | [**PassDeviceInput**](PassDeviceInput.md)|  | |

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

<a id="walletUnregisterPassDeviceDelete"></a>
# **walletUnregisterPassDeviceDelete**
> NotificationsRegisterDevicePost200Response walletUnregisterPassDeviceDelete(passDeviceInput)

Remove a device token from Apple Wallet .pass updates (idempotent)

Called by the iOS app when the user removes the loyalty pass from Wallet. Idempotent — 200 even if the token or pass is already gone. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = WalletApi()
val passDeviceInput : PassDeviceInput =  // PassDeviceInput | 
try {
    val result : NotificationsRegisterDevicePost200Response = apiInstance.walletUnregisterPassDeviceDelete(passDeviceInput)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WalletApi#walletUnregisterPassDeviceDelete")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WalletApi#walletUnregisterPassDeviceDelete")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **passDeviceInput** | [**PassDeviceInput**](PassDeviceInput.md)|  | |

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

