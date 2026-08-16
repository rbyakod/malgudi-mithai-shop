# LoyaltyAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**accountLoyaltyGet**](LoyaltyAPI.md#accountloyaltyget) | **GET** /account/loyalty | Read the customer&#39;s loyalty standing (no wallet-pass side effects)
[**accountLoyaltyPassGet**](LoyaltyAPI.md#accountloyaltypassget) | **GET** /account/loyalty-pass | Generate / refresh the customer&#39;s Apple Wallet loyalty pass (signed URL)


# **accountLoyaltyGet**
```swift
    open class func accountLoyaltyGet(completion: @escaping (_ data: AccountLoyaltyGet200Response?, _ error: Error?) -> Void)
```

Read the customer's loyalty standing (no wallet-pass side effects)

Plain loyalty-state read for surfaces that show progress rather than mint a pass: deliveredCount plus the resolved tier (null below Silver, \"silver\" at >=2 delivered, \"gold\" at >=5) and the tier thresholds. Unlike /account/loyalty-pass this never 404s below the threshold and never writes WalletPasses. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient


// Read the customer's loyalty standing (no wallet-pass side effects)
LoyaltyAPI.accountLoyaltyGet() { (response, error) in
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

[**AccountLoyaltyGet200Response**](AccountLoyaltyGet200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

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

