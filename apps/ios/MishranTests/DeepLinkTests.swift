// Task 14.4 (Mishran Mobile Apps v1): deep-link parsing unit tests.
// mishran://order/{id} must push the order detail route and reset the stack
// (notification deep links should never land mid-stack).
import XCTest
@testable import Mishran

final class DeepLinkTests: XCTestCase {
    private func makeHandler() -> (DeepLinkHandler, Router) {
        let router = Router()
        return (DeepLinkHandler(router: router), router)
    }

    func testOrderDeepLinkPushesOrderDetail() throws {
        let (handler, router) = makeHandler()
        let url = try XCTUnwrap(URL(string: "mishran://order/abc123"))
        handler.handle(url)
        XCTAssertEqual(router.path, [.orderDetail(id: "abc123")])
    }

    func testOrderDeepLinkResetsExistingStack() throws {
        let (handler, router) = makeHandler()
        router.push(.productDetail(slug: "kaju-katli"))
        router.push(.cart)
        let url = try XCTUnwrap(URL(string: "mishran://order/ord_9"))
        handler.handle(url)
        XCTAssertEqual(router.path, [.orderDetail(id: "ord_9")])
    }

    func testForeignSchemeIsIgnored() throws {
        let (handler, router) = makeHandler()
        let url = try XCTUnwrap(URL(string: "https://mishran.app/order/abc"))
        handler.handle(url)
        XCTAssertTrue(router.path.isEmpty)
    }

    func testOrderDeepLinkWithoutIdIsIgnored() throws {
        let (handler, router) = makeHandler()
        let url = try XCTUnwrap(URL(string: "mishran://order"))
        handler.handle(url)
        XCTAssertTrue(router.path.isEmpty)
    }

    func testUnknownHostIsIgnored() throws {
        let (handler, router) = makeHandler()
        let url = try XCTUnwrap(URL(string: "mishran://totally-unknown/x"))
        handler.handle(url)
        XCTAssertTrue(router.path.isEmpty)
    }

    func testRouterPopAndPopToRoot() {
        let router = Router()
        router.push(.productDetail(slug: "a"))
        router.push(.cart)
        router.pop()
        XCTAssertEqual(router.path, [.productDetail(slug: "a")])
        router.popToRoot()
        XCTAssertTrue(router.path.isEmpty)
    }
}
