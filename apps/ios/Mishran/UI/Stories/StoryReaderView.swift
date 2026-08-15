// StoryReaderView.swift — P2 (Mishran Mobile Apps v1).
// Story detail: hero, title, pillar chip, date, then the flattened body as
// one Text (the server joins Lexical paragraphs with \n — SwiftUI renders
// those as line breaks). Back is the standard stack pop. Offline fallback:
// the cached StoryEntity row renders everything except the body (the
// excerpt stands in). TODO(i18n): labels match packages/i18n-strings/en.json;
// the hardcode sweep wires String(localized:) later.
import SwiftData
import SwiftUI

/// Reader state: live detail with a cached-row fallback (ProductDetailViewModel
/// idiom — fetch, degrade offline, own the error/retry UI).
@MainActor
@Observable
final class StoryDetailViewModel {
    private let slug: String
    private let repository: StoryRepository
    private let context: ModelContext

    private(set) var detail: StoryDetailDTO?
    private(set) var cached: StoryEntity?
    private(set) var isLoading = false
    var errorMessage: String?

    init(slug: String, repository: StoryRepository, context: ModelContext) {
        self.slug = slug
        self.repository = repository
        self.context = context
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            detail = try await repository.storyDetail(slug: slug)
        } catch {
            // Offline-first: the cached list row carries title/hero/pillar/
            // date + excerpt — everything but the body.
            if let row = StoryEntity.fetch(slug: slug, in: context) {
                cached = row
            } else {
                errorMessage = "Couldn't load this story. Try again."
            }
        }
    }

    /// Presentation tuple merging the live detail over the cached row.
    var presentation: (title: String, pillar: String?, date: String?, hero: String?, body: String?)? {
        if let detail {
            return (detail.title, detail.pillar, detail.publishedAt, detail.heroImage, detail.body)
        }
        if let cached {
            return (cached.title, cached.pillar, cached.publishedAt, cached.heroImage, cached.excerpt)
        }
        return nil
    }
}

struct StoryReaderView: View {
    @State private var viewModel: StoryDetailViewModel

    init(slug: String, repository: StoryRepository, context: ModelContext) {
        _viewModel = State(
            initialValue: StoryDetailViewModel(slug: slug, repository: repository, context: context)
        )
    }

    var body: some View {
        ScrollView {
            if let presentation = viewModel.presentation {
                VStack(alignment: .leading, spacing: .mishranSpacingMd) {
                    ProductRemoteImage(imageURL: presentation.hero)
                        .frame(height: 240)
                        .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusLg))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                        if let pillar = presentation.pillar {
                            Text(pillar.capitalized)
                                .font(.mishranBodySm.weight(.semibold))
                                .foregroundStyle(Color.mishranBrandAccent)
                                .padding(.horizontal, .mishranSpacingSm)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
                                .accessibilityLabel("Pillar: \(pillar)")
                        }
                        Text(presentation.title)
                            .font(.mishranDisplay.weight(.semibold))
                        if let date = StoryFormatting.displayString(presentation.date) {
                            Text(date)
                                .font(.mishranBodySm)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let body = presentation.body, !body.isEmpty {
                        // Plain \n-joined paragraphs — Text breaks lines on \n.
                        Text(body)
                            .font(.mishranBodyLg)
                            .lineSpacing(.mishranSpacingSm)
                    }
                }
                .padding(.mishranSpacingLg)
            } else if viewModel.isLoading {
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, .mishranSpacingXl)
            } else {
                ContentUnavailableView {
                    Label("Couldn't load this story", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(viewModel.errorMessage ?? "")
                } actions: {
                    Button("Try again") {
                        Task { await viewModel.load() }
                    }
                }
                .padding(.top, .mishranSpacingXl)
            }
        }
        .navigationTitle("Journal")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.presentation == nil {
                await viewModel.load()
            }
        }
    }
}
