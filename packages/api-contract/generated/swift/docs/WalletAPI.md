# WalletAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**walletRegisterPassDevicePost**](WalletAPI.md#walletregisterpassdevicepost) | **POST** /wallet/register-pass-device | Register a device token for Apple Wallet .pass updates (idempotent)
[**walletUnregisterPassDeviceDelete**](WalletAPI.md#walletunregisterpassdevicedelete) | **DELETE** /wallet/unregister-pass-device | Remove a device token from Apple Wallet .pass updates (idempotent)


# **walletRegisterPassDevicePost**
```swift
    open class func walletRegisterPassDevicePost(passDeviceInput: PassDeviceInput, completion: @escaping (_ data: NotificationsRegisterDevicePost200Response?, _ error: Error?) -> Void)
```

Register a device token for Apple Wallet .pass updates (idempotent)

Called by the iOS app after the user adds the loyalty pass to Wallet. Stores the pass-update token on the WalletPasses row so the backend can push .pass update pings when the loyalty balance / tier changes. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let passDeviceInput = PassDeviceInput(serialNumber: "serialNumber_example", pushToken: "pushToken_example") // PassDeviceInput | 

// Register a device token for Apple Wallet .pass updates (idempotent)
WalletAPI.walletRegisterPassDevicePost(passDeviceInput: passDeviceInput) { (response, error) in
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
 **passDeviceInput** | [**PassDeviceInput**](PassDeviceInput.md) |  | 

### Return type

[**NotificationsRegisterDevicePost200Response**](NotificationsRegisterDevicePost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **walletUnregisterPassDeviceDelete**
```swift
    open class func walletUnregisterPassDeviceDelete(passDeviceInput: PassDeviceInput, completion: @escaping (_ data: NotificationsRegisterDevicePost200Response?, _ error: Error?) -> Void)
```

Remove a device token from Apple Wallet .pass updates (idempotent)

Called by the iOS app when the user removes the loyalty pass from Wallet. Idempotent — 200 even if the token or pass is already gone. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let passDeviceInput = PassDeviceInput(serialNumber: "serialNumber_example", pushToken: "pushToken_example") // PassDeviceInput | 

// Remove a device token from Apple Wallet .pass updates (idempotent)
WalletAPI.walletUnregisterPassDeviceDelete(passDeviceInput: passDeviceInput) { (response, error) in
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
 **passDeviceInput** | [**PassDeviceInput**](PassDeviceInput.md) |  | 

### Return type

[**NotificationsRegisterDevicePost200Response**](NotificationsRegisterDevicePost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

