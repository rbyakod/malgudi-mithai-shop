// VerticalCatalogViewModel.swift — P2 (Mishran Mobile Apps v1).
// State behind the catalog's non-mithai tabs (Snacks / QSR / Merch). One
// view model owns all three lists; `selected` is the segmented tab. Tabs
// load once and are memoized (revisiting a tab is instant), retry/reload
// re-fetches the selected one. No offline cache in v1 — the verticals are
// browse-only surfaces with no commerce behind them, so a failed load shows
// error + retry instead of a stale row set (the mithai tab keeps the
// offline-first CatalogRepository flow).
import Foundation
import Observation

@MainActor
@Observable
final class VerticalCatalogViewModel {
    private let repository: VerticalsRepository

    var selected: Vertical
    private(set) var snacks: [SnackDTO] = []
    private(set) var qsr: [QsrItemDTO] = []
    private(set) var merch: [MerchDTO] = []
    private(set) var isLoading = false
    var errorMessage: String?

    /// Tabs whose list already loaded — select() skips them (memoized).
    private var loadedVerticals: Set<Vertical> = []

    init(repository: VerticalsRepository, selected: Vertical = .snacks) {
        self.repository = repository
        self.selected = selected
    }

    /// Cards for the selected tab (empty for .mithai — that tab renders the
    /// products flow, never this view model).
    var cards: [VerticalCard] {
        switch selected {
        case .mithai: []
        case .snacks: snacks.map(VerticalCard.snack)
        case .qsr: qsr.map(VerticalCard.qsr)
        case .merch: merch.map(VerticalCard.merch)
        }
    }

    /// Switch the tab, loading its list on first visit.
    func select(_ vertical: Vertical) async {
        guard vertical != .mithai else { return }
        selected = vertical
        guard !loadedVerticals.contains(vertical) else { return }
        await load(vertical)
    }

    /// Re-fetch the selected tab (error retry + pull-to-refresh share this).
    func reload() async {
        guard selected != .mithai else { return }
        await load(selected)
    }

    private func load(_ vertical: Vertical) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            switch vertical {
            case .mithai:
                break
            case .snacks:
                snacks = try await repository.snacks().items
            case .qsr:
                qsr = try await repository.qsr().items
            case .merch:
                merch = try await repository.merch().items
            }
            loadedVerticals.insert(vertical)
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
        } catch {
            errorMessage = "Couldn't load this tab. Try again."
        }
    }

    nonisolated private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load this tab. Try again."
    }
}
