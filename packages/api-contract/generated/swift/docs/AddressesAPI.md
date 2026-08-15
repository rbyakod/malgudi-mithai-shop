# AddressesAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**addressesGet**](AddressesAPI.md#addressesget) | **GET** /addresses | List the caller&#39;s saved addresses
[**addressesIdDelete**](AddressesAPI.md#addressesiddelete) | **DELETE** /addresses/{id} | Delete an address (owner-scoped)
[**addressesIdGet**](AddressesAPI.md#addressesidget) | **GET** /addresses/{id} | Get one address (owner-scoped; 404 if owned by another)
[**addressesIdPatch**](AddressesAPI.md#addressesidpatch) | **PATCH** /addresses/{id} | Update an address (owner-scoped)
[**addressesPost**](AddressesAPI.md#addressespost) | **POST** /addresses | Create a new address


# **addressesGet**
```swift
    open class func addressesGet(completion: @escaping (_ data: AddressesGet200Response?, _ error: Error?) -> Void)
```

List the caller's saved addresses

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


// List the caller's saved addresses
AddressesAPI.addressesGet() { (response, error) in
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

[**AddressesGet200Response**](AddressesGet200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **addressesIdDelete**
```swift
    open class func addressesIdDelete(id: String, completion: @escaping (_ data: NotificationsRegisterDevicePost200Response?, _ error: Error?) -> Void)
```

Delete an address (owner-scoped)

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let id = "id_example" // String | 

// Delete an address (owner-scoped)
AddressesAPI.addressesIdDelete(id: id) { (response, error) in
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
 **id** | **String** |  | 

### Return type

[**NotificationsRegisterDevicePost200Response**](NotificationsRegisterDevicePost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **addressesIdGet**
```swift
    open class func addressesIdGet(id: String, completion: @escaping (_ data: AddressesPost201Response?, _ error: Error?) -> Void)
```

Get one address (owner-scoped; 404 if owned by another)

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let id = "id_example" // String | 

// Get one address (owner-scoped; 404 if owned by another)
AddressesAPI.addressesIdGet(id: id) { (response, error) in
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
 **id** | **String** |  | 

### Return type

[**AddressesPost201Response**](AddressesPost201Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **addressesIdPatch**
```swift
    open class func addressesIdPatch(id: String, addressInput: AddressInput, completion: @escaping (_ data: AddressesPost201Response?, _ error: Error?) -> Void)
```

Update an address (owner-scoped)

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let id = "id_example" // String | 
let addressInput = AddressInput(line1: "line1_example", line2: "line2_example", city: "city_example", state: "state_example", pincode: "pincode_example", lat: 123, lng: 123, tag: "tag_example", isDefault: false) // AddressInput | 

// Update an address (owner-scoped)
AddressesAPI.addressesIdPatch(id: id, addressInput: addressInput) { (response, error) in
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
 **id** | **String** |  | 
 **addressInput** | [**AddressInput**](AddressInput.md) |  | 

### Return type

[**AddressesPost201Response**](AddressesPost201Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **addressesPost**
```swift
    open class func addressesPost(addressInput: AddressInput, completion: @escaping (_ data: AddressesPost201Response?, _ error: Error?) -> Void)
```

Create a new address

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let addressInput = AddressInput(line1: "line1_example", line2: "line2_example", city: "city_example", state: "state_example", pincode: "pincode_example", lat: 123, lng: 123, tag: "tag_example", isDefault: false) // AddressInput | 

// Create a new address
AddressesAPI.addressesPost(addressInput: addressInput) { (response, error) in
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
 **addressInput** | [**AddressInput**](AddressInput.md) |  | 

### Return type

[**AddressesPost201Response**](AddressesPost201Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

