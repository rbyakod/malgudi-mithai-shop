# StoriesApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**storiesGet**](StoriesApi.md#storiesGet) | **GET** /stories |  |
| [**storiesSlugGet**](StoriesApi.md#storiesSlugGet) | **GET** /stories/{slug} |  |


<a id="storiesGet"></a>
# **storiesGet**
> StoriesGet200Response storiesGet(ifNoneMatch, pillar, page, pageSize)



Published-stories list, newest first. Drafts excluded server-side.

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = StoriesApi()
val ifNoneMatch : kotlin.String = ifNoneMatch_example // kotlin.String | 
val pillar : kotlin.String = pillar_example // kotlin.String | 
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : StoriesGet200Response = apiInstance.storiesGet(ifNoneMatch, pillar, page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling StoriesApi#storiesGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling StoriesApi#storiesGet")
    e.printStackTrace()
}
```

### Parameters
| **ifNoneMatch** | **kotlin.String**|  | [optional] |
| **pillar** | **kotlin.String**|  | [optional] [enum: farm, milk, karigar, karigari, packaging, festival, regional, recipe, journal] |
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 50] |

### Return type

[**StoriesGet200Response**](StoriesGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="storiesSlugGet"></a>
# **storiesSlugGet**
> StoriesSlugGet200Response storiesSlugGet(slug)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = StoriesApi()
val slug : kotlin.String = slug_example // kotlin.String | Unique story slug (collections/Stories.slug).
try {
    val result : StoriesSlugGet200Response = apiInstance.storiesSlugGet(slug)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling StoriesApi#storiesSlugGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling StoriesApi#storiesSlugGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **slug** | **kotlin.String**| Unique story slug (collections/Stories.slug). | |

### Return type

[**StoriesSlugGet200Response**](StoriesSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

