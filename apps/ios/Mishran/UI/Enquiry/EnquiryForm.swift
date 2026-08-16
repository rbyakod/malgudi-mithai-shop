// EnquiryForm.swift — P2 (Mishran Mobile Apps v1); P3 wire parity.
// Pure form state + validation for the Bulk & events enquiry screen
// (AddressForm pattern — the rules are unit-testable without rendering).
// Client gate: name/phone/message/email required, email well-formed, GSTIN
// shape-checked when present. P3: email became REQUIRED — the server
// (app/api/leads/route.ts) always 400'd a blank one, so the old
// "optional-but-validated" gate only deferred the failure to the wire.
// The payload now mirrors the web forms exactly (wedding: eventDate/city/
// guests:Int/budget/mithaiPreferences/packaging; corporate: quantity:Int/
// deadline/branding/occasion; GSTIN rides contact.GSTIN).
import Foundation

/// Lead type toggle — raw values are the literals collections/Leads.ts
/// accepts ("wedding" / "corporate").
enum EnquiryType: String, CaseIterable, Identifiable, Hashable {
    case wedding, corporate

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .wedding: L("enquiry.type.wedding")
        case .corporate: L("enquiry.type.corporate")
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
    /// P3 wire parity: free-form budget line ("₹40,000–₹60,000", "per box", …).
    var budget = ""
    /// P3 wire parity: mithai the customer wants (or wants avoided).
    var mithaiPreferences = ""
    /// P3 wire parity: packaging asks (eco boxes, custom trays, …).
    var packaging = ""
    // Corporate extras
    var company = ""
    var quantity = ""
    var neededBy = Date()
    /// P3 wire parity: GSTIN for the input-credit invoice (contact.GSTIN).
    var gstin = ""
    /// P3 wire parity: the gifting occasion (Diwali, onboarding, …).
    var occasion = ""
    /// P3 wire parity: logo/branding asks on the boxes.
    var branding = ""

    /// Submit gate: name/phone/email/message non-blank; email well-formed;
    /// GSTIN 15 chars of digits + capitals when present.
    var isValid: Bool {
        !name.trimmed.isEmpty
            && !phone.trimmed.isEmpty
            && !message.trimmed.isEmpty
            && Self.emailIsValid(email)
            && (gstin.trimmed.isEmpty || Self.gstinIsValid(gstin))
    }

    /// Writable body for POST /api/leads — trimmed, blanks ride nothing
    /// (company + GSTIN ride contact; the rest ride the free-form payload).
    var input: LeadInputDTO {
        LeadInputDTO(
            type: type.rawValue,
            contact: .init(
                name: name.trimmed,
                email: email.trimmed.isEmpty ? nil : email.trimmed,
                phone: phone.trimmed,
                company: company.trimmed.isEmpty ? nil : company.trimmed,
                GSTIN: gstin.trimmed.isEmpty ? nil : gstin.trimmed.uppercased()
            ),
            payload: payload,
            source: "ios-app"
        )
    }

    /// Type-specific extras (the web forms' exact keys + shapes); message
    /// always rides along, counts ride as JSON numbers, blanks ride nothing.
    var payload: [String: LeadPayloadValue] {
        var fields: [String: LeadPayloadValue] = ["message": .string(message.trimmed)]
        switch type {
        case .wedding:
            fields["eventDate"] = .string(Self.dayString(eventDate))
            if !city.trimmed.isEmpty { fields["city"] = .string(city.trimmed) }
            if let guestCount = Self.intOrNull(guests) { fields["guests"] = .number(guestCount) }
            if !budget.trimmed.isEmpty { fields["budget"] = .string(budget.trimmed) }
            if !mithaiPreferences.trimmed.isEmpty { fields["mithaiPreferences"] = .string(mithaiPreferences.trimmed) }
            if !packaging.trimmed.isEmpty { fields["packaging"] = .string(packaging.trimmed) }
        case .corporate:
            if let quantityCount = Self.intOrNull(quantity) { fields["quantity"] = .number(quantityCount) }
            fields["deadline"] = .string(Self.dayString(neededBy))
            if !branding.trimmed.isEmpty { fields["branding"] = .string(branding.trimmed) }
            if !occasion.trimmed.isEmpty { fields["occasion"] = .string(occasion.trimmed) }
        }
        return fields
    }

    /// Simple one-@-two-dot shape check (same latitude as the web form's
    /// type=email validation).
    nonisolated static func emailIsValid(_ email: String) -> Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.wholeMatch(of: Self.emailRegex) != nil
    }

    /// GSTIN shape: exactly 15 chars of digits + uppercase A–Z (the
    /// GSTIN's own alphabet — lowercase is normalized to upper before the
    /// payload, but the gate itself stays strict on case so a paste is
    /// surfaced as an error, not silently rewritten).
    nonisolated static func gstinIsValid(_ gstin: String) -> Bool {
        let trimmed = gstin.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.wholeMatch(of: Self.gstinRegex) != nil
    }

    /// DatePicker Date → "2026-11-14" (ops-friendly, sortable, locale-fixed).
    nonisolated static func dayString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    /// Count field text → Int for the payload's JSON numbers; nil when
    /// blank or non-numeric (the field is a number pad, but pastes aren't).
    nonisolated static func intOrNull(_ text: String) -> Int? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return Int(trimmed)
    }

    private static let emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/
    private static let gstinRegex = /^[0-9A-Z]{15}$/

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
