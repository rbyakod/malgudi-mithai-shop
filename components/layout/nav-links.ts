// components/layout/nav-links.ts
// Pure data module — no React, no next-intl. Kept separate so unit tests can
// assert structure without booting the Next.js runtime.
//
// Translation keys live under the `nav` namespace in messages/*.json. Keys are
// camelCase to match the existing message-file convention (e.g. `Header.orderNow`).

export type NavLink = {href: string; key: string};

// The main navigation, as the Mishran Design System's website brief sets it:
// Gifting · Mithai · Our dairy · Restaurant · Visit.
export const SHOP_NAV_LINKS: readonly NavLink[] = [
  {href: "/gifts", key: "nav.gifting"},
  {href: "/mithai", key: "nav.mithai"},
  {href: "/stories/farms", key: "nav.ourDairy"},
  {href: "/qsr", key: "nav.restaurant"},
  {href: "/visit", key: "nav.visit"},
] as const;

// The rest of the shop: in the menu panel, the footer and the home page's doors.
export const MORE_NAV_LINKS: readonly NavLink[] = [
  {href: "/build-a-gift", key: "nav.buildAGift"},
  {href: "/snacks", key: "nav.snacks"},
  {href: "/merch", key: "nav.merch"},
] as const;

export const STORY_NAV_LINKS: readonly NavLink[] = [
  {href: "/stories", key: "nav.stories"},
  {href: "/stories/farms", key: "nav.farms"},
  {href: "/stories/karigars", key: "nav.karigars"},
  {href: "/stories/journal", key: "nav.journal"},
] as const;

export const NAV_LINKS: readonly NavLink[] = [
  ...SHOP_NAV_LINKS,
  ...MORE_NAV_LINKS,
  ...STORY_NAV_LINKS,
] as const;
