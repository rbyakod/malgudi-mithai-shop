// StoryPillarTests.swift — P3 parity (Mishran Mobile Apps v1).
// Chip derivation for the journal's pillar filter: present(in:) keeps the
// contract's select order for known pillars, appends unknown extras sorted
// (a stray admin value still gets a stable chip), and drops nil/blank
// pillars; label(_:) resolves the stories.pillar.* table entries with a
// capitalized fallback outside the vocabulary.
import XCTest
@testable import Mishran

final class StoryPillarTests: XCTestCase {
    private func story(_ slug: String, pillar: String?) -> StoryEntity {
        StoryEntity(id: slug, slug: slug, title: slug, pillar: pillar)
    }

    func testPresentKeepsContractOrderAndDropsBlankPillars() {
        let stories = [
            story("journal-1", pillar: "journal"),
            story("farm-1", pillar: "farm"),
            story("untitled", pillar: nil),
            story("blank", pillar: ""),
            story("karigar-1", pillar: "karigar"),
            story("farm-2", pillar: "farm"),
        ]
        XCTAssertEqual(StoryPillar.present(in: stories), ["farm", "karigar", "journal"], "contract order, distinct, nil/blank dropped")
    }

    func testPresentAppendsUnknownPillarsSortedAfterKnown() {
        let stories = [
            story("journal-1", pillar: "journal"),
            story("sweets-1", pillar: "sweets"),
            story("people-1", pillar: "people"),
        ]
        XCTAssertEqual(StoryPillar.present(in: stories), ["journal", "people", "sweets"])
    }

    func testPresentWithNoPillarsIsEmpty() {
        XCTAssertEqual(StoryPillar.present(in: [story("a", pillar: nil), story("b", pillar: nil)]), [])
    }

    func testAllMirrorsTheCollectionsSelectOrder() {
        XCTAssertEqual(
            StoryPillar.all,
            ["farm", "milk", "karigar", "karigari", "packaging", "festival", "regional", "recipe", "journal"]
        )
    }

    func testLabelResolvesKnownPillarsThroughTheTable() {
        XCTAssertEqual(StoryPillar.label("farm"), L("stories.pillar.farm"))
        XCTAssertEqual(StoryPillar.label("journal"), L("stories.pillar.journal"))
    }

    func testLabelCapitalizesUnknownPillars() {
        XCTAssertEqual(StoryPillar.label("sweets"), "Sweets", "outside the vocabulary → capitalized value, not the raw key")
    }
}
