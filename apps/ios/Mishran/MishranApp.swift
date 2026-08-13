// MishranApp.swift — Task 14.1 (Mishran Mobile Apps v1).
// Minimal @main entry point: boots a blank screen showing the wordmark.
// Real theme (14.2) + nav graph (14.3/14.4) wrap this root view later.
import SwiftUI

@main
struct MishranApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 8) {
                Image(systemName: "circle.hexagongrid.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(Color.accentColor)
                Text("Mishran")
                    .font(.title.bold())
            }
        }
    }
}
