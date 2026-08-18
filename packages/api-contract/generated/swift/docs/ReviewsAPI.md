# ReviewsAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**reviewsGet**](ReviewsAPI.md#reviewsget) | **GET** /reviews | List approved reviews for one product (public)
[**reviewsPost**](ReviewsAPI.md#reviewspost) | **POST** /reviews | Upsert the customer&#39;s review for one product (capture-only)


# **reviewsGet**
```swift
    open class func reviewsGet(productId: String, page: Int? = nil, pageSize: Int? = nil, completion: @escaping (_ data: ReviewsGet200Response?, _ error: Error?) -> Void)
```

List approved reviews for one product (public)

Moderation-approved reviews only, newest first, paginated. productId is required. Authors appear as display names — customer ids and phones are never returned. averageRating and total cover ALL approved reviews for the product, not just this page. The write side stays capture-only (POST below, pending moderation). 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let productId = "productId_example" // String | mithai-products id.
let page = 987 // Int |  (optional) (default to 1)
let pageSize = 987 // Int |  (optional) (default to 20)

// List approved reviews for one product (public)
ReviewsAPI.reviewsGet(productId: productId, page: page, pageSize: pageSize) { (response, error) in
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
 **productId** | **String** | mithai-products id. | 
 **page** | **Int** |  | [optional] [default to 1]
 **pageSize** | **Int** |  | [optional] [default to 20]

### Return type

[**ReviewsGet200Response**](ReviewsGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **reviewsPost**
```swift
    open class func reviewsPost(reviewInput: ReviewInput, completion: @escaping (_ data: ReviewsPost200Response?, _ error: Error?) -> Void)
```

Upsert the customer's review for one product (capture-only)

Creates or updates ONE review per (customer, product). Body is zod-validated (rating 1-5 required); verifiedPurchase is server-stamped — true with the linked order when the customer has a delivered order containing the product. Reviews start as \"pending\" for moderation and are not displayed anywhere yet. 201 on create, 200 on update. 

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import OpenAPIClient

let reviewInput = ReviewInput(productId: "productId_example", rating: 123, body: "body_example", authorName: "authorName_example") // ReviewInput | 

// Upsert the customer's review for one product (capture-only)
ReviewsAPI.reviewsPost(reviewInput: reviewInput) { (response, error) in
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
 **reviewInput** | [**ReviewInput**](ReviewInput.md) |  | 

### Return type

[**ReviewsPost200Response**](ReviewsPost200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

