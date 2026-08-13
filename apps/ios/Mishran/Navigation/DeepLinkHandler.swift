// DeepLinkHandler.swift — Task 14.4 (Mishran Mobile Apps v1).
// Parses mishran:// URIs into routes. Registered scheme lives in Info.plist
// (CFBundleURLSchemes, set in Task 14.1). Currently understood:
//   mishran://order/{id}  → .orderDetail (push-notification taps)
//   mishran://account      → .account (loyalty pass, Task 19.3)
// Unknown hosts/schemes are ignored — never crash on a malformed link.
import Foundation

final class DeepLinkHandler {
    let router: Router

    init(router: Router) {
        self.router = router
    }

    func handle(_ url: URL) {
        guard url.scheme?.lowercased() == "mishran" else { return }

        switch url.host?.lowercased() {
        case "order":
            // mishran://order/abc123 → host "order", path "/abc123".
            if let id = url.pathComponents.first(where: { $0 != "/" }), !id.isEmpty {
                router.reset(to: .orderDetail(id: id))
            }
        case "account":
            router.reset(to: .account)
        default:
            break
        }
    }
}
