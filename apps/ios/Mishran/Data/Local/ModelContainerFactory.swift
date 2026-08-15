// ModelContainerFactory.swift — Task 16.1 (Mishran Mobile Apps v1).
// Builds the SwiftData container: on-disk Mishran.sqlite in app support for
// the app, in-memory for tests/previews.
import Foundation
import SwiftData

enum ModelContainerFactory {
    static var schema: Schema {
        Schema([
            ProductEntity.self,
            CategoryEntity.self,
            CartEntity.self,
            CartItemEntity.self,
            AddressEntity.self,
            OrderEntity.self,
            StoryEntity.self,
        ])
    }

    /// - Parameter inMemory: tests/previews pass true (no on-disk store).
    static func makeContainer(inMemory: Bool = false) throws -> ModelContainer {
        let configuration = inMemory
            ? ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            : ModelConfiguration(schema: schema, url: storeURL())
        return try ModelContainer(for: schema, configurations: [configuration])
    }

    /// Application Support/Mishran/Mishran.sqlite — created on first use.
    static func storeURL() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = support.appendingPathComponent("Mishran", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("Mishran.sqlite")
    }
}
