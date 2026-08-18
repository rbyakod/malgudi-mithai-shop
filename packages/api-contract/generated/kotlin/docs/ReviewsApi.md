# ReviewsApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**reviewsGet**](ReviewsApi.md#reviewsGet) | **GET** /reviews | List approved reviews for one product (public) |
| [**reviewsPost**](ReviewsApi.md#reviewsPost) | **POST** /reviews | Upsert the customer&#39;s review for one product (capture-only) |


<a id="reviewsGet"></a>
# **reviewsGet**
> ReviewsGet200Response reviewsGet(productId, page, pageSize)

List approved reviews for one product (public)

Moderation-approved reviews only, newest first, paginated. productId is required. Authors appear as display names — customer ids and phones are never returned. averageRating and total cover ALL approved reviews for the product, not just this page. The write side stays capture-only (POST below, pending moderation). 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = ReviewsApi()
val productId : kotlin.String = productId_example // kotlin.String | mithai-products id.
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : ReviewsGet200Response = apiInstance.reviewsGet(productId, page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ReviewsApi#reviewsGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ReviewsApi#reviewsGet")
    e.printStackTrace()
}
```

### Parameters
| **productId** | **kotlin.String**| mithai-products id. | |
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 20] |

### Return type

[**ReviewsGet200Response**](ReviewsGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="reviewsPost"></a>
# **reviewsPost**
> ReviewsPost200Response reviewsPost(reviewInput)

Upsert the customer&#39;s review for one product (capture-only)

Creates or updates ONE review per (customer, product). Body is zod-validated (rating 1-5 required); verifiedPurchase is server-stamped — true with the linked order when the customer has a delivered order containing the product. Reviews start as \&quot;pending\&quot; for moderation and are not displayed anywhere yet. 201 on create, 200 on update. 

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = ReviewsApi()
val reviewInput : ReviewInput =  // ReviewInput | 
try {
    val result : ReviewsPost200Response = apiInstance.reviewsPost(reviewInput)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ReviewsApi#reviewsPost")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ReviewsApi#reviewsPost")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **reviewInput** | [**ReviewInput**](ReviewInput.md)|  | |

### Return type

[**ReviewsPost200Response**](ReviewsPost200Response.md)

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

