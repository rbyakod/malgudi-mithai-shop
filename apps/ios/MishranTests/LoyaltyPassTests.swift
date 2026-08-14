// Task 19.3 (Mishran Mobile Apps v1): Apple Wallet loyalty pass — manager
// + account eligibility. LoyaltyPassManager's PassKit edge (PKPass can only
// be built from genuinely signed data — impossible to forge in a unit test)
// sits behind a PassViewControllerBuilder seam, so the tests drive
// download → build → present honestly with stub VCs. The account view model
// consumes GET /account/loyalty-pass: 200 = eligible, 404 = not yet.
import UIKit
import XCTest
@testable import Mishran

// MARK: - Test doubles

private struct StubPassDownloader: PassDownloading {
    var result: Result<Data, Error>

    func data(from url: URL) async throws -> Data {
        switch result {
        case .success(let data): return data
        case .failure(let error): throw error
        }
    }
}

@MainActor
private final class StubPassPresenter: PassPresenting {
    private(set) var presented: [UIViewController] = []
    private(set) var dismissed = false

    func present(_ viewController: UIViewController) {
        presented.append(viewController)
    }

    func dismissPresented() {
        dismissed = true
    }
}

@MainActor
final class LoyaltyPassTests: XCTestCase {
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

    // MARK: LoyaltyPassManager

    func testAddPassDownloadsBuildsAndPresents() async throws {
        let stubVC = UIViewController()
        let presenter = StubPassPresenter()
        let manager = LoyaltyPassManager(
            downloader: StubPassDownloader(result: .success(Data("pkpass-bytes".utf8))),
            builder: { _ in stubVC },
            presenter: presenter
        )

        try await manager.addPass(from: URL(string: "https://cdn.test/loyalty.pkpass")!)

        XCTAssertEqual(presenter.presented.count, 1)
        XCTAssertTrue(presenter.presented[0] === stubVC)
    }

    func testUnbuildablePassThrowsInvalidPassWithoutPresenting() async {
        let presenter = StubPassPresenter()
        let manager = LoyaltyPassManager(
            downloader: StubPassDownloader(result: .success(Data("junk".utf8))),
            builder: { _ in nil },
            presenter: presenter
        )

        do {
            try await manager.addPass(from: URL(string: "https://cdn.test/loyalty.pkpass")!)
            XCTFail("expected invalidPass")
        } catch let error as LoyaltyPassError {
            XCTAssertEqual(error, .invalidPass)
        } catch {
            XCTFail("unexpected error type \(error)")
        }
        XCTAssertTrue(presenter.presented.isEmpty)
    }

    func testDownloadFailurePropagatesWithoutPresenting() async {
        let presenter = StubPassPresenter()
        let manager = LoyaltyPassManager(
            downloader: StubPassDownloader(result: .failure(URLError(.notConnectedToInternet))),
            builder: { _ in UIViewController() },
            presenter: presenter
        )

        do {
            try await manager.addPass(from: URL(string: "https://cdn.test/loyalty.pkpass")!)
            XCTFail("expected download error")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .notConnectedToInternet)
        } catch {
            XCTFail("unexpected error type \(error)")
        }
        XCTAssertTrue(presenter.presented.isEmpty)
    }

    func testDelegateDidFinishFiresCompletionAndDismisses() async throws {
        let presenter = StubPassPresenter()
        let manager = LoyaltyPassManager(
            downloader: StubPassDownloader(result: .success(Data("pkpass-bytes".utf8))),
            builder: { _ in UIViewController() },
            presenter: presenter
        )
        let finish = expectation(description: "completion fired")
        manager.onFinish = { finish.fulfill() }

        try await manager.addPass(from: URL(string: "https://cdn.test/loyalty.pkpass")!)
        // Wallet dismisses via the delegate once the user Added / tapped
        // Done — handleDidFinish is the funnel the delegate calls.
        manager.handleDidFinish()

        await fulfillment(of: [finish], timeout: 2)
        XCTAssertTrue(presenter.dismissed)
    }

    // MARK: AccountViewModel eligibility

    private let eligibleJSON = #"""
    {"data":{"url":"https://cdn.test/loyalty.pkpass","serialNumber":"loyal_cust_1","tier":"gold"}}
    """#

    func testEligibleResponseYieldsPassURLAndTier() async {
        MockURLProtocol.routes["account/loyalty-pass"] = (200, [:], Data(eligibleJSON.utf8))
        let vm = AccountViewModel(client: makeClient())

        await vm.loadLoyaltyPass()

        guard case let .eligible(url, tier, serial) = vm.passState else {
            return XCTFail("expected eligible, got \(vm.passState)")
        }
        XCTAssertEqual(url.absoluteString, "https://cdn.test/loyalty.pkpass")
        XCTAssertEqual(tier, .gold)
        XCTAssertEqual(serial, "loyal_cust_1")
        XCTAssertEqual(MockURLProtocol.lastRequests["account/loyalty-pass"]?.httpMethod, "GET")
    }

    func testNotFoundMeansNotEligibleNotAnError() async {
        MockURLProtocol.routes["account/loyalty-pass"] = (404, [:], Data(
            #"{"error":{"code":"NOT_FOUND","message":"Not eligible for a loyalty pass — requires at least 2 delivered orders"}}"#.utf8
        ))
        let vm = AccountViewModel(client: makeClient())

        await vm.loadLoyaltyPass()

        guard case .notEligible = vm.passState else {
            return XCTFail("expected notEligible, got \(vm.passState)")
        }
    }

    func testServerErrorSurfacesMessage() async {
        MockURLProtocol.routes["account/loyalty-pass"] = (500, [:], Data(
            #"{"error":{"code":"INTERNAL","message":"Something broke"}}"#.utf8
        ))
        let vm = AccountViewModel(client: makeClient())

        await vm.loadLoyaltyPass()

        guard case let .failed(message) = vm.passState else {
            return XCTFail("expected failed, got \(vm.passState)")
        }
        XCTAssertEqual(message, "Something broke")
    }

    // MARK: tier display

    func testLoyaltyTierDisplayNames() {
        XCTAssertEqual(LoyaltyTier.silver.displayName, "Silver")
        XCTAssertEqual(LoyaltyTier.gold.displayName, "Gold")
    }
}
