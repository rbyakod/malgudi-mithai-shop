// StoryFormatting.swift — P2 (Mishran Mobile Apps v1).
// ISO-8601 helpers for story dates: the contract ships strings (Payload's
// publishedAt/updatedAt, with or without fractional seconds), the journal
// sorts by parsed date and renders a medium date ("Aug 12, 2026").
import Foundation

enum StoryFormatting {
    /// Lenient ISO-8601 parse — handles both "…T10:30:00" and
    /// "…T10:30:00.000Z" shapes the API emits.
    static func date(fromISO iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        if let date = fractionalFormatter.date(from: iso) { return date }
        return plainFormatter.date(from: iso)
    }

    /// "Aug 12, 2026" for a contract timestamp, nil when unparseable.
    static func displayString(_ iso: String?) -> String? {
        guard let date = date(fromISO: iso) else { return nil }
        return displayFormatter.string(from: date)
    }

    private static let fractionalFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plainFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}
