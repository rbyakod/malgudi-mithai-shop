# StoriesAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**storiesGet**](StoriesAPI.md#storiesget) | **GET** /stories | 
[**storiesSlugGet**](StoriesAPI.md#storiesslugget) | **GET** /stories/{slug} | 


# **storiesGet**
```swift
    open class func storiesGet(ifNoneMatch: String? = nil, pillar: Pillar_storiesGet? = nil, page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: StoriesGet200Response?, _ error: Error?) -> Void)
```



Published-stories list, newest first. Drafts excluded server-side.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let ifNoneMatch = "ifNoneMatch_example" // String |  (optional)
let pillar = "pillar_example" // String |  (optional)
let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 50)

StoriesAPI.storiesGet(ifNoneMatch: ifNoneMatch, pillar: pillar, page: page, pageSize: pageSize) { (response, error) in
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
 **pillar** | **String** |  | [optional] 
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 50]

### Return type

[**StoriesGet200Response**](StoriesGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **storiesSlugGet**
```swift
    open class func storiesSlugGet(slug: String, completion: @escaping (_ data: StoriesSlugGet200Response?, _ error: Error?) -> Void)
```



### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let slug = "slug_example" // String | Unique story slug (collections/Stories.slug).

StoriesAPI.storiesSlugGet(slug: slug) { (response, error) in
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
 **slug** | **String** | Unique story slug (collections/Stories.slug). | 

### Return type

[**StoriesSlugGet200Response**](StoriesSlugGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

