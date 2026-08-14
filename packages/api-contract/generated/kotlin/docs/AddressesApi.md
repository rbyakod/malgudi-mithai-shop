# AddressesApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**addressesGet**](AddressesApi.md#addressesGet) | **GET** /addresses | List the caller&#39;s saved addresses |
| [**addressesIdDelete**](AddressesApi.md#addressesIdDelete) | **DELETE** /addresses/{id} | Delete an address (owner-scoped) |
| [**addressesIdGet**](AddressesApi.md#addressesIdGet) | **GET** /addresses/{id} | Get one address (owner-scoped; 404 if owned by another) |
| [**addressesIdPatch**](AddressesApi.md#addressesIdPatch) | **PATCH** /addresses/{id} | Update an address (owner-scoped) |
| [**addressesPost**](AddressesApi.md#addressesPost) | **POST** /addresses | Create a new address |


<a id="addressesGet"></a>
# **addressesGet**
> AddressesGet200Response addressesGet()

List the caller&#39;s saved addresses

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AddressesApi()
try {
    val result : AddressesGet200Response = apiInstance.addressesGet()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AddressesApi#addressesGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AddressesApi#addressesGet")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AddressesGet200Response**](AddressesGet200Response.md)

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

<a id="addressesIdDelete"></a>
# **addressesIdDelete**
> NotificationsRegisterDevicePost200Response addressesIdDelete(id)

Delete an address (owner-scoped)

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AddressesApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : NotificationsRegisterDevicePost200Response = apiInstance.addressesIdDelete(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AddressesApi#addressesIdDelete")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AddressesApi#addressesIdDelete")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

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

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="addressesIdGet"></a>
# **addressesIdGet**
> AddressesPost201Response addressesIdGet(id)

Get one address (owner-scoped; 404 if owned by another)

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AddressesApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : AddressesPost201Response = apiInstance.addressesIdGet(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AddressesApi#addressesIdGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AddressesApi#addressesIdGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**AddressesPost201Response**](AddressesPost201Response.md)

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

<a id="addressesIdPatch"></a>
# **addressesIdPatch**
> AddressesPost201Response addressesIdPatch(id, addressInput)

Update an address (owner-scoped)

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AddressesApi()
val id : kotlin.String = id_example // kotlin.String | 
val addressInput : AddressInput =  // AddressInput | 
try {
    val result : AddressesPost201Response = apiInstance.addressesIdPatch(id, addressInput)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AddressesApi#addressesIdPatch")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AddressesApi#addressesIdPatch")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**|  | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **addressInput** | [**AddressInput**](AddressInput.md)|  | |

### Return type

[**AddressesPost201Response**](AddressesPost201Response.md)

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

<a id="addressesPost"></a>
# **addressesPost**
> AddressesPost201Response addressesPost(addressInput)

Create a new address

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = AddressesApi()
val addressInput : AddressInput =  // AddressInput | 
try {
    val result : AddressesPost201Response = apiInstance.addressesPost(addressInput)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AddressesApi#addressesPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AddressesApi#addressesPost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **addressInput** | [**AddressInput**](AddressInput.md)|  | |

### Return type

[**AddressesPost201Response**](AddressesPost201Response.md)

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

