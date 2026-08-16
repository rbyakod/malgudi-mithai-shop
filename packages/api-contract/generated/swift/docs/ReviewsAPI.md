# ReviewsAPI

All URIs are relative to *http://localhost:3000/api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**reviewsPost**](ReviewsAPI.md#reviewspost) | **POST** /reviews | Upsert the customer&#39;s review for one product (capture-only)


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

