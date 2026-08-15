# HeroApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**heroGet**](HeroApi.md#heroGet) | **GET** /hero |  |


<a id="heroGet"></a>
# **heroGet**
> HeroGet200Response heroGet()



Admin-curated home hero slides (the &#x60;home-hero&#x60; global the web renders). ETag over the resolved slides; If-None-Match → 304. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = HeroApi()
try {
    val result : HeroGet200Response = apiInstance.heroGet()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling HeroApi#heroGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling HeroApi#heroGet")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**HeroGet200Response**](HeroGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

