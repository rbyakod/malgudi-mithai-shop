// CountryPickerSheet.swift — Task 83 (Mishran Mobile Apps v1).
// Searchable country picker for the sign-in dial-code chip. ~240 rows, so the
// body is a List (lazy). Search matches country name, ISO code, or dial-code
// digits; picking applies immediately and dismisses.
import SwiftUI

struct CountryPickerSheet: View {
    let selected: CountryCode
    let onSelect: (CountryCode) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var filtered: [CountryCode] {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return CountryCodes.all }
        // "+971" typed with the plus should still match by dial digits.
        let dialQuery = q.hasPrefix("+") ? String(q.dropFirst()) : q
        let isDialQuery = !dialQuery.isEmpty && dialQuery.allSatisfy(\.isNumber)
        return CountryCodes.all.filter { country in
            country.name.localizedCaseInsensitiveContains(q)
                || country.iso2.caseInsensitiveCompare(q) == .orderedSame
                || (isDialQuery
                    && (country.dialCode == dialQuery || country.dialCode.hasPrefix(dialQuery)))
        }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { country in
                let isSelected = country.iso2 == selected.iso2
                Button {
                    onSelect(country)
                    dismiss()
                } label: {
                    HStack(spacing: .mishranSpacingMd) {
                        Text(country.flagEmoji)
                        Text(country.name)
                            .foregroundStyle(Color.mishranBrandInk)
                        Spacer()
                        Text(country.dialPrefixed)
                            .foregroundStyle(.secondary)
                        if isSelected {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color.mishranBrandAccent)
                        }
                    }
                    .frame(minHeight: 44)
                }
                .accessibilityLabel("\(country.name), \(country.dialPrefixed)")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: Text(L("auth.phone.country.search"))
            )
            .navigationTitle(L("auth.phone.country.label"))
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.large])
    }
}
