// GiftForm.swift — P3 parity (Mishran Mobile Apps v1).
// Pure form state + validation for the gift-box builder (EnquiryForm
// pattern — the rules are unit-testable without rendering). The builder
// collects the occasion/box-size/budget trio + contact + delivery wishes
// and posts a "gift-builder-draft" lead through the same LeadRepository
// the enquiry screen uses; ops replies with an assortment + quote. Client
// gate: name + a well-formed email REQUIRED (the /api/leads route 400s a
// blank email — the known bug the enquiry gate also guards against).
import Foundation

/// Gift builder picker vocabularies — the web configurator's verbatim
/// options (labels and payload values are the same strings).
enum GiftFormOptions {
    static let occasions = ["Diwali", "Wedding", "Corporate", "Birthday", "Housewarming", "Other"]
    static let boxSizes = ["4-piece", "8-piece", "16-piece", "Custom"]
    static let budgets = ["Under ₹1,000", "₹1,000-₹2,500", "₹2,500-₹5,000", "₹5,000+"]
}

struct GiftForm: Equatable {
    var name = ""
    var email = ""
    var phone = ""
    var city = ""
    var occasion = GiftFormOptions.occasions[0]
    var boxSize = GiftFormOptions.boxSizes[0]
    var budget = GiftFormOptions.budgets[0]
    var neededBy = Date()
    var dietary = ""
    var message = ""

    /// Lead type literal (collections/Leads.ts options).
    static let leadType = "gift-builder-draft"

    /// Submit gate: name non-blank; email REQUIRED and well-formed (same
    /// shape check as the enquiry form).
    var isValid: Bool {
        !name.trimmed.isEmpty && EnquiryForm.emailIsValid(email)
    }

    /// Writable body for POST /api/leads — trimmed, blanks ride nothing:
    /// contact carries name/email/phone, the payload carries the picker
    /// trio + city + the ISO needed-by date + the free-form dietary and
    /// message-card notes.
    var input: LeadInputDTO {
        LeadInputDTO(
            type: Self.leadType,
            contact: .init(
                name: name.trimmed,
                email: email.trimmed,
                phone: phone.trimmed.isEmpty ? nil : phone.trimmed
            ),
            payload: payload,
            source: "ios-app"
        )
    }

    /// Payload extras — pickers always ride (they always have a value);
    /// city/dietary/message ride only when non-blank.
    var payload: [String: LeadPayloadValue] {
        var fields: [String: LeadPayloadValue] = [
            "occasion": .string(occasion),
            "boxSize": .string(boxSize),
            "budget": .string(budget),
            "date": .string(EnquiryForm.dayString(neededBy)),
        ]
        if !city.trimmed.isEmpty { fields["city"] = .string(city.trimmed) }
        if !dietary.trimmed.isEmpty { fields["dietary"] = .string(dietary.trimmed) }
        if !message.trimmed.isEmpty { fields["message"] = .string(message.trimmed) }
        return fields
    }
}
