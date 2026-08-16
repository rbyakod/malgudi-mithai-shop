// DeliveryCheck.swift — P3 parity (Mishran Mobile Apps v1).
// "Check delivery" pincode section for the mithai PDP — the iOS face of
// the serviceability API checkout already uses (GET /catalog/serviceable,
// port of the web components/mithai/PincodeCheck.tsx). Checks are one-shot:
// the last SERVICEABLE result is persisted to UserDefaults and restored on
// the next PDP visit without refetching (the SLA data is static; repeat
// calls would be noise). Formatting + result-line composition are pure
// statics so they're unit-testable without a repository.
import Foundation
import Observation
import SwiftUI

/// Last checked serviceable outcome — the persisted shape (Codable JSON in
/// UserDefaults). Only successful results persist (a not-serviceable probe
/// is a soft negative; the shopper may retry a different pincode).
struct DeliveryCheckResult: Codable, Equatable {
    let pincode: String
    /// "fresh" | "shelf".
    let tier: String
    let city: String
    let slaDays: Int
}

@MainActor
@Observable
final class DeliveryCheckModel {
    enum Phase: Equatable {
        case idle
        case checking
        case ok(DeliveryCheckResult)
        case notServiceable(String)
        case invalid
        case failed
    }

    static let storageKey = "product.delivery.last"
    /// Fresh-tier literal (CheckoutViewModel.tierFresh parity — duplicated
    /// here so the section has no checkout dependency).
    static let tierFresh = "fresh"

    private let client: MishranAPIClient
    private let defaults: UserDefaults

    private(set) var phase: Phase
    /// Raw field text — formatting (digits only, ≤6) happens on change and
    /// on check; the field keeps what the user typed between attempts.
    var pincode = ""

    init(client: MishranAPIClient, defaults: UserDefaults = .standard) {
        self.client = client
        self.defaults = defaults
        // One-shot restore: a saved result renders immediately, no refetch.
        if let saved = Self.storedResult(from: defaults) {
            phase = .ok(saved)
            pincode = saved.pincode
        } else {
            phase = .idle
        }
    }

    /// Validate → fetch → persist. Invalid input never leaves the device.
    func check() async {
        let pin = Self.formatted(pincode)
        guard Self.isValid(pin) else {
            phase = .invalid
            return
        }
        phase = .checking
        do {
            let dto: ServiceabilityDTO = try await client.request(
                Endpoint.catalogServiceable(pincode: pin)
            )
            if dto.serviceable, let tier = dto.tier, let city = dto.city, let slaDays = dto.slaDays {
                let result = DeliveryCheckResult(pincode: pin, tier: tier, city: city, slaDays: slaDays)
                Self.store(result, in: defaults)
                phase = .ok(result)
            } else {
                phase = .notServiceable(pin)
            }
        } catch {
            phase = .failed
        }
    }

    /// "Change" — back to the input, keeping the last pincode text so the
    /// shopper edits rather than retypes (web's Change does the same).
    func change() {
        phase = .idle
    }

    // MARK: Pure formatting + persistence (testable without a repository)

    /// Field sanitizer: digits only, first 6 ("560 0a2" → "56002" paths are
    /// impossible by construction — letters never accumulate).
    nonisolated static func formatted(_ raw: String) -> String {
        String(raw.filter(\.isNumber).prefix(6))
    }

    /// 6 digits, nothing else (the serviceable route's own contract).
    nonisolated static func isValid(_ pincode: String) -> Bool {
        pincode.count == 6 && pincode.allSatisfy(\.isNumber)
    }

    /// Localized tier word: Fresh for the same-day network, Shelf otherwise
    /// (unknown tiers read as Shelf — the conservative shipping promise).
    nonisolated static func tierLabel(_ tier: String) -> String {
        tier == tierFresh ? L("product.delivery.tier_fresh") : L("product.delivery.tier_shelf")
    }

    /// {days} token for the result line: "same-day" in the fresh tier, else
    /// the SLA day count (singular "1 day", web's ICU-plural counterpart).
    nonisolated static func daysLabel(tier: String, slaDays: Int) -> String {
        if tier == tierFresh { return L("product.delivery.same_day") }
        return slaDays == 1 ? "1 day" : "\(slaDays) days"
    }

    /// Full result line: "Delivers to Bengaluru · Fresh · same-day".
    nonisolated static func resultLine(_ result: DeliveryCheckResult) -> String {
        L(
            "product.delivery.result",
            result.city,
            tierLabel(result.tier),
            daysLabel(tier: result.tier, slaDays: result.slaDays)
        )
    }

    nonisolated static func storedResult(from defaults: UserDefaults) -> DeliveryCheckResult? {
        guard let data = defaults.data(forKey: storageKey) else { return nil }
        guard let result = try? JSONDecoder().decode(DeliveryCheckResult.self, from: data),
              isValid(result.pincode), !result.city.isEmpty else { return nil }
        return result
    }

    nonisolated static func store(_ result: DeliveryCheckResult, in defaults: UserDefaults) {
        if let data = try? JSONEncoder().encode(result) {
            defaults.set(data, forKey: storageKey)
        }
    }

    nonisolated static func clearStorage(in defaults: UserDefaults) {
        defaults.removeObject(forKey: storageKey)
    }
}

/// The PDP section itself: small uppercase label, then either the pincode
/// field + Check button (idle/invalid/failed) or the result line + Change
/// button (ok/notServiceable). ≥44pt targets throughout (a11y audit floor).
struct DeliveryCheckSection: View {
    @Bindable var model: DeliveryCheckModel

    var body: some View {
        VStack(alignment: .leading, spacing: .mishranSpacingSm) {
            Text(L("product.delivery.label"))
                .font(.mishranBodySm.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityAddTraits(.isHeader)

            switch model.phase {
            case .ok, .notServiceable:
                outcomeRow
            case .idle, .invalid, .failed, .checking:
                inputRow
            }

            // Status message under the field (aria-live counterpart): the
            // invalid/error copies; the ok/not-serviceable copies render in
            // outcomeRow instead.
            if model.phase == .invalid {
                message(L("product.delivery.invalid"))
            } else if model.phase == .failed {
                message(L("product.delivery.error"))
            }
        }
        .padding(.mishranSpacingMd)
        .background(
            RoundedRectangle(cornerRadius: .mishranRadiusMd)
                .fill(Color.mishranBrandSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .mishranRadiusMd)
                .strokeBorder(Color.mishranBrandAccent.opacity(0.15), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
    }

    /// Pincode field + Check/Checking button.
    private var inputRow: some View {
        HStack(spacing: .mishranSpacingMd) {
            TextField(L("product.delivery.placeholder"), text: $model.pincode)
                .keyboardType(.numberPad)
                .font(.mishranBodyLg)
                .onChange(of: model.pincode) { _, newValue in
                    model.pincode = DeliveryCheckModel.formatted(newValue)
                }
                .accessibilityLabel(L("product.delivery.label"))

            Button {
                Task { await model.check() }
            } label: {
                Group {
                    if model.phase == .checking {
                        ProgressView()
                    } else {
                        Text(L("product.delivery.check"))
                    }
                }
                .frame(minWidth: 44, minHeight: 44)
            }
            .buttonStyle(.bordered)
            .tint(Color.mishranBrandAccent)
            .disabled(model.phase == .checking || DeliveryCheckModel.formatted(model.pincode).count != 6)
            .accessibilityLabel(
                model.phase == .checking ? L("product.delivery.checking") : L("product.delivery.check")
            )
            .accessibilityHint("Checks delivery to this pincode")
        }
    }

    /// Result line + Change button (ok and not-serviceable share the row).
    private var outcomeRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: .mishranSpacingMd) {
            switch model.phase {
            case let .ok(result):
                Label(DeliveryCheckModel.resultLine(result), systemImage: "checkmark.circle.fill")
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranBrandAccent)
                    .accessibilityLabel(DeliveryCheckModel.resultLine(result))
            case let .notServiceable(pincode):
                Label(
                    L("product.delivery.not_serviceable", pincode),
                    systemImage: "xmark.octagon.fill"
                )
                .font(.mishranBodyMd)
                .foregroundStyle(Color.mishranStateError)
                .accessibilityLabel(L("product.delivery.not_serviceable", pincode))
            default:
                EmptyView()
            }

            Spacer(minLength: .mishranSpacingSm)

            Button(L("product.delivery.change")) {
                model.change()
            }
            .font(.mishranBodySm.weight(.semibold))
            .frame(minHeight: 44)
            .accessibilityLabel(L("product.delivery.change"))
            .accessibilityHint("Enter a different pincode")
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.mishranBodySm)
            .foregroundStyle(Color.mishranStateError)
            .accessibilityLabel(text)
    }
}
