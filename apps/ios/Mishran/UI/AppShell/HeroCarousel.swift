// HeroCarousel.swift — admin-curated home hero (Mishran Mobile Apps v1).
// The /hero slides replace Home's static featured-product hero when the
// global has content (HomeView keeps the old hero as the fallback, so this
// view only ever renders with slides). Paged TabView (the journal/portal
// idiom, vertical): swipe + tap, default page dots, autoplay every
// autoplayMs with the timer reset on any page change (manual swipes
// included). Autoplay is off entirely for a single slide and whenever the
// user has Reduce Motion on — the carousel then behaves as a plain pager.
import SwiftUI

/// `vertical` + `slug` → the deep link the slide opens (Batch E routes):
/// mithai is the products flow, the other verticals their detail screens.
/// An unrecognized vertical string (contract drift) degrades to the
/// catalog instead of a dead tap.
extension HeroSlideDTO {
    var route: Route {
        switch Vertical(rawValue: vertical) {
        case .mithai:
            .productDetail(slug: slug)
        case .snacks, .qsr, .merch:
            .verticalDetail(vertical: Vertical(rawValue: vertical)!, slug: slug)
        case nil:
            .catalog(vertical: .mithai, family: nil)
        }
    }
}

struct HeroCarousel: View {
    let slides: [HeroSlideDTO]
    let autoplayMs: Int
    let onOpen: (Route) -> Void

    @State private var page = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var autoplayEnabled: Bool {
        slides.count > 1 && !reduceMotion
    }

    var body: some View {
        TabView(selection: $page) {
            ForEach(Array(slides.enumerated()), id: \.element.id) { index, slide in
                HeroSlideCard(slide: slide, index: index, total: slides.count) {
                    onOpen(slide.route)
                }
                .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: slides.count > 1 ? .automatic : .never))
        .frame(height: 260)
        // Page-group semantics: one container label for the group, slides
        // stay individual children (each card announces name + price and
        // its "Slide i of n" position).
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L("home.hero_carousel"))
        // task(id:) restarts the countdown on every page change — a manual
        // swipe resets the autoplay clock — and cancels it off-screen.
        .task(id: "\(autoplayEnabled)-\(page)-\(autoplayMs)") {
            guard autoplayEnabled else { return }
            try? await Task.sleep(for: .milliseconds(autoplayMs))
            guard !Task.isCancelled else { return }
            withAnimation(.easeInOut(duration: 0.35)) {
                page = (page + 1) % slides.count
            }
        }
    }
}

/// One full-bleed slide — the static hero's scrim language with the
/// curated name/price in place of the wordmark + tagline.
private struct HeroSlideCard: View {
    let slide: HeroSlideDTO
    let index: Int
    let total: Int
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            ZStack(alignment: .bottomLeading) {
                ProductRemoteImage(imageURL: slide.imageURL)
                    .frame(height: 260)
                    .clipped()
                LinearGradient(
                    colors: [.black.opacity(0.25), .black.opacity(0.7)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)
                VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                    Text(slide.name)
                        .font(.mishranDisplay.weight(.light))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    if let priceLabel = slide.priceLabel {
                        Text(priceLabel)
                            .font(.mishranBodyLg.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }
                .padding(.mishranSpacingLg)
            }
        }
        .buttonStyle(.plain)
        // ProductCard's "name, price" label idiom. The image itself is
        // accessibility-hidden by ProductRemoteImage's convention, so the
        // admin's imageAlt surfaces here as the value when it adds anything
        // beyond the name, followed by the slide position.
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(accessibilityValue)
    }

    private var accessibilityLabel: String {
        slide.priceLabel.map { "\(slide.name), \($0)" } ?? slide.name
    }

    private var accessibilityValue: String {
        var parts: [String] = []
        if !slide.imageAlt.isEmpty,
           slide.imageAlt.caseInsensitiveCompare(slide.name) != .orderedSame {
            parts.append(slide.imageAlt)
        }
        if total > 1 {
            parts.append(L("home.hero_page", String(index + 1), String(total)))
        }
        return parts.joined(separator: " — ")
    }
}
