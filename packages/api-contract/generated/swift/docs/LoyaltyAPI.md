# LoyaltyAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**accountLoyaltyPassGet**](LoyaltyAPI.md#accountloyaltypassget) | **GET** /account/loyalty-pass | Generate / refresh the customer&#39;s Apple Wallet loyalty pass (signed URL)


# **accountLoyaltyPassGet**
```swift
    open class func accountLoyaltyPassGet(completion: @escaping (_ data: AccountLoyaltyPassGet200Response?, _ error: Error?) -> Void)
```

Generate / refresh the customer's Apple Wallet loyalty pass (signed URL)

Silver tier at >=2 delivered orders, Gold at >=5. Below the threshold the route 404s. Returns a short-lived signed .pkpass URL the iOS client adds via PKAddPassesViewController. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


// Generate / refresh the customer's Apple Wallet loyalty pass (signed URL)
LoyaltyAPI.accountLoyaltyPassGet() { (response, error) in
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

[**AccountLoyaltyPassGet200Response**](AccountLoyaltyPassGet200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

