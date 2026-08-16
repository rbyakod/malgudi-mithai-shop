// WhatsAppMessagesTests.swift — P3 parity (Mishran Mobile Apps v1).
// Exact prefill copy for the two wa.me surfaces: the PDP's product enquiry
// (greeting + name + pack/price line + quantity, each optional piece
// collapsing cleanly) and the cart's enumerated order (1-based indexed
// lines with the pack chip in parens + the ₹ total).
import XCTest
@testable import Mishran

final class WhatsAppMessagesTests: XCTestCase {
    // MARK: PDP product enquiry

    func testProductEnquiryComposesFullForm() {
        let text = WhatsAppMessages.productEnquiry(
            name: "Kaju Katli",
            packLabel: "500g",
            priceLine: "₹1,840 / 500g",
            quantity: 2
        )
        XCTAssertEqual(
            text,
            "Hi Mishran! I'd like to ask about:\nKaju Katli\n500g — ₹1,840 / 500g\nQuantity: 2"
        )
    }

    func testProductEnquiryBasePackHasNoChip() {
        let text = WhatsAppMessages.productEnquiry(
            name: "Motichoor Laddoo",
            packLabel: nil,
            priceLine: "₹480",
            quantity: 1
        )
        XCTAssertEqual(
            text,
            "Hi Mishran! I'd like to ask about:\nMotichoor Laddoo\n₹480\nQuantity: 1"
        )
    }

    func testProductEnquirySurvivesMissingPriceAndPack() {
        let text = WhatsAppMessages.productEnquiry(
            name: "Mishran Box",
            packLabel: nil,
            priceLine: nil,
            quantity: 3
        )
        XCTAssertEqual(
            text,
            "Hi Mishran! I'd like to ask about:\nMishran Box\nQuantity: 3",
            "no dangling separator when the detail line is empty"
        )
    }

    // MARK: Cart order

    func testCartLineEnumeratesWithPackInParens() {
        XCTAssertEqual(
            WhatsAppMessages.cartLine(index: 1, name: "Kaju Katli", packLabel: "500g", quantity: 2, unitPricePaise: 184_000),
            "1. Kaju Katli (500g) × 2 — ₹1840"
        )
        XCTAssertEqual(
            WhatsAppMessages.cartLine(index: 2, name: "Motichoor Laddoo", packLabel: nil, quantity: 1, unitPricePaise: 48_000),
            "2. Motichoor Laddoo × 1 — ₹480",
            "base-pack lines carry no parens chip"
        )
    }

    func testCartOrderEnumeratesLinesAndTotal() {
        let text = WhatsAppMessages.cartOrder(
            lines: [
                (name: "Kaju Katli", packLabel: "500g", quantity: 2, unitPricePaise: 184_000),
                (name: "Motichoor Laddoo", packLabel: nil, quantity: 1, unitPricePaise: 48_000),
                (name: "Sugar-Free Barfi", packLabel: "250g", quantity: 3, unitPricePaise: 62_500),
            ],
            totalPaise: 605_500
        )
        // Money formats through CartView.rupees — no thousands separators.
        XCTAssertEqual(
            text,
            "Hi Mishran! I'd like to order:\n"
                + "1. Kaju Katli (500g) × 2 — ₹1840\n"
                + "2. Motichoor Laddoo × 1 — ₹480\n"
                + "3. Sugar-Free Barfi (250g) × 3 — ₹625\n"
                + "Total: ₹6055"
        )
    }

    func testCartOrderHandlesEmptyCart() {
        XCTAssertEqual(
            WhatsAppMessages.cartOrder(lines: [], totalPaise: 0),
            "Hi Mishran! I'd like to order:\nTotal: ₹0"
        )
    }

    // MARK: wa.me URL composition (BrandRepository side of the hand-off)

    func testWhatsappURLEncodesMultilinePrefill() throws {
        let url = try XCTUnwrap(BrandRepository.whatsappURL(
            digits: "919876543210",
            text: "Hi Mishran! I'd like to order:\n1. Kaju Katli × 1 — ₹480"
        ))
        XCTAssertEqual(url.absoluteString.hasPrefix("https://wa.me/919876543210?text="), true)
        // Newlines percent-encode as %0A so the prefill keeps its lines.
        XCTAssertTrue(url.absoluteString.contains("%0A"), "newlines must survive the query encoding")
    }

    func testWhatsappURLWithoutTextCarriesNoQuery() throws {
        let url = try XCTUnwrap(BrandRepository.whatsappURL(digits: "919876543210"))
        XCTAssertNil(url.query, "no prefill, no ?text= noise")
    }
}
