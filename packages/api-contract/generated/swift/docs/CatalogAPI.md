# CatalogAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**catalogMerchGet**](CatalogAPI.md#catalogmerchget) | **GET** /catalog/merch | 
[**catalogMerchSlugGet**](CatalogAPI.md#catalogmerchslugget) | **GET** /catalog/merch/{slug} | 
[**catalogProductsGet**](CatalogAPI.md#catalogproductsget) | **GET** /catalog/products | 
[**catalogProductsSlugGet**](CatalogAPI.md#catalogproductsslugget) | **GET** /catalog/products/{slug} | 
[**catalogQsrGet**](CatalogAPI.md#catalogqsrget) | **GET** /catalog/qsr | 
[**catalogQsrSlugGet**](CatalogAPI.md#catalogqsrslugget) | **GET** /catalog/qsr/{slug} | 
[**catalogServiceableGet**](CatalogAPI.md#catalogserviceableget) | **GET** /catalog/serviceable | 
[**catalogSnacksGet**](CatalogAPI.md#catalogsnacksget) | **GET** /catalog/snacks | 
[**catalogSnacksSlugGet**](CatalogAPI.md#catalogsnacksslugget) | **GET** /catalog/snacks/{slug} | 


# **catalogMerchGet**
```swift
    open class func catalogMerchGet(ifNoneMatch: String? = nil, type: String? = nil, page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: CatalogMerchGet200Response?, _ error: Error?) -> Void)
```



Merchandise list. Enquiry-led; availability routes the app to the leads form.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let ifNoneMatch = "ifNoneMatch_example" // String |  (optional)
let type = "type_example" // String |  (optional)
let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 50)

CatalogAPI.catalogMerchGet(ifNoneMatch: ifNoneMatch, type: type, page: page, pageSize: pageSize) { (response, error) in
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
 **ifNoneMatch** | **String** |  | [optional] 
 **type** | **String** |  | [optional] 
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 50]

### Return type

[**CatalogMerchGet200Response**](CatalogMerchGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogMerchSlugGet**
```swift
    open class func catalogMerchSlugGet(slug: String, completion: @escaping (_ data: CatalogMerchSlugGet200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let slug = "slug_example" // String | slugify(name) — server-computed.

CatalogAPI.catalogMerchSlugGet(slug: slug) { (response, error) in
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
 **slug** | **String** | slugify(name) — server-computed. | 

### Return type

[**CatalogMerchSlugGet200Response**](CatalogMerchSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogProductsGet**
```swift
    open class func catalogProductsGet(ifNoneMatch: String? = nil, family: Family_catalogProductsGet? = nil, freshnessStatus: FreshnessStatus_catalogProductsGet? = nil, dietaryTags: [String]? = nil, q: String? = nil, page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: CatalogProductsGet200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let ifNoneMatch = "ifNoneMatch_example" // String |  (optional)
let family = "family_example" // String |  (optional)
let freshnessStatus = "freshnessStatus_example" // String |  (optional)
let dietaryTags = ["inner_example"] // [String] |  (optional)
let q = "q_example" // String | Case-insensitive name substring (Payload `contains`). (optional)
let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 50)

CatalogAPI.catalogProductsGet(ifNoneMatch: ifNoneMatch, family: family, freshnessStatus: freshnessStatus, dietaryTags: dietaryTags, q: q, page: page, pageSize: pageSize) { (response, error) in
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
 **ifNoneMatch** | **String** |  | [optional] 
 **family** | **String** |  | [optional] 
 **freshnessStatus** | **String** |  | [optional] 
 **dietaryTags** | [**[String]**](String.md) |  | [optional] 
 **q** | **String** | Case-insensitive name substring (Payload &#x60;contains&#x60;). | [optional] 
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 50]

### Return type

[**CatalogProductsGet200Response**](CatalogProductsGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogProductsSlugGet**
```swift
    open class func catalogProductsSlugGet(slug: String, completion: @escaping (_ data: CatalogProductsSlugGet200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let slug = "slug_example" // String | Unique product slug (collections/MithaiProducts.slug).

CatalogAPI.catalogProductsSlugGet(slug: slug) { (response, error) in
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
 **slug** | **String** | Unique product slug (collections/MithaiProducts.slug). | 

### Return type

[**CatalogProductsSlugGet200Response**](CatalogProductsSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogQsrGet**
```swift
    open class func catalogQsrGet(ifNoneMatch: String? = nil, category: String? = nil, page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: CatalogQsrGet200Response?, _ error: Error?) -> Void)
```



QSR counter-menu list. Walk-in vertical — no price, no cart.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let ifNoneMatch = "ifNoneMatch_example" // String |  (optional)
let category = "category_example" // String |  (optional)
let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 50)

CatalogAPI.catalogQsrGet(ifNoneMatch: ifNoneMatch, category: category, page: page, pageSize: pageSize) { (response, error) in
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
 **ifNoneMatch** | **String** |  | [optional] 
 **category** | **String** |  | [optional] 
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 50]

### Return type

[**CatalogQsrGet200Response**](CatalogQsrGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogQsrSlugGet**
```swift
    open class func catalogQsrSlugGet(slug: String, completion: @escaping (_ data: CatalogQsrSlugGet200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let slug = "slug_example" // String | slugify(name) — server-computed; the collection has no slug field.

CatalogAPI.catalogQsrSlugGet(slug: slug) { (response, error) in
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
 **slug** | **String** | slugify(name) — server-computed; the collection has no slug field. | 

### Return type

[**CatalogQsrSlugGet200Response**](CatalogQsrSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogServiceableGet**
```swift
    open class func catalogServiceableGet(pincode: String, completion: @escaping (_ data: CatalogServiceableGet200Response?, _ error: Error?) -> Void)
```



Check if a pincode is serviceable for delivery.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let pincode = "pincode_example" // String | 6-digit Indian postal code.

CatalogAPI.catalogServiceableGet(pincode: pincode) { (response, error) in
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
 **pincode** | **String** | 6-digit Indian postal code. | 

### Return type

[**CatalogServiceableGet200Response**](CatalogServiceableGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogSnacksGet**
```swift
    open class func catalogSnacksGet(ifNoneMatch: String? = nil, category: String? = nil, page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: CatalogSnacksGet200Response?, _ error: Error?) -> Void)
```



Retail snacks list. MSRP display-only; CTAs route to external retailers.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let ifNoneMatch = "ifNoneMatch_example" // String |  (optional)
let category = "category_example" // String |  (optional)
let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 50)

CatalogAPI.catalogSnacksGet(ifNoneMatch: ifNoneMatch, category: category, page: page, pageSize: pageSize) { (response, error) in
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
 **ifNoneMatch** | **String** |  | [optional] 
 **category** | **String** |  | [optional] 
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 50]

### Return type

[**CatalogSnacksGet200Response**](CatalogSnacksGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **catalogSnacksSlugGet**
```swift
    open class func catalogSnacksSlugGet(slug: String, completion: @escaping (_ data: CatalogSnacksSlugGet200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let slug = "slug_example" // String | slugify(name) — server-computed.

CatalogAPI.catalogSnacksSlugGet(slug: slug) { (response, error) in
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
 **slug** | **String** | slugify(name) — server-computed. | 

### Return type

[**CatalogSnacksSlugGet200Response**](CatalogSnacksSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

