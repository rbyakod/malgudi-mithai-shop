# BrandAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**brandGet**](BrandAPI.md#brandget) | **GET** /brand | 


# **brandGet**
```swift
    open class func brandGet(completion: @escaping (_ data: BrandGet200Response?, _ error: Error?) -> Void)
```



Brand support contact for the apps' help surfaces. No ETag — single tiny doc, cached client-side. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


BrandAPI.brandGet() { (response, error) in
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

[**BrandGet200Response**](BrandGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

