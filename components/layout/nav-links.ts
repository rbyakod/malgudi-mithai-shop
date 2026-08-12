// components/layout/nav-links.ts
// Pure data module — no React, no next-intl. Kept separate so unit tests can
// assert structure without booting the Next.js runtime.
//
// Translation keys live under the `nav` namespace in messages/*.json. Keys are
// camelCase to match the existing message-file convention (e.g. `Header.orderNow`).

export type NavLink = {href: string; key: string};

export const NAV_LINKS: readonly NavLink[] = [
  {href: "/mithai", key: "nav.mithai"},
  {href: "/build-a-gift", key: "nav.buildAGift"},
  {href: "/qsr", key: "nav.qsr"},
  {href: "/snacks", key: "nav.snacks"},
  {href: "/merch", key: "nav.merch"},
  {href: "/stories", key: "nav.stories"},
  {href: "/stories/farms", key: "nav.farms"},
  {href: "/stories/karigars", key: "nav.karigars"},
  {href: "/stories/journal", key: "nav.journal"},
] as const;
