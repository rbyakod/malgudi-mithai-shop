// StoryRepository.swift — P2 (Mishran Mobile Apps v1).
// Cached fetch of GET /stories for the journal list + Home rail, and
// GET /stories/{slug} for the reader. Mirrors CatalogRepository's shape
// (MainActor + @Observable because it owns SwiftData rows, not an actor
// like the DTO-only repositories): offline-first — the cached page is the
// starting state, a failed refresh keeps it standing with errorMessage set.
//
// Refresh strategy: SIMPLE FULL REFRESH, no ETag conditional. The stories
// set is small (a handful of docs), rarely edited, and the reader always
// re-fetches its detail — a 304 wouldn't save enough bytes to justify the
// extra plumbing here (catalog keeps its ETag because it's the hot path).
// If stories grow, port the If-None-Match flow from CatalogRepository.
import Foundation
import Observation
import SwiftData

@MainActor
@Observable
final class StoryRepository {
    private let client: MishranAPIClient
    private let context: ModelContext

    private(set) var stories: [StoryEntity] = []
    private(set) var isLoading = false
    var errorMessage: String?

    init(client: MishranAPIClient, context: ModelContext) {
        self.client = client
        self.context = context
        // Offline-first: cached rows are the starting state, always.
        stories = StoryEntity.cachedStories(in: context)
    }

    func getStories() async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            let page: StoryPageDTO = try await client.request(Endpoint.storiesList())
            StoryEntity.replaceAll(with: page.items, in: context)
            stories = StoryEntity.cachedStories(in: context)
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
        } catch {
            errorMessage = "Couldn't load the journal. Showing saved stories."
        }
    }

    /// Reader payload — fetched live (the body never rides the list, so it
    /// isn't cached); callers fall back to the cached row on failure.
    func storyDetail(slug: String) async throws -> StoryDetailDTO {
        try await client.request(Endpoint.storyDetail(slug: slug))
    }

    nonisolated private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load the journal. Showing saved stories."
    }
}
