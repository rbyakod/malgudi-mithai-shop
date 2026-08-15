# NotificationsAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**notificationsRegisterDevicePost**](NotificationsAPI.md#notificationsregisterdevicepost) | **POST** /notifications/register-device | Register / refresh a push token (idempotent upsert)


# **notificationsRegisterDevicePost**
```swift
    open class func notificationsRegisterDevicePost(notificationsRegisterDevicePostRequest: NotificationsRegisterDevicePostRequest, completion: @escaping (_ data: NotificationsRegisterDevicePost200Response?, _ error: Error?) -> Void)
```

Register / refresh a push token (idempotent upsert)

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let notificationsRegisterDevicePostRequest = _notifications_register_device_post_request(platform: "platform_example", pushToken: "pushToken_example", liveActivityToken: "liveActivityToken_example", appVersion: "appVersion_example", deviceModel: "deviceModel_example", osVersion: "osVersion_example", locale: "locale_example") // NotificationsRegisterDevicePostRequest | 

// Register / refresh a push token (idempotent upsert)
NotificationsAPI.notificationsRegisterDevicePost(notificationsRegisterDevicePostRequest: notificationsRegisterDevicePostRequest) { (response, error) in
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
 **notificationsRegisterDevicePostRequest** | [**NotificationsRegisterDevicePostRequest**](NotificationsRegisterDevicePostRequest.md) |  | 

### Return type

[**NotificationsRegisterDevicePost200Response**](NotificationsRegisterDevicePost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

