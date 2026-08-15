// AccountView.swift — Task 19.3 (Mishran Mobile Apps v1).
// Minimal account hub: loyalty-pass promotion card (19.3) + quick links.
// Deep links mishran://account land here.
// Task 48.1: signed-in identity header + sign-out (tokens, best-effort
// server logout, local cart/order caches), and the Task 48.2 row into
// delivery-address management.
import SwiftData
import SwiftUI

struct AccountView: View {
    @State private var viewModel = AccountViewModel(client: MishranAPIClient())
    @Environment(\.modelContext) private var context
    let router: Router
    /// Task 48.1: the shell flips its launch surface to sign-in when this
    /// fires (same closure pattern as HomeView.onSignInRequested).
    var onSignedOut: (() -> Void)? = nil

    @State private var isSigningOut = false
    /// Best-effort client for the sign-out call — separate from the view
    /// model's so the loyalty state stays untouched.
    @State private var signOutClient = MishranAPIClient()
    /// Task 20.3: in-app language override (UserDefaults "AppleLanguages").
    @State private var showingLanguagePicker = false

    /// Cheap keychain probe: a refresh token means a live session. Nothing
    /// customer-shaped persists locally yet (signedInCustomer lives only in
    /// the sign-in view model's memory), so the header shows a static
    /// identity until a customer cache lands.
    private var hasSession: Bool {
        KeychainTokenStore().refreshToken != nil
    }

    var body: some View {
        List {
            if hasSession {
                Section {
                    HStack(spacing: .mishranSpacingMd) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.mishranDisplay)
                            .foregroundStyle(Color.mishranBrandAccent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(L("account.signed_in"))
                                .font(.mishranBodyLg.weight(.semibold))
                            Text("Phone-verified Mishran account")
                                .font(.mishranBodySm)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)

                    Button(role: .destructive) {
                        Task { await signOut() }
                    } label: {
                        HStack {
                            if isSigningOut {
                                ProgressView()
                            } else {
                                Label(L("account.logout"), systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        }
                        .frame(minHeight: 44)
                    }
                    .disabled(isSigningOut)
                    .accessibilityLabel(L("account.logout"))
                }
            }

            Section {
                WalletPassView(viewModel: viewModel)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Section(L("nav.orders")) {
                NavigationLink(value: Route.orders) {
                    Label("Order history", systemImage: "clock.arrow.circlepath")
                }
            }
            Section("Delivery") {
                NavigationLink(value: Route.addresses) {
                    Label(L("account.addresses"), systemImage: "mappin.and.ellipse")
                }
                .accessibilityLabel(L("account.addresses"))
            }
            // Task 20.3: in-app language override (persists to AppleLanguages;
            // applies on next launch — the sheet's footnote says so).
            Section("Preferences") {
                Button {
                    showingLanguagePicker = true
                } label: {
                    Label(L("account.language"), systemImage: "globe")
                }
                .accessibilityLabel(L("account.language"))
                .accessibilityHint("Choose the app language")
            }
            // P2: journal + bulk/events entries (stories.title / enquiry.title).
            Section("More") {
                NavigationLink(value: Route.stories) {
                    Label(L("stories.title"), systemImage: "book")
                }
                .accessibilityLabel(L("stories.title"))
                NavigationLink(value: Route.enquiry(type: .wedding)) {
                    Label(L("enquiry.title"), systemImage: "person.2")
                }
                .accessibilityLabel("Bulk and events")
            }
        }
        .navigationTitle(L("account.title"))
        .sheet(isPresented: $showingLanguagePicker) {
            LanguagePickerSheet()
        }
        .task {
            await viewModel.loadLoyaltyPass()
        }
    }

    /// Sign-out (Task 48.1): server logout + tokens dropped, then the
    /// customer-scoped local caches (cart lines + row, cached orders — and
    /// the address mirror, which would otherwise leak into the next
    /// customer's checkout picker). signedInOnce stays true so the next
    /// launch lands on sign-in, exactly like the revoked-session branch.
    private func signOut() async {
        isSigningOut = true
        defer { isSigningOut = false }
        await signOutClient.signOut()

        if let cart = try? context.fetch(FetchDescriptor<CartEntity>()).first {
            cart.delete(in: context)
        }
        for order in (try? context.fetch(FetchDescriptor<OrderEntity>())) ?? [] {
            context.delete(order)
        }
        for address in (try? context.fetch(FetchDescriptor<AddressEntity>())) ?? [] {
            context.delete(address)
        }
        for story in (try? context.fetch(FetchDescriptor<StoryEntity>())) ?? [] {
            context.delete(story)
        }
        // P2: the enquiry pre-fill phone is customer-shaped — drop it too.
        UserDefaults.standard.removeObject(forKey: AuthViewModel.sessionPhoneKey)
        try? context.save()

        router.popToRoot()
        onSignedOut?()
    }
}

/// Task 20.3: the 9 supported locales, each shown in its own script
/// (account.locale.*). Selection persists to UserDefaults "AppleLanguages"
/// — iOS applies the override on the NEXT launch, hence the footnote.
/// Without an override the app simply follows the system language.
private struct LanguagePickerSheet: View {
    /// en first (development language), then the rollout order.
    private let locales = ["en", "hi", "kn", "ta", "te", "mr", "gu", "bn", "pa"]
    @Environment(\.dismiss) private var dismiss

    /// The override iOS is currently using (first AppleLanguages entry),
    /// or the resolved bundle language when the user never picked one.
    private var current: String {
        let preferred = Locale.preferredLanguages.first ?? "en"
        return locales.first { preferred.hasPrefix($0) } ?? "en"
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(locales, id: \.self) { tag in
                    Button {
                        UserDefaults.standard.set([tag], forKey: "AppleLanguages")
                        dismiss()
                    } label: {
                        HStack {
                            Text(L("account.locale.\(tag)"))
                                .foregroundStyle(Color.mishranBrandInk)
                            Spacer()
                            if tag == current {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Color.mishranBrandAccent)
                            }
                        }
                        .frame(minHeight: 44)
                    }
                    .accessibilityLabel(L("account.locale.\(tag)"))
                    .accessibilityAddTraits(tag == current ? .isSelected : [])
                }

                Section {
                    Text(L("account.language_relaunch"))
                        .font(.mishranBodySm)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle(L("account.language"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
