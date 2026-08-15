// EnquiryForm.swift — P2 (Mishran Mobile Apps v1).
// Pure form state + validation for the Bulk & events enquiry screen
// (AddressForm pattern — the rules are unit-testable without rendering).
// Client gate: name/phone/message required, email well-formed when present.
// NOTE: the server (app/api/leads/route.ts) additionally requires
// contact.email — a blank email passes the client gate only to be 400'd;
// TODO(next pass): tighten the gate once copy allows making email required.
import Foundation

/// Lead type toggle — raw values are the literals collections/Leads.ts
/// accepts ("wedding" / "corporate").
enum EnquiryType: String, CaseIterable, Identifiable, Hashable {
    case wedding, corporate

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .wedding: "Wedding"
        case .corporate: "Corporate"
        }
    }
}

struct EnquiryForm: Equatable {
    var type: EnquiryType = .wedding
    var name = ""
    var phone = ""
    var email = ""
    var message = ""
    // Wedding extras
    var eventDate = Date()
    var city = ""
    var guests = ""
    // Corporate extras
    var company = ""
    var quantity = ""
    var neededBy = Date()

    /// Submit gate: name/phone/message non-blank; email optional but must be
    /// well-formed when present.
    var isValid: Bool {
        !name.trimmed.isEmpty
            && !phone.trimmed.isEmpty
            && !message.trimmed.isEmpty
            && (email.trimmed.isEmpty || Self.emailIsValid(email))
    }

    /// Writable body for POST /api/leads — trimmed, blanks ride nothing
    /// (company rides contact.company; the rest ride the free-form payload).
    var input: LeadInputDTO {
        LeadInputDTO(
            type: type.rawValue,
            contact: .init(
                name: name.trimmed,
                email: email.trimmed.isEmpty ? nil : email.trimmed,
                phone: phone.trimmed,
                company: company.trimmed.isEmpty ? nil : company.trimmed
            ),
            payload: payload,
            source: "ios-app"
        )
    }

    /// Type-specific extras; message always rides along.
    var payload: [String: String] {
        var fields = ["message": message.trimmed]
        switch type {
        case .wedding:
            fields["eventDate"] = Self.dayString(eventDate)
            if !city.trimmed.isEmpty { fields["city"] = city.trimmed }
            if !guests.trimmed.isEmpty { fields["guests"] = guests.trimmed }
        case .corporate:
            if !quantity.trimmed.isEmpty { fields["quantity"] = quantity.trimmed }
            fields["neededBy"] = Self.dayString(neededBy)
        }
        return fields
    }

    /// Simple one-@-two-dot shape check (same latitude as the web form's
    /// type=email validation).
    nonisolated static func emailIsValid(_ email: String) -> Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.wholeMatch(of: Self.emailRegex) != nil
    }

    /// DatePicker Date → "2026-11-14" (ops-friendly, sortable, locale-fixed).
    nonisolated static func dayString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    private static let emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
