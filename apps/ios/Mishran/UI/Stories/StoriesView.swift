// StoriesView.swift — P2 (Mishran Mobile Apps v1).
// Journal list: hero card for the newest story + rows for the rest, all off
// the cached StoryEntity rows (offline-first — pull-to-refresh swaps the
// set). The view model is the StoryRepository itself (CatalogRepository
// idiom: it owns the rows + loading/error state). Labels resolve from
// packages/i18n-strings (stories.title/empty) via the L() helper —
// Task 20.3 wiring.
import SwiftData
import SwiftUI

struct StoriesView: View {
    @Environment(\.modelContext) private var context
    @State private var repository: StoryRepository?

    var body: some View {
        Group {
            if let repository {
                content(repository)
            } else {
                ProgressView()
            }
        }
        .navigationTitle(L("stories.title"))
        .task {
            guard repository == nil else { return }
            repository = StoryRepository(client: MishranAPIClient(), context: context)
            await repository?.getStories()
        }
    }

    @ViewBuilder
    private func content(_ repository: StoryRepository) -> some View {
        let stories = repository.stories
        if repository.isLoading && stories.isEmpty {
            ProgressView(L("common.loading"))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if stories.isEmpty, repository.errorMessage != nil {
            ContentUnavailableView {
                Label(L("common.load_error"), systemImage: "exclamationmark.triangle")
            } description: {
                Text(repository.errorMessage ?? "")
            } actions: {
                Button(L("common.retry")) {
                    Task { await repository.getStories() }
                }
            }
        } else if stories.isEmpty {
            ContentUnavailableView(
                L("stories.empty"),
                systemImage: "book",
                description: Text("Notes from the kitchen, karigars, and the shop floor.")
            )
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: .mishranSpacingMd) {
                    NavigationLink(value: Route.story(slug: stories[0].slug)) {
                        StoryHeroCard(story: stories[0])
                    }
                    .buttonStyle(.plain)

                    ForEach(stories.dropFirst(), id: \.id) { story in
                        NavigationLink(value: Route.story(slug: story.slug)) {
                            StoryRow(story: story)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, .mishranSpacingMd)
                .padding(.vertical, .mishranSpacingSm)
            }
            .refreshable {
                await repository.getStories()
            }
        }
    }
}

/// Newest story: full-bleed hero with scrim, title + pillar chip + date
/// overlaid (Home hero idiom).
private struct StoryHeroCard: View {
    let story: StoryEntity

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            ProductRemoteImage(imageURL: story.heroImage)
                .frame(height: 220)
                .clipped()
                .accessibilityHidden(true)
            LinearGradient(
                colors: [.clear, .black.opacity(0.7)],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                if let pillar = story.pillar {
                    Text(pillar.capitalized)
                        .font(.mishranBodySm.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, .mishranSpacingSm)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(.white.opacity(0.25)))
                }
                Text(story.title)
                    .font(.mishranBodyXxl.weight(.semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                if let date = StoryFormatting.displayString(story.publishedAt) {
                    Text(date)
                        .font(.mishranBodySm)
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.mishranSpacingLg)
        }
        .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusLg))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(story.title)\(story.pillar.map { ", \($0)" } ?? "")")
        .accessibilityHint("Read this story")
    }
}

/// Older stories: thumbnail + title + pillar chip + date.
private struct StoryRow: View {
    let story: StoryEntity

    var body: some View {
        HStack(spacing: .mishranSpacingMd) {
            ProductRemoteImage(imageURL: story.heroImage)
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: .mishranSpacingXs) {
                Text(story.title)
                    .font(.mishranBodyLg.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandInk)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                HStack(spacing: .mishranSpacingSm) {
                    if let pillar = story.pillar {
                        Text(pillar.capitalized)
                            .font(.mishranBodySm)
                            .foregroundStyle(Color.mishranBrandAccent)
                            .padding(.horizontal, .mishranSpacingSm)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
                    }
                    if let date = StoryFormatting.displayString(story.publishedAt) {
                        Text(date)
                            .font(.mishranBodySm)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(minHeight: 72)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(story.title)\(story.pillar.map { ", \($0)" } ?? "")")
        .accessibilityHint("Read this story")
    }
}
