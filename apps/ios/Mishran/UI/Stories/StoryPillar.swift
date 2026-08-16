// StoryPillar.swift — P3 parity (Mishran Mobile Apps v1).
// Editorial pillar vocabulary for the journal's filter chips: the nine
// select options collections/Stories.ts accepts, each with a
// stories.pillar.* label in the i18n tables. Pure derivation over the
// cached StoryEntity rows so chip order + label fallback are unit-testable
// without a repository.
import Foundation

enum StoryPillar {
    /// The nine contract pillars in select order (collections/Stories.ts) —
    /// also the chip order for pillars present in the cached set.
    nonisolated static let all: [String] = [
        "farm",
        "milk",
        "karigar",
        "karigari",
        "packaging",
        "festival",
        "regional",
        "recipe",
        "journal",
    ]

    /// Pillars worth a chip: the distinct non-nil pillars across the rows,
    /// contract order first, any unknown extras after (sorted — a stray
    /// admin value still gets a stable, labeled chip instead of vanishing).
    nonisolated static func present(in stories: [StoryEntity]) -> [String] {
        let seen = Set(stories.compactMap(\.pillar).filter { !$0.isEmpty })
        let known = all.filter { seen.contains($0) }
        let extras = seen.subtracting(all).sorted()
        return known + extras
    }

    /// Chip label: the stories.pillar.* table entry; a pillar outside the
    /// vocabulary falls back to its capitalized raw value (L() would echo
    /// the raw key, which reads worse than the value itself).
    nonisolated static func label(_ pillar: String) -> String {
        all.contains(pillar) ? L("stories.pillar.\(pillar)") : pillar.capitalized
    }
}
