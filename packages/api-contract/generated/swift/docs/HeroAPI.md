# HeroAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**heroGet**](HeroAPI.md#heroget) | **GET** /hero | 


# **heroGet**
```swift
    open class func heroGet(completion: @escaping (_ data: HeroGet200Response?, _ error: Error?) -> Void)
```



Admin-curated home hero slides (the `home-hero` global the web renders). ETag over the resolved slides; If-None-Match → 304. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


HeroAPI.heroGet() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

[**HeroGet200Response**](HeroGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

