// Router.swift — Task 14.4 (Mishran Mobile Apps v1).
// @Observable path holder for NavigationStack — iOS 17 Observation, no
// ObservableObject boilerplate. Views mutate through push/pop; deep links
// and notifications reset + push in one update.
import Foundation
import Observation

@Observable
final class Router {
    var path: [Route] = []

    func push(_ route: Route) {
        path.append(route)
    }

    func pop() {
        if !path.isEmpty {
            path.removeLast()
        }
    }

    func popToRoot() {
        path.removeAll()
    }

    /// Deep-link entry: land on the route with a clean stack.
    func reset(to route: Route) {
        path = [route]
    }
}
