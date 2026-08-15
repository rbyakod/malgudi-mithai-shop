# CatalogApi

All URIs are relative to *http://localhost:3000/api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**catalogMerchGet**](CatalogApi.md#catalogMerchGet) | **GET** /catalog/merch |  |
| [**catalogMerchSlugGet**](CatalogApi.md#catalogMerchSlugGet) | **GET** /catalog/merch/{slug} |  |
| [**catalogProductsGet**](CatalogApi.md#catalogProductsGet) | **GET** /catalog/products |  |
| [**catalogProductsSlugGet**](CatalogApi.md#catalogProductsSlugGet) | **GET** /catalog/products/{slug} |  |
| [**catalogQsrGet**](CatalogApi.md#catalogQsrGet) | **GET** /catalog/qsr |  |
| [**catalogQsrSlugGet**](CatalogApi.md#catalogQsrSlugGet) | **GET** /catalog/qsr/{slug} |  |
| [**catalogServiceableGet**](CatalogApi.md#catalogServiceableGet) | **GET** /catalog/serviceable |  |
| [**catalogSnacksGet**](CatalogApi.md#catalogSnacksGet) | **GET** /catalog/snacks |  |
| [**catalogSnacksSlugGet**](CatalogApi.md#catalogSnacksSlugGet) | **GET** /catalog/snacks/{slug} |  |


<a id="catalogMerchGet"></a>
# **catalogMerchGet**
> CatalogMerchGet200Response catalogMerchGet(ifNoneMatch, type, page, pageSize)



Merchandise list. Enquiry-led; availability routes the app to the leads form.

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val ifNoneMatch : kotlin.String = ifNoneMatch_example // kotlin.String | 
val type : kotlin.String = type_example // kotlin.String | 
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : CatalogMerchGet200Response = apiInstance.catalogMerchGet(ifNoneMatch, type, page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogMerchGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogMerchGet")
    e.printStackTrace()
}
```

### Parameters
| **ifNoneMatch** | **kotlin.String**|  | [optional] |
| **type** | **kotlin.String**|  | [optional] |
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 50] |

### Return type

[**CatalogMerchGet200Response**](CatalogMerchGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogMerchSlugGet"></a>
# **catalogMerchSlugGet**
> CatalogMerchSlugGet200Response catalogMerchSlugGet(slug)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val slug : kotlin.String = slug_example // kotlin.String | slugify(name) — server-computed.
try {
    val result : CatalogMerchSlugGet200Response = apiInstance.catalogMerchSlugGet(slug)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogMerchSlugGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogMerchSlugGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **slug** | **kotlin.String**| slugify(name) — server-computed. | |

### Return type

[**CatalogMerchSlugGet200Response**](CatalogMerchSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogProductsGet"></a>
# **catalogProductsGet**
> CatalogProductsGet200Response catalogProductsGet(ifNoneMatch, family, freshnessStatus, dietaryTags, q, page, pageSize)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val ifNoneMatch : kotlin.String = ifNoneMatch_example // kotlin.String | 
val family : kotlin.String = family_example // kotlin.String | 
val freshnessStatus : kotlin.String = freshnessStatus_example // kotlin.String | 
val dietaryTags : kotlin.collections.List<kotlin.String> =  // kotlin.collections.List<kotlin.String> | 
val q : kotlin.String = q_example // kotlin.String | Case-insensitive name substring (Payload `contains`).
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : CatalogProductsGet200Response = apiInstance.catalogProductsGet(ifNoneMatch, family, freshnessStatus, dietaryTags, q, page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogProductsGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogProductsGet")
    e.printStackTrace()
}
```

### Parameters
| **ifNoneMatch** | **kotlin.String**|  | [optional] |
| **family** | **kotlin.String**|  | [optional] [enum: classic, original, sugar-free, regional, seasonal] |
| **freshnessStatus** | **kotlin.String**|  | [optional] [enum: made-daily, made-to-order, batch-frozen] |
| **dietaryTags** | [**kotlin.collections.List&lt;kotlin.String&gt;**](kotlin.String.md)|  | [optional] |
| **q** | **kotlin.String**| Case-insensitive name substring (Payload &#x60;contains&#x60;). | [optional] |
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 50] |

### Return type

[**CatalogProductsGet200Response**](CatalogProductsGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogProductsSlugGet"></a>
# **catalogProductsSlugGet**
> CatalogProductsSlugGet200Response catalogProductsSlugGet(slug)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val slug : kotlin.String = slug_example // kotlin.String | Unique product slug (collections/MithaiProducts.slug).
try {
    val result : CatalogProductsSlugGet200Response = apiInstance.catalogProductsSlugGet(slug)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogProductsSlugGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogProductsSlugGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **slug** | **kotlin.String**| Unique product slug (collections/MithaiProducts.slug). | |

### Return type

[**CatalogProductsSlugGet200Response**](CatalogProductsSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogQsrGet"></a>
# **catalogQsrGet**
> CatalogQsrGet200Response catalogQsrGet(ifNoneMatch, category, page, pageSize)



QSR counter-menu list. Walk-in vertical — no price, no cart.

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val ifNoneMatch : kotlin.String = ifNoneMatch_example // kotlin.String | 
val category : kotlin.String = category_example // kotlin.String | 
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : CatalogQsrGet200Response = apiInstance.catalogQsrGet(ifNoneMatch, category, page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogQsrGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogQsrGet")
    e.printStackTrace()
}
```

### Parameters
| **ifNoneMatch** | **kotlin.String**|  | [optional] |
| **category** | **kotlin.String**|  | [optional] |
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 50] |

### Return type

[**CatalogQsrGet200Response**](CatalogQsrGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogQsrSlugGet"></a>
# **catalogQsrSlugGet**
> CatalogQsrSlugGet200Response catalogQsrSlugGet(slug)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val slug : kotlin.String = slug_example // kotlin.String | slugify(name) — server-computed; the collection has no slug field.
try {
    val result : CatalogQsrSlugGet200Response = apiInstance.catalogQsrSlugGet(slug)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogQsrSlugGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogQsrSlugGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **slug** | **kotlin.String**| slugify(name) — server-computed; the collection has no slug field. | |

### Return type

[**CatalogQsrSlugGet200Response**](CatalogQsrSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogServiceableGet"></a>
# **catalogServiceableGet**
> CatalogServiceableGet200Response catalogServiceableGet(pincode)



Check if a pincode is serviceable for delivery.

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val pincode : kotlin.String = pincode_example // kotlin.String | 6-digit Indian postal code.
try {
    val result : CatalogServiceableGet200Response = apiInstance.catalogServiceableGet(pincode)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogServiceableGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogServiceableGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pincode** | **kotlin.String**| 6-digit Indian postal code. | |

### Return type

[**CatalogServiceableGet200Response**](CatalogServiceableGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogSnacksGet"></a>
# **catalogSnacksGet**
> CatalogSnacksGet200Response catalogSnacksGet(ifNoneMatch, category, page, pageSize)



Retail snacks list. MSRP display-only; CTAs route to external retailers.

### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val ifNoneMatch : kotlin.String = ifNoneMatch_example // kotlin.String | 
val category : kotlin.String = category_example // kotlin.String | 
val page : kotlin.Int = 56 // kotlin.Int | 
val pageSize : kotlin.Int = 56 // kotlin.Int | 
try {
    val result : CatalogSnacksGet200Response = apiInstance.catalogSnacksGet(ifNoneMatch, category, page, pageSize)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogSnacksGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogSnacksGet")
    e.printStackTrace()
}
```

### Parameters
| **ifNoneMatch** | **kotlin.String**|  | [optional] |
| **category** | **kotlin.String**|  | [optional] |
| **page** | **kotlin.Int**|  | [optional] [default to 1] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **pageSize** | **kotlin.Int**|  | [optional] [default to 50] |

### Return type

[**CatalogSnacksGet200Response**](CatalogSnacksGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="catalogSnacksSlugGet"></a>
# **catalogSnacksSlugGet**
> CatalogSnacksSlugGet200Response catalogSnacksSlugGet(slug)



### Example
```kotlin
// Import classes:
//import com.mishran.api.infrastructure.*
//import com.mishran.api.models.*

val apiInstance = CatalogApi()
val slug : kotlin.String = slug_example // kotlin.String | slugify(name) — server-computed.
try {
    val result : CatalogSnacksSlugGet200Response = apiInstance.catalogSnacksSlugGet(slug)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling CatalogApi#catalogSnacksSlugGet")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling CatalogApi#catalogSnacksSlugGet")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **slug** | **kotlin.String**| slugify(name) — server-computed. | |

### Return type

[**CatalogSnacksSlugGet200Response**](CatalogSnacksSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

