// Task 18.1 (Mishran Mobile Apps v1): orders list/detail view models over
// the URLProtocol mock — GET /orders (paginated, customer-scoped) and
// GET /orders/{id}. Badge helpers mirror Android's OrderTimeline (pure).
import XCTest
@testable import Mishran

@MainActor
final class OrdersViewModelTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    private func makeClient() -> MishranAPIClient {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        return MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: InMemoryTokenStore(), session: session(), baseURL: baseURL),
            retryDelay: 0
        )
    }

    private let orderJSON = #"""
    {"data":{"items":[{"id":"order_1","customerId":"cust_1","items":[{"productId":"p1","slug":"kaju-katli","name":"Kaju Katli","quantity":2,"unit":"kg","priceInPaise":50000}],"totals":{"itemsTotalInPaise":100000,"deliveryFeeInPaise":0,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":100000},"status":"confirmed","paymentStatus":"paid","createdAt":"2026-08-13T10:00:00Z","updatedAt":"2026-08-13T10:05:00Z"},{"id":"order_2","customerId":"cust_1","items":[],"totals":{"itemsTotalInPaise":0,"deliveryFeeInPaise":0,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":0},"status":"out_for_delivery","paymentStatus":"paid","createdAt":"2026-08-12T10:00:00Z","updatedAt":"2026-08-13T08:00:00Z"}],"total":2,"page":1,"pageSize":20}}
    """#

    private let detailJSON = #"""
    {"data":{"id":"order_1","customerId":"cust_1","items":[{"productId":"p1","slug":"kaju-katli","name":"Kaju Katli","quantity":2,"unit":"kg","priceInPaise":50000}],"totals":{"itemsTotalInPaise":100000,"deliveryFeeInPaise":0,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":100000},"status":"confirmed","paymentStatus":"paid","createdAt":"2026-08-13T10:00:00Z","updatedAt":"2026-08-13T10:05:00Z"}}
    """#

    // MARK: list

    func testTwoOrdersInResponseYieldTwoRows() async {
        MockURLProtocol.routes["orders"] = (200, [:], Data(orderJSON.utf8))
        let vm = OrdersViewModel(client: makeClient())

        await vm.load()

        XCTAssertEqual(vm.orders.count, 2)
        XCTAssertEqual(vm.orders[0].id, "order_1")
        XCTAssertEqual(vm.orders[0].status, .confirmed)
        XCTAssertEqual(vm.orders[0].totals.totalInPaise, 100000)
        XCTAssertEqual(vm.orders[0].items.first?.name, "Kaju Katli")
        XCTAssertEqual(vm.orders[1].status, .outForDelivery)
        XCTAssertNil(vm.errorMessage)
    }

    func testListRequestCarriesPaginationQuery() async {
        MockURLProtocol.routes["orders"] = (200, [:], Data(orderJSON.utf8))
        let vm = OrdersViewModel(client: makeClient())
        await vm.load()

        let query = MockURLProtocol.lastRequests["orders"]?.url?.query ?? ""
        XCTAssertTrue(query.contains("page=1"))
        XCTAssertTrue(query.contains("pageSize=20"))
    }

    func testListErrorSurfacesMessageAndKeepsRows() async {
        MockURLProtocol.routes["orders"] = (200, [:], Data(orderJSON.utf8))
        let vm = OrdersViewModel(client: makeClient())
        await vm.load()
        XCTAssertEqual(vm.orders.count, 2)

        // Next refresh fails — rows stay, message appears.
        MockURLProtocol.routes["orders"] = (500, [:], Data(
            #"{"error":{"code":"INTERNAL","message":"boom"}}"#.utf8
        ))
        await vm.load()
        XCTAssertEqual(vm.orders.count, 2)
        XCTAssertNotNil(vm.errorMessage)
    }

    // MARK: detail

    func testDetailLoadsOrderById() async {
        MockURLProtocol.routes["orders/order_1"] = (200, [:], Data(detailJSON.utf8))
        let vm = OrderDetailViewModel(orderId: "order_1", client: makeClient())

        await vm.load()

        XCTAssertEqual(vm.order?.id, "order_1")
        XCTAssertEqual(vm.order?.status, .confirmed)
        XCTAssertEqual(vm.order?.paymentStatus, "paid")
        XCTAssertEqual(vm.order?.items.count, 1)
        XCTAssertNil(vm.errorMessage)
    }

    func testDetailNotFoundSurfacesMessage() async {
        MockURLProtocol.routes["orders/order_x"] = (404, [:], Data(
            #"{"error":{"code":"ORDER_NOT_FOUND","message":"Order order_x not found"}}"#.utf8
        ))
        let vm = OrderDetailViewModel(orderId: "order_x", client: makeClient())

        await vm.load()

        XCTAssertNil(vm.order)
        XCTAssertEqual(vm.errorMessage, "Order order_x not found")
    }

    // MARK: badge helpers (pure — Android OrderTimeline parity)

    func testStageIndexFollowsHappyPath() {
        XCTAssertNil(OrderTimeline.stageIndex(for: .pendingPayment))
        XCTAssertNil(OrderTimeline.stageIndex(for: .cancelled))
        XCTAssertEqual(OrderTimeline.stageIndex(for: .confirmed), 0)
        XCTAssertEqual(OrderTimeline.stageIndex(for: .packed), 1)
        XCTAssertEqual(OrderTimeline.stageIndex(for: .dispatched), 2)
        XCTAssertEqual(OrderTimeline.stageIndex(for: .outForDelivery), 3)
        XCTAssertEqual(OrderTimeline.stageIndex(for: .delivered), 4)
    }

    func testStatusTones() {
        XCTAssertEqual(OrderTimeline.tone(for: .delivered), .positive)
        XCTAssertEqual(OrderTimeline.tone(for: .confirmed), .progress)
        XCTAssertEqual(OrderTimeline.tone(for: .cancelled), .negative)
        XCTAssertEqual(OrderTimeline.tone(for: .paymentFailed), .negative)
    }

    func testStatusLabels() {
        XCTAssertEqual(OrderTimeline.label(for: .outForDelivery), "Out for delivery")
        XCTAssertEqual(OrderTimeline.label(for: .pendingPayment), "Payment pending")
        XCTAssertEqual(OrderTimeline.label(for: .failedDelivery), "Delivery failed")
    }

    func testFormatOrderDateParsesIsoInstant() {
        let formatted = OrderTimeline.formatDate("2026-08-13T10:00:00Z")
        XCTAssertTrue(formatted.contains("13"), "day should appear: \(formatted)")
        // Unparseable input passes through raw.
        XCTAssertEqual(OrderTimeline.formatDate("not-a-date"), "not-a-date")
    }
}
