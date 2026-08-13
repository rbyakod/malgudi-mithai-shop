// CatalogRefreshTask.swift — Task 16.2 (Mishran Mobile Apps v1).
// BGTaskScheduler periodic catalog refresh: every 6 hours the store gets a
// conditional GET (ETag) so the offline cache stays fresh. Registration
// happens at app launch; the handler is injectable for tests/previews.
import BackgroundTasks
import Foundation

enum CatalogRefreshTask {
    static let identifier = "com.mishran.app.catalog-refresh"
    /// 6 hours, per plan.
    static let refreshInterval: TimeInterval = 6 * 60 * 60

    /// Testable request factory — the scheduling surface itself
    /// (BGTaskScheduler.submit) is device/runtime-gated.
    static func makeRequest(after interval: TimeInterval = refreshInterval) -> BGAppRefreshTaskRequest {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: interval)
        return request
    }

    /// Call once at app launch (before scene setup finishes).
    static func register(handler: @escaping () async -> Void) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            let job = Task {
                await handler()
                refresh.setTaskCompleted(success: true)
            }
            refresh.expirationHandler = {
                job.cancel()
                refresh.setTaskCompleted(success: false)
            }
            scheduleNext()
        }
    }

    /// (Re)schedule the next refresh — call at launch and after each run.
    static func scheduleNext() {
        do {
            try BGTaskScheduler.shared.submit(makeRequest())
        } catch {
            // Scheduling can legitimately fail right after a manual run
            // (OS throttling) — the next launch retries.
        }
    }
}
