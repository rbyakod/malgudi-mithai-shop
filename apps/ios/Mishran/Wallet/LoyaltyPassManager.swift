// LoyaltyPassManager.swift — Task 19.3 (Mishran Mobile Apps v1).
// Downloads the signed .pkpass the backend produced (GET /account/loyalty-pass
// → 24h signed URL) and hands it to PKAddPassesViewController. The PassKit
// edge — building a PKPass from genuinely signed data — sits behind
// PassViewControllerBuilder so unit tests can drive download → build →
// present without forging Apple-signed bytes (impossible).
import PassKit
import UIKit

enum LoyaltyPassError: Error, Equatable {
    /// The downloaded bytes didn't yield a presentable pass (bad data,
    /// or PKAddPassesViewController unavailable on this device).
    case invalidPass
}

/// Loyalty tier resolved from delivered-order count (backend: Silver ≥2,
/// Gold ≥5).
enum LoyaltyTier: String, Codable, Equatable, Sendable {
    case silver, gold

    var displayName: String {
        switch self {
        case .silver: return "Silver"
        case .gold: return "Gold"
        }
    }
}

/// Fetches the raw .pkpass bytes from the signed CDN URL.
protocol PassDownloading: Sendable {
    func data(from url: URL) async throws -> Data
}

struct URLSessionPassDownloader: PassDownloading {
    func data(from url: URL) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        return data
    }
}

/// Presents the add-pass sheet over whatever is on screen.
@MainActor
protocol PassPresenting: AnyObject {
    func present(_ viewController: UIViewController)
    func dismissPresented()
}

/// Real presenter: walks the key window to its top-most view controller.
@MainActor
final class WindowPassPresenter: PassPresenting {
    func present(_ viewController: UIViewController) {
        topViewController()?.present(viewController, animated: true)
    }

    func dismissPresented() {
        topViewController()?.dismiss(animated: true)
    }

    private func topViewController() -> UIViewController? {
        let window = UIApplication.shared
            .connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

@MainActor
final class LoyaltyPassManager: NSObject, PKAddPassesViewControllerDelegate {
    typealias PassViewControllerBuilder = @MainActor (Data) -> UIViewController?

    private let downloader: PassDownloading
    private let builder: PassViewControllerBuilder
    private let presenter: PassPresenting
    /// Fired after the user finishes the add-pass sheet (added or cancelled).
    var onFinish: (() -> Void)?

    init(
        downloader: PassDownloading = URLSessionPassDownloader(),
        builder: @escaping PassViewControllerBuilder = LoyaltyPassManager.buildAddPassesController,
        presenter: PassPresenting? = nil
    ) {
        self.downloader = downloader
        self.builder = builder
        // Default-arg position is nonisolated — resolve inside the body.
        self.presenter = presenter ?? WindowPassPresenter()
        super.init()
    }

    /// Real builder: .pkpass bytes → PKPass → PKAddPassesViewController
    /// (delegate wired in addPass — the builder can't capture self).
    /// Returns nil when the data isn't a valid signed pass.
    @MainActor static func buildAddPassesController(_ data: Data) -> UIViewController? {
        guard let pass = try? PKPass(data: data) else { return nil }
        return PKAddPassesViewController(pass: pass)
    }

    /// Download → build → present. Throws the download error as-is, or
    /// .invalidPass when no presentable controller comes out.
    func addPass(from url: URL) async throws {
        let data = try await downloader.data(from: url)
        guard let viewController = builder(data) else {
            throw LoyaltyPassError.invalidPass
        }
        if let addPasses = viewController as? PKAddPassesViewController {
            addPasses.delegate = self
        }
        presenter.present(viewController)
    }

    // MARK: PKAddPassesViewControllerDelegate

    nonisolated func addPassesViewControllerDidFinish(
        _ controller: PKAddPassesViewController
    ) {
        Task { @MainActor in
            self.handleDidFinish()
        }
    }

    /// The funnel the delegate lands in: dismiss + notify (tested).
    @MainActor
    func handleDidFinish() {
        presenter.dismissPresented()
        onFinish?()
    }
}
