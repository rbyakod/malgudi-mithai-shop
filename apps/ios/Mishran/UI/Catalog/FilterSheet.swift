// FilterSheet.swift — Task 16.3 (Mishran Mobile Apps v1).
// Dietary (sugar-free, eggless…), family/category, region filters.
import SwiftUI

struct FilterSheet: View {
    @Binding var filters: CatalogFilters
    @Environment(\.dismiss) private var dismiss

    /// Dietary options surfaced in v1 (tags come from the catalog contract).
    private let dietaryOptions = ["sugar-free", "eggless", "gluten-free"]

    var body: some View {
        NavigationStack {
            List {
                Section("Category") {
                    Picker("Category", selection: $filters.family) {
                        Text("All").tag(ProductFamily?.none)
                        ForEach(ProductFamily.allCases, id: \.self) { family in
                            Text(family.displayName).tag(ProductFamily?.some(family))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                    .accessibilityLabel("Category filter")
                }

                Section("Dietary") {
                    ForEach(dietaryOptions, id: \.self) { tag in
                        Toggle(isOn: binding(for: tag)) {
                            Text(tag.capitalized)
                        }
                        .accessibilityLabel("\(tag.capitalized) filter")
                    }
                }

                Section("Region") {
                    Toggle(isOn: regionalBinding) {
                        Text("Regional specials")
                    }
                    .accessibilityLabel("Regional specials filter")
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") { filters = CatalogFilters() }
                        .accessibilityLabel("Clear all filters")
                }
            }
        }
    }

    private func binding(for tag: String) -> Binding<Bool> {
        Binding(
            get: { filters.dietary.contains(tag) },
            set: { isOn in
                if isOn {
                    filters.dietary.insert(tag)
                } else {
                    filters.dietary.remove(tag)
                }
            }
        )
    }

    /// Region is a one-tap shortcut for the regional family.
    private var regionalBinding: Binding<Bool> {
        Binding(
            get: { filters.family == .regional },
            set: { isOn in
                filters.family = isOn ? .regional : nil
            }
        )
    }
}

extension ProductFamily {
    var displayName: String {
        switch self {
        case .classic: "Classic"
        case .original: "Originals"
        case .sugarFree: "Sugar-free"
        case .regional: "Regional"
        case .seasonal: "Seasonal"
        }
    }
}
