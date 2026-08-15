# BrandApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**brandGet**](BrandApi.md#brandGet) | **GET** /brand |  |


<a id="brandGet"></a>
# **brandGet**
> BrandGet200Response brandGet()



Brand support contact for the apps&#39; help surfaces. No ETag — single tiny doc, cached client-side. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = BrandApi()
try {
    val result : BrandGet200Response = apiInstance.brandGet()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling BrandApi#brandGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling BrandApi#brandGet")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**BrandGet200Response**](BrandGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

