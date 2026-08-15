// Verticals.swift — P2 (Mishran Mobile Apps v1).
// Shared vocabulary for the catalog's vertical tabs. Mithai is the existing
// products flow; snacks (retail-only, MSRP + external retailers), QSR
// (walk-in counter menu, no cart), and merch (enquiry-led) load from their
// own public mobile-v1 endpoints. Labels resolve from
// packages/i18n-strings (vertical.mithai/snacks/qsr/merch) via the L()
// helper — Task 20.3 wiring.
import Foundation

/// Catalog vertical tabs (Mithai · Snacks · QSR · Merch).
enum Vertical: String, CaseIterable, Identifiable, Hashable {
    case mithai, snacks, qsr, merch

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .mithai: L("vertical.mithai")
        case .snacks: L("vertical.snacks")
        case .qsr: L("vertical.qsr")
        case .merch: L("vertical.merch")
        }
    }

    /// Placeholder portals (count 0, no imagery) rendered on Home until the
    /// vertical pages load — keeps the row's layout stable while in flight.
    static var placeholderPortals: [VerticalPortal] {
        Vertical.allCases.map { VerticalPortal(vertical: $0, count: 0, imageURL: nil) }
    }
}

/// One Home "Shop by vertical" portal card: where the row's image + count
/// come from (mithai derives off the offline catalog; the other three off
/// their first list page).
struct VerticalPortal: Equatable, Identifiable {
    let vertical: Vertical
    let count: Int
    let imageURL: String?

    var id: String { vertical.rawValue }

    /// "Snacks · 39" when stocked, bare label otherwise (FamilyChip idiom).
    var label: String {
        count > 0 ? "\(vertical.displayName) · \(count)" : vertical.displayName
    }
}

/// Card-shape adapter across the non-mithai verticals — every tab renders
/// image + name + ONE discriminator line; detail screens stay per-vertical.
enum VerticalCard: Identifiable {
    case snack(SnackDTO)
    case qsr(QsrItemDTO)
    case merch(MerchDTO)

    var id: String {
        switch self {
        case let .snack(dto): "snack:\(dto.id)"
        case let .qsr(dto): "qsr:\(dto.id)"
        case let .merch(dto): "merch:\(dto.id)"
        }
    }

    var vertical: Vertical {
        switch self {
        case .snack: .snacks
        case .qsr: .qsr
        case .merch: .merch
        }
    }

    var slug: String {
        switch self {
        case let .snack(dto): dto.slug
        case let .qsr(dto): dto.slug
        case let .merch(dto): dto.slug
        }
    }

    var name: String {
        switch self {
        case let .snack(dto): dto.name
        case let .qsr(dto): dto.name
        case let .merch(dto): dto.name
        }
    }

    var imageURL: String? {
        switch self {
        case let .snack(dto): dto.images?.first
        case let .qsr(dto): dto.image
        case let .merch(dto): dto.images?.first
        }
    }

    /// One-line discriminator under the name: snacks MSRP + weight, QSR
    /// category (the veg dot renders beside it — see showsVegDot), merch
    /// type + availability.
    var discriminator: String? {
        switch self {
        case let .snack(dto):
            [dto.msrp, dto.weight]
                .compactMap { $0?.isEmpty == false ? $0 : nil }
                .joined(separator: " · ")
                .nilIfEmpty
        case let .qsr(dto):
            dto.category.map { $0.capitalized }
        case let .merch(dto):
            [dto.type.map(Self.titleCase), dto.availability.map(Self.titleCase)]
                .compactMap(\.self)
                .joined(separator: " · ")
                .nilIfEmpty
        }
    }

    /// QSR cards prefix the discriminator with the green veg dot.
    var showsVegDot: Bool {
        if case let .qsr(dto) = self { return dto.veg == true }
        return false
    }

    /// "enquiry-only" → "Enquiry-only" (first letter only — the compound
    /// reads better hyphenated than camel-split).
    private static func titleCase(_ value: String) -> String {
        value.prefix(1).uppercased() + value.dropFirst()
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
